-- Preserve all existing personal/library content. Legacy library drafts must
-- select honest provenance before their next publication.
ALTER TABLE "reading_articles"
  ADD COLUMN "source_id" VARCHAR(64),
  ADD COLUMN "published_source_id" VARCHAR(64),
  ADD CONSTRAINT "reading_articles_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "reading_articles_published_source_id_fkey" FOREIGN KEY ("published_source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A measured file can be reused by a draft and its still-live published revision.
-- article_version remains the version that generated the file, never reassigned.
CREATE INDEX "reading_audio_article_id_content_hash_voice_status_idx"
  ON "reading_audio" ("article_id", "content_hash", "voice", "status");
