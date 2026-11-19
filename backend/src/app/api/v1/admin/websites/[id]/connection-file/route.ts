import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { newKey } from "@/lib/apikeys";
import { admin, fail, json } from "@/lib/http";

/** Makes the ready-to-use js/cms-config.js for the live website: this CMS's address plus a new read-only key. */
export const POST = admin<{ params: Promise<{ id: string }> }>(async (req, { params }, user) => {
  const { id } = await params;
  const [site] = await db.select().from(schema.websites).where(eq(schema.websites.id, id));
  if (!site) return fail("Not found", 404);
  const k = newKey();
  await db.insert(schema.apiKeys).values({ websiteId: id, label: "Website connection file", prefix: k.prefix, keyHash: k.keyHash });
  await db.insert(schema.activityLogs).values({ userId: user.id, websiteId: id, action: "API_KEY_CREATE", summary: "Created key for the website connection file" });
  const content = `/* Connects this website to the Elanster CMS. Made by the CMS on ${new Date().toISOString().slice(0, 10)}.
   The key can only READ published content. Keep this file in your website's js folder. */
window.ELANSTER_CMS = { url: "${new URL(req.url).origin}", site: "${site.slug}", key: "${k.key}" };
`;
  return json({ filename: "cms-config.js", content });
}, { superOnly: true });
