-- SQL CHECK accepts NULL. Require the kana target explicitly, too.
ALTER TABLE jlpt_resources DROP CONSTRAINT jlpt_resource_target_check;
ALTER TABLE jlpt_resources ADD CONSTRAINT jlpt_resource_target_check CHECK (
  num_nonnulls(kanji_id,vocabulary_lesson_id,grammar_pattern_id,reading_article_id,shadowing_video_id,kana_script) = 1
  AND ((kind = 'kanji' AND kanji_id IS NOT NULL)
    OR (kind = 'vocabulary' AND vocabulary_lesson_id IS NOT NULL)
    OR (kind = 'grammar' AND grammar_pattern_id IS NOT NULL)
    OR (kind = 'reading' AND reading_article_id IS NOT NULL)
    OR (kind = 'shadowing' AND shadowing_video_id IS NOT NULL)
    OR (kind = 'kana' AND kana_script IS NOT NULL AND kana_script IN ('hiragana','katakana')))
);
