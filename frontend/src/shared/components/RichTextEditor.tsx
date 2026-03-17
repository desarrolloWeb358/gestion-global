import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { cn } from "@/shared/lib/cn";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
}

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({ onClick, active, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "px-2 py-1 rounded text-sm font-medium transition-colors select-none",
        active
          ? "bg-brand-primary text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Escribe aquí...",
  disabled = false,
  className,
  minHeight = "7rem",
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    editable: !disabled,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      // Treat empty editor as empty string
      onChange(html === "<p></p>" ? "" : html);
    },
  });

  // Sync external value changes (e.g. reset after save)
  const prevValue = React.useRef(value);
  React.useEffect(() => {
    if (!editor) return;
    if (value !== prevValue.current) {
      prevValue.current = value;
      // Only reset if editor content actually differs to avoid cursor jump
      const current = editor.getHTML();
      const normalized = current === "<p></p>" ? "" : current;
      if (value !== normalized) {
        editor.commands.setContent(value || "", false);
      }
    }
  }, [value, editor]);

  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div
      className={cn(
        "rounded-xl border border-brand-secondary/30 bg-white overflow-hidden transition-colors",
        !disabled && "focus-within:border-brand-primary/60 focus-within:ring-2 focus-within:ring-brand-primary/10",
        disabled && "opacity-60",
        className
      )}
    >
      {/* Toolbar */}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/70">
          <ToolbarButton
            title="Negrilla (Ctrl+B)"
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <strong>B</strong>
          </ToolbarButton>

          <ToolbarButton
            title="Cursiva (Ctrl+I)"
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <em>I</em>
          </ToolbarButton>

          <ToolbarButton
            title="Subrayado (Ctrl+U)"
            active={editor?.isActive("underline")}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <span className="underline">U</span>
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarButton
            title="Lista con viñetas"
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            ≡
          </ToolbarButton>

          <ToolbarButton
            title="Lista numerada"
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            1.
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <ToolbarButton
            title="Alinear izquierda"
            active={editor?.isActive({ textAlign: "left" })}
            onClick={() => editor?.chain().focus().setTextAlign("left").run()}
          >
            ←
          </ToolbarButton>

          <ToolbarButton
            title="Centrar"
            active={editor?.isActive({ textAlign: "center" })}
            onClick={() => editor?.chain().focus().setTextAlign("center").run()}
          >
            ↔
          </ToolbarButton>

          <ToolbarButton
            title="Alinear derecha"
            active={editor?.isActive({ textAlign: "right" })}
            onClick={() => editor?.chain().focus().setTextAlign("right").run()}
          >
            →
          </ToolbarButton>
        </div>
      )}

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="rich-editor-content"
        style={{ minHeight }}
      />

      {/* Placeholder fallback */}
      {editor && editor.isEmpty && (
        <style>{`
          .rich-editor-content .tiptap p.is-editor-empty:first-child::before {
            content: "${placeholder}";
            float: left;
            color: #9ca3af;
            pointer-events: none;
            height: 0;
          }
        `}</style>
      )}
    </div>
  );
}
