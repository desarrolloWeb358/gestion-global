/**
 * Render de los correos de campaña.
 *
 * Vive en el backend a propósito: el cliente manda la plantilla y los valores
 * de cada deudor, NO el HTML ya armado. Así el HTML que sale hacia el deudor
 * siempre se escapa aquí, y el documento de la campaña guarda una plantilla
 * (no 200 copias del cuerpo renderizado), que es lo que lo mantiene debajo del
 * límite de 1 MB por documento de Firestore.
 *
 * Si cambias el render, actualiza también la vista previa del frontend
 * (`frontend/src/modules/correos/components/EmailComposePage.tsx`).
 */
export const EMAIL_VARIABLES = [
  "nombre",
  "cedula",
  "ubicacion",
  "direccion",
  "tipificacion",
  "conjunto",
  "fecha",
] as const;

export type EmailVariable = (typeof EMAIL_VARIABLES)[number];
export type EmailVars = Partial<Record<EmailVariable, string>>;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char] ?? char));
}

export function replaceVariables(text: string, vars: EmailVars): string {
  return EMAIL_VARIABLES.reduce(
    // El reemplazo va como función: si el valor trae `$&` o `$'` (un nombre o
    // una dirección con `$`), un string de reemplazo lo interpretaría como
    // patrón y corrompería el texto.
    (result, variable) => result.replace(
      new RegExp(`\{\{${variable}\}\}`, "g"),
      () => vars[variable] ?? ""
    ),
    text
  );
}

export function buildHtml(text: string): string {
  const paragraphs = escapeHtml(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.6">${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:Arial,sans-serif;color:#243447;max-width:680px;margin:auto"><div style="background:#004B87;color:white;padding:18px 24px;font-size:20px;font-weight:700">Gestión Global ACG</div><div style="padding:24px;border:1px solid #dde5ec">${paragraphs}</div></div>`;
}
