"use client";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { useEffect, useRef, useState } from "react";
import { MediaPicker, uploadImage } from "./MediaPicker";

// Image that remembers its size and alignment as a small inline style, so the live website shows it the same way with no extra CSS.
const RichImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), style: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute("style"), renderHTML: (a: { style?: string | null }) => (a.style ? { style: a.style } : {}) } };
  },
});
const ALIGN: Record<string, string> = { left: "margin:16px auto 16px 0", center: "margin:16px auto", right: "margin:16px 0 16px auto" };
const imgStyle = (align: string, width: number) => `display:block;${ALIGN[align] ?? ALIGN.center};width:${width}%;height:auto`;
const readStyle = (s?: string | null) => ({
  width: Number(/width:\s*(\d+(?:\.\d+)?)%/.exec(s || "")?.[1] ?? 100),
  align: /margin:\s*16px 0 16px auto/.test(s || "") ? "right" : /margin:\s*16px auto 16px 0/.test(s || "") ? "left" : "center",
});

function Btn({ on, label, run, title, disabled }: { on?: boolean; label: React.ReactNode; run: () => void; title: string; disabled?: boolean }) {
  return <button type="button" title={title} aria-label={title} disabled={disabled} className={on ? "on" : ""} onMouseDown={(e) => e.preventDefault()} onClick={run}>{label}</button>;
}

export function RichEditor({ value, onChange, websiteId }: { value: string; onChange: (html: string) => void; websiteId?: string }) {
  const [pick, setPick] = useState(false); const [link, setLink] = useState<null | string>(null); const [msg, setMsg] = useState("");
  const site = useRef(websiteId); site.current = websiteId;
  const editorRef = useRef<Editor | null>(null);

  const insertUploaded = async (file: File, pos?: number) => {
    if (!site.current) { setMsg("Choose the website first, then add the image."); return; }
    try {
      setMsg("Uploading image…"); const m = await uploadImage(file, site.current);
      editorRef.current?.chain().focus().insertContentAt(pos ?? editorRef.current.state.selection.to, { type: "image", attrs: { src: m.url, alt: m.altText || file.name.replace(/\.[^.]+$/, ""), style: imgStyle("center", 100) } }).run();
      setMsg("");
    } catch (e) { setMsg((e as Error).message); }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false } }),
      RichImage, TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
      Placeholder.configure({ placeholder: "Start writing, or paste your article here. Use the toolbar to add headings, images, links and more." }), CharacterCount,
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { "aria-label": "Article content" },
      handlePaste: (_v, e) => { const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/")); if (!f) return false; insertUploaded(f); return true; },
      handleDrop: (view, e) => {
        const f = Array.from((e as DragEvent).dataTransfer?.files ?? []).find((x) => x.type.startsWith("image/")); if (!f) return false;
        const pos = view.posAtCoords({ left: (e as DragEvent).clientX, top: (e as DragEvent).clientY })?.pos; insertUploaded(f, pos); return true;
      },
    },
  });
  editorRef.current = editor;
  useEffect(() => { if (editor && value !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(value, { emitUpdate: false }); }, [value, editor]);

  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => !e ? null : ({
      h2: e.isActive("heading", { level: 2 }), h3: e.isActive("heading", { level: 3 }), h4: e.isActive("heading", { level: 4 }),
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"), strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), quote: e.isActive("blockquote"), code: e.isActive("codeBlock"), link: e.isActive("link"),
      aL: e.isActive({ textAlign: "left" }), aC: e.isActive({ textAlign: "center" }), aR: e.isActive({ textAlign: "right" }), aJ: e.isActive({ textAlign: "justify" }),
      table: e.isActive("table"), image: e.isActive("image"), imgAttrs: e.isActive("image") ? e.getAttributes("image") : null,
      words: e.storage.characterCount?.words?.() ?? 0, canUndo: e.can().undo(), canRedo: e.can().redo(),
    }),
  });
  if (!editor || !st) return <div className="tt">Loading editor…</div>;
  const c = () => editor.chain().focus();
  const img = st.imgAttrs as { src: string; alt?: string; style?: string } | null;
  const cur = readStyle(img?.style);
  const setImg = (patch: Partial<{ align: string; width: number }>) => { const n = { ...cur, ...patch }; c().updateAttributes("image", { style: imgStyle(n.align, n.width) }).run(); };
  const heading = st.h2 ? "2" : st.h3 ? "3" : st.h4 ? "4" : "p";

  return (<div className="rte">
    <div className="tt-bar" role="toolbar" aria-label="Formatting">
      <select className="tt-sel" title="Text style" aria-label="Text style" value={heading} onChange={(e) => { const v = e.target.value; v === "p" ? c().setParagraph().run() : c().toggleHeading({ level: Number(v) as 2 | 3 | 4 }).run(); }}>
        <option value="p">Paragraph</option><option value="2">Heading</option><option value="3">Subheading</option><option value="4">Small heading</option>
      </select>
      <span className="tt-sep" />
      <Btn title="Bold (Ctrl+B)" label={<b>B</b>} on={st.bold} run={() => c().toggleBold().run()} />
      <Btn title="Italic (Ctrl+I)" label={<i>I</i>} on={st.italic} run={() => c().toggleItalic().run()} />
      <Btn title="Underline (Ctrl+U)" label={<u>U</u>} on={st.underline} run={() => c().toggleUnderline().run()} />
      <Btn title="Strikethrough" label={<s>S</s>} on={st.strike} run={() => c().toggleStrike().run()} />
      <span className="tt-sep" />
      <Btn title="Align left" label="⬅" on={st.aL} run={() => c().setTextAlign("left").run()} />
      <Btn title="Align center" label="↔" on={st.aC} run={() => c().setTextAlign("center").run()} />
      <Btn title="Align right" label="➡" on={st.aR} run={() => c().setTextAlign("right").run()} />
      <Btn title="Justify" label="☰" on={st.aJ} run={() => c().setTextAlign("justify").run()} />
      <span className="tt-sep" />
      <Btn title="Bullet list" label="• List" on={st.bullet} run={() => c().toggleBulletList().run()} />
      <Btn title="Numbered list" label="1. List" on={st.ordered} run={() => c().toggleOrderedList().run()} />
      <Btn title="Quote" label="❝" on={st.quote} run={() => c().toggleBlockquote().run()} />
      <Btn title="Code block" label="</>" on={st.code} run={() => c().toggleCodeBlock().run()} />
      <Btn title="Divider line" label="―" run={() => c().setHorizontalRule().run()} />
      <span className="tt-sep" />
      <Btn title="Link" label="🔗 Link" on={st.link} run={() => setLink(editor.getAttributes("link").href ?? "")} />
      <Btn title="Add an image" label="🖼 Image" run={() => setPick(true)} />
      <Btn title="Insert a table" label="▦ Table" run={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      <span className="tt-sep" />
      <Btn title="Remove formatting" label="Clear" run={() => c().unsetAllMarks().clearNodes().run()} />
      <Btn title="Undo (Ctrl+Z)" label="↶" disabled={!st.canUndo} run={() => c().undo().run()} />
      <Btn title="Redo (Ctrl+Y)" label="↷" disabled={!st.canRedo} run={() => c().redo().run()} />
    </div>
    {link !== null && <div className="tt-sub">
      <input autoFocus placeholder="Paste or type the link address, e.g. https://…" value={link} onChange={(e) => setLink(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const u = link.trim(); u ? c().extendMarkRange("link").setLink({ href: u }).run() : c().unsetLink().run(); setLink(null); } if (e.key === "Escape") setLink(null); }} />
      <button type="button" className="btn orange" onClick={() => { const u = (link || "").trim(); u ? c().extendMarkRange("link").setLink({ href: u }).run() : c().unsetLink().run(); setLink(null); }}>Apply</button>
      {st.link && <button type="button" className="btn" onClick={() => { c().extendMarkRange("link").unsetLink().run(); setLink(null); }}>Remove link</button>}
      <button type="button" className="btn" onClick={() => setLink(null)}>Cancel</button>
    </div>}
    {st.image && img && <div className="tt-sub">
      <b>Image</b>
      <input style={{ flex: 1, minWidth: 180 }} placeholder="Describe the image (alt text: helps SEO and accessibility)" value={img.alt ?? ""} onChange={(e) => c().updateAttributes("image", { alt: e.target.value }).run()} />
      {[25, 50, 75, 100].map((w) => <button key={w} type="button" className={"btn" + (cur.width === w ? " on" : "")} onClick={() => setImg({ width: w })}>{w}%</button>)}
      {(["left", "center", "right"] as const).map((a) => <button key={a} type="button" className={"btn" + (cur.align === a ? " on" : "")} onClick={() => setImg({ align: a })}>{a[0].toUpperCase() + a.slice(1)}</button>)}
      <button type="button" className="btn" onClick={() => setPick(true)}>Replace</button>
      <button type="button" className="btn danger" onClick={() => c().deleteSelection().run()}>Remove</button>
    </div>}
    {st.table && <div className="tt-sub">
      <b>Table</b>
      <button type="button" className="btn" onClick={() => c().addRowAfter().run()}>+ Row</button>
      <button type="button" className="btn" onClick={() => c().addColumnAfter().run()}>+ Column</button>
      <button type="button" className="btn" onClick={() => c().deleteRow().run()}>− Row</button>
      <button type="button" className="btn" onClick={() => c().deleteColumn().run()}>− Column</button>
      <button type="button" className="btn danger" onClick={() => c().deleteTable().run()}>Delete table</button>
    </div>}
    <div className="tt"><EditorContent editor={editor} /></div>
    <div className="tt-foot"><span>{st.words} words</span><span>{msg || "Tip: paste or drag a picture straight into the article to upload it."}</span></div>
    {pick && websiteId && <MediaPicker websiteId={websiteId} onClose={() => setPick(false)} onPick={(m) => {
      setPick(false);
      if (st.image) c().updateAttributes("image", { src: m.url, alt: m.altText || img?.alt || "" }).run();
      else c().setImage({ src: m.url, alt: m.altText || m.originalName.replace(/\.[^.]+$/, ""), style: imgStyle("center", 100) } as { src: string }).run();
    }} />}
    {pick && !websiteId && <div className="modal" onClick={() => setPick(false)}><div onClick={(e) => e.stopPropagation()}><p>Choose the website for this article first.</p><button className="btn" onClick={() => setPick(false)}>OK</button></div></div>}
  </div>);
}
