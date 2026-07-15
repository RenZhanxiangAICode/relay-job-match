CREATE TABLE `oauth_identities` (
	`provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`provider`, `provider_subject`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauth_identities_user_idx` ON `oauth_identities` (`user_id`);