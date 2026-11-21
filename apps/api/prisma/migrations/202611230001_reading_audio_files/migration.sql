CREATE TABLE reading_audio_files (
  audio_id uuid NOT NULL REFERENCES reading_audio(id) ON DELETE CASCADE,
  claim_token uuid NOT NULL,
  filename text NOT NULL,
  data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 20000000),
  PRIMARY KEY (audio_id, claim_token, filename)
);
