CREATE TABLE "vocab_lessons" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "words" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "vocab_lessons_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vocab_lessons_words_array" CHECK (jsonb_typeof("words") = 'array'),
    CONSTRAINT "vocab_lessons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "vocab_lessons_user_id_created_at_idx" ON "vocab_lessons"("user_id", "created_at");
