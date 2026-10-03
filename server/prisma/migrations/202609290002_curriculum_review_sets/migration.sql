CREATE TABLE "curriculum_review_sets" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "course_id" UUID NOT NULL,
  "lesson_ids" UUID[] NOT NULL, "selection_hash" VARCHAR(64) NOT NULL,
  "progress" JSONB NOT NULL DEFAULT '{}', "progress_version" INTEGER NOT NULL DEFAULT 0,
  "completed_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "curriculum_review_sets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "curriculum_review_sets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "curriculum_review_sets_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "curriculum_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "curriculum_review_sets_selection_key" ON "curriculum_review_sets"("user_id", "course_id", "selection_hash");
CREATE INDEX "curriculum_review_sets_course_id_idx" ON "curriculum_review_sets"("course_id");

CREATE TABLE "curriculum_review_results" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "review_set_id" UUID NOT NULL,
  "lesson_name" VARCHAR(200) NOT NULL, "lesson_version" INTEGER NOT NULL, "kind" VARCHAR(8) NOT NULL,
  "mode" VARCHAR(8) NOT NULL, "total" INTEGER NOT NULL, "correct" INTEGER NOT NULL, "answers" JSONB NOT NULL,
  "submission_hash" VARCHAR(64) NOT NULL, "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "curriculum_review_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "curriculum_review_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "curriculum_review_results_review_set_id_fkey" FOREIGN KEY ("review_set_id") REFERENCES "curriculum_review_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "curriculum_review_results_latest_idx" ON "curriculum_review_results"("user_id", "review_set_id", "kind", "completed_at");
CREATE INDEX "curriculum_review_results_review_set_id_idx" ON "curriculum_review_results"("review_set_id");
