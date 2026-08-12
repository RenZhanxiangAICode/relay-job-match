CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`detail` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `admin_audit_time_idx` ON `admin_audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`scope` text NOT NULL,
	`key_hash` text NOT NULL,
	`window_key` text NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`scope`, `key_hash`, `window_key`)
);
--> statement-breakpoint
CREATE TABLE `data_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`execute_at` integer,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `data_requests_user_time_idx` ON `data_requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `product_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`event` text NOT NULL,
	`target_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `product_events_event_time_idx` ON `product_events` (`event`,`created_at`);--> statement-breakpoint
ALTER TABLE `conversations` ADD `outcome_stage` text DEFAULT 'chatting' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `outcome_requested_stage` text;--> statement-breakpoint
ALTER TABLE `conversations` ADD `outcome_requested_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `email_verification_codes` ADD `delivery_id` text;--> statement-breakpoint
ALTER TABLE `email_verification_codes` ADD `delivery_token_hash` text;--> statement-breakpoint
ALTER TABLE `jury_assignments` ADD `round` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `jury_assignments` ADD `status` text DEFAULT 'assigned' NOT NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `conversation_id` text REFERENCES conversations(id);--> statement-breakpoint
ALTER TABLE `reports` ADD `evidence_status` text DEFAULT 'user_redacted' NOT NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `round` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `valid_votes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `resolved_at` integer;--> statement-breakpoint
ALTER TABLE `reviews` ADD `response` text;--> statement-breakpoint
ALTER TABLE `reviews` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `publish_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `jury_eligible` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `jury_permanently_revoked` integer DEFAULT false NOT NULL;--> statement-breakpoint
DELETE FROM `reputation_events` WHERE `evidence_ref` IS NOT NULL AND rowid NOT IN (
	SELECT MIN(rowid) FROM `reputation_events` WHERE `evidence_ref` IS NOT NULL GROUP BY `user_id`,`reason`,`evidence_ref`
);--> statement-breakpoint
CREATE UNIQUE INDEX `reputation_event_once_unique` ON `reputation_events` (`user_id`,`reason`,`evidence_ref`);
--> statement-breakpoint
UPDATE `users` SET `status` = 'active', `reputation` = 0, `jury_eligible` = 0 WHERE `status` = 'banned';
--> statement-breakpoint
UPDATE `reports` SET `status` = 'substantiated' WHERE `status` = 'banned';
--> statement-breakpoint
UPDATE `jury_votes` SET `verdict` = 'substantiated' WHERE `verdict` = 'ban';
--> statement-breakpoint
UPDATE `jury_votes` SET `verdict` = 'unsubstantiated' WHERE `verdict` = 'keep';
