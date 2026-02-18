// src/modules/cobranza/services/reportes/reporteClienteWord.ts
import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  TableLayoutType,
  BorderStyle,
  ExternalHyperlink,
} from "docx";

import { buildHeaderGG, buildFooterGG, cm, formatCOP, formatFechaLargaES } from "./helperWord";

import numeroALetras from "@/shared/numeroALetras";

const PURPLE = "4F46E5";
const LIGHT = "EEF2FF";
const GRAY = "FAFAFA";
const TEXT = "2B2B2B";

// --- estilos tipo Excel ---
const BORDER_COLOR = "000000";
const HEADER_FILL = "B4C6E7"; // azul claro
const TOTAL_FILL = "D9E1F2";  // azul muy suave
const RED = "FF0000";

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// ===== RECOMENDACIONES =====
const RECOM_MIN = 2_000_000;

function pCenterTitleUnderline(text: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 260, after: 180 },
    children: [
      new TextRun({
        text: (text || "").toUpperCase(),
        bold: true,
        italics: true,
        underline: {},
        size: 26,
        color: "000000",
      }),
    ],
  });
}

// Intenta sacar TORRE/APTO desde "ubicacion" (tú ajustas si tu formato es distinto)
function parseTorreApto(ubicacion: string) {
  const s = (ubicacion || "").toUpperCase();

  // Ej: "TORRE 1 APTO 702" / "Torre 1 Apto 702"
  const m1 = s.match(/TORRE\s*([A-Z0-9]+)\s*(?:APTO|APT|APARTAMENTO)\s*([A-Z0-9]+)/i);
  if (m1) return { torre: m1[1], apto: m1[2] };

  // Ej: "1-702" o "1 / 702"
  const m2 = s.match(/(\d+)\s*[-/]\s*(\d+)/);
  if (m2) return { torre: m2[1], apto: m2[2] };

  // Ej: "T1 702"
  const m3 = s.match(/T\s*([A-Z0-9]+)\s+([A-Z0-9]+)/i);
  if (m3) return { torre: m3[1], apto: m3[2] };

  return { torre: "-", apto: "-" };
}

function pRecomendacionesWord(params: {
  clienteNombre: string;
  cantidad: number;
  monto: number; // fijo 2.000.000
}) {
  const { clienteNombre, cantidad, monto } = params;

  const money = formatCOP(monto);
  const letras = numeroALetras(monto).toUpperCase();

  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text: "Se recomienda a la copropiedad en cabeza del Administrador ",
        italics: true,
        size: 24,
        color: "000000",
      }),      
      new TextRun({
        text: "que, en consideración al tiempo de mora, el monto adeudado y habiéndose agotado previamente la gestión prejurídica respecto a los ",
        italics: true,
        size: 24,
        color: "000000",
      }),
      new TextRun({
        text: String(cantidad),
        italics: true,
        bold: true,
        size: 24,
        color: "000000",
      }),
      new TextRun({
        text: " deudores que presentan obligaciones superiores a los ",
        italics: true,
        size: 24,
        color: "000000",
      }),

      // monto en rojo (fijo)
      new TextRun({
        text: money,
        italics: true,
        bold: true,
        color: RED,
        size: 24,
      }),
      new TextRun({ text: " (", italics: true, size: 24 }),

      // letras en rojo
      new TextRun({
        text: `${letras} PESOS M/CTE`,
        italics: true,
        bold: true,
        color: RED,
        size: 24,
      }),
      new TextRun({ text: "), se autorice dar inicio a los respectivos procesos ejecutivos en contra de cada uno de ellos.", italics: true, size: 24 }),
    ],
  });
}

async function buildFirmaGG(params: { nombreFirma?: string }) {
  // ✅ AJUSTA la ruta del archivo en tu /public
  const firmaBytes = await urlToUint8Array("/images/logo/gestion_firma.jpg");
  const nombre = (params.nombreFirma || "").trim();

  return [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [
        new ImageRun({
          data: firmaBytes,
          type: "png",
          transformation: { width: 190, height: 70 }, // ajusta a tu gusto
        }),
      ],
    }),

    

    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 20 },
      children: [
        new TextRun({ text: ( nombre || "").toUpperCase(), bold: true, italics: true, size: 24, color: "000000" }),
        
      ],
    }),

    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: "Ejecutiva de Cuenta", italics: true, size: 24, color: "000000" }),
      ],
    }),
  ];
}

function buildTablaRecomendacionesExcelStyle(input: {
  mesLabel: string; // ✅ "ENERO", "JUNIO", etc
  rows: { tipificacion: string; ubicacion: string; deudor: string; capitalMes: number }[];
}) {
  const mes = (input.mesLabel || "").toUpperCase();

  const header = new TableRow({
    children: [
      excelCell({ text: "TIPIFICACIÓN", bold: true, fill: HEADER_FILL, align: AlignmentType.LEFT }),
      excelCell({ text: "UBICACIÓN", bold: true, fill: HEADER_FILL, align: AlignmentType.LEFT }),
      excelCell({ text: "DEUDOR", bold: true, fill: HEADER_FILL, align: AlignmentType.LEFT }),
      excelCell({ text: `CAPITAL ${mes}`, bold: true, fill: HEADER_FILL, align: AlignmentType.RIGHT }),
    ],
  });

  const body = input.rows.map((r) => {
    return new TableRow({
      children: [
        excelCell({ text: (r.tipificacion || "").toUpperCase(), align: AlignmentType.LEFT }),
        excelCell({ text: (r.ubicacion || "").toUpperCase(), align: AlignmentType.LEFT }),
        excelCell({ text: (r.deudor || "").toUpperCase(), align: AlignmentType.LEFT }),
        excelCell({
          text: formatCOP(r.capitalMes ?? 0),
          align: AlignmentType.RIGHT,
          bold: true,
          color: "000000",
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [header, ...body],
  });
}




function fontSizeByCols(cols: number, kind: "header" | "value") {
  // half-points: 24=12pt, 20=10pt, 18=9pt, 16=8pt, 14=7pt
  if (cols <= 4) return kind === "header" ? 20 : 20;
  if (cols <= 6) return kind === "header" ? 20 : 20;
  if (cols <= 8) return kind === "header" ? 18 : 20;
  if (cols <= 10) return kind === "header" ? 16 : 18;
  return kind === "header" ? 14 : 14; // ✅ 12 meses: header 7pt, value 8pt
}

function moneyNoBreak(s: string) {
  // Quita espacios normales y usa NBSP para que Word NO parta
  // Si quieres quitar el espacio después del $, lo dejamos como "$100.000"
  return (s || "")
    .replace(/\$\s+/g, "$")     // "$ 100.000" -> "$100.000"
    .replace(/\s+/g, "\u00A0"); // cualquier espacio -> NBSP
}


function shouldSplitHeader(cols: number) {
  // desde 6+ columnas, mejor forzar máximo 2 líneas
  return cols >= 8;
}

function pluralizeES(n: number, singular: string, plural?: string) {
  return n === 1 ? singular : (plural ?? `${singular}s`);
}

function normalizeTip(t: string) {
  return (t || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}



function pctOf(vol: number, total: number) {
  if (!total) return 0;
  return Math.round((vol / total) * 100);
}

/**
 * Devuelve el texto base (sin el bloque final del recaudo)
 */
function buildTextoBasePorTip(tip: string, n: number, pct: number) {
  const deudorWord = `${n} ${pluralizeES(n, "deudor", "deudores")}`;
  const baseA = `En esta tipificación tenemos ${deudorWord} donde está concentrado el ${pct}% del volumen de la cartera, `;
  const baseB = `En esta tipificación encontramos ${deudorWord} donde está concentrado el ${pct}% del volumen de la cartera, `;

  const T = normalizeTip(tip);

  // Reglas por tipo (según tus ejemplos)
  if (T.includes("TERMINADO")) {
    // Terminado y Demanda/Terminado
    return `${baseA}los cuales terminaron con su obligación en mora. `;
  }

  if (T === "ACUERDO") {
    return `${baseA}los cuales vienen cumpliendo el acuerdo de pago, recaudando mes a mes bajo consignación en la cuenta del conjunto. `;
  }

  if (T === "GESTIONANDO") {
    return (
      `${baseB}a los cuales se les ha realizado gestión, tanto escrito como telefónico, mensajes de WhatsApp, correos electrónicos y notificación física, ` +
      `esperamos llegar a normalizar la cartera con el recaudo total en esta tipificación. `
    );
  }

  if (T === "DEMANDA") {
    return (
      `${baseB}por la mora, el monto y en vista que se agotaron todas las instancias para lograr la normalización y no se ha acordado una negociación, ` +
      `se han seguido las acciones correspondientes con el fin de llegar a este deudor por la vía judicial y lograr el recaudo de dichos dineros, `
    );
  }

  if (T.includes("DEMANDA") && T.includes("ACUERDO")) {
    return (
      `${baseB}a estos deudores se le dio inicio al proceso jurídico, pero se allegaron a un acuerdo de pago para suspender el proceso y cancelar la obligación, `
    );
  }

  // Default (el resto)
  return `${baseB.slice(0, -2)}. `; // quita ", " y deja ". "
}

/**
 * Leyenda final con monto en rojo + letras en rojo, estilo similar a tu párrafo de RECAUDO
 */
function pLeyendaTipificacionWord(params: {
  tipificacion: string;
  inmuebles: number;
  porcentaje: number;
  recaudoTotal: number;
}) {
  const { tipificacion, inmuebles, porcentaje, recaudoTotal } = params;

  const base = buildTextoBasePorTip(tipificacion, inmuebles, porcentaje);
  const money = formatCOP(recaudoTotal);
  const letras = numeroALetras(recaudoTotal).toUpperCase();

  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120 },
    children: [
      new TextRun({
        text: `${normalizeTip(tipificacion)}: `,
        bold: true,
        italics: true,
        underline: {},
        size: 24,
        color: "000000",
      }),

      new TextRun({
        text: base,
        italics: true,
        size: 24,
        color: "000000",
      }),

      // “A la fecha...”
      new TextRun({
        text: "A la fecha se ha realizado un recaudo por valor de ",
        italics: true,
        size: 24,
        color: "000000",
      }),

      // valor rojo
      new TextRun({
        text: money,
        italics: true,
        bold: true,
        color: RED,
        size: 24,
      }),

      new TextRun({ text: " (", italics: true, size: 24 }),

      // letras rojo
      new TextRun({
        text: `${letras} PESOS M/CTE`,
        italics: true,
        bold: true,
        color: RED,
        size: 24,
      }),

      new TextRun({ text: ").", italics: true, size: 24 }),
    ],
  });
}




function buildTablaDetalleTipificacionExcelStyle(input: {
  detalle: DetalleTipRow[];
  totales: { inmuebles: number; recaudoTotal: number; porRecuperar: number };
}) {
  const { detalle, totales } = input;

  const header = new TableRow({
    children: [
      excelCell({ text: "UBICACIÓN", bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER }),
      excelCell({ text: "DEUDOR", bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER }),
      excelCell({ text: "RECAUDO TOTAL", bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER }),
      excelCell({ text: "POR RECUPERAR", bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER }),
    ],
  });

  const rows = detalle.map((d) => {
    return new TableRow({
      children: [
        excelCell({ text: d.ubicacion ?? "", align: AlignmentType.LEFT }),
        excelCell({ text: (d.nombre ?? "").toUpperCase(), align: AlignmentType.LEFT }),
        excelCell({
          text: formatCOP(d.recaudoTotal ?? 0),
          align: AlignmentType.RIGHT,
          color: RED,
          bold: true,
        }),
        excelCell({
          text: formatCOP(d.porRecuperar ?? 0),
          align: AlignmentType.RIGHT,
        }),
      ],
    });
  });

  const totalRow = new TableRow({
    children: [
      excelCell({ text: "TOTAL", bold: true, color: RED, fill: TOTAL_FILL, align: AlignmentType.CENTER }),
      excelCell({ text: String(totales.inmuebles ?? 0), bold: true, color: "000000", fill: TOTAL_FILL, align: AlignmentType.CENTER }),
      excelCell({ text: formatCOP(totales.recaudoTotal ?? 0), bold: true, color: RED, fill: TOTAL_FILL, align: AlignmentType.RIGHT }),
      excelCell({ text: formatCOP(totales.porRecuperar ?? 0), bold: true, color: "000000", fill: TOTAL_FILL, align: AlignmentType.RIGHT }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [header, ...rows, totalRow],
  });
}


function excelBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 8, color: BORDER_COLOR },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: BORDER_COLOR },
    left: { style: BorderStyle.SINGLE, size: 8, color: BORDER_COLOR },
    right: { style: BorderStyle.SINGLE, size: 8, color: BORDER_COLOR },
  };
}

function cleanUpper(s?: string) {
  return (s || "").trim().toUpperCase();
}

function valueCell(
  text: string,
  opts?: {
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bold?: boolean;
    color?: string;
    fill?: string;
    size?: number;
  }
) {
  return excelCell({
    text: text ?? "",
    align: opts?.align ?? AlignmentType.LEFT,
    bold: opts?.bold ?? false,
    color: opts?.color ?? "000000",
    fill: opts?.fill,
    size: opts?.size ?? 22,
  });
}

function runsFromMultiline(
  text: string,
  run: { size?: number; color?: string; bold?: boolean; italics?: boolean }
): TextRun[] {
  const lines = (text ?? "").split(/\r?\n/);

  const out: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(new TextRun({ break: 1 })); // 👈 salto de línea real en Word
    out.push(
      new TextRun({
        text: line,
        size: run.size,
        color: run.color,
        bold: run.bold,
        italics: run.italics,
      })
    );
  });

  return out;
}



/**
 * Tarjeta (card) profesional para un proceso de demanda:
 * - Tabla 4 columnas (cabecera + valores)
 * - Tabla 1 columna para observaciones con listado numerado
 */
function buildProcesoDemandaCard(input: {
  ubicacion: string;
  demandados?: string;
  numeroRadicado?: string;
  juzgado?: string;
  seguimientos: { fecha: string | null; texto: string }[];
  observacionCliente?: string;
}) {
  const ubicacion = input.ubicacion || "SIN UBICACIÓN";
  const demandados = (input.demandados || "").trim() || "-";
  const radicado = (input.numeroRadicado || "").trim() || "-";
  const juzgado = (input.juzgado || "").trim() || "-";

  const lista = [
    ...(input.seguimientos || []),
    { fecha: null, texto: input.observacionCliente?.trim() ? input.observacionCliente.trim() : "" },
  ].filter((x) => (x.texto || "").trim().length > 0);

  // ✅ anchos estables (ajústalos si quieres)
  const W_INM = 14;
  const W_DEM = 40;
  const W_RAD = 18;
  const W_JUZ = 28;

  const headRow = new TableRow({
    children: [
      cellWrap({ text: "INMUEBLE", bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER, size: 20, widthPct: W_INM }),
      cellWrap({ text: "DEMANDADO", bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER, size: 20, widthPct: W_DEM }),
      cellWrap({ text: "RADICADO", bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER, size: 20, widthPct: W_RAD }),
      cellWrap({ text: "JUZGADO", bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER, size: 20, widthPct: W_JUZ }),
    ],
  });

  const valRow = new TableRow({
    children: [
      cellWrap({ text: cleanUpper(ubicacion), bold: true, align: AlignmentType.CENTER, widthPct: W_INM }),
      cellWrap({ text: cleanUpper(demandados), align: AlignmentType.LEFT, widthPct: W_DEM }),
      cellWrap({ text: cleanUpper(radicado), align: AlignmentType.CENTER, widthPct: W_RAD }),
      cellWrap({ text: cleanUpper(juzgado), align: AlignmentType.LEFT, widthPct: W_JUZ }),
    ],
  });

  const obsHeaderRow = new TableRow({
    children: [
      cellWrap({
        text: "OBSERVACIONES",
        bold: true,
        fill: HEADER_FILL,
        align: AlignmentType.LEFT,
        size: 22,
        colSpan: 4,
        widthPct: 100,
      }),
    ],
  });

  // ✅ Párrafos bonitos: número + fecha en gris + texto normal
  const obsParagraphs: Paragraph[] = lista.length
    ? lista.map((it) => {
      const fecha = it.fecha ? it.fecha : "";
      const texto = (it.texto || "").trim();

      return new Paragraph({
        spacing: { after: 80 },
        children: [
          ...(fecha
            ? [new TextRun({ text: `${fecha} `, bold: false, size: 20, color: "000000" })]
            : []),

          // ✅ Respeta saltos de línea (\n) dentro del texto
          ...runsFromMultiline(texto, { size: 20, color: "000000" }),
        ],
      });
    })
    : [new Paragraph({ children: [new TextRun({ text: "Sin observaciones.", size: 20 })] })];


  const obsRow = new TableRow({
    children: [
      cellWrap({
        colSpan: 4,
        widthPct: 100,
        children: obsParagraphs,
      }),
    ],
  });

  const tabla = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headRow, valRow, obsHeaderRow, obsRow],
  });

  return [tabla];
}


function cellWrap(params: {
  text?: string;
  children?: Paragraph[];
  bold?: boolean;
  color?: string;
  fill?: string;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  size?: number;
  widthPct?: number;  // ✅ ancho en porcentaje
  colSpan?: number;   // ✅ column span
}) {
  const { text, children, bold, color, fill, align, size, widthPct, colSpan } = params;

  return new TableCell({
    columnSpan: colSpan,
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    borders: excelBorders(),
    shading: fill ? { fill } : undefined,
    children:
      children ??
      [
        new Paragraph({
          alignment: align ?? AlignmentType.LEFT,
          children: [
            new TextRun({
              text: text ?? "",
              bold: !!bold,
              color: color ?? "000000",
              size: size ?? 20,
            }),
          ],
        }),
      ],
  });
}


function excelCell(params: {
  text: string;
  bold?: boolean;
  color?: string;
  fill?: string;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  size?: number;
}) {
  const { text, bold, color, fill, align, size } = params;

  return new TableCell({
    borders: excelBorders(),
    shading: fill ? { fill } : undefined,
    children: [
      new Paragraph({
        alignment: align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text: text ?? "",
            bold: !!bold,
            color: color ?? "000000",
            size: size ?? 20, // 12pt (docx usa half-points*2 => 24)
          }),
        ],
      }),
    ],
  });
}

function isTipificacionRoja(t: string) {
  const x = (t || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " "); // normaliza espacios
  return x.includes("TERMINADO");
}



function buildTablaResumenTipificacionExcelStyle(input: {
  resumenTipificacion: { tipificacion: string; inmuebles: number; recaudoTotal: number; porRecuperar: number }[];
  totalesResumen: { inmuebles: number; recaudoTotal: number; porRecuperar: number };
  formatCOP: (v: number) => string;
}) {
  const { resumenTipificacion, totalesResumen, formatCOP } = input;

  // ✅ SOLO esta tabla: anchos fijos (suman 100)
  const W_TIP = 35;
  const W_INM = 15;
  const W_REC = 25;
  const W_POR = 25;

  // ✅ SOLO esta tabla: letra más pequeña
  const HEADER_SIZE = 20; // 9pt
  const VALUE_SIZE = 20;  // 9pt

  // 🔒 helper LOCAL (no afecta otras tablas)
  const cellPct = (params: {
    text: string;
    widthPct: number;
    bold?: boolean;
    color?: string;
    fill?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    size?: number;
  }) => {
    const { text, widthPct, bold, color, fill, align, size } = params;

    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: excelBorders(),
      shading: fill ? { fill } : undefined,
      children: [
        new Paragraph({
          alignment: align ?? AlignmentType.LEFT,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({
              text: text ?? "",
              bold: !!bold,
              color: color ?? "000000",
              size: size ?? VALUE_SIZE,
            }),
          ],
        }),
      ],
    });
  };

  const header = new TableRow({
    children: [
      cellPct({ text: "TIPIFICACIÓN", widthPct: W_TIP, bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER, size: HEADER_SIZE }),
      cellPct({ text: "INMUEBLE", widthPct: W_INM, bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER, size: HEADER_SIZE }),
      cellPct({ text: "RECAUDO TOTAL", widthPct: W_REC, bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER, size: HEADER_SIZE }),
      cellPct({ text: "POR RECUPERAR", widthPct: W_POR, bold: true, fill: HEADER_FILL, align: AlignmentType.CENTER, size: HEADER_SIZE }),
    ],
  });

  const rows = resumenTipificacion.map((r) => {
    const tip = (r.tipificacion || "").trim();
    const rojo = isTipificacionRoja(tip);

    return new TableRow({
      children: [
        cellPct({
          text: tip.toUpperCase(),
          widthPct: W_TIP,
          bold: rojo,
          color: rojo ? RED : "000000",
          align: AlignmentType.LEFT,
          size: VALUE_SIZE,
        }),
        cellPct({
          text: String(r.inmuebles ?? 0),
          widthPct: W_INM,
          bold: rojo,
          color: rojo ? RED : "000000",
          align: AlignmentType.CENTER,
          size: VALUE_SIZE,
        }),
        cellPct({
          text: formatCOP(r.recaudoTotal ?? 0),
          widthPct: W_REC,
          bold: rojo,
          color: rojo ? RED : "000000",
          align: AlignmentType.RIGHT,
          size: VALUE_SIZE,
        }),
        cellPct({
          text: formatCOP(r.porRecuperar ?? 0),
          widthPct: W_POR,
          bold: false,
          color: "000000",
          align: AlignmentType.RIGHT,
          size: VALUE_SIZE,
        }),
      ],
    });
  });

  const totalRow = new TableRow({
    children: [
      cellPct({ text: "TOTAL", widthPct: W_TIP, bold: true, color: RED, fill: TOTAL_FILL, align: AlignmentType.CENTER, size: VALUE_SIZE }),
      cellPct({ text: String(totalesResumen.inmuebles ?? 0), widthPct: W_INM, bold: true, color: RED, fill: TOTAL_FILL, align: AlignmentType.CENTER, size: VALUE_SIZE }),
      cellPct({ text: formatCOP(totalesResumen.recaudoTotal ?? 0), widthPct: W_REC, bold: true, color: RED, fill: TOTAL_FILL, align: AlignmentType.RIGHT, size: VALUE_SIZE }),
      cellPct({ text: formatCOP(totalesResumen.porRecuperar ?? 0), widthPct: W_POR, bold: true, color: "000000", fill: TOTAL_FILL, align: AlignmentType.RIGHT, size: VALUE_SIZE }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [header, ...rows, totalRow],
  });
}


function buildTablaRecaudoHorizontalExcelStyle(input: {
  recaudosMensuales: RecaudoMensualRow[];
  formatCOP: (v: number) => string;
}) {
  const { recaudosMensuales, formatCOP } = input;

  const cols = Math.max(1, recaudosMensuales.length);
  const headerSize = fontSizeByCols(cols, "header");
  const valueSize = fontSizeByCols(cols, "value");
  const split = shouldSplitHeader(cols);

  const headerRow = new TableRow({
    children: recaudosMensuales.map((m) => {
      const mes = (m.mesLabel || "").toUpperCase();

      return new TableCell({
        borders: excelBorders(),
        shading: { fill: HEADER_FILL },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            // si quieres compactar aún más verticalmente:
            spacing: { before: 0, after: 0 },
            children: split
              ? [
                new TextRun({ text: "RECAUDO", bold: true, size: headerSize }),
                new TextRun({ text: mes, bold: true, size: headerSize, break: 1 }),
              ]
              : [
                new TextRun({
                  text: `RECAUDO ${mes}`,
                  bold: true,
                  size: headerSize,
                }),
              ],
          }),
        ],
      });
    }),
  });

  const valueRow = new TableRow({
    children: recaudosMensuales.map((m) =>
      excelCell({
        text: moneyNoBreak(formatCOP(m.total)),
        align: AlignmentType.RIGHT,
        size: valueSize,
      })
    ),
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, valueRow],
  });
}



function nombreMes(mes: number) {
  return MESES_ES[Math.max(0, Math.min(11, mes - 1))];
}

function pJust(text: string, after = 120) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after },
    children: [new TextRun({ text, font: "Arial", color: TEXT, size: 24 })],
  });
}

function pJustItalic(text: string, after = 140) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after },
    children: [new TextRun({ text, italics: true, size: 24, color: "000000" })],
  });
}

function buildBloqueGestionInformativa() {
  return [
    pCenterTitleCompact(
      "GESTIÓN INFORMATIVA SISTEMA GESGLO – GESTION GLOBAL ACG SAS"
    ),

   
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      children: [
        new TextRun({
          text: "Para más información por favor ingresar a la página ", italics: true, size: 24, color: "000000"
        }),

        new ExternalHyperlink({
          link: "https://www.gestionglobalacg.com",
          children: [
            new TextRun({
              text: "https://www.gestionglobalacg.com",
              style: "Hyperlink", // importante para azul automático
            }),
          ],
        }),

        new TextRun({
          text:
            " con su usuario y contraseña debidamente enviada al correo de la copropiedad, si necesita soporte para ingresar a la plataforma, por favor comunicarse al correo electrónico: ", italics: true, size: 24, color: "000000"
        }),

        new ExternalHyperlink({
          link: "mailto:soporte@gestionglobalacg.com",
          children: [
            new TextRun({
              text: "soporte@gestionglobalacg.com",
              style: "Hyperlink",
            }),
          ],
        }),
      ],
    }),
  ];
}

function buildBloqueTasacionHonorarios(params: { mesLabel: string; year: number }) {
  const mes = (params.mesLabel || "").toLowerCase();
  const year = params.year;

  return [
    pCenterTitleCompact("TASACION DE HONORARIOS"),

    pJustItalic(
      `Por la consecución de los diferentes procesos y la gestión realizada por nuestros gestores de cobranza, y sin tener en cuenta el valor total de la asignación, hemos generado la Factura Electrónica del mes de ${mes} de ${year}.`,
      180
    ),

    pJustItalic(
      "Esperamos estar cumpliendo con sus expectativas de recaudo, sin otro particular y en espera de sus comentarios.",
      180
    ),

    pJustItalic("Cordialmente.", 200),
  ];
}

function pLeft(text: string, after = 120, bold = false) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after },
    children: [new TextRun({ text, font: "Arial", color: TEXT, size: 24, bold })],
  });
}

function pLeftItalic(text: string, after = 120, bold = false) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after },
    children: [new TextRun({ text, color: TEXT, size: 24, bold, italics: true })], // 12pt => 24 half-points
  });
}

function pLeftItalicRuns(runs: TextRun[], after = 120) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after },
    children: runs,
  });
}

function tr(text: string, opts?: { bold?: boolean; italics?: boolean; color?: string }) {
  return new TextRun({
    text,
    size: 24,
    color: opts?.color ?? TEXT,
    bold: opts?.bold ?? false,
    italics: opts?.italics ?? false,
  });
}

function pCenterTitle(text: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 260, after: 180 },
    children: [
      new TextRun({
        text: (text || "").toUpperCase(),
        bold: true,
        italics: true,
        size: 26,
      }),
    ],
  });
}

function pSmall(text: string, after = 90) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after },
    children: [new TextRun({ text, font: "Arial", color: TEXT, size: 24 })],
  });
}

function spacer(after = 120) {
  return new Paragraph({ text: "", spacing: { after } });
}

function headerRow(cells: string[], rightCols: number[] = []) {
  return new TableRow({
    children: cells.map((c, idx) => {
      const align = rightCols.includes(idx) ? AlignmentType.RIGHT : AlignmentType.LEFT;
      return new TableCell({
        shading: { fill: PURPLE },
        children: [
          new Paragraph({
            alignment: align,
            children: [new TextRun({ text: c, bold: true, color: "FFFFFF", size: 20 })],
          }),
        ],
      });
    }),
  });
}

function bodyRow(values: string[], rightCols: number[] = [], fill?: string, bold = false) {
  return new TableRow({
    children: values.map((v, idx) => {
      const align = rightCols.includes(idx) ? AlignmentType.RIGHT : AlignmentType.LEFT;
      return new TableCell({
        shading: fill ? { fill } : undefined,
        children: [
          new Paragraph({
            alignment: align,
            children: [new TextRun({ text: v ?? "", size: 20, bold })],
          }),
        ],
      });
    }),
  });
}

// Azul estándar de hyperlink Word
const LINK_BLUE = "0563C1";

// Traer imagen desde /public o URL (frontend) -> Uint8Array
async function urlToUint8Array(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar imagen: ${url}`);
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

function pCenterTitleCompact(text: string) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 140 },
    children: [
      new TextRun({
        text: (text || "").toUpperCase(),
        bold: true,
        italics: true,
        size: 26,
        color: "000000",
      }),
    ],
  });
}

// Párrafo centrado en cursiva con link azul subrayado (clickeable)
function pCenterInfoConLink(params: { beforeText: string; url: string; afterText: string }) {
  const { beforeText, url, afterText } = params;

  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160 },
    children: [
      new TextRun({ text: beforeText, italics: true, size: 24, color: "000000" }),

      // Link clickeable
      new ExternalHyperlink({
        link: url,
        children: [
          new TextRun({
            text: url,
            italics: true,
            size: 24,
            color: LINK_BLUE,
            underline: {},
          }),
        ],
      }),

      new TextRun({ text: afterText, italics: true, size: 24, color: "000000" }),
    ],
  });
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type ResumenTipificacionRow = {
  tipificacion: string;
  inmuebles: number;
  recaudoTotal: number;
  porRecuperar: number;
};

export type RecaudoMensualRow = {
  mesLabel: string;
  total: number;
};

export type DetalleTipRow = {
  ubicacion: string;
  nombre: string;
  recaudoTotal: number;
  porRecuperar: number;
};

export type FilaReporteAnual = {
  tipificacion: string;
  inmueble: string;
  nombre: string;
  porRecaudar: number;
  rec_01: number; rec_02: number; rec_03: number; rec_04: number; rec_05: number; rec_06: number;
  rec_07: number; rec_08: number; rec_09: number; rec_10: number; rec_11: number; rec_12: number;
  recaudoTotal: number;
};

export type SeguimientoItem = {
  fecha: string | null; // dd/mm/aaaa o null
  texto: string;
};

export type DemandaWordItem = {
  ubicacion: string;
  demandados: string;
  numeroRadicado?: string;
  juzgado?: string;
  observacionCliente?: string;
  seguimientos: SeguimientoItem[];
};

export type DetallePorTipificacionWord = {
  tipificacion: string;
  inmuebles: number;
  recaudoTotal: number;
  porRecuperar: number;
  detalle: DetalleTipRow[];
  totalesDetalle: { inmuebles: number; recaudoTotal: number; porRecuperar: number };
};


export type ReporteClienteWordInput = {
  ciudad?: string;
  fechaGeneracion?: Date;
  clienteNombre?: string;
  administrador?: string;
  firmaNombre?: string;
  yearTabla?: number;
  monthTabla?: number;

  resumenTipificacion: ResumenTipificacionRow[];
  totalesResumen: { inmuebles: number; recaudoTotal: number; porRecuperar: number };

  recaudosMensuales: RecaudoMensualRow[];

  detallePorTipificacion?: DetallePorTipificacionWord[];

  demandas?: DemandaWordItem[];

  pieChartPngDataUrl?: string;
  barChartPngDataUrl?: string;

  pieChartSize?: { width: number; height: number };
  barChartSize?: { width: number; height: number };

};

export async function buildReporteClienteDocx(input: ReporteClienteWordInput): Promise<Blob> {
  const ciudad = input.ciudad ?? "Bogotá D.C.";
  const administrador =
    (input.administrador ?? "").trim() || "ADMINISTRADOR";

  const nombreFirma = (input.firmaNombre || "").trim();

  const fecha = input.fechaGeneracion ?? new Date();
  const fechaLarga = formatFechaLargaES(fecha);

  const header = await buildHeaderGG();   // ✅ estándar
  const footer = buildFooterGG();         // ✅ estándar

  // ✅ IMPORTANTE: children NO puede ser Paragraph[] si vas a meter Table/Images
  const children: any[] = [];

  const mesInicio = "enero";
  const mesFin = input.monthTabla
    ? nombreMes(input.monthTabla)
    : "diciembre";

  const year = input.yearTabla ?? new Date().getFullYear();

  const nombreCliente = input.clienteNombre?.trim()
    ? input.clienteNombre.trim().toUpperCase()
    : "CLIENTE";

  children.push(pLeftItalic(`${ciudad}, ${fechaLarga}`, 220)); // fecha en cursiva
  children.push(pLeftItalic("Señores", 0));             // cursiva + bold
  children.push(pLeftItalic(nombreCliente, 0, true));


  children.push(
    pLeftItalicRuns(
      [
        tr("Señor(a) ", { italics: true }),
        tr(administrador.toUpperCase(), { italics: true }),
      ],
      0
    )
  );

  children.push(pLeftItalic("Administrador", 0));
  children.push(pLeftItalic("Ciudad", 330));
  children.push(pLeftItalic("Cordial saludo,", 300));

  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: "En atención me permito remitir un informe sobre la gestión que hemos venido desempeñando de ",
          italics: true,
          size: 24,
        }),
        new TextRun({
          text: `${mesInicio} al mes de ${mesFin} de ${year}, `,
          italics: true,
          size: 24,
        }),
        new TextRun({
          text: "para la ",
          italics: true,
          size: 24,
        }),
        new TextRun({
          text: `${nombreCliente}, `,
          italics: true,
          bold: true,          // 👈 como en el ejemplo
          size: 24,
        }),
        new TextRun({
          text:
            "en el área Pre-Jurídico y Jurídico, con cartera de más de 180 días de mora, donde podemos visualizar la acción que se ha realizado con cada uno de los deudores, que fueron entregados para la gestión de cobro.",
          italics: true,
          size: 24,
        }),
      ],
    })
  );


  children.push(
    buildTablaResumenTipificacionExcelStyle({
      resumenTipificacion: input.resumenTipificacion,
      totalesResumen: input.totalesResumen,
      formatCOP,
    })
  );

  children.push(spacer(180));

  // ✅ Gráfico Pie (PNG)
  children.push(pCenterTitle("CARTERA POR TIPIFICACIÓN"));
  const targetWidth = 580;
  if (input.pieChartPngDataUrl) {
    const pieBytes = dataUrlToUint8Array(input.pieChartPngDataUrl);
    const srcW = input.pieChartSize?.width ?? 1;
    const srcH = input.pieChartSize?.height ?? 1;

    const targetHeight = Math.round((targetWidth * srcH) / srcW);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new ImageRun({
            data: pieBytes,
            type: "png",
            transformation: { width: targetWidth, height: targetHeight },
          }),
        ],
      })
    );
  } else {
    children.push(pJust("(Gráfico no disponible)", 180));
  }

  children.push(spacer(100));

  // ✅ Gráfico Barras (PNG)
  children.push(pCenterTitle("RECAUDO"));

  // ===== Párrafo RECAUDO (igual estilo que "En atención...") =====
  const totalRecaudo = input.totalesResumen.recaudoTotal ?? 0;
  const totalRecaudoFmt = formatCOP(totalRecaudo);

  // 👇 convertir a letras (ver helper en el punto 2)
  const totalRecaudoLetras = numeroALetras(totalRecaudo).toUpperCase();

  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: "Se puede observar que, de ",
          italics: true,
          size: 24,
        }),
        new TextRun({
          text: `${mesInicio} al mes de ${mesFin} de ${year}, `,
          italics: true,
          size: 24,
        }),
        new TextRun({
          text: "se ha generado un recaudo de ",
          italics: true,
          size: 24,
        }),

        // ✅ valor en rojo
        new TextRun({
          text: `${totalRecaudoFmt}`,
          italics: true,
          bold: true,
          color: RED,
          size: 24,
        }),

        new TextRun({
          text: " (",
          italics: true,
          size: 24,
        }),

        // ✅ valor en letras en rojo
        new TextRun({
          text: `${totalRecaudoLetras} PESOS M/CTE`,
          italics: true,
          bold: true,
          color: RED,
          size: 24,
        }),

        new TextRun({
          text: "). Correspondientes a abonos, pagos totales, acuerdos de pago los cuales se encuentran reflejados de la siguiente forma:",
          italics: true,
          size: 24,
        }),
      ],
    })
  );

  children.push(spacer(100));

  children.push(
    buildTablaRecaudoHorizontalExcelStyle({
      recaudosMensuales: input.recaudosMensuales,
      formatCOP,
    })
  );

  children.push(spacer(100));

  // ✅ Gráfico Barras (PNG) - respetando aspect ratio (igual que el pie)
  if (input.barChartPngDataUrl) {
    const barBytes = dataUrlToUint8Array(input.barChartPngDataUrl);

    const srcW = input.barChartSize?.width ?? 1;
    const srcH = input.barChartSize?.height ?? 1;

    // Escoge un ancho objetivo coherente con tu documento:
    // - 520 funciona bien
    // - si quieres más ancho: 560 o 600 (pero ojo con márgenes)
    const targetWidth = 560;
    const targetHeight = Math.round((targetWidth * srcH) / srcW);

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new ImageRun({
            data: barBytes,
            type: "png",
            transformation: { width: targetWidth, height: targetHeight },
          }),
        ],
      })
    );
  } else {
    children.push(pJust("(Gráfico no disponible)", 180));
  }




  // ===============================
  // DETALLE POR TIPIFICACIÓN (TODAS)
  // ===============================
  const detalleAll = (input.detallePorTipificacion || [])
    .filter((x) => (x.inmuebles ?? 0) > 0);

  // ✅ total inmuebles (base del porcentaje, igual que el PIE de la UI)
  const totalInmueblesTip = detalleAll.reduce(
    (acc, x) => acc + (x.inmuebles ?? 0),
    0
  );

  if (detalleAll.length) {
    detalleAll.forEach((bloque) => {
      // ✅ porcentaje por cantidad de inmuebles (NO por volumen)
      const porcentaje = pctOf(bloque.inmuebles ?? 0, totalInmueblesTip); // 0..100

      children.push(
        pLeyendaTipificacionWord({
          tipificacion: bloque.tipificacion,
          inmuebles: bloque.inmuebles,
          porcentaje,
          recaudoTotal: bloque.recaudoTotal ?? 0,
        })
      );

      if (!bloque.detalle?.length) {
        children.push(pJust("No hay deudores para esta tipificación.", 160));
      } else {
        children.push(
          buildTablaDetalleTipificacionExcelStyle({
            detalle: bloque.detalle,
            totales: bloque.totalesDetalle,
          })
        );
      }

      children.push(spacer(180));
    });
  }



  // PROCESOS DE DEMANDA (formato gerencial tipo “tarjeta Excel”)
  children.push(pCenterTitle("SEGUIMIENTO PROCESOS DE DEMANDA"));

  if (!input.demandas?.length) {
    children.push(pJust("No hay demandas para mostrar.", 160));
  } else {
    input.demandas.forEach((d) => {
      const blocks = buildProcesoDemandaCard({
        ubicacion: d.ubicacion || "Sin ubicación",
        demandados: d.demandados || "",
        numeroRadicado: d.numeroRadicado || "",
        juzgado: d.juzgado || "",
        seguimientos: d.seguimientos || [],
        observacionCliente: d.observacionCliente || "",
      });

      // tabla info + tabla observaciones
      children.push(...blocks);

      // espacio entre “tarjetas”
      children.push(spacer(180));
    });
  }

  // ===============================
  // RECOMENDACIONES (final) - SOLO si hay deudores
  // ===============================
  const gestionandoBlock = (input.detallePorTipificacion || []).find(
    (x) => normalizeTip(x.tipificacion) === "GESTIONANDO"
  );

  const recomRowsRaw = (gestionandoBlock?.detalle || []).filter(
    (d) => (d.porRecuperar ?? 0) >= RECOM_MIN
  );

  if (recomRowsRaw.length) {
    // ✅ mes dinámico según consulta
    const mesCapital =
      input.monthTabla ? nombreMes(input.monthTabla) : "enero"; // fallback si no llega monthTabla

    children.push(pCenterTitleUnderline("RECOMENDACIONES"));

    children.push(
      pRecomendacionesWord({
        clienteNombre: nombreCliente,
        cantidad: recomRowsRaw.length,
        monto: RECOM_MIN, // fijo 2.000.000
      })
    );

    const recomRows = recomRowsRaw.map((d) => ({
      tipificacion: "GESTIONANDO",
      ubicacion: d.ubicacion ?? "",
      deudor: d.nombre ?? "",
      capitalMes: d.porRecuperar ?? 0, // 👈 tu "capital" para esta tabla (realmente es POR RECUPERAR)
    }));

    children.push(
      buildTablaRecomendacionesExcelStyle({
        mesLabel: mesCapital,
        rows: recomRows,
      })
    );

    children.push(spacer(180));
  }


  // ===============================
  // BLOQUES FIJOS FINALES + FIRMA
  // ===============================
  const mesConsulta = input.monthTabla ? nombreMes(input.monthTabla) : mesFin; // mesFin ya lo calculas arriba
  const yearConsulta = input.yearTabla ?? year;

  //children.push(spacer(220));

  // Bloque informativo
  children.push(...buildBloqueGestionInformativa());

  //children.push(spacer(120));

  // Tasación (mes/año dinámico)
  children.push(...buildBloqueTasacionHonorarios({ mesLabel: mesConsulta, year: yearConsulta }));

  // Firma (imagen + texto)
  children.push(...(await buildFirmaGG({
    nombreFirma: input.firmaNombre
  })));


  const baseSectionProps = {
    page: {
      margin: {
        top: cm(1.2),     // opcional: reduce un poco el margen superior general
        bottom: cm(2),
        left: cm(3),
        right: cm(2),

        header: cm(0.2),  // 🔥 ESTO es lo que sube el logo (distancia del header al borde)
        footer: cm(0.8),  // opcional: distancia del footer (si quieres)
      },
    },
  };

  const FONT = "Arial";
  const SIZE_12 = 24; // docx usa half-points => 12pt = 24

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: SIZE_12,
            color: TEXT,
          },
          paragraph: {
            spacing: { line: 276 }, // opcional: interlineado “bonito” (~1.15)
          },
        },
      },
    },
    sections: [
      {
        properties: baseSectionProps,
        headers: { default: header },
        footers: { default: footer },
        children,
      },
    ],
  });


  return Packer.toBlob(doc);
}
