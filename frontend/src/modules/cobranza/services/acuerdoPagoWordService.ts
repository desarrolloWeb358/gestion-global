// src/modules/cobranza/services/acuerdoPagoWordService.ts
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  TableLayoutType,
  VerticalAlign,
  TextDirection,
  ImageRun,
} from "docx";

import type { IRunOptions, IParagraphOptions } from "docx";
import type { CuotaAcuerdo } from "@/modules/cobranza/models/acuerdoPago.model";

import {
  buildFooterGG,
  buildHeaderGG,
  cm,
  formatCOP,
  formatDateDDMMYYYY,
  saveDocx,
  type GGBrandingOptions,
} from "../services/reportes/helperWord"




// =====================
// Constantes / helpers
// =====================
const FONT = "Arial";
const COLOR_RED = "C00000";


const isMissing = (v: any) => v === null || v === undefined || String(v).trim() === "";

// ✅ IRunOptions sí soporta bold/color/font/size
const r = (text: string, opts: Partial<IRunOptions> = {}) => {
  const isPlaceholder = text.includes("XXXXX");

  return new TextRun({
    text,
    font: FONT,
    size: 22,
    color: isPlaceholder ? COLOR_RED : opts.color,
    bold: isPlaceholder ? true : opts.bold,
    ...opts,
  });
};


const rBold = (text: string) => r(text, { bold: true });
const rRed = (text: string) => r(text, { bold: true, color: COLOR_RED });

const p = (children: TextRun[], opts: Partial<IParagraphOptions> = {}) =>
  new Paragraph({
    children,
    spacing: { after: 180, line: 240 },
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
    spacing: { after: 180, line: 240 },
  });

function noBorders() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };
}

// Traer imagen desde /public o URL (frontend) -> Uint8Array
async function urlToUint8Array(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo cargar imagen: ${url}`);
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

async function buildFirmaAcreedor(params: {
  nombre?: string;
  cargo?: string;
  empresa?: string;
  nit?: string;
}) {
  // ✅ archivo en /public/images/logo/firma_javier.jpeg
  const firmaBytes = await urlToUint8Array("/images/logo/firma_javier.jpeg");

  const nombre = (params.nombre || "").trim();
  const cargo = (params.cargo || "").trim();
  const empresa = (params.empresa || "").trim();
  const nit = (params.nit || "").trim();

  return [
    // (opcional) espacio antes de la firma, ajusta si quieres
    new Paragraph({ text: "", spacing: { after: 100 } }),

    // ✅ Imagen firma
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [
        new ImageRun({
          data: firmaBytes,
          type: "jpg", // 👈 IMPORTANTÍSIMO: docx usa "jpg" (no "jpeg")
          transformation: { width: 190, height: 70 }, // ajusta a tu gusto
        }),
      ],
    }),

    // Empresa
    p([rBold(empresa || "GESTION GLOBAL ACG S.A.S")], { spacing: { after: 0 } }),

    // NIT
    p([rBold("Nit. "), rBold(nit || "901.662.783-7"), r(".")], { spacing: { after: 0 } }),
    
    // Nombre
    p([valOrRedBold(nombre, "XXXXX (REPRESENTANTE LEGAL)")], { spacing: { after: 0 } }),

    // Cargo
    p([rBold(cargo || "Representante Legal")], { spacing: { after: 0 } }),

    
  ];
}




const sectionTitle = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 220, after: 200 },
    children: [new TextRun({ text, font: FONT, size: 22, bold: true })],
  });

const valOrRed = (v: any, fallback = "XXXXX") => (isMissing(v) ? rRed(fallback) : r(String(v)));
const valOrRedBold = (v: any, fallback = "XXXXX") => (isMissing(v) ? rRed(fallback) : rBold(String(v)));



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

  formaPago?: string;
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

const COLOR_HEADER = "BDD7EE";  // azul claro tipo Excel
const COLOR_TOTAL = "9DC3E6";   // azul más fuerte para totales
const COLOR_YELLOW = "FFF200";  // amarillo columna vertical
const BORDER_COLOR = "000000";

function cellBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 8, color: BORDER_COLOR },
    bottom: { style: BorderStyle.SINGLE, size: 8, color: BORDER_COLOR },
    left: { style: BorderStyle.SINGLE, size: 8, color: BORDER_COLOR },
    right: { style: BorderStyle.SINGLE, size: 8, color: BORDER_COLOR },
  };
}

function th2(text: string) {
  return new TableCell({
    shading: { fill: COLOR_HEADER },
    verticalAlign: VerticalAlign.CENTER,
    borders: cellBorders(),
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, font: FONT, size: 20 })],
      }),
    ],
  });
}

function tdMoney(v: number, align: DocxAlignment = AlignmentType.RIGHT) {
  const text = formatCOP(v || 0);
  return new TableCell({
    borders: cellBorders(),
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        children: [new TextRun({ text, font: FONT, size: 20 })],
      }),
    ],
  });
}

function tdPlain(text: string, align: DocxAlignment = AlignmentType.LEFT) {
  const isX = text === "XXXXX";
  return new TableCell({
    borders: cellBorders(),
    verticalAlign: VerticalAlign.CENTER,
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

function totalCell(title: string, value: number) {
  return new TableCell({
    borders: cellBorders(),
    shading: { fill: COLOR_TOTAL },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: title, bold: true, font: FONT, size: 20 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: formatCOP(value), bold: true, font: FONT, size: 20 })],
      }),
    ],
  });
}

function emptyCell(colSpan = 1) {
  return new TableCell({
    columnSpan: colSpan,
    borders: cellBorders(),
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ text: "" })],
  });
}

function totalBoxCell(text: string, shaded = true) {
  return new TableCell({
    borders: cellBorders(),
    shading: shaded ? { fill: COLOR_TOTAL } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            bold: true,
            font: FONT,
            size: 20,
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

function buildAmortTableExcelStyle(input: AcuerdoPagoWordInput) {
  const cuotas = input.cuotas || [];

  const totalCapital = Math.round(input.capitalInicial || 0);
  const totalHonorarios = Math.round((input.totalAcordado || 0) - (input.capitalInicial || 0));
  const totalAcuerdo = Math.round(input.totalAcordado || 0);

  // Header (como imagen)
  const header = new TableRow({
    children: [
      th2("No.\nCUOTAS"),
      th2("FECHA DE\nPAGOS"),
      th2("DEUDA\nCAPITAL"),
      th2("CUOTA\nCAPITAL"),
      th2("DEUDA\nHONORARIOS"),
      th2("CUOTA\nHONORARIOS"),
      th2("CUOTA\nACUERDO"),
      th2("CUOTA\nADMON\nMENSUAL"),
    ],
  });

  const rows: TableRow[] = cuotas.map((c, idx) => {
    const fechaObj = toDateFromFirestore((c as any).fechaPago);
    const fechaTxt = fechaObj ? formatDateDDMMYYYY(fechaObj) : "XXXXX";

    const baseCells: TableCell[] = [
      tdPlain(String(c.numero ?? ""), AlignmentType.CENTER),
      tdPlain(fechaTxt, AlignmentType.CENTER),

      // Deuda capital (capitalSaldoAntes)
      tdMoney(Math.round((c as any).capitalSaldoAntes || 0), AlignmentType.RIGHT),

      // Cuota capital
      tdMoney(Math.round(c.capitalCuota || 0), AlignmentType.RIGHT),

      // Deuda honorarios (honorariosSaldoAntes)
      tdMoney(Math.round((c as any).honorariosSaldoAntes || 0), AlignmentType.RIGHT),

      // Cuota honorarios
      tdMoney(Math.round(c.honorariosCuota || 0), AlignmentType.RIGHT),

      // Cuota acuerdo
      tdMoney(Math.round(c.valorCuota || 0), AlignmentType.RIGHT),
    ];

    // Última columna amarilla: 1 sola celda con rowSpan que cubre:
    // - filas de cuotas
    // - +2 filas de totales (las que vamos a agregar abajo)
    if (idx === 0) {
      baseCells.push(
        new TableCell({
          rowSpan: Math.max(cuotas.length, 1) + 2, // 👈 clave (antes era solo cuotas.length)
          shading: { fill: COLOR_YELLOW },
          borders: cellBorders(),
          verticalAlign: VerticalAlign.CENTER,
          textDirection: TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "MAS CUOTA DE ADMINISTRACION MENSUAL",
                  bold: true,
                  font: FONT,
                  size: 20,
                }),
              ],
            }),
          ],
        })
      );
    }

    return new TableRow({ children: baseCells });
  });

  // ==========================
  // ✅ FILAS DE TOTALES (DENTRO DE LA MISMA TABLA)
  // ==========================
  // Columnas:
  // 1 No
  // 2 Fecha
  // 3 Deuda capital
  // 4 Cuota capital      <-- TOTAL CAPITAL aquí
  // 5 Deuda honorarios
  // 6 Cuota honorarios   <-- TOTAL HONORARIOS aquí
  // 7 Cuota acuerdo      <-- TOTAL ACUERDO aquí
  // 8 Cuota admon mensual (amarillo) <-- NO se agrega aquí porque ya está "rowSpan" desde la primera fila

  const totalsRowLabels = new TableRow({
    children: [
      emptyCell(3),                    // cols 1-3 vacías
      totalBoxCell("TOTAL\nCAPITAL"),   // col 4
      emptyCell(1),                    // col 5 vacía
      totalBoxCell("TOTAL\nHONORARIOS"),// col 6
      totalBoxCell("TOTAL\nACUERDO"),   // col 7
      // col 8 NO VA (porque está combinada con rowSpan)
    ],
  });

  const totalsRowValues = new TableRow({
    children: [
      emptyCell(3),
      totalBoxCell(formatCOP(totalCapital), true),
      emptyCell(1),
      totalBoxCell(formatCOP(totalHonorarios), true),
      totalBoxCell(formatCOP(totalAcuerdo), true),
      // col 8 NO VA (rowSpan)
    ],
  });

  const mainTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [header, ...rows, totalsRowLabels, totalsRowValues],
  });

  return { mainTable };
}


// =====================
// Export principal
// =====================
export async function descargarAcuerdoPagoWord(input: AcuerdoPagoWordInput) {
  // Branding opcional: si input trae overrides, los pasas al helper
  const branding: GGBrandingOptions = {
    footerDireccion: input.footerDireccion,
    footerTelefonos: input.footerTelefonos,
    footerEmail: input.footerEmail,
    footerWeb: input.footerWeb,
    // headerImageUrl: "/images/logo/encabezado_word.jpg" // si algún día lo cambias
  };

  const header = await buildHeaderGG(branding);
  const footer = buildFooterGG(branding);


  const empresaNombre = input.empresaNombre ?? "GESTION GLOBAL ACG S.A.S";
  const empresaNit = input.empresaNit ?? "901.662.783-7";
  const empresaRepresentante = input.empresaRepresentante ?? "XXXXX";

  const formaPago = input.formaPago ?? "XXXXX";

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
          page: {
            size: {
              width: 12240,  // 8.5"
              height: 15840, // 11"
            },
            margin: {
              top: cm(2),
              bottom: cm(2),
              left: cm(3),
              right: cm(2),
            },
          },
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

          //new Paragraph({ text: "", spacing: { after: 180 } }),

          // ===== CONSIDERACIONES =====
          sectionTitle("CONSIDERACIONES:"),

          // Consid 1
          pJustify([
            rRed("Que el señor "),
            valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)"),
            r(", deuda acreencias a favor de la copropiedad "),
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
            r(", de una parte y por otra parte "),
            rRed("el señor "),
            valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)"),
            r(", hemos acordado celebrar el presente acuerdo de pago, que se regirá en especial por las siguientes:"),
          ]),

          //new Paragraph({ text: "", spacing: { after: 180 } }),

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
          new Paragraph({ text: "", spacing: { after: 120 } }),
          new Paragraph({ text: "", spacing: { after: 120 } }),

          // TABLA AMORTIZACION
          ...(input.cuotas?.length
            ? (() => {
              const { mainTable } = buildAmortTableExcelStyle(input);

              return [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 120, after: 180 },
                  children: [
                    new TextRun({
                      text: "TABLA DE AMORTIZACIÓN SEGÚN ACUERDO\nEXTRAPROCESO",
                      font: FONT,
                      bold: true,
                      size: 36,
                    }),
                  ],
                }),

                mainTable,

                new Paragraph({ text: "", spacing: { after: 180 } }),
              ];
            })()
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
            spacing: { after: 180, line: 240 },
            children: [
              rBold("CUOTA ACUERDO DE PAGO "),
              valOrRedBold(
                formaPago?.toUpperCase(),
                " CONSIGNACION "
              ),
              rBold(" ("),
              valOrRedBold(
                acreedor?.toUpperCase(),
                "XXXXX (NOMBRE CONJUNTO)"
              ),
              rBold(
                ") Y HACER LLEGAR DE MANERA INMEDIATA AL EMAIL carterazona1@gestionglobalacg.com O AL WHATSAPP "
              ),
              rBold(
                " XXXXXX "
              ),
              rBold(
                " COPIA DE CADA UNA DE LAS CONSIGNACIONES QUE SE REALICEN DENTRO DE ESTE ACUERDO."
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
            rRed(" y el señor "),
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
          new Paragraph({ text: "", spacing: { after: 220 } }),

/**/ new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({
                children: [
                  // IZQUIERDA (ancha) - SIN BORDES
                  new TableCell({
                    width: { size: 9000, type: WidthType.DXA }, // 👈 ancho grande
                    borders: noBorders(),
                    verticalAlign: VerticalAlign.TOP,
                    children: [
                      new Paragraph({ text: "", spacing: { after: 1800 } }),
                      p([valOrRedBold(deudor, "XXXXX (NOMBRE DEUDOR)")]),
                      p([
                        r("C.C No. "),
                        valOrRedBold(input.deudorDocumento, "XXXXX (CÉDULA)"),
                        r(" de "),
                        valOrRedBold(input.deudorCiudadDoc, "XXXXX (CIUDAD)"),
                        r("."),
                      ]),
                    ],
                  }),

                ],
              }),
            ],
          }),

          new Paragraph({ text: "", spacing: { after: 600 } }),

          p([rBold("EL ACREEDOR,")]),
          new Paragraph({ text: "", spacing: { after: 200 } }),

          ...(await buildFirmaAcreedor({
            nombre: empresaRepresentante,
            cargo: "Representante Legal",
            empresa: empresaNombre,
            nit: empresaNit,
          })),
        ],
      },
    ],
  });


  const blob = await Packer.toBlob(doc);
  const fileName = `Acuerdo_Pago_${(input.numeroAcuerdo || "SIN_NUMERO").replace(/\s+/g, "_")}.docx`;
  saveDocx(blob, fileName);

}
