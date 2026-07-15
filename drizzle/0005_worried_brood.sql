CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`target_id` text,
	`dedupe_key` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_dedupe_unique` ON `notifications` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `notifications_user_time_idx` ON `notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`truthfulness` integer NOT NULL,
	`attitude` integer NOT NULL,
	`responsiveness` integer NOT NULL,
	`professionalism` integer NOT NULL,
	`fulfillment` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`followup` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_conversation_reviewer_unique` ON `reviews` (`conversation_id`,`reviewer_id`);--> statement-breakpoint
ALTER TABLE `conversations` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `success_requested_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `conversations` ADD `updated_at` integer DEFAULT 0 NOT NULL;
