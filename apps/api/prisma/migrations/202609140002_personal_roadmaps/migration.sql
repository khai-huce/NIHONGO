CREATE TABLE "personal_roadmaps" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "raw_kanji" VARCHAR(2000) NOT NULL,
    "kanji_list" TEXT[] NOT NULL,
    "per_day" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "personal_roadmaps_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "personal_roadmaps_per_day_check" CHECK ("per_day" IN (5, 10, 15, 20, 25, 30)),
    CONSTRAINT "personal_roadmaps_version_check" CHECK ("version" >= 0),
    CONSTRAINT "personal_roadmaps_kanji_list_check" CHECK (cardinality("kanji_list") > 0)
);

CREATE INDEX "personal_roadmaps_user_id_created_at_idx" ON "personal_roadmaps"("user_id", "created_at");

ALTER TABLE "personal_roadmaps" ADD CONSTRAINT "personal_roadmaps_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
