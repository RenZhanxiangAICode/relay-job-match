CREATE TABLE `company_complaints` (
	`id` text PRIMARY KEY NOT NULL,
	`company_email` text NOT NULL,
	`profile_code` text NOT NULL,
	`reason` text NOT NULL,
	`statement` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE INDEX `company_complaints_status_time_idx` ON `company_complaints` (`status`,`created_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reviews` (
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
	`response` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`publish_at` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_reviews`("id", "conversation_id", "reviewer_id", "truthfulness", "attitude", "responsiveness", "professionalism", "fulfillment", "comment", "followup", "response", "status", "publish_at", "created_at") SELECT "id", "conversation_id", "reviewer_id", "truthfulness", "attitude", "responsiveness", "professionalism", "fulfillment", "comment", "followup", "response", "status", "publish_at", "created_at" FROM `reviews`;--> statement-breakpoint
DROP TABLE `reviews`;--> statement-breakpoint
ALTER TABLE `__new_reviews` RENAME TO `reviews`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_conversation_reviewer_unique` ON `reviews` (`conversation_id`,`reviewer_id`);--> statement-breakpoint
CREATE VIRTUAL TABLE `profile_search` USING fts5(`profile_id` UNINDEXED, `type` UNINDEXED, `content`, tokenize='unicode61');
