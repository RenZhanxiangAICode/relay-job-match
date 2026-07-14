CREATE TABLE `ai_parse_usage` (
	`user_id` text NOT NULL,
	`day_key` text NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `day_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
