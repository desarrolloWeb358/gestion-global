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
} from "docx";

const PURPLE = "4F46E5";
const LIGHT = "EEF2FF";
const GRAY = "FAFAFA";
const TEXT = "2B2B2B";

export const formatCOP = (v: number) => `$ ${Number(v || 0).toLocaleString("es-CO")}`;

export const formatFechaLargaES = (d: Date) =>
  d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

function pJust(text: string, after = 120) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after },
    children: [new TextRun({ text, color: TEXT, size: 22 })],
  });
}

function pLeft(text: string, after = 120, bold = false) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after },
    children: [new TextRun({ text, color: TEXT, size: 22, bold })],
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
    children: [new TextRun({ text, color: TEXT, size: 20 })],
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

export type ReporteClienteWordInput = {
  ciudad?: string;
  fechaGeneracion?: Date;
  clienteNombre?: string;

  resumenTipificacion: ResumenTipificacionRow[];
  totalesResumen: { inmuebles: number; recaudoTotal: number; porRecuperar: number };

  recaudosMensuales: RecaudoMensualRow[];

  tipSeleccionada?: string;
  detalleTip?: DetalleTipRow[];
  totalesDetalle?: { inmuebles: number; recaudoTotal: number; porRecuperar: number };

  yearTabla?: number;
  tablaDeudoresAnual?: FilaReporteAnual[];

  demandas?: DemandaWordItem[];

  pieChartPngDataUrl?: string;
  barChartPngDataUrl?: string;
};

export async function buildReporteClienteDocx(input: ReporteClienteWordInput): Promise<Blob> {
  const ciudad = input.ciudad ?? "Bogotá D.C.";
  const fecha = input.fechaGeneracion ?? new Date();
  const fechaLarga = formatFechaLargaES(fecha);

  // ✅ IMPORTANTE: children NO puede ser Paragraph[] si vas a meter Table/Images
  const children: any[] = [];

  children.push(pLeft(`${ciudad}, ${fechaLarga}`, 220));
  children.push(pLeft("Señores", 60, true));
  children.push(pLeft(input.clienteNombre?.trim() ? input.clienteNombre.trim() : "Cliente", 160));
  children.push(pLeft("Respetado(a) señor(a)", 160));

  children.push(
    pJust(
      "En atención, me permito remitir el informe del estado de cartera y gestión registrada en el sistema Gestión Global. A continuación se presenta el resumen por tipificación, el recaudo mensual y el detalle de deudores, junto con el seguimiento de demandas cuando aplique.",
      220
    )
  );

  children.push(pCenterTitle("RECAUDO"));
  children.push(
    pJust(
      `A la fecha, el recaudo total acumulado es de ${formatCOP(input.totalesResumen.recaudoTotal)} y queda por recuperar ${formatCOP(input.totalesResumen.porRecuperar)}.`,
      180
    )
  );

  input.resumenTipificacion.forEach((r) => {
    children.push(
      pJust(
        `${r.tipificacion}: En esta tipificación tenemos ${r.inmuebles} inmueble(s). ` +
          `A la fecha se ha recaudado ${formatCOP(r.recaudoTotal)} y queda por recuperar ${formatCOP(r.porRecuperar)}.`,
        120
      )
    );
  });

  children.push(pCenterTitle("RESUMEN POR TIPIFICACIÓN"));

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow(["Tipificación", "Inmueble", "Recaudo total", "Por recuperar"], [1, 2, 3]),
        ...input.resumenTipificacion.map((r, i) =>
          bodyRow(
            [r.tipificacion, `${r.inmuebles}`, formatCOP(r.recaudoTotal), formatCOP(r.porRecuperar)],
            [1, 2, 3],
            i % 2 === 1 ? GRAY : undefined
          )
        ),
        bodyRow(
          [
            "TOTAL",
            `${input.totalesResumen.inmuebles}`,
            formatCOP(input.totalesResumen.recaudoTotal),
            formatCOP(input.totalesResumen.porRecuperar),
          ],
          [1, 2, 3],
          LIGHT,
          true
        ),
      ],
    })
  );

  children.push(spacer(180));

  // ✅ Gráfico Pie (PNG)
  children.push(pCenterTitle("TIPIFICACIÓN DE INMUEBLES"));
  if (input.pieChartPngDataUrl) {
    const pieBytes = dataUrlToUint8Array(input.pieChartPngDataUrl);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new ImageRun({
            data: pieBytes,
            type: "png", // ✅ fuerza raster, evita overload SVG
            transformation: { width: 520, height: 300 },
          }),
        ],
      })
    );
  } else {
    children.push(pJust("(Gráfico no disponible)", 180));
  }

  // ✅ Gráfico Barras (PNG)
  children.push(pCenterTitle("RECAUDO MES A MES"));
  if (input.barChartPngDataUrl) {
    const barBytes = dataUrlToUint8Array(input.barChartPngDataUrl);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new ImageRun({
            data: barBytes,
            type: "png",
            transformation: { width: 520, height: 300 },
          }),
        ],
      })
    );
  } else {
    children.push(pJust("(Gráfico no disponible)", 180));
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow(["Mes", "Recaudo"], [1]),
        ...input.recaudosMensuales.map((m, i) =>
          bodyRow([m.mesLabel, formatCOP(m.total)], [1], i % 2 === 1 ? GRAY : undefined)
        ),
      ],
    })
  );

  children.push(spacer(200));

  if (input.tipSeleccionada) {
    children.push(pCenterTitle(`DETALLE DE DEUDORES POR TIPIFICACIÓN (${input.tipSeleccionada})`));

    if (!input.detalleTip?.length) {
      children.push(pJust("No hay deudores para esta tipificación.", 160));
    } else {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            headerRow(["Ubicación", "Deudor", "Recaudo total", "Por recuperar"], [2, 3]),
            ...input.detalleTip.map((d, i) =>
              bodyRow(
                [d.ubicacion, d.nombre, formatCOP(d.recaudoTotal), formatCOP(d.porRecuperar)],
                [2, 3],
                i % 2 === 1 ? GRAY : undefined
              )
            ),
            ...(input.totalesDetalle
              ? [
                  bodyRow(
                    [
                      "TOTAL",
                      `${input.totalesDetalle.inmuebles}`,
                      formatCOP(input.totalesDetalle.recaudoTotal),
                      formatCOP(input.totalesDetalle.porRecuperar),
                    ],
                    [1, 2, 3],
                    LIGHT,
                    true
                  ),
                ]
              : []),
          ],
        })
      );
    }
    children.push(spacer(220));
  }

  // Seguimiento demandas
  children.push(pCenterTitle("SEGUIMIENTO DE DEMANDAS"));

  if (!input.demandas?.length) {
    children.push(pJust("No hay demandas para mostrar.", 160));
  } else {
    input.demandas.forEach((d) => {
      children.push(
        new Paragraph({
          spacing: { after: 70 },
          children: [
            new TextRun({
              text: `Inmueble: ${d.ubicacion || "Sin ubicación"}`,
              bold: true,
              size: 22,
            }),
          ],
        })
      );

      if (d.demandados) children.push(pSmall(`Demandado(s): ${d.demandados}`));
      if (d.numeroRadicado) children.push(pSmall(`Radicado: ${d.numeroRadicado}`));
      if (d.juzgado) children.push(pSmall(`Juzgado: ${d.juzgado}`));

      children.push(spacer(80));

      const lista: SeguimientoItem[] = [
        ...(d.seguimientos || []),
        {
          fecha: null,
          texto: d.observacionCliente?.trim()
            ? d.observacionCliente.trim()
            : "Sin observación registrada para el conjunto.",
        },
      ];

      lista.forEach((it) => {
        children.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              ...(it.fecha
                ? [new TextRun({ text: `${it.fecha}  `, bold: true, size: 20, color: "555555" })]
                : []),
              new TextRun({ text: it.texto || "Sin descripción", size: 20 }),
            ],
          })
        );
      });

      children.push(spacer(160));
    });
  }

  children.push(
    pJust(
      "Estas son algunas de las evidencias que se pueden observar sobre la gestión realizada. Para más información, por favor ingresar a la plataforma con el usuario y contraseña entregados.",
      180
    ),
    pJust(
      "Esperamos estar cumpliendo con sus expectativas de recaudo. Sin otro particular y en espera de sus comentarios.",
      220
    ),
    pLeft("Cordialmente,", 200),
    pLeft("GESTIÓN GLOBAL ACG S.A.S.", 60, true)
  );

  // Landscape para tabla anual (si existe)
  const landscapeChildren: any[] = [];

  if (input.tablaDeudoresAnual?.length) {
    landscapeChildren.push(pCenterTitle(`TABLA DE DEUDORES (AÑO ${input.yearTabla ?? ""})`), spacer(120));

    const head = [
      "Tipificación",
      "Inmueble",
      "Nombre",
      "Por Recaudar",
      "Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic",
      "Recaudo Total",
    ];

    const rows: TableRow[] = [
      headerRow(head, [3,4,5,6,7,8,9,10,11,12,13,14,15]),
      ...input.tablaDeudoresAnual.map((r, idx) => {
        const vals = [
          r.tipificacion,
          r.inmueble,
          r.nombre,
          formatCOP(r.porRecaudar),
          formatCOP(r.rec_01),
          formatCOP(r.rec_02),
          formatCOP(r.rec_03),
          formatCOP(r.rec_04),
          formatCOP(r.rec_05),
          formatCOP(r.rec_06),
          formatCOP(r.rec_07),
          formatCOP(r.rec_08),
          formatCOP(r.rec_09),
          formatCOP(r.rec_10),
          formatCOP(r.rec_11),
          formatCOP(r.rec_12),
          formatCOP(r.recaudoTotal),
        ];
        return bodyRow(vals, [3,4,5,6,7,8,9,10,11,12,13,14,15], idx % 2 === 1 ? GRAY : undefined);
      }),
    ];

    landscapeChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
      })
    );
  }

  const doc = new Document({
    sections: [
      { properties: {}, children },
      ...(landscapeChildren.length
        ? [
            {
              properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
              children: landscapeChildren,
            },
          ]
        : []),
    ],
  });

  return Packer.toBlob(doc);
}
