// helperWord.ts
import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  ImageRun,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { saveAs } from "file-saver";

const FONT = "Arial";
const COLOR_BLUE = "1F4E79";

// 👇 Cache para NO hacer fetch cada vez que generas un Word
let headerImageCache: Uint8Array | null = null;

async function fetchUint8Array(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar imagen: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

export type GGBrandingOptions = {
  headerImageUrl?: string; // default: /images/logo/encabezado_word.jpg

  footerDireccion?: string;
  footerTelefonos?: string;
  footerEmail?: string;
  footerWeb?: string;
};

export async function buildHeaderGG(opts: GGBrandingOptions = {}) {
  const url = opts.headerImageUrl ?? "/images/logo/encabezado_word.jpg";

  if (!headerImageCache) {
    headerImageCache = await fetchUint8Array(url);
  }

  // Ajustes finos:
  // - "LEFT_PAD" controla cuánto se corre a la derecha (más % a la izquierda = más a la derecha)
  // - "spacing.after" más pequeño = más arriba
  const LEFT_PAD = 20;  // antes 50/0, prueba 60-70 según te guste
  const RIGHT_COL = 100 - LEFT_PAD;

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: LEFT_PAD, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            children: [new Paragraph({ text: "" })],
          }),
          new TableCell({
            width: { size: RIGHT_COL, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 0 },
                children: [
                  new ImageRun({
                    type: "jpg",
                    data: headerImageCache,
                    transformation: { width: 520, height: 90 },
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return new Header({
    children: [headerTable],
  });
}

export function buildFooterGG(opts: GGBrandingOptions = {}) {
  const footerDireccion = opts.footerDireccion ?? "Calle 24 sur # 68 h 52 segundo piso";
  const footerTelefonos = opts.footerTelefonos ?? "Teléfonos: (601) 4631148 – 3017566868 – 3123152594";
  const footerEmail = opts.footerEmail ?? "Email: gestionglobalacg@gestionglobalacg.com";
  const footerWeb = opts.footerWeb ?? "www.gestionglobalacg.com";

  const LEFT = 45;
  const RIGHT = 55;

  const t = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: LEFT, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 24, color: COLOR_BLUE },
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


export const cm = (v: number) => Math.round(v * 567);

export const formatCOP = (v: number) => `$ ${Math.round(v || 0).toLocaleString("es-CO")}`;

export const formatDateDDMMYYYY = (d?: Date | null) => {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

export const formatFechaLargaES = (d: Date) =>
  d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

export function saveDocx(blob: Blob, fileName: string) {
  saveAs(blob, fileName);
}