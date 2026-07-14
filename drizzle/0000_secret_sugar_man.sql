CREATE TABLE `appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`user_id` text NOT NULL,
	`statement` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appeals_report_unique` ON `appeals` (`report_id`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conversations_match_unique` ON `conversations` (`match_id`);--> statement-breakpoint
CREATE TABLE `jury_assignments` (
	`report_id` text NOT NULL,
	`juror_id` text NOT NULL,
	`assigned_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`report_id`, `juror_id`),
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`juror_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jury_assignments_juror_idx` ON `jury_assignments` (`juror_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `jury_votes` (
	`report_id` text NOT NULL,
	`juror_id` text NOT NULL,
	`verdict` text NOT NULL,
	`voted_at` integer NOT NULL,
	`upheld_after_appeal` integer,
	PRIMARY KEY(`report_id`, `juror_id`),
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`juror_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`role_profile_id` text NOT NULL,
	`talent_profile_id` text NOT NULL,
	`score` integer NOT NULL,
	`reasons` text NOT NULL,
	`risks` text NOT NULL,
	`verify_on_meeting` text NOT NULL,
	`week_key` text NOT NULL,
	`role_decision` text DEFAULT 'pending' NOT NULL,
	`talent_decision` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`role_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`talent_profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_pair_week_unique` ON `matches` (`role_profile_id`,`talent_profile_id`,`week_key`);--> statement-breakpoint
CREATE INDEX `matches_role_week_idx` ON `matches` (`role_profile_id`,`week_key`);--> statement-breakpoint
CREATE INDEX `matches_talent_week_idx` ON `matches` (`talent_profile_id`,`week_key`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_conversation_time_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`anonymous_code` text NOT NULL,
	`payload` text NOT NULL,
	`completion` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_user_type_unique` ON `profiles` (`user_id`,`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_anonymous_code_unique` ON `profiles` (`anonymous_code`);--> statement-breakpoint
CREATE INDEX `profiles_pool_idx` ON `profiles` (`type`,`status`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`reported_user_id` text NOT NULL,
	`category` text NOT NULL,
	`summary` text NOT NULL,
	`evidence` text NOT NULL,
	`status` text DEFAULT 'jury' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reported_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `reputation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reason` text NOT NULL,
	`delta` integer NOT NULL,
	`evidence_ref` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reputation_user_time_idx` ON `reputation_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified_at` integer,
	`reputation` integer DEFAULT 80 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);