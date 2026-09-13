ALTER TABLE "vocab_lessons" ADD COLUMN "progress_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "vocab_progress" (
    "user_id" UUID NOT NULL,
    "word_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "memorized" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vocab_progress_pkey" PRIMARY KEY ("user_id", "word_id")
);

CREATE INDEX "vocab_progress_lesson_id_idx" ON "vocab_progress"("lesson_id");

ALTER TABLE "vocab_progress" ADD CONSTRAINT "vocab_progress_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vocab_progress" ADD CONSTRAINT "vocab_progress_lesson_id_fkey"
    FOREIGN KEY ("lesson_id") REFERENCES "vocab_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
