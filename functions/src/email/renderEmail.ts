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

/**
 * Marcador que el redactor escribe en el cuerpo para decir dónde va la imagen.
 *
 * No es una EMAIL_VARIABLE: `replaceVariables` no lo toca, porque su valor no
 * es texto sino una etiqueta `<img>` que arma el backend. Sustituirlo antes del
 * escape convertiría el `<img>` en texto literal.
 */
export const IMAGE_PLACEHOLDER = "{{imagen}}";

/** Content-ID con el que la imagen se referencia desde el HTML del correo. */
export const IMAGE_CID = "imagen-embebida";

/**
 * Quita el marcador del cuerpo en texto plano. El `text` del correo es el
 * fallback para clientes sin HTML: ahí no hay imagen que mostrar, y dejar
 * "{{imagen}}" crudo se lee como un error del sistema.
 */
export function stripImagePlaceholder(text: string): string {
  // Al quitar el marcador de su propia línea quedan tres saltos seguidos, que
  // en el correo se ven como un hueco: se colapsan a una línea en blanco.
  return text.split(IMAGE_PLACEHOLDER).join("").replace(/\n{3,}/g, "\n\n").trim();
}

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

/**
 * Marcado mínimo que el redactor puede escribir a mano en el textarea:
 * `**texto**` para negrilla y una línea que empiece con `## ` como título
 * destacado (color y tamaño). Se aplica DESPUÉS de escapar el HTML, así que
 * nunca puede introducir una etiqueta que no sea la que agrega esta función.
 * Si esto cambia, hay que replicarlo en la vista previa del frontend
 * (`EmailComposePage.tsx`, función `renderFormattedLines`).
 */
function applyInlineBold(escaped: string): string {
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function buildHtml(text: string, options?: { imageCid?: string }): string {
  const paragraphs = escapeHtml(text)
    .split(/\n{2,}/)
    .map((block) => {
      const headingMatch = block.trim().match(/^##\s+(.+)$/);
      if (headingMatch) {
        return `<h3 style="margin:20px 0 8px;font-size:16px;color:#004B87;font-weight:700">${applyInlineBold(headingMatch[1])}</h3>`;
      }
      return `<p style="margin:0 0 16px;line-height:1.6">${applyInlineBold(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  // El `<img>` se inyecta DESPUÉS de escapar, y lo arma esta función a partir de
  // un cid que fija el backend: nada de lo que escribió el usuario llega a la
  // etiqueta. El marcador sobrevive al escape porque las llaves no se escapan.
  const imgTag = options?.imageCid
    ? `<img src="cid:${options.imageCid}" alt="" style="display:block;max-width:100%;height:auto;margin:0 0 16px" />`
    : "";

  const cuerpo = paragraphs.includes(IMAGE_PLACEHOLDER)
    ? paragraphs.split(IMAGE_PLACEHOLDER).join(imgTag)
    // Sin marcador, una imagen adjunta va al final: es lo que espera quien la
    // sube sin conocer la sintaxis. Sin imagen, el marcador simplemente se borra.
    : paragraphs + imgTag;

  return `<div style="font-family:Arial,sans-serif;color:#243447;max-width:680px;margin:auto"><div style="background:#004B87;color:white;padding:18px 24px;font-size:20px;font-weight:700">Gestión Global ACG</div><div style="padding:24px;border:1px solid #dde5ec">${cuerpo}</div></div>`;
}
