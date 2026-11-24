BEGIN;
DROP TABLE shadowing_provider_calls;
ALTER TABLE shadowing_ai_requests DROP COLUMN personal_charged;
COMMIT;
