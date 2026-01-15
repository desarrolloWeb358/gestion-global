// src/modules/cobranza/services/acuerdoPagoWordService.ts
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { IRunOptions, IParagraphOptions } from "docx";
import { saveAs } from "file-saver";
import type { CuotaAcuerdo } from "@/modules/cobranza/models/acuerdoPago.model";
import { TableLayoutType } from "docx";


// =====================
// Constantes / helpers
// =====================
const FONT = "Arial";
const COLOR_BLUE = "1F4E79";
const COLOR_RED = "C00000";

// cm -> twips
const cm = (v: number) => Math.round(v * 567);

const formatCOP = (v: number) => `$${Math.round(v || 0).toLocaleString("es-CO")}`;

const formatDateDDMMYYYY = (d?: Date | null) => {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const isMissing = (v: any) => v === null || v === undefined || String(v).trim() === "";

// ✅ IRunOptions sí soporta bold/color/font/size
const r = (text: string, opts: Partial<IRunOptions> = {}) =>
  new TextRun({
    text,
    font: FONT,
    size: 22, // 11pt
    ...opts,
  });

const rBold = (text: string) => r(text, { bold: true });
const rRed = (text: string) => r(text, { bold: true, color: COLOR_RED });

const p = (children: TextRun[], opts: Partial<IParagraphOptions> = {}) =>
  new Paragraph({
    children,
    spacing: { after: 180, line: 360 },
    ...opts,
  });

const pCenterText = (text: string, sizePt: number, bold = true) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: sizePt * 2, // docx usa half-points
        bold,
      }),
    ],
    spacing: { after: 120, line: 200 },
  });


const pJustify = (children: TextRun[]) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    children,
    spacing: { after: 180, line: 360 },
  });

const sectionTitle = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 220, after: 200 },
    children: [new TextRun({ text, font: FONT, size: 22, bold: true })],
  });

const valOrRed = (v: any, fallback = "XXXXX") => (isMissing(v) ? rRed(fallback) : r(String(v)));
const valOrRedBold = (v: any, fallback = "XXXXX") => (isMissing(v) ? rRed(fallback) : rBold(String(v)));

async function fetchUint8Array(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar imagen: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

// =====================
// Tipos de entrada
// =====================
export type AcuerdoPagoWordInput = {
  ciudadFirma?: string;
  fechaFirma?: Date;

  empresaNombre?: string;
  empresaNit?: string;
  empresaRepresentante?: string;

  entidadAcreedoraNombre?: string;
  entidadAcreedoraDireccion?: string;

  deudorNombre?: string;
  deudorDocumento?: string;
  deudorCiudadDoc?: string;

  deudorCelular?: string;
  deudorEmail?: string;
  deudorDireccion?: string;
  deudorUbicacion?: string;

  totalAcordadoLetras?: string;

  numeroAcuerdo?: string;
  capitalInicial?: number;
  totalAcordado?: number;
  fechaEstadoDeuda?: Date;

  bancoPagoTexto?: string;
  canalSoportesTexto?: string;

  detalles?: string;

  cuotas: CuotaAcuerdo[];

  footerDireccion?: string;
  footerTelefonos?: string;
  footerEmail?: string;
  footerWeb?: string;
};

// =====================
// Tabla amortización
// =====================
function th(text: string) {
  return new TableCell({
    shading: { fill: "E7EEF6" },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, font: FONT, size: 20 })],
      }),
    ],
  });
}

type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];

function tdText(text: string, align: DocxAlignment = AlignmentType.LEFT) {
  const isX = text === "XXXXX";
  return new TableCell({
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            font: FONT,
            size: 20,
            color: isX ? COLOR_RED : undefined,
            bold: isX ? true : undefined,
          }),
        ],
      }),
    ],
  });
}

function toDateFromFirestore(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate(); // Timestamp
  return null;
}


function buildAmortTable(cuotas: CuotaAcuerdo[]) {
  const header = new TableRow({
    children: [th("#"), th("Fecha"), th("Valor cuota"), th("Honorarios"), th("Capital"), th("Saldo capital")],
  });

  const rows = (cuotas || []).map((c) => {
    const fechaObj = 
      toDateFromFirestore((c as any).fechaPago)

    const fechaTxt = fechaObj ? formatDateDDMMYYYY(fechaObj) : "XXXXX";

    return new TableRow({
      children: [
        tdText(String(c.numero ?? ""), AlignmentType.CENTER),
        tdText(fechaTxt, AlignmentType.CENTER),
        tdText(formatCOP(c.valorCuota || 0), AlignmentType.RIGHT),
        tdText(formatCOP(c.honorariosCuota || 0), AlignmentType.RIGHT),
        tdText(formatCOP(c.capitalCuota || 0), AlignmentType.RIGHT),
        tdText(formatCOP((c as any).capitalSaldoDespues || 0), AlignmentType.RIGHT),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
  });
}

// =====================
// Header / Footer
// =====================
async function buildHeader() {
  const data = await fetchUint8Array("/images/logo/encabezado_word.jpg");

  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: "jpg", // 👈 importante
            data,
            transformation: { width: 520, height: 90 },
          }),
        ],
        spacing: { after: 120 },
      }),
    ],
  });
}

function buildFooter(input: AcuerdoPagoWordInput) {
  const footerDireccion = input.footerDireccion ?? "Calle 24 sur # 68 h 52 segundo piso";
  const footerTelefonos = input.footerTelefonos ?? "Teléfonos: (601) 4631148 – 3017566868 – 3123152594";
  const footerEmail = input.footerEmail ?? "Email: gestionglobalacg@gestionglobalacg.com";
  const footerWeb = input.footerWeb ?? "www.gestionglobalacg.com";

  const LEFT = 45;  // 👈 más pequeña la parte de la línea
  const RIGHT = 55; // 👈 más grande la parte del texto

  const t = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED, // 👈 clave: fija anchos
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: LEFT, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 24, color: COLOR_BLUE }, // (o el borde que estés usando)
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            children: [new Paragraph({ text: "" })],
          }),

          new TableCell({
            width: { size: RIGHT, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: footerDireccion, font: FONT, size: 18, color: COLOR_BLUE, bold: true }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: footerTelefonos, font: FONT, size: 18, color: COLOR_BLUE, bold: true }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: footerEmail, font: FONT, size: 18, color: COLOR_BLUE, bold: true }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: footerWeb, font: FONT, size: 18, color: COLOR_BLUE, bold: true }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return new Footer({ children: [t] });
}





// =====================
// Export principal
// =====================
export async function descargarAcuerdoPagoWord(input: AcuerdoPagoWordInput) {
  const header = await buildHeader();
  const footer = buildFooter(input);

  const empresaNombre = input.empresaNombre ?? "GESTION GLOBAL ACG S.A.S";
  const empresaNit = input.empresaNit ?? "901.662.783-7";
  const empresaRepresentante = input.empresaRepresentante ?? "XXXXX";

  const fechaFirma = input.fechaFirma ?? new Date();
  const ciudadFirma = input.ciudadFirma ?? "Bogotá D.C.";

  // Dentro de descargarAcuerdoPagoWord()

  const total = input.totalAcordado ?? input.capitalInicial ?? 0;
  const totalLetras = input.totalAcordadoLetras; // opcional, si no: XXXXX

  const deudorUbicacion = input.deudorUbicacion;
  const deudorDireccion = input.deudorDireccion;

  const acreedor = input.entidadAcreedoraNombre;
  const acreedorDir = input.entidadAcreedoraDireccion;

  const deudor = input.deudorNombre?.toUpperCase();


  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: cm(2), bottom: cm(2), left: cm(3), right: cm(2) } },
        },
        headers: { default: header },
        footers: { default: footer },
        children: [
          // Deja un pequeño espacio para que el header no “tape” el título
          new Paragraph({ text: "", spacing: { before: 120 } }),

          // ===== TITULOS (Arial 14, Negrita) =====
          pCenterText("ACUERDO DE PAGO CELEBRADO", 14, true),
          pCenterText(`ENTRE ${empresaNombre}`, 14, true),
          pCenterText(
            `Y ${(deudor || "XXXXX (NOMBRE DEUDOR)").toUpperCase()}`,
            14,
            true
          ),



          new Paragraph({ text: "", spacing: { after: 260 } }),

          // ===== INTRO =====
          pJustify([
            r("Entre los suscritos a saber por una parte "),
            rBold(empresaNombre),
            r(" actuando como apoderado(a) judicial de la "),
            valOrRedBold(acreedor, "XXXXX (NOMBRE CONJUNTO / CLIENTE)"),
            r(", y por otra parte "),
            valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)"),
            r(" persona mayor de edad identificada con la Cédula de Ciudadanía No."),
            valOrRed(input.deudorDocumento, "XXXXX (CÉDULA)"),
            r(" de "),
            valOrRed(input.deudorCiudadDoc, "XXXXX (CIUDAD)"),
            r(", quienes en adelante se denominarán el "),
            rBold("DEUDOR"),
            r(", hemos convenido celebrar el presente "),
            rBold("ACUERDO DE PAGO"),
            r(", que en adelante se regirá por las cláusulas que a continuación se enuncian, previas las siguientes"),
          ]),

          new Paragraph({ text: "", spacing: { after: 180 } }),

          // ===== CONSIDERACIONES =====
          sectionTitle("CONSIDERACIONES:"),

          // Consid 1
          pJustify([
            r("Que el señor "),
            valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)"),
            r(", deuda acreencias a favor de la "),
            valOrRedBold(acreedor, "XXXXX (NOMBRE CONJUNTO / CLIENTE)"),
            r(", por valor de "),
            rBold(formatCOP(total)),
            r("("),
            isMissing(totalLetras) ? rRed("XXXXX (VALOR EN LETRAS)") : rBold(String(totalLetras)),
            r("). Conforme al estado de deuda bajado directamente del sistema a la fecha "),
            isMissing(input.fechaEstadoDeuda)
              ? rRed("XXXXX (FECHA)")
              : rBold(formatDateDDMMYYYY(input.fechaEstadoDeuda!)),
            r(", el cual forma parte de este documento."),
          ]),

          // Consid 2
          pJustify([
            r("Que la anterior suma de dinero corresponde a las cuotas vencidas de las expensas de administración, intereses de mora y honorarios causados, de la "),
            valOrRedBold(deudorUbicacion, "XXXXX (TORRE/APTO o CASA)"),
            r(" "),
            valOrRedBold(acreedor, "XXXXX (NOMBRE CONJUNTO / CLIENTE)"),
            r(", ubicado en la "),
            valOrRedBold(acreedorDir, "XXXXX (DIRECCIÓN INMUEBLE)"),
            r("."),
          ]),

          // Consid 3
          pJustify([
            r("Que en virtud de lo anterior y con el fin de resolver el inconveniente presentado de manera amigable "),
            rBold(empresaNombre),
            r(", de una parte y por otra parte la señora "),
            valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)"),
            r(", hemos acordado celebrar el presente acuerdo de pago, que se regirá en especial por las siguientes:"),
          ]),

          new Paragraph({ text: "", spacing: { after: 180 } }),

          // ===== CLAUSULAS =====
          sectionTitle("CLAUSULAS:"),

          // CLAUSULA 1
          pJustify([
            rBold("CLÁUSULA PRIMERA. - OBJETO: "),
            r("El presente acuerdo tiene como objeto principal, facilitar a EL DEUDOR, el pago de las obligaciones a favor de la entidad ACREEDORA por valor de "),
            rBold(formatCOP(total)),
            r("("),
            isMissing(totalLetras) ? rRed("XXXXX (VALOR EN LETRAS)") : rBold(String(totalLetras)),
            r("). Frente a lo cual asume desde ya los compromisos y obligaciones contenidos en este acuerdo."),
          ]),

          // CLAUSULA 2
          pJustify([
            rBold("CLÁUSULA SEGUNDA. - FACILIDAD DE PAGO DE LAS OBLIGACIONES: "),
            r("Las condiciones de pago objeto del presente acuerdo, son las siguientes:"),
          ]),

          pJustify([
            rBold("LA SUMA DE "),
            rBold(formatCOP(total)),
            r("("),
            isMissing(totalLetras) ? rRed("XXXXX (VALOR EN LETRAS)") : rBold(String(totalLetras)),
            r("). "),
            r("Serán cancelados por el DEUDOR a la "),
            valOrRedBold(acreedor, "XXXXX (NOMBRE CONJUNTO / CLIENTE)"),
            r(", según tabla de amortización."),
          ]),

          new Paragraph({ text: "", spacing: { after: 120 } }),

          // TABLA AMORTIZACION
          ...(input.cuotas?.length
            ? [buildAmortTable(input.cuotas)]
            : [p([rRed("XXXXX (Aca va la tabla de amortización - NO HAY CUOTAS)")])]),

          new Paragraph({ text: "", spacing: { after: 180 } }),

          // PARÁGRAFO 1 (título)
          pJustify([
            rBold("PARÁGRAFO 1: "),
            r("LAS CUOTAS PACTADAS EN EL PRESENTE ACUERDO DEBERÁ SER CONSIGNADA ASÍ:"),
          ]),

          // PARÁGRAFO 1 (bullet – SOLO cambia el nombre del conjunto)
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            bullet: { level: 0 },
            spacing: { after: 180, line: 360 },
            children: [
              rBold("CUOTA ACUERDO DE PAGO EN EL  DE TORRE Y APARTAMENTO ("),
              valOrRedBold(
                acreedor?.toUpperCase(),
                "XXXXX (NOMBRE CONJUNTO)"
              ),
              rBold(
                ") SEGUIDO DE LA TORRE Y APARTAMENTO Y HACER LLEGAR DE MANERA INMEDIATA AL EMAIL carterazona1@gestionglobalacg.com O AL WHATSAPP 312 3152594 COPIA DE CADA UNA DE LAS CONSIGNACIONES QUE SE REALICEN DENTRO DE ESTE ACUERDO."
              ),
            ],
          }),


          // PARAGRAFO 2
          pJustify([
            rBold("PARÁGRAFO 2: "),
            r("ALTERNAMENTE Y AL CUMPLIMIENTO DE ESTE ACUERDO SE DEBE SEGUIR DANDO CANCELACIÓN A LAS CUOTAS DE ADMINISTRACIÓN MENSUAL Y CONFORME A LOS INCREMENTOS ANUALES QUE ESTABLEZCAN LAS LEYES NACIONALES"),
          ]),

          // CLAUSULA 3
          pJustify([
            rBold("CLÁUSULA TERCERA. CONDICIÓN RESOLUTORIA: "),
            r("En el evento en que EL DEUDOR incumpla el pago de una cualquiera de las cuotas previstas en este acuerdo, La entidad Acreedora representada por el Abogado que designe, podrá declarar de plazo vencido todas y cada una de las obligaciones que adicionalmente tenga a nuestro cargo el DEUDOR, aun cuando respecto de ellas se hubiera pactado algún plazo para su exigibilidad y el mismo estuviera pendiente."),
          ]),

          pJustify([
            rBold("PARÁGRAFO: "),
            r("El presente acuerdo no significa novación, ni transacción de las obligaciones respectivas, ni desistimiento de La entidad Acreedora de las acciones judiciales que se deban iniciar para la recuperación de las obligaciones a cargo del deudor."),
          ]),

          // CLAUSULA 4
          pJustify([
            rBold("CLAUSULA CUARTA. CESIONES: "),
            r("La entidad Acreedora podrá ceder en cualquier tiempo y a cualquier título las obligaciones que regulan este acuerdo, así como las garantías a ella concedidas, sin necesidad de notificación alguna a EL DEUDOR. Para el efecto, bastará que LA ENTIDAD ACREEDORA informe por escrito a EL DEUDOR sobre esta circunstancia a la dirección adelante indicada."),
          ]),

          // CLAUSULA 5
          pJustify([
            rBold("CLÁUSULA QUINTA. MODIFICACIONES: "),
            r("En caso de que el deudor llegue a aumentar su capacidad de pago, las sumas aquí adeudadas se plasmarán por escrito; el cual será anexo al presente acuerdo. Cualquier otra modificación a este ACUERDO deberá constar por escrito y sólo será válida y obligatoria en cuanto sea suscrita por las partes o sus apoderados debidamente constituidos."),
          ]),

          // CLAUSULA 6
          pJustify([
            rBold("CLÁUSULA SEXTA. AUTORIZACIÓN: "),
            r("En mi calidad de titular de información, actuando libre y voluntariamente, autorizo de manera expresa e irrevocable al "),
            valOrRedBold(acreedor, "XXXXX (NOMBRE CONJUNTO / CLIENTE)"),
            r(", o quien represente sus derechos, a consultar, suministrar, reportar, procesar y divulgar toda la información que se requiera a mi comportamiento crediticio, financiero, comercial de servicios y de terceros países de la misma naturaleza a la central de información DATACREDITO- CIFIN, que administra la asociación bancaria y de entidades financieras de Colombia, o quien represente sus derechos."),
          ]),

          // CLAUSULA 7
          pJustify([
            rBold("CLÁUSULA SEPTIMA. MÉRITO EJECUTIVO. "),
            r("Para todos sus efectos el presente acuerdo presta mérito ejecutivo y en consecuencia el deudor renuncia a cualquier clase de requerimiento o constitución en mora previa de cualquier índole bien sea este judicial, privada o administrativa."),
          ]),

          // CLAUSULA 8
          pJustify([
            rBold("CLAUSULA OCTAVA. COMUNICACIONES: "),
            r("Para efectos de las comunicaciones a que haya lugar en virtud del presente Acuerdo, las direcciones son las siguientes: la entidad acreedora las recibirá a en la "),
            valOrRedBold(acreedorDir, "XXXXX (DIRECCIÓN ADMINISTRACIÓN / SEDE)"),
            r(" y la señora "),
            valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)"),
            r(" de la "),
            valOrRedBold(deudorUbicacion, "XXXXX (TORRE/APTO o CASA)"),
            r(" celular "),
            valOrRedBold(input.deudorCelular, "XXXXX (CELULAR)"),
            r(" correo "),
            valOrRedBold(input.deudorEmail, "XXXXX (EMAIL)"),
            r(" dirección "),
            valOrRedBold(input.deudorDireccion, "XXXXX (DIRECCIÓN DEUDOR)"),
          ]),

          pJustify([r("Los cambios de direcciones serán informados por escrito.")]),

          // CLAUSULA 9
          pJustify([
            rBold("CLAUSULA NOVENA. PAZ Y SALVO: "),
            r("Una vez cumplida la totalidad del presente acuerdo, las partes firmantes se declararán a paz y salvo y se abstendrán mutuamente de iniciar cualquier acción judicial o administrativa, respecto a las obligaciones aquí pactadas."),
          ]),

          // CLAUSULA 10
          pJustify([
            rBold("CLAUSULA DÉCIMA. DOMICILIO CONTRACTUAL: "),
            r("Para todos los efectos el domicilio del presente contrato es en "),
            valOrRedBold(ciudadFirma, "XXXXX (CIUDAD)"),
            r("."),
          ]),

          new Paragraph({ text: "", spacing: { after: 220 } }),

          // ===== CIERRE / FIRMAS =====
          pJustify([
            r("En constancia se suscribe el presente acuerdo en "),
            rBold(ciudadFirma),
            r(", a los "),
            rBold(String(fechaFirma.getDate())),
            r(" días del mes de "),
            rBold(fechaFirma.toLocaleString("es-CO", { month: "long" })),
            r(" de "),
            rBold(String(fechaFirma.getFullYear())),
            r("."),
          ]),

          new Paragraph({ text: "", spacing: { after: 320 } }),

          p([rBold("EL DEUDOR,")]),
          new Paragraph({ text: "", spacing: { after: 420 } }),
          p([r("HUELLA")], { alignment: AlignmentType.RIGHT }),
          p([r("INDICE DERECHO")], { alignment: AlignmentType.RIGHT }),
          new Paragraph({ text: "", spacing: { after: 180 } }),
          p([valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)")]),
          p([
            r("C.C No. "),
            valOrRedBold(input.deudorDocumento, "XXXXX (CÉDULA)"),
            r(" de "),
            valOrRedBold(input.deudorCiudadDoc, "XXXXX (CIUDAD)"),
            r("."),
          ]),

          new Paragraph({ text: "", spacing: { after: 320 } }),

          p([rBold("EL ACREEDOR,")]),
          new Paragraph({ text: "", spacing: { after: 420 } }),
          p([valOrRedBold(empresaRepresentante, "XXXXX (REPRESENTANTE LEGAL)")]),
          p([rBold("Representante Legal")]),
          p([rBold(empresaNombre)]),
          p([rBold("Nit. "), rBold(empresaNit), r(".")]),
        ],
      },
    ],
  });


  const blob = await Packer.toBlob(doc);
  const fileName = `Acuerdo_Pago_${(input.numeroAcuerdo || "SIN_NUMERO").replace(/\s+/g, "_")}.docx`;
  saveAs(blob, fileName);
}
