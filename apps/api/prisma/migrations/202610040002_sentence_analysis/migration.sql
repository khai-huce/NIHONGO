-- Private Gemini request cache and quota claims. No changes to learning progress.
CREATE TABLE "sentence_analysis_requests" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "model" VARCHAR(100) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "result" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "sentence_analysis_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sentence_analysis_requests_status_check" CHECK ("status" IN ('pending', 'ready', 'failed')),
  CONSTRAINT "sentence_analysis_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "sentence_analysis_requests_user_id_request_hash_created_at_idx" ON "sentence_analysis_requests"("user_id", "request_hash", "created_at");
CREATE INDEX "sentence_analysis_requests_user_id_created_at_idx" ON "sentence_analysis_requests"("user_id", "created_at");
CREATE INDEX "sentence_analysis_requests_created_at_idx" ON "sentence_analysis_requests"("created_at");
