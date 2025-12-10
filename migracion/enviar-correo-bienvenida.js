/* eslint-disable no-console */
const xlsx = require("xlsx");
const path = require("path");
const axios = require("axios");

// ==== CONFIGURACIÓN ====

const excelPath = process.env.INPUT || "./Clientes.xlsx";

// URL de tu Cloud Function enviarNotificacion
// Puedes ponerla fija aquí o usar la variable de entorno FN_URL
const FN_URL =
  process.env.FN_URL ||
  "https://enviarnotificacion-prldsxsgzq-uc.a.run.app";

// ==== UTILIDADES ====

const normStr = (v) =>
  v === null || v === undefined ? "" : String(v).trim();

/**
 * Busca el índice de una cabecera admitiendo varios alias.
 * names: ['nombre', 'razon_social'] etc.
 */
function hIndex(headers, names) {
  const lower = headers.map((h) => String(h).toLowerCase());
  for (const n of names) {
    const i = lower.indexOf(String(n).toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * Aquí defines tu plantilla de correo HTML.
 * Ajusta el texto a tu gusto.
 */
function buildHtmlTemplate({ nombre, correo, password }) {
  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Bienvenida a GESGLO</title>
</head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background-color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
    <tr>
      <td align="center">
        
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 10px 15px rgba(0,0,0,0.05);">
          
          <!-- HEADER -->
          <!-- HEADER -->
<tr>
  <td style="
      background:#021C47;
      padding:22px 24px;
      text-align:center;
      color:#ffffff;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    "
  >
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">
      Gestión Global ACG SAS
    </h1>

    <p style="
        margin:6px 0 0;
        font-size:13px;
        color:#dbeafe;
        letter-spacing:0.3px;
        opacity:0.95;
      "
    >
      Plataforma de Gestión Global · GESGLO
    </p>
  </td>
</tr>

          <!-- CONTENIDO -->
          <tr>
            <td style="padding:24px;">
              
              <p style="margin-top:0;margin-bottom:12px;font-size:14px;">
                Estimados miembros del <strong>${nombre}</strong>,
              </p>

              <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">
                Bienvenidos a la nueva plataforma GESGLO
              </h2>

              <div style="font-size:14px;color:#374151;line-height:1.6;">
                <p>
                  Desde <strong>Gestión Global ACG SAS </strong>, nos complace informarles que a partir de este momento estaremos operando oficialmente con nuestra nueva plataforma tecnológica de gestión global: <strong>GESGLO</strong>.
                </p>

                <p>
                  Este cambio representa un paso importante para ofrecerles un servicio más ágil, transparente y eficiente, permitiéndoles visualizar en tiempo real toda la información relacionada con la recuperación de cartera de su conjunto.
                </p>

                <h3 style="margin-top:20px;margin-bottom:8px;font-size:16px;color:#111827;">🚀 ¿Qué encontrarán en GESGLO?</h3>
                <ul style="margin:0 0 16px;padding-left:18px;color:#374151;">
                  <li>Gestión centralizada de deudores, acuerdos y recaudos</li>
                  <li>Informes automáticos y actualizados en vivo</li>
                  <li>Seguimiento detallado de las gestiones realizadas (llamadas, correos, visitas, procesos jurídicos)</li>
                  <li>Panel administrativo más claro y fácil de usar</li>
                  <li>Mayor trazabilidad y transparencia en la información</li>
                </ul>

                <h3 style="margin-top:20px;margin-bottom:8px;font-size:16px;color:#111827;">🔑 Acceso a la plataforma</h3>
                <p>Para ingresar, pueden utilizar el enlace de siempre:</p>

                <p style="margin:0 0 16px;">
                  👉 <a href="https://www.gestionglobalacg.com" style="color:#2563eb;text-decoration:none;font-weight:600;" target="_blank">https://www.gestionglobalacg.com</a>
                </p>

                <p>Sus credenciales iniciales son:</p>

                <table cellpadding="0" cellspacing="0" style="margin-top:8px;margin-bottom:16px;background:#f9fafb;padding:12px;border-radius:6px;width:100%;font-size:14px;color:#374151;">
                  <tr>
                    <td style="padding:4px 0;"><strong>Usuario:</strong></td>
                    <td style="padding:4px 0;">${correo}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;"><strong>Contraseña:</strong></td>
                    <td style="padding:4px 0;">${password}</td>
                  </tr>
                </table>

                <p>
                  Nuestro equipo estará atento para acompañarlos durante este proceso de transición.
                </p>

                <h3 style="margin-top:20px;margin-bottom:8px;font-size:16px;color:#111827;">🤝 Agradecimiento</h3>
                <p>
                  Agradecemos su confianza y la oportunidad de seguir acompañando la gestión administrativa y financiera de su conjunto. Con GESGLO iniciamos una nueva etapa orientada a mejorar la experiencia y brindarles herramientas más robustas para la toma de decisiones.
                </p>

                <p>
                  Quedamos atentos a cualquier inquietud o asistencia que requieran.
                </p>

                <p style="margin-top:24px;">
                  Cordialmente,<br>
                  <strong>Equipo Gestión Global A.C.G.</strong><br>
                  Área de Tecnología y Transformación Digital<br>
                  📧 gestionglobalacg@gestionglobalacg.com<br>
                  📞 (601) 4631148  -  57 316 6936088
                </p>

                <p style="margin-top:24px;font-size:12px;color:#6b7280;">
                  Si no reconoces esta notificación, por favor comunícate con el equipo de soporte de Gestión Global.
                </p>
              </div>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:11px;color:#9ca3af;">
              © ${new Date().getFullYear()} Gestión Global ACG SAS · Todos los derechos reservados.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}


/**
 * Versión texto plano (opcional pero recomendable).
 */
function buildTextTemplate({ nombre, correo, password }) {
  return `
Hola ${nombre || "cliente"},

Te damos la bienvenida a la plataforma de Gestión Global ACG.

Estos son tus datos de acceso:
- Usuario (correo): ${correo}
- Contraseña: ${password}

Puedes ingresar a la plataforma desde: https://tusitio.com/login

Si tienes alguna duda o inconveniente, respóndenos a este correo.

Equipo Gestión Global ACG
  `.trim();
}

// ==== PROCESO PRINCIPAL ====

(async function main() {
  console.log("📂 Leyendo archivo Excel:", excelPath);

  // 1) Leer Excel como AOA para conservar encabezados
  const workbook = xlsx.readFile(excelPath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!aoa.length) {
    console.error("❌ La hoja está vacía");
    process.exit(1);
  }

  const headers = aoa[0].map((h) => String(h).trim());
  const rows = aoa.slice(1);

  // 2) Detectar índices de columnas
  const idxNombre = hIndex(headers, ["nombre", "razon_social", "razón social"]);
  const idxCorreo = hIndex(headers, [
    "correo",
    "email",
    "correo_electronico",
    "correo electrónico",
  ]);
  const idxPass = hIndex(headers, ["contraseña", "password", "clave"]);

  if (idxCorreo === -1 || idxPass === -1) {
    console.error(
      "❌ No se encontraron las columnas obligatorias de correo y/o password.\n" +
      "Cabeceras encontradas:",
      headers
    );
    process.exit(1);
  }

  console.log(`✅ Registros encontrados: ${rows.length}`);
  console.log("👉 Índices:", {
    idxNombre,
    idxCorreo,
    idxPass,
  });

  // 3) Recorrer filas y enviar correos
  let enviados = 0;
  let errores = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : [];
    const fila = i + 2; // por el encabezado (fila real en Excel)

    const nombre = idxNombre >= 0 ? normStr(row[idxNombre]) : "";
    const correo = idxCorreo >= 0 ? normStr(row[idxCorreo]).toLowerCase() : "";
    const password = idxPass >= 0 ? normStr(row[idxPass]) : "";

    if (!correo) {
      console.warn(`⚠️ Fila ${fila}: sin correo, se omite.`);
      continue;
    }
    if (!password) {
      console.warn(`⚠️ Fila ${fila}: sin password, se omite.`);
      continue;
    }

    const subject = "Nueva plataforma de Gestión Global ACG SAS";
    const html = buildHtmlTemplate({ nombre, correo, password });
    const text = buildTextTemplate({ nombre, correo, password });

    try {
      console.log(`📧 Enviando correo a ${correo} (fila ${fila})...`);

      const resp = await axios.post(
        FN_URL,
        {
          to: correo,
          subject,
          text,
          html,
        },
        {
          // Opcional: timeout
          timeout: 15000,
        }
      );

      if (resp.data && resp.data.success) {
        console.log(
          `✅ Enviado correctamente a ${correo} (messageId: ${resp.data.messageId})`
        );
      } else {
        console.log(
          `✅ Enviado (sin estructura estándar) a ${correo}:`,
          resp.data
        );
      }

      enviados++;
      // Si quieres ir más suave con Gmail, puedes hacer un pequeño delay:
      // await new Promise((res) => setTimeout(res, 500)); // 0.5s
    } catch (err) {
      errores++;
      console.error(
        `⛔ Error al enviar a ${correo} (fila ${fila}):`,
        err.response?.data || err.message || err
      );
    }
  }

  console.log("🚀 Proceso terminado.");
  console.log(`   Correos enviados OK: ${enviados}`);
  console.log(`   Errores:            ${errores}`);

  console.log(
    `📁 Archivo procesado en: ${path.resolve(excelPath)} (el script NO modifica el Excel)`
  );
})().catch((e) => {
  console.error("❌ Error general no controlado:", e);
});
