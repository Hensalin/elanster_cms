# Threat model

## Assets
Admin accounts · content of each website (drafts and published) · uploaded pictures · website API keys · the database · the websites' reputation (defacement).

## Actors
Anonymous visitor · website visitor running the CMS script · Editor · Website Admin (one website) · Super Admin · someone who stole a password or cookie · a malicious website address given to the sync feature.

## Trust boundaries
1. Browser ↔ CMS frontend (cookie). 2. Frontend ↔ backend (`/api` rewrite). 3. Backend ↔ Supabase (password, TLS). 4. Website visitors ↔ public API (read-only key). 5. Backend → the internet (website sync, image links).

## Threats and controls
| Threat (STRIDE) | Example | Control | Residual |
|---|---|---|---|
| Spoofing | Password guessing | bcrypt, lockouts, logging | No MFA (OPEN-01) |
| Spoofing | Stolen cookie | HttpOnly, Secure, 8 h, revoked on password change | Not revoked on sign-out (OPEN-05) |
| Tampering | Editor publishes without approval | Server-side role checks (tested) | — |
| Tampering | Two people overwrite each other | Version check (409) | — |
| Repudiation | "I did not publish that" | Activity log with person and time | Log editable by database owner |
| Information disclosure | Read another website's drafts | Website-scoped queries (tested 102/102) | — |
| Information disclosure | Website source/tools on the live site | `.vercelignore` | Until you upload the fix |
| Denial of service | Huge downloads during sync | Size caps and time-outs | Public API has no per-address limit (cached 30 s) |
| Elevation of privilege | Editor becomes admin | Super-Admin-only user routes (tested) | — |
| SSRF | Sync pointed at internal addresses | netguard checks | DNS rebinding window |
| XSS | Script in an article | sanitize-html, text-only page fields, CSP | `'unsafe-inline'` scripts in CSP |
