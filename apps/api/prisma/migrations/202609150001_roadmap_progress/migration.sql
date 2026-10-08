ALTER TABLE "personal_roadmaps"
  ADD COLUMN "assessments" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "completed_days" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "progress_version" INTEGER NOT NULL DEFAULT 0;
