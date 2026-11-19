-- Elanster CMS update (19 Nov 2026). Safe to run more than once.
-- Supabase -> SQL Editor -> New query -> paste all -> Run.

ALTER TABLE media ADD COLUMN IF NOT EXISTS data bytea;
ALTER TABLE blog_categories ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '';
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS review_note text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS content_versions (
  id text PRIMARY KEY,
  entity text NOT NULL,
  entity_id text NOT NULL,
  website_id text REFERENCES websites(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS versions_entity ON content_versions (entity, entity_id, created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL
);

-- Category colours that match the website's blog labels
UPDATE blog_categories SET color = 'orange' WHERE slug = 'ai-strategy' AND color = '';
UPDATE blog_categories SET color = 'blue'   WHERE slug = 'ai-economics' AND color = '';
UPDATE blog_categories SET color = 'lime'   WHERE slug = 'ai-engineering' AND color = '';

-- Remove the duplicate "Why Most AI Products Fail..." draft (the copy whose address ends in -2)
UPDATE blogs SET deleted_at = now(), status = 'UNPUBLISHED'
WHERE slug LIKE 'why-most-ai-products-fail-after-launch-and-what-production-ready-actually-means-2' AND deleted_at IS NULL;
