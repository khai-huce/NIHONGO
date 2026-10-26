-- Additive J01 catalog; existing learning content and account history are untouched.
CREATE TABLE "jlpt_roadmaps" (
  "id" UUID PRIMARY KEY, "level" VARCHAR(2) NOT NULL UNIQUE,
  "version" INTEGER NOT NULL DEFAULT 0, "draft" JSONB NOT NULL, "published" JSONB,
  "source_id" VARCHAR(64), "published_source_id" VARCHAR(64), "published_version" INTEGER,
  "archived_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "jlpt_level_check" CHECK (level IN ('N5','N4','N3','N2','N1')),
  CONSTRAINT "jlpt_roadmaps_source_id_fkey" FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "jlpt_roadmaps_published_source_id_fkey" FOREIGN KEY (published_source_id) REFERENCES content_sources(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "jlpt_sessions" (
  "id" UUID PRIMARY KEY, "roadmap_id" UUID NOT NULL, "draft" JSONB, "published" JSONB,
  CONSTRAINT "jlpt_sessions_roadmap_id_fkey" FOREIGN KEY (roadmap_id) REFERENCES jlpt_roadmaps(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "jlpt_sessions_roadmap_id_idx" ON "jlpt_sessions" ("roadmap_id");
CREATE TABLE "jlpt_resources" (
  "id" UUID PRIMARY KEY, "session_id" UUID NOT NULL, "kind" VARCHAR(16) NOT NULL,
  "kanji_id" VARCHAR(32), "vocabulary_lesson_id" UUID, "grammar_pattern_id" UUID,
  "reading_article_id" UUID, "shadowing_video_id" UUID, "kana_script" VARCHAR(16),
  "draft_position" INTEGER, "published_position" INTEGER,
  CONSTRAINT "jlpt_resource_target_check" CHECK (
    num_nonnulls(kanji_id,vocabulary_lesson_id,grammar_pattern_id,reading_article_id,shadowing_video_id,kana_script) = 1
    AND ((kind = 'kanji' AND kanji_id IS NOT NULL)
      OR (kind = 'vocabulary' AND vocabulary_lesson_id IS NOT NULL)
      OR (kind = 'grammar' AND grammar_pattern_id IS NOT NULL)
      OR (kind = 'reading' AND reading_article_id IS NOT NULL)
      OR (kind = 'shadowing' AND shadowing_video_id IS NOT NULL)
      OR (kind = 'kana' AND kana_script IN ('hiragana','katakana')))
  ),
  CONSTRAINT "jlpt_resource_position_check" CHECK ((draft_position IS NULL OR draft_position >= 0) AND (published_position IS NULL OR published_position >= 0)),
  CONSTRAINT "jlpt_resources_session_id_fkey" FOREIGN KEY (session_id) REFERENCES jlpt_sessions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "jlpt_resources_kanji_id_fkey" FOREIGN KEY (kanji_id) REFERENCES kanji_content(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "jlpt_resources_vocabulary_lesson_id_fkey" FOREIGN KEY (vocabulary_lesson_id) REFERENCES curriculum_lessons(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "jlpt_resources_grammar_pattern_id_fkey" FOREIGN KEY (grammar_pattern_id) REFERENCES grammar_patterns(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "jlpt_resources_reading_article_id_fkey" FOREIGN KEY (reading_article_id) REFERENCES reading_articles(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "jlpt_resources_shadowing_video_id_fkey" FOREIGN KEY (shadowing_video_id) REFERENCES shadowing_videos(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "jlpt_resources_session_id_draft_position_idx" ON "jlpt_resources" ("session_id","draft_position");
CREATE INDEX "jlpt_resources_session_id_published_position_idx" ON "jlpt_resources" ("session_id","published_position");
CREATE INDEX "jlpt_resources_kanji_id_idx" ON "jlpt_resources" ("kanji_id");
CREATE INDEX "jlpt_resources_vocabulary_lesson_id_idx" ON "jlpt_resources" ("vocabulary_lesson_id");
CREATE INDEX "jlpt_resources_grammar_pattern_id_idx" ON "jlpt_resources" ("grammar_pattern_id");
CREATE INDEX "jlpt_resources_reading_article_id_idx" ON "jlpt_resources" ("reading_article_id");
CREATE INDEX "jlpt_resources_shadowing_video_id_idx" ON "jlpt_resources" ("shadowing_video_id");
