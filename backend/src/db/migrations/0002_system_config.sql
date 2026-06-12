CREATE TABLE IF NOT EXISTS "system_config" (
  "key"         text PRIMARY KEY NOT NULL,
  "category"    text NOT NULL,
  "value"       text,
  "is_secret"   boolean NOT NULL DEFAULT true,
  "label"       text NOT NULL,
  "description" text,
  "updated_by"  uuid REFERENCES "users"("id"),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);
