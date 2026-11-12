CREATE TABLE "reading_analysis_requests" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "article_id" UUID NOT NULL,
  "base_version" INTEGER NOT NULL,
  "base_hash" VARCHAR(64) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "model" VARCHAR(100) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "provider_called" BOOLEAN NOT NULL DEFAULT true,
  "result" JSONB,
  "applied_hash" VARCHAR(64),
  "applied_version" INTEGER,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reading_analysis_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reading_analysis_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reading_analysis_requests_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "reading_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reading_analysis_requests_status_check" CHECK ("status" IN ('pending', 'ready', 'failed')),
  CONSTRAINT "reading_analysis_requests_version_check" CHECK ("base_version" >= 0 AND ("applied_version" IS NULL OR "applied_version" = "base_version" + 1)),
  CONSTRAINT "reading_analysis_requests_applied_check" CHECK (("applied_hash" IS NULL) = ("applied_version" IS NULL))
);
CREATE INDEX "reading_analysis_requests_user_id_request_hash_created_at_idx" ON "reading_analysis_requests"("user_id", "request_hash", "created_at");
CREATE INDEX "reading_analysis_requests_user_id_created_at_idx" ON "reading_analysis_requests"("user_id", "created_at");
CREATE INDEX "reading_analysis_requests_created_at_idx" ON "reading_analysis_requests"("created_at");
CREATE INDEX "reading_analysis_requests_article_id_idx" ON "reading_analysis_requests"("article_id");
