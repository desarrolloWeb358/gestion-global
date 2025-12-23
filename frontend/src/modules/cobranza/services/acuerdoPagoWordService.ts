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

const pCenter = (children: TextRun[], sizePt: number, bold = false) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: children.map((run) => {
      const base: any = run;
      return new TextRun({
        text: base.text ?? "",
        font: FONT,
        size: sizePt * 2,
        bold: bold || !!base.bold,
        color: base.color,
      });
    }),
    spacing: { after: 120, line: 360 },
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

  inmuebleEtiqueta?: string;
  inmuebleDireccion?: string;

  deudorCelular?: string;
  deudorEmail?: string;

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


function buildAmortTable(cuotas: CuotaAcuerdo[]) {
  const header = new TableRow({
    children: [th("#"), th("Fecha"), th("Valor cuota"), th("Honorarios"), th("Capital"), th("Saldo capital")],
  });

  const rows = (cuotas || []).map((c) => {
    const fecha: Date | null =
      (c as any)?.fecha?.toDate?.() ? (c as any).fecha.toDate() :
        (c as any)?.fecha instanceof Date ? (c as any).fecha :
          null;

    const fechaTxt = fecha ? formatDateDDMMYYYY(fecha) : "XXXXX";

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
  const footerTelefonos = input.footerTelefonos ?? "Teléfonos: (601) 4631148 – 3017566868 -–3123152594";
  const footerEmail = input.footerEmail ?? "Email: gestionglobalacg@gestionglobalacg.com";
  const footerWeb = input.footerWeb ?? "www.gestionglobalacg.com";

  const t = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: {
              bottom: { style: BorderStyle.SINGLE, size: 24, color: COLOR_BLUE },
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            children: [new Paragraph({ text: "" })],
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: footerDireccion, font: FONT, size: 18, color: COLOR_BLUE, bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: footerTelefonos, font: FONT, size: 18, color: COLOR_BLUE, bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: footerEmail, font: FONT, size: 18, color: COLOR_BLUE, bold: true })],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: footerWeb, font: FONT, size: 18, color: COLOR_BLUE, bold: true })],
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
  const empresaNit = input.empresaNit ?? "900.042.908-7";
  const empresaRepresentante = input.empresaRepresentante ?? "XXXXX";

  const acreedor = input.entidadAcreedoraNombre;
  const deudor = input.deudorNombre;

  const total = input.totalAcordado ?? input.capitalInicial ?? 0;

  const fechaFirma = input.fechaFirma ?? new Date();
  const ciudadFirma = input.ciudadFirma ?? "Bogotá D.C.";

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: cm(2), bottom: cm(2), left: cm(3), right: cm(2) },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: [
          // ===== TITULOS =====
          pCenter([rBold("ACUERDO DE PAGO CELEBRADO")], 14, true),
          pCenter([r("ENTRE "), rBold(empresaNombre)], 11),
          pCenter([r("Y "), valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)")], 11),

          new Paragraph({ text: "", spacing: { after: 260 } }),

          // ===== TEXTO BASE (luego lo dejamos igual al ejemplo.docx) =====
          pJustify([
            r("Entre los suscritos a saber por una parte "),
            rBold(empresaNombre),
            r(" actuando como apoderado(a) judicial de la "),
            valOrRedBold(acreedor, "XXXXX (NOMBRE CONJUNTO / CLIENTE)"),
            r(", y por otra parte "),
            valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)"),
            r(" persona mayor de edad identificada con la Cédula de Ciudadanía No. "),
            valOrRed(input.deudorDocumento, "XXXXX (CÉDULA)"),
            r(" de "),
            valOrRed(input.deudorCiudadDoc, "XXXXX (CIUDAD)"),
            r(", quienes en adelante se denominarán el "),
            rBold("DEUDOR"),
            r(", hemos convenido celebrar el presente "),
            rBold("ACUERDO DE PAGO"),
            r(", que en adelante se regirá por las cláusulas que a continuación se enuncian, previas las siguientes:"),
          ]),

          sectionTitle("CONSIDERACIONES:"),

          pJustify([
            r("Que la señora "),
            valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)"),
            r(", adeuda acreencias a favor de la "),
            valOrRedBold(acreedor, "XXXXX (NOMBRE CONJUNTO / CLIENTE)"),
            r(", por valor de "),
            rBold(formatCOP(total)),
            r(". Conforme al estado de deuda bajado directamente del sistema a la fecha "),
            isMissing(input.fechaEstadoDeuda) ? rRed("XXXXX (FECHA)") : rBold(formatDateDDMMYYYY(input.fechaEstadoDeuda!)),
            r(", el cual forma parte de este documento."),
          ]),

          sectionTitle("CLAUSULAS:"),

          ...(input.cuotas?.length
            ? [buildAmortTable(input.cuotas)]
            : [p([rRed("XXXXX (AQUÍ VA LA TABLA DE AMORTIZACIÓN - NO HAY CUOTAS)")])]),

          new Paragraph({ text: "", spacing: { after: 220 } }),

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
