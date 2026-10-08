CREATE TABLE "default_roadmap_progress" (
    "user_id" UUID NOT NULL,
    "catalog_id" VARCHAR(32) NOT NULL,
    "assessments" JSONB NOT NULL DEFAULT '{}',
    "completed_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "progress_version" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(3),
    "activity_days" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "default_roadmap_progress_pkey" PRIMARY KEY ("user_id", "catalog_id"),
    CONSTRAINT "default_roadmap_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
