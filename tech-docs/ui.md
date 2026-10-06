# UI

## Direction: Cold Ledger

A cat's official account book. Spare, slightly formal, run with indifferent precision. The design does not try to be friendly or cosy; it does its job and expects you to do yours.

**Named direction**: Cold Ledger  
**Key choices**:
- **Type**: Lora (serif) for headings — gives Lissie's proclamations the weight of a formal notice; Space Grotesk (sans) for all other UI — slightly mechanical, not warm
- **Color**: cool off-white base (`#F5F4F8` light, `#100F18` dark) with violet undertones instead of the more common warm cream or neutral grey; amber `#F2B705` as the single accent (Lissie's eyes)
- **Layout**: interactive todo panel sits right of the chat on desktop (fixed `w-80`), stacks below on mobile
- **Signature detail**: the done-state checkbox is a CSS cat eye — an amber oval with a thin vertical slit pupil, achieved without images

## Tokens

All design tokens live in `app/globals.css`. The core palette:

| Token          | Light       | Dark        | Role                                |
| -------------- | ----------- | ----------- | ----------------------------------- |
| `--background` | `#F5F4F8`   | `#100F18`   | Page surface                        |
| `--foreground` | `#1A1825`   | `#EDECF1`   | Body text, icons                    |
| `--muted`      | `#6B6876`   | `#9390A4`   | Secondary text, placeholders        |
| `--line`       | `#D4D0DE`   | `#2B293A`   | Borders, dividers                   |
| `--accent`     | `#F2B705`   | `#F2B705`   | Lissie's eyes: focus rings, cat eye |
| `--danger`     | `#C41E3A`   | `#F97066`   | Errors, destructive actions         |

Font variables are set in `app/layout.tsx` via Next.js `next/font/google`:

| CSS variable          | Font           | Role               |
| --------------------- | -------------- | ------------------ |
| `--font-space-grotesk` | Space Grotesk | `--font-sans` (body) |
| `--font-lora`          | Lora          | `--font-display` (headings) |
| `--font-geist-mono`    | Geist Mono    | `--font-mono` (code) |

`@theme inline` in `globals.css` maps these to Tailwind utilities:
- `font-sans` → Space Grotesk (default body font)
- `font-display` → Lora (used in `PageHeader` h1)
- `font-mono` → Geist Mono

## Shared components

All shared UI components live in `components/ui/`:

- **`Button`** — two variants: `primary` (filled, foreground/background) and `secondary` (outlined, `border-line`)
- **`TextField`** — labelled input, `border-line`, focus shifts border to `foreground` with an `accent` outline ring
- **`Form` / `FormError`** — vertical field stack; `FormError` uses `text-danger` and `role="alert"`
- **`PageHeader`** — `font-display` (`Lora`) h1, `text-muted` subtitle
- **`Shell`** — the single centering column; `narrow` (forms, auth) or `wide` (chat + todo, `h-dvh`)

## The cat-eye checkbox

The done toggle in `TodoList` is a `<button role="checkbox">` with the `.cat-eye` CSS class. The CSS lives in `globals.css` under `/* Cat-eye done toggle */`. Key shapes:

- 20×14 px oval with `border-radius: 50%` (gives the eye shape)
- Undone: transparent fill, `border-line` border; hover shows an amber border tint
- Done (`.cat-eye--done`): amber fill + amber border; `::after` pseudo-element adds the vertical slit pupil (`width: 4px`, `top: 2px`, `bottom: 2px`, `translateX(-50%)`)

## CopilotKit styling gotchas

CopilotKit v2's chat renders inside `[data-copilotkit]` and reads a large set of shadcn CSS custom properties (`--background`, `--foreground`, `--muted`, `--accent`, etc.) that overlap in name with the app's own tokens but have different meanings (e.g., their `--accent` is a surface hover colour, not the brand amber).

The fix, documented in `globals.css`:

1. The `.lissie-chat` wrapper captures the app's values under private `--chat-*` aliases while they are still in scope (before CopilotKit redeclares them on `[data-copilotkit]`).
2. The rule `:root .lissie-chat [data-copilotkit]` sets CopilotKit's tokens from the `--chat-*` aliases. Because this rule is anchored to `:root`, its specificity outranks CopilotKit's own `.dark [data-copilotkit]` dark-mode overrides.
3. Dark mode is applied with a `dark` class on the `.lissie-chat` div (toggled by `usePrefersDark` in `lissie-chat.tsx`), which CopilotKit reads.
4. `--cpk-default-font-family` is set to `var(--font-space-grotesk)` so the chat uses the same typeface as the rest of the app.

## Browser todo mutations

The interactive todo list (`components/chat/todo-list.tsx`) uses Next.js server actions (`app/todo-actions.ts`) for all mutations: `addTodoAction`, `toggleTodoAction`, `deleteTodoAction`. Each action follows the adapter pattern from `tech-docs/architecture.md`: validate input with a contract schema, resolve the user with `getUserId`, call the todo service, then call `revalidatePath('/')` to refresh the server-rendered todo list. Local state in `TodoList` covers only UI concerns: the pending delete confirmation and the `useTransition` pending flag.

When Lissie changes a todo via her agent tools, `LissieToolCalls` calls `router.refresh()`, which triggers the same page re-render and passes fresh todos to `TodoList`.
