import { Suspense } from "react";
import { jwtVerify } from "jose";
import { notFound } from "next/navigation";
import { blogWithRelations } from "@/lib/blogs";
import { cleanHtml } from "@/lib/sanitize";

export const metadata = { robots: { index: false, follow: false } };

// Private preview of one article (draft or live), valid only with a signed 30-minute link.
async function PreviewInner({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let id = "";
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET!));
    if (payload.kind !== "preview") notFound();
    id = String(payload.blog);
  } catch { notFound(); }
  const b = await blogWithRelations(id);
  if (!b || b.deletedAt) notFound();
  return (
    <article style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px", background: "#fff", minHeight: "100vh" }}>
      <p style={{ background: "#fbeed2", color: "#b7791f", padding: "8px 12px", borderRadius: 10, fontWeight: 600 }}>Preview — only you can see this link. Status: {b.status.toLowerCase().replace("_", " ")}</p>
      <p style={{ color: "#6b7064" }}>{b.category?.name ?? "Uncategorised"}</p>
      <h1 style={{ fontSize: 38, lineHeight: 1.15 }}>{b.title}</h1>
      {b.excerpt && <p style={{ fontSize: 19, color: "#555" }}>{b.excerpt}</p>}
      <div style={{ lineHeight: 1.7, fontSize: 17 }} dangerouslySetInnerHTML={{ __html: cleanHtml(b.content) }} />
      <p style={{ color: "#6b7064", marginTop: 32 }}>{b.tagLinks.map((l) => `#${l.tag.name}`).join("  ")}</p>
    </article>
  );
}

export default function Preview({ params }: { params: Promise<{ token: string }> }) {
  return <Suspense fallback={<p style={{ padding: 40 }}>Loading preview…</p>}><PreviewInner params={params} /></Suspense>;
}
