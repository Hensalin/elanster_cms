# Scalability audit

| Area | Today | Assessment | Recommendation |
|---|---|---|---|
| Hosting | Vercel serverless functions | Scales out automatically, stateless (sign-in is a signed cookie; rate limits in the database) | — |
| Website traffic | Each page view: 2 small API calls, 30 s CDN cache allowed | Good. **Fixed:** removed a database write on every visit (PERF-01) | Add a short per-address limit if abuse appears |
| Database | Supabase Postgres through the pooler | Fine for this size | Watch connection count; keep the pooler |
| Indexes | Unique and status indexes existed | **Added** 4 indexes (PERF-02) | — |
| Pagination | Article lists paginated (≤ 50 per page) | Good | — |
| Dashboard | Reads every page's content to count changes | Fine up to a few hundred pages | Store a "has changes" flag if pages grow a lot |
| Pictures | Stored in the database (≤ 3.5 MB each), served with 1-year cache | Fine for a small library | Move to Supabase Storage/CDN when > ~1 GB |
| Sync | Reads up to 40 pages per website, with time-outs | Fine | Run in the background for very large sites |

Load test (local, one server process): see `PERFORMANCE_LOAD_TEST_REPORT.md`. No microservices or extra infrastructure are needed.
