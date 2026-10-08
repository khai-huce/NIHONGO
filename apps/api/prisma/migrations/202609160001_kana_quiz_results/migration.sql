CREATE TABLE "kana_quiz_results" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "catalog_id" VARCHAR(32) NOT NULL,
  "mode" VARCHAR(16) NOT NULL,
  "total" INTEGER NOT NULL,
  "correct" INTEGER NOT NULL,
  "answers" JSONB NOT NULL,
  "submission_hash" VARCHAR(64) NOT NULL,
  "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kana_quiz_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kana_quiz_results_score_check" CHECK ("total" > 0 AND "correct" >= 0 AND "correct" <= "total")
);

CREATE INDEX "kana_quiz_results_user_id_completed_at_idx" ON "kana_quiz_results"("user_id", "completed_at");
ALTER TABLE "kana_quiz_results" ADD CONSTRAINT "kana_quiz_results_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
