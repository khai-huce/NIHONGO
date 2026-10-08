-- CreateTable
CREATE TABLE "grammar_courses" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "draft" JSONB NOT NULL,
    "source_id" VARCHAR(64),
    "published_source_id" VARCHAR(64),
    "published_version" INTEGER,
    "title" VARCHAR(100) NOT NULL DEFAULT '',
    "subtitle" VARCHAR(200) NOT NULL DEFAULT '',
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "level" VARCHAR(2) NOT NULL DEFAULT 'N5',
    "lesson_count" INTEGER NOT NULL DEFAULT 0,
    "pattern_count" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "grammar_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_lessons" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL DEFAULT '',
    "japanese" VARCHAR(200) NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "grammar_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_patterns" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "retained_exercise_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "retained_example_ids" UUID[] DEFAULT ARRAY[]::UUID[],

    CONSTRAINT "grammar_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_progress" (
    "user_id" UUID NOT NULL,
    "pattern_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(3),
    "answers" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "grammar_progress_pkey" PRIMARY KEY ("user_id","pattern_id")
);

-- CreateTable
CREATE TABLE "grammar_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pattern_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "pattern_version" INTEGER NOT NULL,
    "action" VARCHAR(8) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grammar_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grammar_ai_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pattern_id" UUID NOT NULL,
    "exercise_id" UUID NOT NULL,
    "pattern_version" INTEGER NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "grammar_ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grammar_courses_slug_key" ON "grammar_courses"("slug");

-- CreateIndex
CREATE INDEX "grammar_courses_archived_at_published_version_idx" ON "grammar_courses"("archived_at", "published_version");

-- CreateIndex
CREATE INDEX "grammar_lessons_course_id_active_sort_order_idx" ON "grammar_lessons"("course_id", "active", "sort_order");

-- CreateIndex
CREATE INDEX "grammar_patterns_lesson_id_active_sort_order_idx" ON "grammar_patterns"("lesson_id", "active", "sort_order");

-- CreateIndex
CREATE INDEX "grammar_patterns_retained_exercise_ids_idx" ON "grammar_patterns" USING GIN ("retained_exercise_ids");

-- CreateIndex
CREATE INDEX "grammar_patterns_retained_example_ids_idx" ON "grammar_patterns" USING GIN ("retained_example_ids");

-- CreateIndex
CREATE INDEX "grammar_progress_pattern_id_idx" ON "grammar_progress"("pattern_id");

-- CreateIndex
CREATE INDEX "grammar_attempts_user_id_pattern_id_idx" ON "grammar_attempts"("user_id", "pattern_id");

-- CreateIndex
CREATE INDEX "grammar_ai_requests_user_id_created_at_idx" ON "grammar_ai_requests"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "grammar_ai_requests_status_created_at_idx" ON "grammar_ai_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "grammar_courses" ADD CONSTRAINT "grammar_courses_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_courses" ADD CONSTRAINT "grammar_courses_published_source_id_fkey" FOREIGN KEY ("published_source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_lessons" ADD CONSTRAINT "grammar_lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "grammar_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_patterns" ADD CONSTRAINT "grammar_patterns_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "grammar_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_progress" ADD CONSTRAINT "grammar_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_progress" ADD CONSTRAINT "grammar_progress_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "grammar_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_attempts" ADD CONSTRAINT "grammar_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_attempts" ADD CONSTRAINT "grammar_attempts_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "grammar_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_ai_requests" ADD CONSTRAINT "grammar_ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_ai_requests" ADD CONSTRAINT "grammar_ai_requests_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "grammar_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

