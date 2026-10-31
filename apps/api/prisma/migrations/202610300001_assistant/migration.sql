-- Quota/idempotency metadata only: conversations and responses are deliberately absent.
CREATE TABLE "assistant_requests" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "model" VARCHAR(100) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "assistant_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "assistant_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "assistant_requests_status_check" CHECK ("status" IN ('pending', 'ready', 'failed'))
);
CREATE INDEX "assistant_requests_user_id_request_hash_created_at_idx" ON "assistant_requests"("user_id", "request_hash", "created_at");
CREATE INDEX "assistant_requests_user_id_created_at_idx" ON "assistant_requests"("user_id", "created_at");
CREATE INDEX "assistant_requests_created_at_idx" ON "assistant_requests"("created_at");
