// Llamada cruda a la API de plantillas de Meta.
//
// Vive aparte de sendTemplateHandler porque ese handler es un onCall y exige un
// usuario autenticado: el scheduler de recordatorios de eventos no tiene sesion
// y necesita el mismo transporte sin esa barrera.

const META_BASE = "https://graph.facebook.com/v22.0";

export interface TemplateParameter {
  parameterName: string;
  value: string;
}

/** Meta rechaza saltos de linea y tabulaciones dentro de un parametro. */
export function sanitizeParameterValue(value: string): string {
  if (!value || typeof value !== "string") return "";
  return value
    .replace(/[\n\r\t]/g, " ")
    .replace(/  +/g, " ")
    .trim();
}

/** Quita todo lo que no sea digito: Meta espera el numero sin "+" ni separadores. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export interface OpcionesPlantilla {
  /**
   * URL publica de la imagen del encabezado, para plantillas cuyo header es de
   * tipo IMAGE. Meta la descarga en el momento del envio, asi que tiene que ser
   * alcanzable sin autenticacion.
   */
  headerImageUrl?: string;
}

/**
 * Envia una plantilla y devuelve el wamid que asigna Meta ("wamid.xxx") o ""
 * si la respuesta no lo trae.
 */
export async function callMetaTemplateApi(
  phoneNumberId: string,
  token: string,
  to: string,
  templateName: string,
  parameters: TemplateParameter[],
  opciones: OpcionesPlantilla = {}
): Promise<string> {
  const url = `${META_BASE}/${phoneNumberId}/messages`;

  const components: Record<string, unknown>[] = [];

  if (opciones.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: opciones.headerImageUrl } }],
    });
  }

  if (parameters.length > 0) {
    components.push({
      type: "body",
      parameters: parameters.map((p) => ({
        type: "text",
        parameter_name: p.parameterName,
        text: p.value,
      })),
    });
  }

  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: "es_CO" },
      ...(components.length > 0 && { components }),
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const error = await resp.json().catch(() => null);
    throw new Error(
      `META_TEMPLATE_SEND_FAILED status=${resp.status} body=${JSON.stringify(error)}`
    );
  }

  const data = await resp.json().catch(() => ({}));
  return (data as any)?.messages?.[0]?.id ?? "";
}
