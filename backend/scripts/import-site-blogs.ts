// Adds the 3 Insights articles from the live Elanster website to the CMS as DRAFTS.
// Safe to run more than once (skips articles that already exist). Then open the
// CMS, paste the full article text in the editor, and press Publish.
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { slugify } from "../src/lib/http";

const articles = [
  {
    title: "Why Most AI Products Fail After Launch — and What Production-Ready Actually Means",
    category: "AI Strategy",
    excerpt: "What separates AI projects that survive production from those that stall after the demo.",
    source: "https://www.notion.so/edraj/Why-Most-AI-Products-Fail-After-Launch-and-What-Production-Ready-Actually-Means-37d925456b56804f8115e23c33e5e242",
  },
  {
    title: "How much does it cost to build an AI product? A real breakdown",
    category: "AI Economics",
    excerpt: "What drives AI build costs, and where budgets tend to leak.",
    source: "",
  },
  {
    title: "Vibe coding technical debt: what happens to your codebase at month six",
    category: "AI Engineering",
    excerpt: "How AI-assisted coding can slow down as debugging costs grow, and when to bring in engineers.",
    source: "",
  },
];

async function main() {
  const [site] = await db.select().from(schema.websites).where(eq(schema.websites.slug, "elanster"));
  if (!site) throw new Error("Website 'elanster' not found. Run npm run db:seed first.");

  for (const a of articles) {
    const slug = slugify(a.title);
    const [dup] = await db.select({ id: schema.blogs.id }).from(schema.blogs)
      .where(and(eq(schema.blogs.websiteId, site.id), eq(schema.blogs.slug, slug)));
    if (dup) { console.log("Already there:", a.title); continue; }

    const catSlug = slugify(a.category);
    await db.insert(schema.categories).values({ websiteId: site.id, name: a.category, slug: catSlug }).onConflictDoNothing();
    const [cat] = await db.select().from(schema.categories)
      .where(and(eq(schema.categories.websiteId, site.id), eq(schema.categories.slug, catSlug)));

    const body = `<p>${a.excerpt}</p><p>Replace this text with the full article.</p>` +
      (a.source ? `<p>Original article: <a href="${a.source}">${a.source}</a></p>` : "");
    await db.insert(schema.blogs).values({
      websiteId: site.id, title: a.title, slug, excerpt: a.excerpt, content: body,
      categoryId: cat?.id ?? null, status: "DRAFT", seoTitle: a.title, metaDescription: a.excerpt,
    });
    console.log("Added draft:", a.title);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
