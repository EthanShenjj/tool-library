CREATE TABLE IF NOT EXISTS "saved_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "favorite" boolean DEFAULT false NOT NULL,
  "source_name" text NOT NULL,
  "content" text NOT NULL,
  "files" jsonb NOT NULL,
  "total_bytes" integer NOT NULL,
  "archive_name" text NOT NULL,
  "archive_base64" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "saved_skills_updated_at_idx" ON "saved_skills" ("updated_at" DESC);
