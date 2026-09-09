CREATE TABLE review_cards (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
 category VARCHAR(16) NOT NULL CHECK (category IN ('kanji','vocab','grammar')), source_id VARCHAR(300) NOT NULL,
 front VARCHAR(500) NOT NULL, back VARCHAR(2000) NOT NULL, reading VARCHAR(500) NOT NULL DEFAULT '', hint VARCHAR(2000) NOT NULL DEFAULT '',
 active BOOLEAN NOT NULL DEFAULT true, due_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 interval_seconds INTEGER NOT NULL DEFAULT 0, review_count INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 0,
 UNIQUE(user_id,category,source_id)
);
CREATE INDEX review_cards_user_id_active_due_at_idx ON review_cards(user_id,active,due_at);
CREATE TABLE review_events (
 id UUID PRIMARY KEY, card_id UUID NOT NULL REFERENCES review_cards(id) ON DELETE CASCADE ON UPDATE CASCADE,
 rating VARCHAR(8) NOT NULL CHECK (rating IN ('again','hard','good','easy')),
 reviewed_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, due_at TIMESTAMPTZ(3) NOT NULL, elapsed_ms INTEGER NOT NULL
);
CREATE INDEX review_events_card_id_reviewed_at_idx ON review_events(card_id,reviewed_at);
