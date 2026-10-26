CREATE TABLE jlpt_enrollments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  roadmap_id UUID NOT NULL REFERENCES jlpt_roadmaps(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  last_session_id UUID REFERENCES jlpt_sessions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  started_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ(3) NOT NULL,
  PRIMARY KEY(user_id, roadmap_id)
);
CREATE TABLE jlpt_session_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  session_id UUID NOT NULL REFERENCES jlpt_sessions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  completed_at TIMESTAMPTZ(3), best_score DOUBLE PRECISION NOT NULL CHECK(best_score BETWEEN 0 AND 100),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0), PRIMARY KEY(user_id, session_id)
);
CREATE TABLE jlpt_attempts (
  id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  roadmap_id UUID NOT NULL REFERENCES jlpt_roadmaps(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  session_id UUID NOT NULL REFERENCES jlpt_sessions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  session_title VARCHAR(150) NOT NULL, level VARCHAR(2) NOT NULL,
  published_version INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 0,
  pass_percent INTEGER NOT NULL CHECK(pass_percent BETWEEN 1 AND 100), questions JSONB NOT NULL, answers JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, submitted_at TIMESTAMPTZ(3),
  correct_count INTEGER, score DOUBLE PRECISION CHECK(score BETWEEN 0 AND 100), passed BOOLEAN
);
CREATE INDEX jlpt_attempts_user_id_roadmap_id_submitted_at_idx ON jlpt_attempts(user_id,roadmap_id,submitted_at);
CREATE INDEX jlpt_attempts_user_id_session_id_started_at_idx ON jlpt_attempts(user_id,session_id,started_at);
