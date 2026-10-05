// Seeds the database named by DATABASE_URL with a demo user and a dozen to-dos
// from the last two weeks (`npm run db:seed`). Running it again recreates the
// demo user, so the state is the same, but the user id and sessions are new.
// Runs under the react-server condition (see package.json), so importing
// lib/db.ts and lib/todo-service.ts gets server-only's empty module.
// @next/env is CommonJS without named exports Node can detect.
import nextEnv from "@next/env";
import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";

const DEMO_USER = {
  name: "Demo Cat Person",
  email: "demo@todo-cat.dev",
  password: "cat-person-2026",
};

nextEnv.loadEnvConfig(process.cwd());

// Imported after loading .env: lib/db.ts reads DATABASE_URL when first imported.
const { db } = await import("../lib/db");
const { authOptions } = await import("../lib/auth-options");
const { user } = await import("../lib/schema");
const { seedTodos } = await import("../lib/todo-service");

// Midnight today in local time, so two runs on the same day write the same rows.
const today = new Date();
today.setHours(0, 0, 0, 0);

/** Local time `daysAgo` days before today, at `hour` o'clock. */
function at(daysAgo: number, hour: number): Date {
  const date = new Date(today);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour);
  return date;
}

/** The local calendar day `days` days from today, as `yyyy-mm-dd`. */
function day(days: number): string {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const seeds = [
  {
    title: "Buy the good tuna, not the store brand",
    createdAt: at(13, 9),
    completedAt: at(12, 18),
  },
  {
    title: "Book the vet for the yearly check-up",
    createdAt: at(12, 10),
    dueDate: day(3),
  },
  {
    title: "Replace the scratching post",
    createdAt: at(11, 20),
    completedAt: at(8, 11),
  },
  { title: "Clean the litter box", createdAt: at(10, 8), dueDate: day(0) },
  { title: "Order a bigger cat tree", createdAt: at(9, 21) },
  {
    title: "Call the cat sitter about the weekend",
    createdAt: at(8, 12),
    dueDate: day(-1),
  },
  {
    title: "Vacuum the sofa (again)",
    createdAt: at(7, 17),
    completedAt: at(6, 9),
  },
  { title: "Renew the pet insurance", createdAt: at(6, 14), dueDate: day(10) },
  { title: "Hide the hair ties", createdAt: at(5, 22), completedAt: at(5, 22) },
  { title: "Water the cat grass", createdAt: at(3, 7), dueDate: day(1) },
  {
    title: "Fix the window screen",
    createdAt: at(2, 16),
    dueDate: day(-3),
    completedAt: at(1, 10),
  },
  {
    title: "Learn why she knocks the cups off the table",
    createdAt: at(1, 21),
  },
];

// Deleting the user cascades to sessions, accounts and to-dos.
await db.delete(user).where(eq(user.email, DEMO_USER.email));
const auth = betterAuth(authOptions(db));
const { user: demo } = await auth.api.signUpEmail({ body: DEMO_USER });
const todos = await seedTodos(demo.id, seeds);

db.$client.close();
const open = todos.filter((todo) => !todo.done).length;
console.log(
  `Seeded ${DEMO_USER.email} (password ${DEMO_USER.password}) with ${todos.length} to-dos, ${open} open.`,
);
