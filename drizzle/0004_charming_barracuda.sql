CREATE TABLE `admin_match_refreshes` (
	`id` text PRIMARY KEY NOT NULL,
	`requested_by` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`processed_profiles` integer DEFAULT 0 NOT NULL,
	`matched_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `admin_match_refresh_status_idx` ON `admin_match_refreshes` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `match_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `match_feedback_user_time_idx` ON `match_feedback` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `match_feedback_match_idx` ON `match_feedback` (`match_id`);--> statement-breakpoint
ALTER TABLE `matches` ADD `role_favorite` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `talent_favorite` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `matches` ADD `algorithm_version` text DEFAULT 'keyword-v1' NOT NULL;