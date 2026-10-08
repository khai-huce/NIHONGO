CREATE TABLE "curriculum_courses" (
  "id" UUID NOT NULL, "slug" VARCHAR(80) NOT NULL, "version" INTEGER NOT NULL DEFAULT 0,
  "draft" JSONB NOT NULL, "source_id" VARCHAR(64), "published_source_id" VARCHAR(64), "published_version" INTEGER,
  "title" VARCHAR(100) NOT NULL DEFAULT '', "subtitle" VARCHAR(200) NOT NULL DEFAULT '',
  "description" VARCHAR(2000) NOT NULL DEFAULT '', "level" VARCHAR(2) NOT NULL DEFAULT 'N5',
  "style" VARCHAR(16) NOT NULL DEFAULT 'custom', "topic_count" INTEGER NOT NULL DEFAULT 0,
  "lesson_count" INTEGER NOT NULL DEFAULT 0, "word_count" INTEGER NOT NULL DEFAULT 0,
  "archived_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "curriculum_courses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "curriculum_courses_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "curriculum_courses_published_source_id_fkey" FOREIGN KEY ("published_source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "curriculum_courses_slug_key" ON "curriculum_courses"("slug");
CREATE INDEX "curriculum_courses_archived_at_published_version_idx" ON "curriculum_courses"("archived_at", "published_version");

CREATE TABLE "curriculum_topics" (
  "id" UUID NOT NULL, "course_id" UUID NOT NULL, "title" VARCHAR(100) NOT NULL DEFAULT '',
  "japanese" VARCHAR(200) NOT NULL DEFAULT '', "sort_order" INTEGER NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "curriculum_topics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "curriculum_topics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "curriculum_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "curriculum_topics_course_id_active_sort_order_idx" ON "curriculum_topics"("course_id", "active", "sort_order");

CREATE TABLE "curriculum_lessons" (
  "id" UUID NOT NULL, "course_id" UUID NOT NULL, "topic_id" UUID NOT NULL,
  "title" VARCHAR(100) NOT NULL DEFAULT '', "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT false, "version" INTEGER NOT NULL DEFAULT 0,
  "words" JSONB NOT NULL DEFAULT '[]', "word_count" INTEGER NOT NULL DEFAULT 0,
  "retained_word_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  CONSTRAINT "curriculum_lessons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "curriculum_lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "curriculum_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "curriculum_lessons_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "curriculum_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "curriculum_lessons_course_id_active_idx" ON "curriculum_lessons"("course_id", "active");
CREATE INDEX "curriculum_lessons_topic_id_active_sort_order_idx" ON "curriculum_lessons"("topic_id", "active", "sort_order");
CREATE INDEX "curriculum_lessons_retained_word_ids_idx" ON "curriculum_lessons" USING GIN ("retained_word_ids");

CREATE TABLE "curriculum_progress" (
  "user_id" UUID NOT NULL, "lesson_id" UUID NOT NULL, "progress" JSONB NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 0, "completed_at" TIMESTAMPTZ(3), "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "curriculum_progress_pkey" PRIMARY KEY ("user_id", "lesson_id"),
  CONSTRAINT "curriculum_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "curriculum_progress_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "curriculum_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "curriculum_progress_lesson_id_idx" ON "curriculum_progress"("lesson_id");

CREATE TABLE "curriculum_study_results" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "lesson_id" UUID NOT NULL,
  "lesson_name" VARCHAR(200) NOT NULL, "lesson_version" INTEGER NOT NULL, "kind" VARCHAR(8) NOT NULL,
  "mode" VARCHAR(8) NOT NULL, "total" INTEGER NOT NULL, "correct" INTEGER NOT NULL, "answers" JSONB NOT NULL,
  "submission_hash" VARCHAR(64) NOT NULL, "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "curriculum_study_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "curriculum_study_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "curriculum_study_results_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "curriculum_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "curriculum_study_results_user_id_lesson_id_kind_completed_at_idx" ON "curriculum_study_results"("user_id", "lesson_id", "kind", "completed_at");
CREATE INDEX "curriculum_study_results_lesson_id_idx" ON "curriculum_study_results"("lesson_id");
