ALTER TABLE "sessions" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pause_kind" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "paused_ms" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pomodoro" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pomodoros" integer DEFAULT 0 NOT NULL;