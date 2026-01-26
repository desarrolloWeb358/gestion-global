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

// =====================
// Branding centralizado
// =====================
export const WORD_FONT = "Arial";
export const COLOR_BLUE = "1F4E79";

// cm -> twips
export const cm = (v: number) => Math.round(v * 567);

async function fetchUint8Array(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar imagen: ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

// ✅ Header igual al acuerdo
export async function buildGGHeader(): Promise<Header> {
  const data = await fetchUint8Array("/images/logo/encabezado_word.jpg");

  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: "jpg",
            data,
            transformation: { width: 520, height: 90 },
          }),
        ],
        spacing: { after: 120 },
      }),
    ],
  });
}

// ✅ Footer igual al acuerdo
export function buildGGFooter(input?: {
  footerDireccion?: string;
  footerTelefonos?: string;
  footerEmail?: string;
  footerWeb?: string;
}): Footer {
  const footerDireccion = input?.footerDireccion ?? "Calle 24 sur # 68 h 52 segundo piso";
  const footerTelefonos = input?.footerTelefonos ?? "Teléfonos: (601) 4631148 – 3017566868 – 3123152594";
  const footerEmail = input?.footerEmail ?? "Email: gestionglobalacg@gestionglobalacg.com";
  const footerWeb = input?.footerWeb ?? "www.gestionglobalacg.com";

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
              footerLine(footerDireccion),
              footerLine(footerTelefonos),
              footerLine(footerEmail),
              footerLine(footerWeb),
            ],
          }),
        ],
      }),
    ],
  });

  return new Footer({ children: [t] });
}

function footerLine(text: string) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text, font: WORD_FONT, size: 18, color: COLOR_BLUE, bold: true })],
  });
}
