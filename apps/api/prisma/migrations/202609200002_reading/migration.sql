CREATE TABLE "reading_articles" (
  "id" UUID NOT NULL PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "scope" VARCHAR(16) NOT NULL DEFAULT 'personal' CHECK ("scope" IN ('personal', 'library')),
  "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version" >= 0),
  "content" JSONB NOT NULL,
  "published_content" JSONB,
  "published_version" INTEGER,
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "reading_articles_user_id_scope_created_at_idx" ON "reading_articles"("user_id", "scope", "created_at");
CREATE TABLE "reading_audio" (
  "id" UUID NOT NULL PRIMARY KEY,
  "article_id" UUID NOT NULL REFERENCES "reading_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "article_version" INTEGER NOT NULL,
  "content_hash" VARCHAR(64) NOT NULL,
  "voice" VARCHAR(64) NOT NULL,
  "provider" VARCHAR(32) NOT NULL DEFAULT 'edge-tts',
  "status" VARCHAR(16) NOT NULL CHECK ("status" IN ('generating', 'ready', 'failed')),
  "claim_token" UUID NOT NULL,
  "lease_until" TIMESTAMPTZ(3) NOT NULL,
  "segments" JSONB NOT NULL DEFAULT '[]',
  "duration_sec" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "character_count" INTEGER NOT NULL CHECK ("character_count" BETWEEN 1 AND 3000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reading_audio_article_id_article_version_voice_key" UNIQUE ("article_id", "article_version", "voice")
);
CREATE INDEX "reading_audio_created_at_status_idx" ON "reading_audio"("created_at", "status");
