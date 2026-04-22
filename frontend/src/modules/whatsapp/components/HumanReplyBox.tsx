import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { toast } from "sonner";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { IconSend, IconLock } from "@tabler/icons-react";

interface Props {
  numberId: string;
  convId: string;
  windowOpen: boolean;
}

export function HumanReplyBox({ numberId, convId, windowOpen }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending || !windowOpen) return;

    setSending(true);
    try {
      const fn = httpsCallable(functions, "sendWhatsAppMessage");
      await fn({ numberId, conversationId: convId, text: text.trim() });
      setText("");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  if (!windowOpen) {
    return (
      <div className="flex-shrink-0 border-t border-border bg-muted/30 px-4 py-3 flex items-center gap-3">
        <IconLock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Ventana de 24 horas cerrada
          </p>
          <p className="text-xs text-muted-foreground/70">
            El contacto no ha respondido. Solo puedes enviar mensajes por plantilla.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-shrink-0 flex items-end gap-2 p-3 border-t border-border bg-background"
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe un mensaje... (Enter para enviar)"
        rows={2}
        className="flex-1 resize-none text-sm"
        disabled={sending}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!text.trim() || sending}
        className="flex-shrink-0 bg-[#004B87] hover:bg-[#003a6b]"
      >
        <IconSend className="w-4 h-4" />
      </Button>
    </form>
  );
}
