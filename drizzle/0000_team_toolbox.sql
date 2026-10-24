CREATE TABLE IF NOT EXISTS "google_credentials" (
  "mode" text PRIMARY KEY NOT NULL,
  "encrypted_payload" text NOT NULL,
  "email" text,
  "permissions_ready" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "google_credentials_mode_check" CHECK ("mode" IN ('service_account', 'oauth'))
);

CREATE TABLE IF NOT EXISTS "sheet_connectors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "auth_mode" text NOT NULL,
  "spreadsheet_id" text NOT NULL,
  "sheet_url" text DEFAULT '' NOT NULL,
  "sheet" text NOT NULL,
  "range" text DEFAULT 'A:Z' NOT NULL,
  "header_row" boolean DEFAULT true NOT NULL,
  "primary_key" text DEFAULT 'user_id' NOT NULL,
  "import_mode" text DEFAULT 'upsert' NOT NULL,
  "frequency" text DEFAULT 'daily' NOT NULL,
  "schedule_time" text DEFAULT '03:00' NOT NULL,
  "timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
  "field_mapping" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "test_status" text DEFAULT 'untested' NOT NULL,
  "last_tested_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sheet_connectors_auth_mode_check" CHECK ("auth_mode" IN ('service_account', 'oauth')),
  CONSTRAINT "sheet_connectors_import_mode_check" CHECK ("import_mode" IN ('append', 'upsert', 'replace')),
  CONSTRAINT "sheet_connectors_test_status_check" CHECK ("test_status" IN ('untested', 'passed', 'failed'))
);

CREATE INDEX IF NOT EXISTS "sheet_connectors_updated_at_idx" ON "sheet_connectors" ("updated_at" DESC);
