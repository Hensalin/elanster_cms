import { websiteFromKey } from "@/lib/apikeys";
import { preflight, pub, pubError, safe } from "@/lib/public";

export const OPTIONS = preflight;
// A website's key only ever lists that one website.
export const GET = safe(async function GET(req: Request) {
  const s = await websiteFromKey(req);
  if (!s) return pubError("Missing or invalid API key", 401);
  return pub([{ id: s.id, name: s.name, slug: s.slug, domain: s.domain }]);
});
