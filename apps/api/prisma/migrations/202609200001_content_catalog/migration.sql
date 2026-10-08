ALTER TABLE "users" ADD COLUMN "role" VARCHAR(16) NOT NULL DEFAULT 'user';
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('user', 'admin'));

CREATE TABLE "content_sources" (
  "id" VARCHAR(64) PRIMARY KEY, "name" VARCHAR(200) NOT NULL, "url" TEXT NOT NULL,
  "license" VARCHAR(200) NOT NULL, "license_url" TEXT NOT NULL, "version" VARCHAR(100) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL, "attribution" VARCHAR(1000) NOT NULL, "notes" VARCHAR(2000) NOT NULL
);
CREATE TABLE "kanji_content" (
  "id" VARCHAR(32) PRIMARY KEY, "character" VARCHAR(8) NOT NULL, "level" VARCHAR(2) NOT NULL,
  "han_viet" VARCHAR(500) NOT NULL, "meaning" VARCHAR(2000) NOT NULL, "dictionary_radical_number" INTEGER,
  "source_id" VARCHAR(64) NOT NULL, "draft_source_id" VARCHAR(64) NOT NULL,
  "published" JSONB, "draft" JSONB NOT NULL, "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
  "version" INTEGER NOT NULL DEFAULT 0, "sort_order" INTEGER NOT NULL DEFAULT 100000,
  "published_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "kanji_content_status_check" CHECK ("status" IN ('draft', 'published', 'archived')),
  CONSTRAINT "kanji_content_version_check" CHECK ("version" >= 0),
  CONSTRAINT "kanji_content_published_check" CHECK ("status" <> 'published' OR "published" IS NOT NULL),
  CONSTRAINT "kanji_content_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kanji_content_draft_source_id_fkey" FOREIGN KEY ("draft_source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "kanji_content_character_key" ON "kanji_content"("character");
CREATE INDEX "kanji_content_status_level_sort_order_idx" ON "kanji_content"("status", "level", "sort_order");
CREATE TABLE "radical_content" (
  "number" INTEGER PRIMARY KEY, "source_id" VARCHAR(64) NOT NULL, "draft_source_id" VARCHAR(64) NOT NULL,
  "published" JSONB, "draft" JSONB NOT NULL, "status" VARCHAR(16) NOT NULL DEFAULT 'draft', "version" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "radical_content_status_check" CHECK ("status" IN ('draft', 'published', 'archived')),
  CONSTRAINT "radical_content_version_check" CHECK ("version" >= 0),
  CONSTRAINT "radical_content_published_check" CHECK ("status" <> 'published' OR "published" IS NOT NULL),
  CONSTRAINT "radical_content_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "radical_content_draft_source_id_fkey" FOREIGN KEY ("draft_source_id") REFERENCES "content_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "catalog_definitions" (
  "id" VARCHAR(32) PRIMARY KEY, "level" VARCHAR(2) NOT NULL, "per_day" INTEGER NOT NULL,
  "kanji_ids" TEXT[] NOT NULL, "kanji_list" TEXT[] NOT NULL,
  CONSTRAINT "catalog_definition_size_check" CHECK ("per_day" > 0 AND cardinality("kanji_ids") > 0 AND cardinality("kanji_ids") = cardinality("kanji_list"))
);

-- A new syllabus must get a new ID. Existing day numbers may never be reinterpreted.
CREATE FUNCTION protect_catalog_definition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Catalog definitions are immutable; create a new version instead';
END;
$$;
CREATE TRIGGER "catalog_definitions_immutable" BEFORE UPDATE OR DELETE ON "catalog_definitions"
  FOR EACH ROW EXECUTE FUNCTION protect_catalog_definition();
