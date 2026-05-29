import { IconFile, IconPlayerPlay, IconVolume } from "@tabler/icons-react";
import type { WaMessage, WaMediaType } from "../models/waMessage.model";

interface Props {
  message: WaMessage;
}

function MediaPreview({
  mediaUrl,
  mediaType,
  mediaFilename,
  isUser,
}: {
  mediaUrl: string;
  mediaType: WaMediaType;
  mediaFilename?: string;
  isUser: boolean;
}) {
  const subColor = isUser ? "text-muted-foreground" : "text-white/70";
  const linkColor = isUser ? "text-blue-600 underline" : "text-white underline";

  if (mediaType === "image") {
    return (
      <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-1">
        <img
          src={mediaUrl}
          alt={mediaFilename ?? "imagen"}
          className="max-w-full rounded-xl max-h-56 object-cover"
        />
      </a>
    );
  }

  if (mediaType === "video") {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 mb-1 text-sm ${linkColor}`}
      >
        <IconPlayerPlay className="w-4 h-4 shrink-0" />
        <span className="truncate">{mediaFilename ?? "video"}</span>
      </a>
    );
  }

  if (mediaType === "audio") {
    return (
      <div className="mb-1">
        <audio controls src={mediaUrl} className="w-full max-w-[260px]" />
        {mediaFilename && (
          <p className={`text-[10px] mt-0.5 ${subColor}`}>{mediaFilename}</p>
        )}
      </div>
    );
  }

  // document
  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 mb-1 text-sm ${linkColor}`}
    >
      <IconFile className="w-4 h-4 shrink-0" />
      <span className="truncate">{mediaFilename ?? "documento"}</span>
    </a>
  );
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === "user";
  const time = new Date(message.timestampMs).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
          isUser
            ? "bg-muted text-fg rounded-tl-sm"
            : "bg-[#004B87] text-white rounded-tr-sm"
        }`}
      >
        {/* Media adjunta */}
        {message.mediaUrl && message.mediaType && (
          <MediaPreview
            mediaUrl={message.mediaUrl}
            mediaType={message.mediaType}
            mediaFilename={message.mediaFilename}
            isUser={isUser}
          />
        )}

        {/* Texto (caption o mensaje de texto puro) */}
        {message.text && (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        )}

        <p
          className={`text-[10px] mt-1 text-right ${
            isUser ? "text-muted-foreground" : "text-white/70"
          }`}
        >
          {message.source === "AGENT" ? "Asesor · " : ""}
          {time}
        </p>
      </div>
    </div>
  );
}
