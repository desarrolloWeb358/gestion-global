// src/shared/utils/phone.ts

/**
 * Normaliza un número al formato E.164.
 * - Si trae "+": limpia y valida longitud (8..15).
 * - Si trae "00" o "011": convierte a "+" y valida.
 * - Si son 10 dígitos exactos: asume país por defecto (CO => +57).
 * - Si son 11..15 dígitos y NO tienen "+": asume que ya incluyen código de país ⇒ antepone "+".
 * Devuelve undefined si no puede normalizar de forma segura.
 */
export function normalizeToE164(
  input?: string,
  opts: { defaultCountry?: "CO" } = { defaultCountry: "CO" }
): string | undefined {
  if (!input) return undefined;
  let s = String(input).trim();

  // Quita todo excepto dígitos y '+'
  s = s.replace(/[^\d+]/g, "");

  // 1) 00… → +…
  if (s.startsWith("00")) s = "+" + s.slice(2);
  // 2) 011… → +…
  if (s.startsWith("011")) s = "+" + s.slice(3);

  // Si ya empieza con '+', limpiamos y validamos rango
  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    const candidate = "+" + digits;
    return digits.length >= 8 && digits.length <= 15 ? candidate : undefined;
  }

  // Aquí sólo quedan dígitos
  const digits = s.replace(/\D/g, "");
  if (!digits) return undefined;

  // Colombia (por defecto):
  if (opts.defaultCountry === "CO") {
    // Caso típico: 10 dígitos locales (móvil/NRN) => +57 + 10
    if (digits.length === 10) return "+57" + digits;
    // 57 + 10 dígitos (ya trae indicativo sin '+') => +57…
    if (digits.startsWith("57") && digits.length === 12) return "+" + digits;
  }

  // Si el usuario puso un número largo (11..15) asumimos que incluye código de país
  if (digits.length >= 11 && digits.length <= 15) {
    return "+" + digits;
  }

  // Demasiado corto/largo para ser E.164 fiable
  return undefined;
}

/** Si Twilio necesita el prefijo "whatsapp:", úsalo sobre el E.164 ya normalizado */
export function toWhatsAppAddress(e164?: string): string | undefined {
  if (!e164) return undefined;
  return e164.startsWith("whatsapp:") ? e164 : `whatsapp:${e164}`;
}
