CREATE TABLE "shadowing_videos" (
  "id" UUID PRIMARY KEY, "owner_id" UUID, "scope" VARCHAR(16) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0, "initial_hash" VARCHAR(64) NOT NULL,
  "content" JSONB NOT NULL, "source_id" VARCHAR(64), "published_content" JSONB,
  "published_source_id" VARCHAR(64), "published_version" INTEGER,
  "archived_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "shadowing_videos_scope_check" CHECK ((scope = 'personal' AND owner_id IS NOT NULL) OR (scope = 'library' AND owner_id IS NULL)),
  CONSTRAINT "shadowing_videos_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "shadowing_videos_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT,
  CONSTRAINT "shadowing_videos_published_source_id_fkey" FOREIGN KEY ("published_source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT
);
CREATE INDEX "shadowing_videos_owner_id_archived_at_created_at_idx" ON "shadowing_videos"("owner_id", "archived_at", "created_at");
CREATE INDEX "shadowing_videos_scope_archived_at_published_version_idx" ON "shadowing_videos"("scope", "archived_at", "published_version");
CREATE TABLE "shadowing_studies" (
  "user_id" UUID NOT NULL, "video_id" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 0,
  "data" JSONB NOT NULL DEFAULT '{}', "updated_at" TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY ("user_id", "video_id"),
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("video_id") REFERENCES "shadowing_videos"("id") ON DELETE CASCADE
);
CREATE TABLE "shadowing_grades" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL, "video_id" UUID NOT NULL,
  "sentence_id" UUID NOT NULL, "content_hash" VARCHAR(64) NOT NULL, "mode" VARCHAR(8) NOT NULL,
  "result" JSONB NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("video_id") REFERENCES "shadowing_videos"("id") ON DELETE CASCADE,
  CONSTRAINT "shadowing_grades_mode_check" CHECK (mode IN ('puzzle', 'typing'))
);
CREATE UNIQUE INDEX "shadowing_grades_user_id_video_id_sentence_id_content_hash_mode_key" ON "shadowing_grades"("user_id", "video_id", "sentence_id", "content_hash", "mode");
CREATE INDEX "shadowing_grades_user_id_video_id_created_at_idx" ON "shadowing_grades"("user_id", "video_id", "created_at");
CREATE TABLE "shadowing_attempts" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL, "video_id" UUID NOT NULL,
  "action" VARCHAR(8) NOT NULL, "request_hash" VARCHAR(64) NOT NULL, "result" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("video_id") REFERENCES "shadowing_videos"("id") ON DELETE CASCADE
);
CREATE INDEX "shadowing_attempts_user_id_video_id_idx" ON "shadowing_attempts"("user_id", "video_id");
CREATE TABLE "shadowing_ai_requests" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL, "request_hash" VARCHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending', "content" JSONB, "error" VARCHAR(1000),
  "lease_until" TIMESTAMPTZ(3) NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "shadowing_ai_requests_status_check" CHECK (status IN ('pending', 'ready', 'failed'))
);
CREATE INDEX "shadowing_ai_requests_user_id_created_at_idx" ON "shadowing_ai_requests"("user_id", "created_at");
CREATE INDEX "shadowing_ai_requests_status_created_at_idx" ON "shadowing_ai_requests"("status", "created_at");
CREATE INDEX "shadowing_ai_requests_created_at_idx" ON "shadowing_ai_requests"("created_at");
