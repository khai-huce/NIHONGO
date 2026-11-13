ALTER TABLE "reading_analysis_requests" ADD COLUMN "purpose" VARCHAR(16) NOT NULL DEFAULT 'annotations';
ALTER TABLE "reading_analysis_requests" ADD CONSTRAINT "reading_analysis_requests_purpose_check"
  CHECK ("purpose" IN ('annotations', 'study', 'quiz'));
