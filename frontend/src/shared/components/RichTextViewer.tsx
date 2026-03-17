import { cn } from "@/shared/lib/cn";

interface Props {
  html: string;
  className?: string;
}

/**
 * Renders rich text HTML stored in Firestore.
 * Falls back gracefully for plain-text entries created before the editor.
 */
export default function RichTextViewer({ html, className }: Props) {
  if (!html) return null;

  // If it looks like plain text (no HTML tags), wrap in paragraph
  const isPlainText = !/<[a-z][\s\S]*>/i.test(html);
  const content = isPlainText ? `<p>${html}</p>` : html;

  return (
    <div
      className={cn("rich-viewer prose-content text-sm text-gray-700", className)}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
