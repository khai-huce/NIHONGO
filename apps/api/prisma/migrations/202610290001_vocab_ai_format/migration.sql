CREATE TABLE "vocab_ai_requests" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "model" VARCHAR(100) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "provider_called" BOOLEAN NOT NULL DEFAULT true,
  "result" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "vocab_ai_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vocab_ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "vocab_ai_requests_user_id_request_hash_created_at_idx" ON "vocab_ai_requests"("user_id", "request_hash", "created_at");
CREATE INDEX "vocab_ai_requests_user_id_created_at_idx" ON "vocab_ai_requests"("user_id", "created_at");
CREATE INDEX "vocab_ai_requests_created_at_idx" ON "vocab_ai_requests"("created_at");
