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

-- Review of page changes (editor sends, admin publishes or sends back)
ALTER TABLE pages ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS review_note text NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS review_by text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS review_at timestamptz;
CREATE INDEX IF NOT EXISTS pages_review ON pages (website_id, review_state);
ALTER TABLE pages ADD COLUMN IF NOT EXISTS edited_by text REFERENCES users(id) ON DELETE SET NULL;

-- Author name shown on the website (free text, e.g. a guest writer)
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS author_name text NOT NULL DEFAULT '';

-- Suggested changes to live articles (editor edits, admin approves)
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS pending text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS pending_state text NOT NULL DEFAULT '';
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS pending_by text REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS pending_at timestamptz;

-- Changing or resetting a password signs that person out everywhere
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after timestamptz;

-- Indexes for the most common lists (safe to repeat)
CREATE INDEX IF NOT EXISTS media_site_created ON media (website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_site_created ON activity_logs (website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blogs_site_published ON blogs (website_id, published_at DESC);
CREATE INDEX IF NOT EXISTS website_users_site ON website_users (website_id);

-- Git publishing (Publish writes the website's real files to GitHub)
ALTER TABLE websites ADD COLUMN IF NOT EXISTS git_repo text NOT NULL DEFAULT '';
ALTER TABLE websites ADD COLUMN IF NOT EXISTS git_branch text NOT NULL DEFAULT 'main';
ALTER TABLE websites ADD COLUMN IF NOT EXISTS git_status text NOT NULL DEFAULT '';
ALTER TABLE websites ADD COLUMN IF NOT EXISTS git_message text NOT NULL DEFAULT '';
ALTER TABLE websites ADD COLUMN IF NOT EXISTS git_commit text NOT NULL DEFAULT '';
ALTER TABLE websites ADD COLUMN IF NOT EXISTS git_at timestamptz;
ALTER TABLE websites ADD COLUMN IF NOT EXISTS git_again boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS git_files (
  website_id text NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  path text NOT NULL,
  kind text NOT NULL,
  original text,
  last_sha text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (website_id, path)
);
