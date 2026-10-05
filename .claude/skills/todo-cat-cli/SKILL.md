---
name: todo-cat-cli
description: Manage a person's to-do list with the `todo-cat` CLI, which is the agent's way into the todo-cat app. It covers adding, finding, completing, reopening, rescheduling and deleting to-dos, and answering questions about the list ("what's overdue?", "what did I add last week?", "what did I finish yesterday?"). Use this skill whenever someone talks about their to-dos, tasks, reminders or todo-cat list, or asks you to remember something for later, even if they never name the CLI. Don't use it for changing the todo-cat codebase itself.
---

# Managing a to-do list with todo-cat

You are acting for a person whose to-do list lives on a todo-cat server. The `todo-cat` CLI is how you reach it. Inside the todo-cat repo, run it as `npx todo-cat`. Anywhere else, use `todo-cat` if it is on the PATH.

`todo-cat --help` and `todo-cat <command> --help` are the source of truth for commands, flags, output and exit codes. If this skill and the help disagree, follow the help. This skill covers what the help can't: workflows and pitfalls.

The CLI never prompts, writes results to stdout and errors to stderr, and supports `--json` on every command. The server is `TODO_CAT_URL` (default `http://localhost:3000`).

## 1. Check the login first

Run `todo-cat whoami` once before the first real command. The exit code tells you what to do:

- **0**: you are logged in, and the output names the account. Carry on.
- **3 `[unauthorized]`**: not logged in. Stop and tell the person (see below).
- **1 `[server-unreachable]`**: the server is down or `TODO_CAT_URL` is wrong. Say so, with the URL from the message. In the todo-cat repo, `npm run dev` starts the server; offer to run it rather than starting it silently.

When the login is missing, the person has to grant you access to their account. Only they can do that, so tell them plainly, for example:

> You're not logged in to todo-cat at http://localhost:3000, so I can't see your list yet. Run `! npx todo-cat login` and approve the code in your browser. Or say the word and I'll start the login and hand you the code and the link.

If they want you to start it, run `todo-cat login` in the background. It prints a code (`ABCD-EFGH`) and a link to stderr right away, then waits up to 30 minutes for approval. Pass both on to the person, wait for the command to exit 0, and then continue with the original request.

Never work around a missing login. That means you don't:

- read or write the SQLite database;
- sign in with a password through the API or a browser;
- create accounts or run `npm run db:seed`;
- edit `credentials.json` or make up tokens;
- call `/api/todos` with curl.

Each of these either skips the person's consent or acts as the wrong user. You'd end up reading or changing a list that may not be theirs, and that's worse than doing nothing.

## 2. Find a to-do by its title before you act on its id

People say "the vet thing". Commands need a UUID. Look the id up every time, right before you act on it. Never guess an id, and don't reuse one from an earlier conversation.

```bash
npx todo-cat list --status all --search vet --json
```

- `list` shows only **open** to-dos by default. To reopen or inspect something already finished, pass `--status done` or `--status all`.
- `--search` is a case-insensitive substring match on the title only. Search for one distinctive word ("vet", "tuna"), not the person's whole phrase, which rarely appears verbatim.
- **One match**: act on it.
- **Several matches**: if exactly one fits the request (say, the only open one when they asked to tick it off), take it. Otherwise ask, quoting titles and due dates, not ids.
- **No match**: try a synonym or a shorter word, then `--status all`. If it still isn't there, say so. Don't create a to-do the person didn't ask for.

Before `add`, a quick search for the same title avoids duplicates. If an open one already exists, mention it instead of adding a second copy.

## 3. Answer questions with `--json` and jq

The text output is a checklist for humans. It hides `createdAt` and `completedAt`, and its format may change. For anything you compute, use `--json`. `list --json` prints an array of to-dos:

```json
{"id":"…","title":"call the vet","dueDate":"2026-10-06","done":false,
 "createdAt":"2026-10-05T13:43:49.343Z","completedAt":null}
```

`dueDate` is a calendar day (`yyyy-mm-dd`) or `null`. `createdAt` and `completedAt` are UTC timestamps; `completedAt` is `null` while the to-do is open. Pass `--status all` whenever the question could involve finished to-dos.

```bash
today=$(date +%F)
# overdue: open, due before today
npx todo-cat list --json | jq --arg t "$today" '[.[] | select(.dueDate != null and .dueDate < $t)]'
# due in a range (inclusive)
npx todo-cat list --json | jq --arg a 2026-10-05 --arg b 2026-10-11 '[.[] | select(.dueDate >= $a and .dueDate <= $b)]'
# added in a range: createdAt is a timestamp, so the end bound is the day after
npx todo-cat list --status all --json | jq --arg a 2026-09-28 --arg b 2026-10-05 '[.[] | select(.createdAt >= $a and .createdAt < $b)] | map(.title)'
```

ISO dates and timestamps compare correctly as strings, so you don't need any date parsing in jq.

Answer in plain words: titles, due dates and counts. Leave out raw JSON and ids unless the person asks for them.

## 4. Due dates are not creation dates

There are three different dates, and the person's wording picks one:

| They say | They mean | Field |
| --- | --- | --- |
| "what's due / what do I have to do next week", "anything overdue?" | when it should be done | `dueDate` |
| "what did I add / write down / put on the list last week" | when it was added | `createdAt` |
| "what did I get done / finish / tick off last week" | when it was completed | `completedAt` |

- If the wording fits more than one row ("my to-dos from last week"), pick the most plausible reading and say which one you used, or ask.
- Resolve relative dates yourself against today (`date +%F`) and state the exact range: "last week, Mon 2026-09-28 to Sun 2026-10-04". Weeks start on Monday unless the person says otherwise.
- `--due` accepts only `yyyy-mm-dd`, so convert "tomorrow" or "Friday" first. Don't invent a due date the person didn't give. Use `edit <id> --no-due` to remove one.
- `createdAt` and `completedAt` are UTC. Near midnight, a UTC date can differ from the person's local date. Mention this only when it changes the answer.

## 5. Destructive commands only when asked

`delete` is permanent: there is no trash and no undo. Run it only when the person asks to delete or remove specific to-dos.

- "Done", "finished" and "tick off" mean `done`, not `delete`. A completed to-do stays in the list's history, and `reopen` can bring it back.
- `--yes` is the CLI's guard against accidents, not the person's consent. Pass it only once they've actually asked for the deletion.
- For vague or bulk requests ("clean up my list", "get rid of the old stuff"), first list exactly what would go, then delete after they confirm. If they named the to-dos explicitly, go ahead.
- Overwriting a title with `edit --title` and running `logout` (which revokes the session) also wait for a request.

## 6. Errors

The error code in `error [<code>]` (or in the `--json` error body on stderr) tells you the next step:

- **`validation-failed` / `usage` (exit 2)**: your input was wrong, usually the date format or an empty title. Fix it and retry. Don't ask the person.
- **`unauthorized` (exit 3)**: the session expired or was revoked. Go back to section 1.
- **`todo-not-found` (exit 4)**: the id is stale or wrong. Search again by title.
- **`server-unreachable` (exit 1)**: see section 1. Other exit-1 errors: report the message as is.

After a change, tell the person what changed in their terms ("Ticked off *call the vet*"), based on what the command printed rather than on what you expected it to print.
