import type { WaMessage } from "../models/waMessage.model";

interface Props {
  message: WaMessage;
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
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
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
