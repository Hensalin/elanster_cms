"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";

export function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }), Image],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { "aria-label": "Article content" } },
  });
  // Load content when an existing article arrives after the first render.
  useEffect(() => { if (editor && value !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(value, { emitUpdate: false }); }, [value, editor]);
  if (!editor) return <div className="tt">Loading editor…</div>;
  const B = ({ on, label, run, title }: { on?: boolean; label: string; run: () => void; title: string }) =>
    <button type="button" title={title} aria-label={title} className={on ? "on" : ""} onClick={run}>{label}</button>;
  const c = () => editor.chain().focus();
  return (<div>
    <div className="tt-bar" role="toolbar" aria-label="Formatting">
      <B title="Heading" label="H2" on={editor.isActive("heading", { level: 2 })} run={() => c().toggleHeading({ level: 2 }).run()} />
      <B title="Smaller heading" label="H3" on={editor.isActive("heading", { level: 3 })} run={() => c().toggleHeading({ level: 3 }).run()} />
      <B title="Bold" label="B" on={editor.isActive("bold")} run={() => c().toggleBold().run()} />
      <B title="Italic" label="I" on={editor.isActive("italic")} run={() => c().toggleItalic().run()} />
      <B title="Bullet list" label="• List" on={editor.isActive("bulletList")} run={() => c().toggleBulletList().run()} />
      <B title="Numbered list" label="1. List" on={editor.isActive("orderedList")} run={() => c().toggleOrderedList().run()} />
      <B title="Quote" label="❝" on={editor.isActive("blockquote")} run={() => c().toggleBlockquote().run()} />
      <B title="Link" label="Link" on={editor.isActive("link")} run={() => {
        const url = window.prompt("Link address (https://…)", editor.getAttributes("link").href ?? "");
        if (url === null) return; url === "" ? c().unsetLink().run() : c().setLink({ href: url }).run(); }} />
      <B title="Insert image from a web address" label="Image" run={() => {
        const src = window.prompt("Image address (https://…)"); if (!src) return;
        const alt = window.prompt("Describe the image (alt text, important for SEO and accessibility)") ?? "";
        c().setImage({ src, alt }).run(); }} />
      <B title="Undo" label="↶" run={() => c().undo().run()} /><B title="Redo" label="↷" run={() => c().redo().run()} />
    </div>
    <div className="tt"><EditorContent editor={editor} /></div>
  </div>);
}
