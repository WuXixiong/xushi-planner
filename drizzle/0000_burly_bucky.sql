CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`estimate_minutes` integer DEFAULT 30 NOT NULL,
	`priority` integer DEFAULT 2 NOT NULL,
	`due_date` text,
	`completed` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_parent` ON `tasks` (`owner_id`,`parent_id`);--> statement-breakpoint
CREATE TABLE `time_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`task_id` text,
	`kind` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_time_blocks_owner_date` ON `time_blocks` (`owner_id`,`date`);