CREATE TABLE IF NOT EXISTS "platform_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "platform" text NOT NULL,
  "website_url" text DEFAULT '' NOT NULL,
  "encrypted_payload" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_accounts_updated_at_idx" ON "platform_accounts" ("updated_at" DESC);
