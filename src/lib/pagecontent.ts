import { z } from "zod";

/** One editable piece of text on a website page. */
export type PageField = { key: string; label: string; group: string; tag: string; text: string };
/** What is stored (as JSON text) in pages.content. `draft` and `published` hold only text that differs from the original. */
export type PageContent = { file: string | null; fields: PageField[]; draft: Record<string, string>; published: Record<string, string> };

export function readContent(raw: string): PageContent {
  try {
    const j = JSON.parse(raw);
    return { file: j.file ?? null, fields: Array.isArray(j.fields) ? j.fields : [], draft: j.draft ?? {}, published: j.published ?? {} };
  } catch { return { file: null, fields: [], draft: {}, published: {} }; }
}
export const writeContent = (c: PageContent) => JSON.stringify(c);

const fieldSchema = z.object({
  key: z.string().min(1).max(120), label: z.string().max(200), group: z.string().max(120),
  tag: z.string().max(40), text: z.string().max(5000),
});
export const manifestSchema = z.object({
  pages: z.array(z.object({
    slug: z.string().min(1).max(80), title: z.string().min(1).max(200), file: z.string().max(200).nullable().optional(),
    fields: z.array(fieldSchema).max(2000),
  })).min(1).max(100),
  global: z.object({ slug: z.string(), title: z.string(), file: z.string().nullable().optional(), fields: z.array(fieldSchema).max(2000) }).optional(),
});
export const draftSchema = z.object({ draft: z.record(z.string(), z.string().max(5000)) });

const same = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
};
export const hasUnpublished = (c: PageContent) => !same(c.draft, c.published);
