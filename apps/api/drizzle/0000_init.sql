CREATE TABLE `days` (
	`date` text PRIMARY KEY NOT NULL,
	`learned` text DEFAULT '' NOT NULL,
	`applied` text DEFAULT '' NOT NULL,
	`next` text DEFAULT '' NOT NULL,
	`commits` text DEFAULT '[]' NOT NULL,
	`areas` text DEFAULT '[]' NOT NULL,
	`post_draft` text DEFAULT '' NOT NULL,
	`posted_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer NOT NULL,
	`prompt` text NOT NULL,
	`answer` text DEFAULT '' NOT NULL,
	`step` integer DEFAULT 0 NOT NULL,
	`due_on` text NOT NULL,
	`last_result` text,
	`retired_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schedule_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text NOT NULL,
	`minutes` integer NOT NULL,
	`track_id` integer NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`track_id` integer NOT NULL,
	`unit_id` integer,
	`block_id` integer,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`paused_at` integer,
	`pause_kind` text,
	`paused_ms` integer DEFAULT 0 NOT NULL,
	`pomodoro` integer DEFAULT true NOT NULL,
	`pomodoros` integer DEFAULT 0 NOT NULL,
	`minutes` integer DEFAULT 0 NOT NULL,
	`learned` text DEFAULT '' NOT NULL,
	`produced` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`block_id`) REFERENCES `schedule_blocks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`unit_label` text NOT NULL,
	`total_units` integer,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_slug_unique` ON `tracks` (`slug`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`track_id` integer NOT NULL,
	`title` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`track_id`) REFERENCES `tracks`(`id`) ON UPDATE no action ON DELETE no action
);
