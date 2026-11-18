import { authorize, preflight, pub } from "@/lib/public";

export const OPTIONS = preflight;
export async function GET(req: Request, { params }: { params: Promise<{ websiteId: string }> }) {
  const a = await authorize(req, (await params).websiteId);
  if ("error" in a) return a.error;
  return pub({ id: a.site.id, name: a.site.name, slug: a.site.slug, domain: a.site.domain });
}
