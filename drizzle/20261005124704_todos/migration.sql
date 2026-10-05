CREATE TABLE `todos` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`done` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT `fk_todos_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT "todos_due_date_is_a_day" CHECK("due_date" is null or date("due_date") = "due_date"),
	CONSTRAINT "todos_completed_at_iff_done" CHECK(("done" = 1) = ("completed_at" is not null))
);
--> statement-breakpoint
CREATE INDEX `todos_user_id_idx` ON `todos` (`user_id`);