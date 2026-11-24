BEGIN;
ALTER TABLE shadowing_ai_requests ADD COLUMN personal_charged BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE shadowing_provider_calls (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES shadowing_ai_requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX shadowing_provider_calls_created_at_idx ON shadowing_provider_calls(created_at);
CREATE INDEX shadowing_provider_calls_request_id_idx ON shadowing_provider_calls(request_id);
-- Preserve historical global reservations; old records lack per-clip outcomes.
INSERT INTO shadowing_provider_calls(request_id, created_at) SELECT id, created_at FROM shadowing_ai_requests;
COMMIT;
