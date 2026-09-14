CREATE TABLE "vocab_study_results" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "lesson_name" VARCHAR(100) NOT NULL,
    "lesson_version" INTEGER NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "mode" VARCHAR(8) NOT NULL,
    "total" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "submission_hash" VARCHAR(64) NOT NULL,
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocab_study_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vocab_study_results_user_id_lesson_id_kind_completed_at_idx"
    ON "vocab_study_results"("user_id", "lesson_id", "kind", "completed_at");

ALTER TABLE "vocab_study_results" ADD CONSTRAINT "vocab_study_results_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
