CREATE TABLE `match_exclusions` (
	`role_profile_id` text NOT NULL,
	`talent_profile_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`role_profile_id`, `talent_profile_id`),
	FOREIGN KEY (`role_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`talent_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match_runs` (
	`profile_id` text NOT NULL,
	`week_key` text NOT NULL,
	`content_version` integer NOT NULL,
	`candidate_count` integer DEFAULT 0 NOT NULL,
	`matched_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`profile_id`, `week_key`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profile_keywords` (
	`profile_id` text NOT NULL,
	`keyword` text NOT NULL,
	`type` text NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`profile_id`, `keyword`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_keywords_lookup_idx` ON `profile_keywords` (`type`,`keyword`);--> statement-breakpoint
CREATE TABLE `publication_cycles` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`month_key` text NOT NULL,
	`delete_count` integer DEFAULT 0 NOT NULL,
	`recreate_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `type`, `month_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `profiles` ADD `search_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `embedding` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `content_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `last_matched_week` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `deleted_at` integer;