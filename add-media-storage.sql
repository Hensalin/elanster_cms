-- Run once in Supabase > SQL Editor. Lets the CMS store uploaded images in the database.
ALTER TABLE media ADD COLUMN IF NOT EXISTS data bytea;
