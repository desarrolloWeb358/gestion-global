export type WaMessageRole   = "user" | "assistant";
export type WaMessageSource = "AGENT" | "PROVIDER";
export type WaMediaType     = "image" | "video" | "document" | "audio";

export interface WaMessage {
  id: string;
  role: WaMessageRole;
  text: string;
  timestampMs: number;
  source: WaMessageSource;
  providerMessageId?: string;
  // media adjunto (enviado o recibido)
  mediaUrl?: string;
  mediaType?: WaMediaType;
  mediaFilename?: string;
}
