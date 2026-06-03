import { useState, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { functions, storage } from "@/firebase";
import { toast } from "sonner";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import {
  IconSend,
  IconLock,
  IconPaperclip,
  IconX,
  IconFile,
  IconPhoto,
  IconVideo,
} from "@tabler/icons-react";
import type { WaMediaType } from "../models/waMessage.model";

const ACCEPTED = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/3gpp", "video/quicktime",
  "audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

function fileToMediaType(file: File): WaMediaType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function FileIcon({ type }: { type: WaMediaType }) {
  if (type === "image") return <IconPhoto className="w-4 h-4" />;
  if (type === "video") return <IconVideo className="w-4 h-4" />;
  return <IconFile className="w-4 h-4" />;
}

interface Props {
  numberId: string;
  convId: string;
  windowOpen: boolean;
}

export function HumanReplyBox({ numberId, convId, windowOpen }: Props) {
  const [text, setText]               = useState("");
  const [sending, setSending]         = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  const canSend = (text.trim().length > 0 || !!pendingFile) && !sending && windowOpen;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPendingFile(file);
    e.target.value = "";
  }

  async function uploadFile(file: File): Promise<{ url: string; mediaType: WaMediaType }> {
    const mediaType = fileToMediaType(file);
    const path = `media/outgoing/${numberId}/${convId}/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return { url, mediaType };
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSend) return;

    setSending(true);
    try {
      const fn = httpsCallable(functions, "sendWhatsAppMessage");

      if (pendingFile) {
        const { url, mediaType } = await uploadFile(pendingFile);
        await fn({
          numberId,
          conversationId: convId,
          mediaUrl:      url,
          mediaType,
          mediaFilename: pendingFile.name,
          ...(text.trim() ? { mediaCaption: text.trim() } : {}),
        });
        setPendingFile(null);
      } else {
        await fn({ numberId, conversationId: convId, text: text.trim() });
      }

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
      void handleSubmit();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const imageItem = Array.from(e.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) return;
    e.preventDefault();
    const blob = imageItem.getAsFile();
    if (!blob) return;
    const ext = imageItem.type.split("/")[1] ?? "png";
    setPendingFile(new File([blob], `imagen_${Date.now()}.${ext}`, { type: imageItem.type }));
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
    <div className="flex-shrink-0 border-t border-border bg-background p-3 space-y-2">
      {/* Preview del archivo seleccionado */}
      {pendingFile && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-sm">
          <FileIcon type={fileToMediaType(pendingFile)} />
          <span className="flex-1 truncate text-muted-foreground text-xs">{pendingFile.name}</span>
          <button
            type="button"
            onClick={() => setPendingFile(null)}
            disabled={sending}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <IconX className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Input file oculto */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={handleFileChange}
          disabled={sending}
        />

        {/* Botón clip */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="flex-shrink-0 p-2 rounded-md border bg-background hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Adjuntar archivo"
        >
          <IconPaperclip className="w-4 h-4" />
        </button>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={pendingFile ? "Pie de foto (opcional)…" : "Escribe un mensaje… (Enter para enviar)"}
          rows={2}
          className="flex-1 resize-none text-sm"
          disabled={sending}
        />

        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          className="flex-shrink-0 bg-[#004B87] hover:bg-[#003a6b]"
        >
          <IconSend className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
