CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`file_path` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `company_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text DEFAULT 'Air Safety System' NOT NULL,
	`logo` text,
	`email` text,
	`phone` text,
	`address` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`is_read` integer DEFAULT 0 NOT NULL,
	`related_report_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`related_report_id`) REFERENCES `reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`report_type` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`submitted_by` text NOT NULL,
	`is_anonymous` integer DEFAULT 0 NOT NULL,
	`description` text NOT NULL,
	`flight_number` text,
	`aircraft_type` text,
	`route` text,
	`event_date_time` text,
	`contributing_factors` text,
	`corrective_actions` text,
	`plan_image` text,
	`elev_image` text,
	`plan_units` text,
	`plan_grid_x` integer,
	`plan_grid_y` integer,
	`plan_distance_x` real,
	`plan_distance_y` real,
	`elev_grid_col` integer,
	`elev_grid_row` integer,
	`elev_distance_horiz_m` real,
	`elev_distance_vert_ft` real,
	`location` text,
	`phase_of_flight` text,
	`risk_level` text,
	`follow_up_actions` text,
	`ground_crew_names` text,
	`vehicle_involved` text,
	`damage_type` text,
	`corrective_steps` text,
	`department` text,
	`nonconformity_type` text,
	`root_cause` text,
	`responsible_person` text,
	`preventive_actions` text,
	`extra_data` text,
	`discretion_reason` text,
	`time_extension` text,
	`crew_fatigue_details` text,
	`final_decision` text,
	`potential_impact` text,
	`prevention_suggestions` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`sid` text PRIMARY KEY NOT NULL,
	`sess` text NOT NULL,
	`expire` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IDX_session_expire` ON `sessions` (`expire`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`password` text,
	`first_name` text,
	`last_name` text,
	`profile_image_url` text,
	`role` text DEFAULT 'captain' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);