CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "password_hash" TEXT,
  "google_sub" VARCHAR(255),
  "avatar_url" TEXT,
  "is_premium" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_auth_method_check" CHECK ("password_hash" IS NOT NULL OR "google_sub" IS NOT NULL),
  CONSTRAINT "users_email_normalized_check" CHECK ("email" = lower(btrim("email")))
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

CREATE TABLE "sessions" (
  "sid" VARCHAR NOT NULL,
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX "sessions_expire_idx" ON "sessions"("expire");
