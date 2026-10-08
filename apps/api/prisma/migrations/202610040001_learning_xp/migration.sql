-- Reward claims are independent of learning-source rows, so removing a source keeps earned XP.
CREATE TABLE "xp_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "source_key" VARCHAR(300) NOT NULL,
    "dedupe_key" VARCHAR(64) NOT NULL,
    "study_date" DATE NOT NULL,
    "points" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "xp_events_kind_check" CHECK ("kind" IN ('review', 'roadmap', 'vocab', 'kana', 'grammar')),
    CONSTRAINT "xp_events_points_check" CHECK ("points" >= 0 AND "points" <= CASE "kind" WHEN 'review' THEN 2 WHEN 'roadmap' THEN 10 ELSE 1 END),
    CONSTRAINT "xp_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "xp_events_user_id_dedupe_key_key" ON "xp_events"("user_id", "dedupe_key");
CREATE INDEX "xp_events_user_id_study_date_idx" ON "xp_events"("user_id", "study_date");
CREATE INDEX "xp_events_study_date_user_id_idx" ON "xp_events"("study_date", "user_id");
