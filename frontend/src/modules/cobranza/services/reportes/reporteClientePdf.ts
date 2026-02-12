// src/modules/cobranza/services/reportes/reporteClientePdf.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { formatCOP, formatFechaLargaES } from "./helperWord";
import type { ReporteClienteInput } from "./reporteClienteTypes";

function nombreMesES(month: number) {
  const meses = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre",
  ];
  return meses[Math.max(0, Math.min(11, month - 1))];
}

function safeText(s?: string) {
  return (s ?? "").toString();
}

// dataURL PNG/JPG -> addImage
function addImageScaled(params: {
  doc: jsPDF;
  dataUrl: string;
  x: number;
  y: number;
  maxW: number;
  maxH: number;
  srcW?: number;
  srcH?: number;
}) {
  const { doc, dataUrl, x, y, maxW, maxH, srcW = 1, srcH = 1 } = params;

  // ratio manteniendo aspecto
  const ratio = Math.min(maxW / srcW, maxH / srcH);
  const w = Math.max(1, Math.round(srcW * ratio));
  const h = Math.max(1, Math.round(srcH * ratio));

  // jsPDF quiere formato "PNG" / "JPEG"
  doc.addImage(dataUrl, "PNG", x, y, w, h);
  return { w, h };
}

function ensureSpace(doc: jsPDF, y: number, needed: number) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed <= pageH - 12) return y;
  doc.addPage();
  return 14;
}

export async function buildReporteClientePdf(input: ReporteClienteInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const marginX = 14;
  let y = 14;

  const ciudad = input.ciudad ?? "Bogotá D.C.";
  const fecha = input.fechaGeneracion ?? new Date();
  const fechaLarga = formatFechaLargaES(fecha);

  const year = input.yearTabla ?? new Date().getFullYear();
  const mesFin = input.monthTabla ? nombreMesES(input.monthTabla) : "diciembre";
  const mesInicio = "enero";

  const clienteNombre = (input.clienteNombre?.trim() || "CLIENTE").toUpperCase();
  const administrador = (input.administrador?.trim() || "ADMINISTRADOR").toUpperCase();

  // ===== Header simple =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`REPORTE: ${clienteNombre}`, marginX, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${ciudad}, ${fechaLarga}`, marginX, y);
  y += 6;

  doc.setFontSize(10);
  doc.text(`Señor(a): ${administrador} (Administrador)`, marginX, y);
  y += 7;

  // Intro
  const intro =
    `En atención me permito remitir un informe sobre la gestión que hemos venido desempeñando ` +
    `de ${mesInicio} al mes de ${mesFin} de ${year}, para la ${clienteNombre}, en el área Pre-Jurídico y Jurídico.`;

  const introLines = doc.splitTextToSize(intro, 180);
  doc.text(introLines, marginX, y);
  y += introLines.length * 5 + 2;

  // ===== Tabla resumen tipificación =====
  y = ensureSpace(doc, y, 35);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("RESUMEN POR TIPIFICACIÓN", marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [180, 198, 231], textColor: 0 },
    bodyStyles: { textColor: 0 },
    head: [[ "TIPIFICACIÓN", "INMUEBLES", "RECAUDO TOTAL", "POR RECUPERAR" ]],
    body: [
      ...(input.resumenTipificacion || []).map(r => ([
        safeText(r.tipificacion).toUpperCase(),
        String(r.inmuebles ?? 0),
        formatCOP(r.recaudoTotal ?? 0),
        formatCOP(r.porRecuperar ?? 0),
      ])),
      [
        "TOTAL",
        String(input.totalesResumen?.inmuebles ?? 0),
        formatCOP(input.totalesResumen?.recaudoTotal ?? 0),
        formatCOP(input.totalesResumen?.porRecuperar ?? 0),
      ],
    ],
    columnStyles: {
      0: { cellWidth: 60 },
      1: { halign: "center", cellWidth: 25 },
      2: { halign: "right", cellWidth: 50 },
      3: { halign: "right", cellWidth: 50 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ===== Gráfico Pie =====
  y = ensureSpace(doc, y, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("CARTERA POR TIPIFICACIÓN", marginX, y);
  y += 4;

  if (input.pieChartPngDataUrl) {
    const maxW = 180;
    const maxH = 70;

    const { h } = addImageScaled({
      doc,
      dataUrl: input.pieChartPngDataUrl,
      x: marginX,
      y,
      maxW,
      maxH,
      srcW: input.pieChartSize?.width ?? 1,
      srcH: input.pieChartSize?.height ?? 1,
    });

    y += h + 8;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("(Gráfico no disponible)", marginX, y);
    y += 8;
  }

  // ===== Recaudo mes a mes (tabla horizontal) =====
  y = ensureSpace(doc, y, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("RECAUDO MES A MES", marginX, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [180, 198, 231], textColor: 0 },
    head: [ (input.recaudosMensuales || []).map(m => `RECAUDO ${safeText(m.mesLabel).toUpperCase()}`) ],
    body: [ (input.recaudosMensuales || []).map(m => formatCOP(m.total ?? 0)) ],
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ===== Gráfico Barras =====
  y = ensureSpace(doc, y, 75);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("GRÁFICO DE RECAUDO", marginX, y);
  y += 4;

  if (input.barChartPngDataUrl) {
    const maxW = 180;
    const maxH = 70;

    const { h } = addImageScaled({
      doc,
      dataUrl: input.barChartPngDataUrl,
      x: marginX,
      y,
      maxW,
      maxH,
      srcW: input.barChartSize?.width ?? 1,
      srcH: input.barChartSize?.height ?? 1,
    });

    y += h + 8;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("(Gráfico no disponible)", marginX, y);
    y += 8;
  }

  // ===== Detalle por tipificación =====
  const detalleAll = (input.detallePorTipificacion || []).filter(x => (x.inmuebles ?? 0) > 0);

  if (detalleAll.length) {
    y = ensureSpace(doc, y, 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("DETALLE DE DEUDORES POR TIPIFICACIÓN", marginX, y);
    y += 6;

    for (const bloque of detalleAll) {
      y = ensureSpace(doc, y, 20);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${safeText(bloque.tipificacion).toUpperCase()} (${bloque.inmuebles})`, marginX, y);
      y += 4;

      autoTable(doc, {
        startY: y,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.5 },
        headStyles: { fillColor: [180, 198, 231], textColor: 0 },
        head: [[ "UBICACIÓN", "DEUDOR", "RECAUDO TOTAL", "POR RECUPERAR" ]],
        body: [
          ...(bloque.detalle || []).map(r => ([
            safeText(r.ubicacion),
            safeText(r.nombre).toUpperCase(),
            formatCOP(r.recaudoTotal ?? 0),
            formatCOP(r.porRecuperar ?? 0),
          ])),
          [
            "TOTAL",
            String(bloque.totalesDetalle?.inmuebles ?? 0),
            formatCOP(bloque.totalesDetalle?.recaudoTotal ?? 0),
            formatCOP(bloque.totalesDetalle?.porRecuperar ?? 0),
          ],
        ],
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 70 },
          2: { halign: "right", cellWidth: 40 },
          3: { halign: "right", cellWidth: 40 },
        },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ===== Procesos de demanda =====
  y = ensureSpace(doc, y, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("PROCESOS DE DEMANDA", marginX, y);
  y += 6;

  if (!input.demandas?.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("No hay demandas para mostrar.", marginX, y);
    y += 6;
  } else {
    for (const d of input.demandas) {
      y = ensureSpace(doc, y, 40);

      autoTable(doc, {
        startY: y,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.5 },
        headStyles: { fillColor: [180, 198, 231], textColor: 0 },
        head: [[ "INMUEBLE", "DEMANDADO", "RADICADO", "JUZGADO" ]],
        body: [[
          safeText(d.ubicacion).toUpperCase(),
          safeText(d.demandados).toUpperCase(),
          safeText(d.numeroRadicado || "-").toUpperCase(),
          safeText(d.juzgado || "-").toUpperCase(),
        ]],
      });

      y = (doc as any).lastAutoTable.finalY + 2;

      // Observaciones (seguimientos + observación cliente)
      const lista = [
        ...(d.seguimientos || []),
        ...(d.observacionCliente?.trim() ? [{ fecha: null, texto: d.observacionCliente.trim() }] : []),
      ].filter(x => (x.texto || "").trim().length > 0);

      const obsText = lista.length
        ? lista.map(it => `${it.fecha ? it.fecha + " " : ""}${it.texto}`).join("\n\n")
        : "Sin observaciones.";

      y = ensureSpace(doc, y, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("OBSERVACIONES", marginX, y);
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(obsText, 180);
      doc.text(lines, marginX, y);
      y += lines.length * 4.2 + 8;
    }
  }

  // Blob final
  const blob = doc.output("blob");
  return blob;
}
