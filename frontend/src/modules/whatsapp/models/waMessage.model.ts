export type WaMessageRole   = "user" | "assistant";
export type WaMessageSource = "AGENT" | "PROVIDER";

export interface WaMessage {
  id: string;
  role: WaMessageRole;
  text: string;
  timestampMs: number;
  source: WaMessageSource;
  providerMessageId?: string;
}
