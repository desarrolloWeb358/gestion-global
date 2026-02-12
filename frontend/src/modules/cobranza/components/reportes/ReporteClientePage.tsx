// src/modules/cobranza/pages/ReporteClientePage.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  LabelList,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import type { Payload as LegendPayload } from "recharts/types/component/DefaultLegendContent";

// shadcn/ui
import { Separator } from "@/shared/ui/separator";
import { Button } from "@/shared/ui/button";
import {
  Loader2,
  PieChart as PieChartIcon,
  BarChart3,
  FileText,
  TrendingUp,
  DollarSign,
  Users,
  Home,
  Filter,
  ArrowLeft,
  Download,
  FileDown,
} from "lucide-react";
import { toPng } from "html-to-image";

import TablaDeudoresReporte from "./TablaDeudoresReporte";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";

import {
  contarTipificacionPorCliente,
  PieItem,
  obtenerResumenPorTipificacion,
  ResumenTipificacion,
  obtenerDetalleDeudoresPorTipificacion,
  DeudorTipificacionDetalle,
  TipificacionKey,
} from "../../services/reportes/tipificacionService";

import SeguimientoDemandasClienteSection from "../../components/reportes/SeguimientoDemandasClienteSection";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";

import { getClienteById } from "@/modules/clientes/services/clienteService";

import { obtenerRecaudosMensuales, MesTotal } from "../../services/reportes/recaudosService";

// PDF
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Word (nuevo servicio)
import { saveAs } from "file-saver";
import { toast } from "sonner";
import {
  buildReporteClienteDocx,
} from "../../services/reportes/reporteClienteWord";

// Servicios para data adicional (ya existen por tus componentes)
import { obtenerDemandasConSeguimientoCliente } from "../../services/reportes/seguimientoDemandaService";
import { obtenerReporteDeudoresPorPeriodo } from "../../services/reportes/reporteDeudoresService";
import type { FilaReporte } from "../../services/reportes/tipos";

const COLORS = [
  "#4F46E5",
  "#22C55E",
  "#F59E0B",
  "#06B6D4",
  "#EF4444",
  "#6366F1",
  "#10B981",
  "#F43F5E",
];

const DETALLE_VISIBLE_ROWS = 10;
const DETALLE_ROW_H = 44;
const DETALLE_HEADER_H = 40;
const DETALLE_CONTAINER_H = DETALLE_HEADER_H + DETALLE_ROW_H * DETALLE_VISIBLE_ROWS;

const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        transform="rotate(-45)"
        style={{ fontSize: 12 }}
      >
        {payload.value}
      </text>
    </g>
  );
};

const formatCOP = (v: number) => `$ ${v.toLocaleString("es-CO")}`;

type TotalesDetalle = { inmuebles: number; recaudoTotal: number; porRecuperar: number };


function calcTotalesDetalle(rows: { recaudoTotal?: number; porRecuperar?: number }[]): TotalesDetalle {
  return rows.reduce<TotalesDetalle>(
    (acc, r) => {
      acc.inmuebles += 1;
      acc.recaudoTotal += r.recaudoTotal ?? 0;
      acc.porRecuperar += r.porRecuperar ?? 0;
      return acc;
    },
    { inmuebles: 0, recaudoTotal: 0, porRecuperar: 0 }
  );
}



// "YYYY-MM" -> "Mes"
function monthNameES(ym: string) {
  const [y, mm] = ym.split("-");
  const d = new Date(Number(y), Number(mm) - 1, 1);
  return d.toLocaleDateString("es-CO", { month: "long" });
}

async function getPngSizeFromDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

const capturarPieConLeyenda = async (elemento: HTMLElement): Promise<string | null> => {
  try {
    return await toPng(elemento, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
  } catch (e) {
    console.error("Error capturando pie+leyenda:", e);
    return null;
  }
};

const capturarPieSVG = async (elemento: HTMLElement): Promise<string | null> => {
  try {
    const svg = elemento.querySelector("svg");
    if (!svg) return null;

    const svgClone = svg.cloneNode(true) as SVGElement;

    // bbox del contenido real
    const bbox = (svg as SVGGraphicsElement).getBBox();

    // padding (para que no quede "pegado" y no corte labels)
    const pad = 12;

    const viewX = bbox.x - pad;
    const viewY = bbox.y - pad;
    const viewW = bbox.width + pad * 2;
    const viewH = bbox.height + pad * 2;

    svgClone.setAttribute("viewBox", `${viewX} ${viewY} ${viewW} ${viewH}`);
    svgClone.setAttribute("width", String(viewW));
    svgClone.setAttribute("height", String(viewH));

    const svgString = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewW * scale);
    canvas.height = Math.round(viewH * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, viewW, viewH);

    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, viewW, viewH);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch (err) {
    console.error("Error capturando PIE:", err);
    return null;
  }
};

const capturarBarSVG = async (elemento: HTMLElement): Promise<string | null> => {
  try {
    const svg = elemento.querySelector("svg");
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    const svgClone = svg.cloneNode(true) as SVGElement;

    if (!svgClone.getAttribute("viewBox")) {
      svgClone.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    svgClone.setAttribute("width", String(width));
    svgClone.setAttribute("height", String(height));

    const svgString = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch (err) {
    console.error("Error capturando BAR:", err);
    return null;
  }
};


// ===== Captura SVG->PNG (la tuya) =====
const capturarGraficoSVG = async (elemento: HTMLElement): Promise<string | null> => {
  try {
    const svg = elemento.querySelector("svg");
    if (!svg) return null;

    // ✅ tamaño visual real del svg en pantalla
    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    const svgClone = svg.cloneNode(true) as SVGElement;

    // ✅ asegurar que tenga viewBox
    if (!svgClone.getAttribute("viewBox")) {
      svgClone.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    svgClone.setAttribute("width", String(width));
    svgClone.setAttribute("height", String(height));

    const svgString = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });

    const scale = 2; // nitidez
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  } catch (err) {
    console.error("Error capturando SVG:", err);
    return null;
  }
};



export default function ReporteClientePage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();

  const [clienteNombre, setClienteNombre] = useState<string>("Cliente");

  const [pieData, setPieData] = useState<PieItem[]>([]);
  const [barsData, setBarsData] = useState<MesTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [resumenTip, setResumenTip] = useState<ResumenTipificacion[]>([]);

  const [tipSeleccionada, setTipSeleccionada] = useState<TipificacionKey | "">("");
  const [detalleTip, setDetalleTip] = useState<DeudorTipificacionDetalle[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // año tabla anual (para Word y para que te quede controlado si luego lo quieres sincronizar)
  const hoy = new Date();
  const [yearTabla, setYearTabla] = useState<number>(hoy.getFullYear());
  const [monthTabla, setMonthTabla] = useState<number>(hoy.getMonth() + 1); // 1..12


  // refs gráficos
  const pieChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);

  const resumenFiltrado = useMemo(
    () => resumenTip.filter((fila) => fila.inmuebles > 0),
    [resumenTip]
  );

  const pieWithColors = useMemo(
    () =>
      pieData.map((d, i) => ({
        ...d,
        color: COLORS[i % COLORS.length],
      })),
    [pieData]
  );

  const totalesDetalle = useMemo(() => {
    return detalleTip.reduce(
      (acc, fila) => {
        acc.inmuebles += 1;
        acc.recaudoTotal += fila.recaudoTotal;
        acc.porRecuperar += fila.porRecuperar;
        return acc;
      },
      { inmuebles: 0, recaudoTotal: 0, porRecuperar: 0 }
    );
  }, [detalleTip]);

  useEffect(() => {
    if (!clienteId) return;
    (async () => {
      setLoading(true);
      const [tip, recs, resumen] = await Promise.all([
        contarTipificacionPorCliente(clienteId, yearTabla, monthTabla),
        obtenerRecaudosMensuales(clienteId, yearTabla, monthTabla),
        obtenerResumenPorTipificacion(clienteId, yearTabla, monthTabla),
      ]);
      setPieData(tip);
      setBarsData(recs);
      setResumenTip(resumen);
      setLoading(false);
    })();
  }, [clienteId, yearTabla, monthTabla]);

  useEffect(() => {
    if (!clienteId) return;

    let alive = true;

    (async () => {
      try {
        const c = await getClienteById(clienteId);
        if (!alive) return;
        setClienteNombre(c?.nombre?.trim() || "Cliente");
      } catch (e) {
        console.error("Error cargando cliente:", e);
        if (!alive) return;
        setClienteNombre("Cliente");
      }
    })();

    return () => {
      alive = false;
    };
  }, [clienteId]);

  useEffect(() => {
    if (!clienteId || !tipSeleccionada) return;
    let alive = true;

    (async () => {
      setLoadingDetalle(true);
      setDetalleTip([]);
      const datos = await obtenerDetalleDeudoresPorTipificacion(
        clienteId,
        tipSeleccionada as TipificacionKey,
        yearTabla,
        monthTabla
      );

      if (!alive) return;
      setDetalleTip(datos);
      setLoadingDetalle(false);
    })();
  }, [clienteId, tipSeleccionada, yearTabla, monthTabla]);

  useEffect(() => {
    if (!resumenFiltrado.length) return;

    setTipSeleccionada((prev) => {
      const existe = resumenFiltrado.some((fila) => fila.tipificacion === prev);
      return existe ? prev : resumenFiltrado[0].tipificacion;
    });
  }, [resumenFiltrado]);

  const totalesResumen = useMemo(() => {
    return resumenFiltrado.reduce(
      (acc, fila) => {
        acc.inmuebles += fila.inmuebles;
        acc.recaudoTotal += fila.recaudoTotal;
        acc.porRecuperar += fila.porRecuperar;
        return acc;
      },
      { inmuebles: 0, recaudoTotal: 0, porRecuperar: 0 }
    );
  }, [resumenFiltrado]);

  const chartData = useMemo(
    () => pieWithColors.filter((d) => d.value > 0).sort((a, b) => b.value - a.value),
    [pieWithColors]
  );

  const total = useMemo(
    () => pieWithColors.reduce((acc, d) => acc + d.value, 0),
    [pieWithColors]
  );

  const legendPayload: LegendPayload[] = useMemo(
    () =>
      pieWithColors
        .filter((d) => d.value > 0)
        .map((d) => ({
          id: d.name,
          type: "circle" as const,
          value: `${d.name} ${total ? ((d.value / total) * 100).toFixed(0) : 0}%`,
          color: d.color,
        })),
    [pieWithColors, total]
  );

  const bars = useMemo(
    () =>
      barsData.map((item) => ({
        mes: item.mes,
        nombreMes: monthNameES(item.mes),
        total: item.total,
      })),
    [barsData]
  );

  const renderLabel = (props: any) => {
    const { name, value, percent } = props;
    if (!value || percent < 0.01) return null;
    return `${name} ${(percent * 100).toFixed(0)}%`;
  };



  // ======= WORD (NUEVO: con TODO y estilo INFORME) =======
  const handleDownloadWord = async () => {
    if (!clienteId) return;

    try {
      setDownloading(true);
      toast.info("Generando documento Word...");

      // 1) Capturar gráficos como PNG (nítido)
      const piePng = pieChartRef.current ? await capturarPieConLeyenda(pieChartRef.current) : null;
      //const piePng = pieChartRef.current ? await capturarPieSVG(pieChartRef.current) : null;
      const barPng = barChartRef.current ? await capturarBarSVG(barChartRef.current) : null;

      const pieSize = piePng ? await getPngSizeFromDataUrl(piePng) : null;
      const barSize = barPng ? await getPngSizeFromDataUrl(barPng) : null;

      // 2) Traer data adicional (misma que ve la página)
      // Seguimiento demandas
      const demandasRaw = await obtenerDemandasConSeguimientoCliente(clienteId, yearTabla, monthTabla);

      // 3) Mapear a formato Word (mismo orden de tu UI: seguimientos DESC + observación al final)
      const demandasWord = demandasRaw.map((d) => {
        const seguimientosOrdenados = [...d.seguimientos]
          .sort((a, b) => {
            const fa = a.fecha ? a.fecha.getTime() : 0;
            const fb = b.fecha ? b.fecha.getTime() : 0;
            return fb - fa; // DESC (más reciente primero)
          })
          .map((s) => ({
            fecha: s.fecha
              ? `${String(s.fecha.getDate()).padStart(2, "0")}/${String(s.fecha.getMonth() + 1).padStart(2, "0")}/${s.fecha.getFullYear()}`
              : null,
            texto: s.descripcion || "Sin descripción",
          }));

        return {
          ubicacion: d.ubicacion || "Sin ubicación",
          demandados: d.demandados || "",
          numeroRadicado: d.numeroRadicado || "",
          juzgado: d.juzgado || "",
          observacionCliente: d.observacionCliente || "",
          seguimientos: seguimientosOrdenados,
        };
      });


      // ✅ 2.1) Traer detalle por cada tipificación (para Word)
      const detallePorTipificacion = await Promise.all(
        resumenFiltrado.map(async (r) => {
          const detalle = await obtenerDetalleDeudoresPorTipificacion(
            clienteId,
            r.tipificacion as TipificacionKey,
            yearTabla,
            monthTabla
          );

          const detalleWord: { ubicacion: string; nombre: string; recaudoTotal: number; porRecuperar: number }[] =
            detalle.map((d) => ({
              ubicacion: d.ubicacion,
              nombre: d.nombre,
              recaudoTotal: d.recaudoTotal,
              porRecuperar: d.porRecuperar,
            }));


          const tot = calcTotalesDetalle(detalleWord);

          return {
            tipificacion: String(r.tipificacion),
            inmuebles: r.inmuebles,              // de resumen (coincide con cantidad)
            recaudoTotal: r.recaudoTotal,        // de resumen
            porRecuperar: r.porRecuperar,        // de resumen
            detalle: detalleWord,                // filas
            totalesDetalle: tot,                 // totales de la tabla
          };
        })
      );



      // 4) Construir docx bonito (tipo INFORME)
      const blob = await buildReporteClienteDocx({
        ciudad: "Bogotá D.C.",
        fechaGeneracion: new Date(),
        clienteNombre: clienteNombre?.trim() ? clienteNombre.trim() : "Cliente",
        yearTabla,
        monthTabla,

        resumenTipificacion: resumenFiltrado.map((r) => ({
          tipificacion: r.tipificacion,
          inmuebles: r.inmuebles,
          recaudoTotal: r.recaudoTotal,
          porRecuperar: r.porRecuperar,
        })),
        totalesResumen,

        recaudosMensuales: bars.map((b) => ({
          mesLabel: b.nombreMes.charAt(0).toUpperCase() + b.nombreMes.slice(1),
          total: b.total,
        })),

        detallePorTipificacion,

        demandas: demandasWord,

        pieChartPngDataUrl: piePng ?? undefined,
        barChartPngDataUrl: barPng ?? undefined,

        pieChartSize: pieSize ?? undefined,
        barChartSize: barSize ?? undefined,
      });

      saveAs(blob, `reporte-cliente-${new Date().toISOString().split("T")[0]}.docx`);
      toast.success("Documento Word descargado correctamente");
    } catch (error) {
      console.error("Error Word:", error);
      toast.error("Error al generar el documento Word");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8">
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            <Typography variant="body" className="text-muted">
              Cargando reporte del cliente...
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header con botones */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="gap-2 text-brand-primary hover:text-brand-secondary hover:bg-brand-primary/10 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

        <Button
          variant="brand"
          disabled={downloading}
          onClick={handleDownloadWord}
          className="gap-2 shadow-md hover:shadow-lg transition-all"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generando Word...
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Descargar reporte (Word)
            </>
          )}
        </Button>

      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <div>
            <Typography variant="h1" className="!text-brand-secondary">
              {clienteNombre ? `Reporte: ${clienteNombre}` : "Reporte ..."}
            </Typography>

            <Typography variant="small" className="text-muted-foreground">
              Análisis de tipificación y recaudo mensual
            </Typography>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Typography variant="small" className="text-brand-secondary font-medium">Año</Typography>
          <Select value={String(yearTabla)} onValueChange={(v) => setYearTabla(Number(v))}>
            <SelectTrigger className="w-28 border-brand-secondary/30 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }).map((_, i) => {
                const y = hoy.getFullYear() - i;
                return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Typography variant="small" className="text-brand-secondary font-medium">Mes</Typography>
          <Select value={String(monthTabla)} onValueChange={(v) => setMonthTabla(Number(v))}>
            <SelectTrigger className="w-40 border-brand-secondary/30 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }).map((_, i) => {
                const m = i + 1;
                const label = new Date(2024, i, 1).toLocaleDateString("es-CO", { month: "long" });
                const nombre = label.charAt(0).toUpperCase() + label.slice(1);
                return <SelectItem key={m} value={String(m)}>{nombre}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>


      <Separator className="bg-brand-secondary/20" />

      {/* Resumen por tipificación */}
      <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-primary" />
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Resumen por tipificación
            </Typography>
          </div>
        </div>
        <div className="p-4 md:p-5">
          <div className="overflow-x-auto rounded-lg border border-brand-secondary/10">
            <Table>
              <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                  <TableHead className="w-40 text-brand-secondary font-semibold">
                    Tipificación
                  </TableHead>
                  <TableHead className="text-right text-brand-secondary font-semibold">
                    Inmueble
                  </TableHead>
                  <TableHead className="text-right text-brand-secondary font-semibold">
                    Recaudo total
                  </TableHead>
                  <TableHead className="text-right text-brand-secondary font-semibold">
                    Por recuperar
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumenFiltrado.map((fila, index) => (
                  <TableRow
                    key={fila.tipificacion}
                    className={cn(
                      "border-brand-secondary/5 transition-colors",
                      index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                      "hover:bg-brand-primary/5"
                    )}
                  >
                    <TableCell className="font-medium text-brand-secondary">
                      {fila.tipificacion}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fila.inmuebles.toLocaleString("es-CO")}
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-semibold">
                      {formatCOP(fila.recaudoTotal)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCOP(fila.porRecuperar)}
                    </TableCell>
                  </TableRow>
                ))}

                <TableRow className="font-semibold bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 border-t-2 border-brand-primary/20">
                  <TableCell className="text-brand-secondary">Total</TableCell>
                  <TableCell className="text-right text-brand-secondary">
                    {totalesResumen.inmuebles.toLocaleString("es-CO")}
                  </TableCell>
                  <TableCell className="text-right text-brand-secondary">
                    {formatCOP(totalesResumen.recaudoTotal)}
                  </TableCell>
                  <TableCell className="text-right text-brand-secondary">
                    {formatCOP(totalesResumen.porRecuperar)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {/* Tipificación de inmuebles */}
      <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-brand-primary" />
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Tipificación de inmuebles
            </Typography>
          </div>
        </div>
        <div className="p-4 md:p-5">
          <div
            ref={pieChartRef}
            className="inline-block bg-white py-6 px-8"
          >
            <div className="flex items-center gap-10">
              <div className="flex items-center gap-10">
                {/* ✅ Leyenda a la izquierda (compacta) */}
                <div className="min-w-[230px]">
                  <Typography variant="small" className="text-brand-secondary font-semibold mb-3">
                    Tipificaciones
                  </Typography>

                  <ul className="space-y-3">
                    {legendPayload.map((it) => (
                      <li key={String(it.id)} className="flex items-center gap-3">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ background: it.color }}
                        />
                        <span className="text-sm text-brand-secondary whitespace-nowrap">
                          {it.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ✅ Pie (tamaño fijo para que NO empuje y quede cerca) */}
                <div className="w-[320px] h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={130}
                        label={false}
                        labelLine={false}
                        minAngle={3}
                      >
                        {chartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>

                      <Tooltip formatter={(v: any) => `${v} inmuebles`} separator=": " />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>


        </div>
      </section>

      {/* Recaudo mes a mes */}
      <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-primary" />
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Recaudo mes a mes
            </Typography>
          </div>
        </div>
        <div className="p-4 md:p-5">
          <div ref={barChartRef} className="h-[340px]">
            <ResponsiveContainer>
              <BarChart data={bars} margin={{ top: 40, right: 16, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="nombreMes"
                  interval={0}
                  height={56}
                  tickMargin={8}
                  tick={<CustomXAxisTick />}
                />
                <YAxis
                  width={100}
                  tickFormatter={formatCOP}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                />
                <Tooltip formatter={(v: any) => formatCOP(Number(v))} />
                <Legend />
                <Bar dataKey="total" name="Recaudo" fill="#4F46E5">
                  <LabelList dataKey="total" content={(props: any) => {
                    const { x, y, width, value } = props;
                    if (value == null) return null;
                    const cx = x + width / 2;
                    const cy = Math.max(12, y - 6);
                    return (
                      <text x={cx} y={cy} textAnchor="middle" style={{ fontSize: 12 }}>
                        {formatCOP(Number(value))}
                      </text>
                    );
                  }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Tabla de deudores */}
      {clienteId && (
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Tabla de deudores (corte mensual)
              </Typography>
            </div>
          </div>
          <div className="p-4 md:p-5">
            <TablaDeudoresReporte clienteId={clienteId} year={yearTabla} month={monthTabla} />
          </div>
        </section>
      )}

      {/* Detalle de deudores por tipificación */}
      <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-brand-primary" />
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Detalle de deudores por tipificación
            </Typography>
          </div>
        </div>
        <div className="p-4 md:p-5 space-y-4">
          {resumenFiltrado.length === 0 ? (
            <div className="text-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-brand-primary/10">
                  <Users className="h-8 w-8 text-brand-primary/60" />
                </div>
                <Typography variant="body" className="text-muted-foreground">
                  No hay deudores con tipificación registrada
                </Typography>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-brand-secondary/20 bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-brand-primary" />
                    <Typography variant="small" className="text-brand-secondary font-medium">
                      Filtrar por tipificación:
                    </Typography>
                  </div>
                  <Select value={tipSeleccionada} onValueChange={(value) => setTipSeleccionada(value as TipificacionKey)}>
                    <SelectTrigger className="w-64 border-brand-secondary/30 bg-white">
                      <SelectValue placeholder="Selecciona una tipificación" />
                    </SelectTrigger>
                    <SelectContent>
                      {resumenFiltrado.map((fila) => (
                        <SelectItem key={fila.tipificacion} value={fila.tipificacion}>
                          {fila.tipificacion} ({fila.inmuebles})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {tipSeleccionada && (
                <div className="flex items-center gap-2 px-1">
                  <DollarSign className="h-4 w-4 text-brand-primary" />
                  <Typography variant="body" className="font-semibold text-brand-secondary">
                    Deudores en tipificación: {tipSeleccionada}
                  </Typography>
                </div>
              )}

              {loadingDetalle ? (
                <div className="rounded-xl border border-brand-secondary/20 bg-white p-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
                    <Typography variant="small" className="text-muted-foreground">
                      Cargando deudores...
                    </Typography>
                  </div>
                </div>
              ) : detalleTip.length === 0 ? (
                <div className="rounded-xl border border-brand-secondary/20 bg-white p-8 text-center">
                  <Typography variant="small" className="text-muted-foreground">
                    No hay deudores para esta tipificación
                  </Typography>
                </div>
              ) : (
                <div
                  className="rounded-lg border border-brand-secondary/10 overflow-hidden"
                  style={{
                    height: detalleTip.length > DETALLE_VISIBLE_ROWS ? DETALLE_CONTAINER_H : "auto",
                    maxHeight: DETALLE_CONTAINER_H,
                    overflowY: "auto",
                  }}
                >
                  <Table className="w-full">
                    <TableHeader className="sticky top-0 z-10 bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                      <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                        <TableHead className="w-24 text-brand-secondary font-semibold">Ubicación</TableHead>
                        <TableHead className="text-brand-secondary font-semibold">Deudor</TableHead>
                        <TableHead className="text-right text-brand-secondary font-semibold">Recaudo total</TableHead>
                        <TableHead className="text-right text-brand-secondary font-semibold">Por recuperar</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {detalleTip.map((fila, index) => (
                        <TableRow
                          key={fila.deudorId}
                          style={{ height: DETALLE_ROW_H }}
                          className={cn(
                            "border-brand-secondary/5 transition-colors",
                            index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                            "hover:bg-brand-primary/5"
                          )}
                        >
                          <TableCell className="font-medium">{fila.ubicacion}</TableCell>
                          <TableCell>{fila.nombre}</TableCell>
                          <TableCell className="text-right text-red-600 font-semibold">
                            {formatCOP(fila.recaudoTotal)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCOP(fila.porRecuperar)}
                          </TableCell>
                        </TableRow>
                      ))}

                      <TableRow
                        className="bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 font-semibold border-t-2 border-brand-primary/20"
                        style={{ height: DETALLE_ROW_H }}
                      >
                        <TableCell className="text-brand-secondary">Total</TableCell>
                        <TableCell className="text-right text-brand-secondary">{totalesDetalle.inmuebles}</TableCell>
                        <TableCell className="text-right text-brand-secondary">{formatCOP(totalesDetalle.recaudoTotal)}</TableCell>
                        <TableCell className="text-right text-brand-secondary">{formatCOP(totalesDetalle.porRecuperar)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {clienteId && (
        <SeguimientoDemandasClienteSection
          clienteId={clienteId}
          year={yearTabla}
          month={monthTabla}
        />
      )}

    </div>
  );
}
