CREATE TABLE "pitch_accent_entries" (
  "id" VARCHAR(64) NOT NULL,
  "word" VARCHAR(100) NOT NULL,
  "reading" VARCHAR(100) NOT NULL,
  "word_key" VARCHAR(100) NOT NULL,
  "reading_key" VARCHAR(100) NOT NULL,
  "romaji" VARCHAR(200) NOT NULL,
  "variants" JSONB NOT NULL,
  "conjugations" JSONB NOT NULL DEFAULT '[]',
  "source_id" VARCHAR(64) NOT NULL,
  "source_line" INTEGER NOT NULL CHECK ("source_line" > 0),
  "source_notation" VARCHAR(500) NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pitch_accent_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pitch_accent_entries_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pitch_accent_entries_variants_check" CHECK (jsonb_typeof("variants") = 'array' AND jsonb_array_length("variants") > 0),
  CONSTRAINT "pitch_accent_entries_conjugations_check" CHECK (jsonb_typeof("conjugations") = 'array')
);
CREATE UNIQUE INDEX "pitch_accent_entries_source_id_word_reading_key" ON "pitch_accent_entries"("source_id", "word", "reading");
CREATE INDEX "pitch_accent_entries_published_word_key_idx" ON "pitch_accent_entries"("published", "word_key" varchar_pattern_ops);
CREATE INDEX "pitch_accent_entries_published_reading_key_idx" ON "pitch_accent_entries"("published", "reading_key" varchar_pattern_ops);
CREATE INDEX "pitch_accent_entries_published_romaji_idx" ON "pitch_accent_entries"("published", "romaji" varchar_pattern_ops);
