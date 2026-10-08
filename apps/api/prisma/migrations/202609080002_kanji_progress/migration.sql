CREATE TABLE "kanji_progress" (
    "user_id" UUID NOT NULL,
    "kanji_id" VARCHAR(32) NOT NULL,
    "memorized" BOOLEAN NOT NULL,
    "reviewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kanji_progress_pkey" PRIMARY KEY ("user_id", "kanji_id"),
    CONSTRAINT "kanji_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
