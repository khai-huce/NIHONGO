CREATE TABLE "notification_reads" (
  "user_id" UUID NOT NULL,
  "category" VARCHAR(16) NOT NULL,
  "read_day" VARCHAR(10) NOT NULL,
  "read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("user_id", "category"),
  CONSTRAINT "notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_reads_category_check" CHECK ("category" IN ('kanji','vocab','grammar'))
);
