import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/firebase";
import { getSeguimientosDemanda } from "../services/seguimientoDemandaService";
import { getObservacionesClienteGlobal } from "../services/observacionClienteGlobalService";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";
import { toast } from "sonner";
import { RefreshCw, ArrowLeft, Scale, MessageSquare, FileText } from "lucide-react";

const FUNCTION_URL =
  "https://us-central1-gestionglobal-9eac8.cloudfunctions.net/helloWorld";

interface ActuacionCPNU {
  numero: number;
  fecha: string;
  tipo: string;
  anotacion: string;
  conDocumentos: boolean;
}

function formatFecha(val: any): string {
  if (!val) return "—";
  if (typeof val === "string") return val;
  if (val?.toDate) return val.toDate().toLocaleDateString("es-CO");
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString("es-CO");
  return String(val);
}

export default function DetalleProcesoJudicialPage() {
  const { clienteId, deudorId } = useParams<{ clienteId: string; deudorId: string }>();
  const navigate = useNavigate();

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingCPNU, setLoadingCPNU] = useState(false);
  const [loadingInterno, setLoadingInterno] = useState(true);

  // Meta
  const [nombreDeudor, setNombreDeudor] = useState("");
  const [nombreCliente, setNombreCliente] = useState("");
  const [numeroRadicado, setNumeroRadicado] = useState("");
  const [observacionesDemandaCliente, setObservacionesDemandaCliente] = useState("");

  // CPNU
  const [actuaciones, setActuaciones] = useState<ActuacionCPNU[]>([]);
  const [totalActuaciones, setTotalActuaciones] = useState(0);
  const [fechaUltimaActuacion, setFechaUltimaActuacion] = useState<string | null>(null);
  const [cpnuConsultado, setCpnuConsultado] = useState(false);
  const [cpnuNoEncontrado, setCpnuNoEncontrado] = useState(false);

  // Interno
  const [seguimientosDemanda, setSeguimientosDemanda] = useState<any[]>([]);
  const [observacionesConjunto, setObservacionesConjunto] = useState<any[]>([]);

  // ── Cargar meta + campo observacionesDemandaCliente ──────
  useEffect(() => {
    if (!clienteId || !deudorId) return;
    async function cargar() {
      const [deudorSnap, clienteSnap] = await Promise.all([
        getDoc(doc(db, `clientes/${clienteId}/deudores/${deudorId}`)),
        getDoc(doc(db, "clientes", clienteId!)),
      ]);
      if (deudorSnap.exists()) {
        const d = deudorSnap.data() as any;
        setNombreDeudor(d.nombre ?? "");
        setNumeroRadicado((d.numeroRadicado ?? "").trim());
        setObservacionesDemandaCliente(d.observacionesDemandaCliente ?? "");
      }
      if (clienteSnap.exists()) {
        setNombreCliente(clienteSnap.data()?.nombre ?? "");
      }
      setLoadingMeta(false);
    }
    cargar();
  }, [clienteId, deudorId]);

  // ── Cargar interno ───────────────────────────────────────
  useEffect(() => {
    if (!clienteId || !deudorId) return;
    async function cargar() {
      try {
        const [demanda, observaciones] = await Promise.all([
          getSeguimientosDemanda(clienteId!, deudorId!),
          getObservacionesClienteGlobal(clienteId!),
        ]);
        setSeguimientosDemanda(demanda);
        setObservacionesConjunto(observaciones);
      } catch {
        toast.error("Error cargando datos internos");
      } finally {
        setLoadingInterno(false);
      }
    }
    cargar();
  }, [clienteId, deudorId]);

  // ── Consultar CPNU ───────────────────────────────────────
  async function consultarCPNU() {
    if (!numeroRadicado || numeroRadicado.length !== 23) {
      toast.error("El deudor no tiene radicado válido");
      return;
    }
    setLoadingCPNU(true);
    setCpnuNoEncontrado(false);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error("Sin sesión");

      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ radicado: numeroRadicado }),
      });
      const data = await res.json();

      if (res.status === 404) {
        setCpnuNoEncontrado(true);
        setCpnuConsultado(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);

      setActuaciones(data.actuaciones ?? []);
      setTotalActuaciones(data.totalActuaciones ?? 0);
      setFechaUltimaActuacion(data.fechaUltimaActuacion ?? null);
      setCpnuConsultado(true);
    } catch (err: any) {
      toast.error(`Error de conexión: ${err.message}`);
    } finally {
      setLoadingCPNU(false);
    }
  }

  if (loadingMeta) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">

      {/* Header */}
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">{nombreDeudor}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {nombreCliente} ·{" "}
            <span className="font-mono text-xs">{numeroRadicado || "Sin radicado"}</span>
          </p>
        </div>
        <Button onClick={consultarCPNU} disabled={loadingCPNU} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loadingCPNU ? "animate-spin" : ""}`} />
          {cpnuConsultado ? "Actualizar CPNU" : "Consultar Rama Judicial"}
        </Button>
      </div>

      {fechaUltimaActuacion && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Última actuación:</span>
          <span className="font-semibold text-primary">{fechaUltimaActuacion}</span>
          <Badge className="text-xs bg-green-600 hover:bg-green-700">
            {totalActuaciones} actuaciones
          </Badge>
        </div>
      )}

      {/* Layout 2 columnas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* ─── Izquierda: CPNU ─── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-base">Rama Judicial — CPNU</h3>
          </div>

          {!cpnuConsultado ? (
            <div className="border rounded-md p-8 text-center text-muted-foreground text-sm space-y-3">
              <Scale className="h-8 w-8 mx-auto opacity-30" />
              <p>Presiona <strong>Consultar Rama Judicial</strong> para traer las actuaciones.</p>
            </div>
          ) : loadingCPNU ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          ) : cpnuNoEncontrado ? (
            <div className="rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-5 space-y-3">
              <p className="font-semibold text-orange-900 dark:text-orange-200 text-sm">
                Proceso no encontrado en CPNU
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Este radicado no está en el sistema nacional. Puede ser un proceso de
                Juzgados de Pequeñas Causas (TYBA). Consúltalo directamente:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href="https://consultaprocesos.ramajudicial.gov.co/procesos/numeroradicacion"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-orange-700 hover:bg-orange-800 text-white text-xs font-medium px-3 py-1.5 transition-colors"
                >
                  Consultar en CPNU
                </a>
                <a
                  href="https://procesos.ramajudicial.gov.co/procesoscs/ConsultaJusticias21.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-orange-700 text-orange-800 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-xs font-medium px-3 py-1.5 transition-colors"
                >
                  Consultar en Justicia XXI
                </a>
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                Radicado: <span className="font-mono font-semibold">{numeroRadicado}</span>
              </p>
            </div>
          ) : actuaciones.length === 0 ? (
            <div className="border rounded-md p-6 text-center text-muted-foreground text-sm">
              Sin actuaciones registradas en CPNU.
            </div>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-8">#</th>
                    <th className="text-left px-3 py-2 font-medium w-24">Fecha</th>
                    <th className="text-left px-3 py-2 font-medium w-36">Actuación</th>
                    <th className="text-left px-3 py-2 font-medium">Anotación</th>
                    <th className="text-center px-3 py-2 font-medium w-12">Docs</th>
                  </tr>
                </thead>
                <tbody>
                  {actuaciones.map((act) => (
                    <tr key={act.numero} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground text-xs text-center">{act.numero}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">{act.fecha || "—"}</td>
                      <td className="px-3 py-2 text-xs font-medium">{act.tipo || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                        {act.anotacion || "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {act.conDocumentos ? (
                          <Badge variant="outline" className="text-xs">Sí</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ─── Derecha: Interno ─── */}
        <section className="space-y-5">

          {/* Observaciones demanda cliente */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Observaciones de la Demanda (Cliente)</h3>
            </div>
            {observacionesDemandaCliente ? (
              <div className="border rounded-md p-3 text-sm whitespace-pre-line leading-relaxed bg-muted/20">
                {observacionesDemandaCliente}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pl-6">Sin observaciones registradas.</p>
            )}
          </div>

          {/* Seguimiento Demanda */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-orange-500" />
              <h3 className="font-semibold text-sm">Seguimiento Demanda</h3>
              <Badge variant="outline" className="text-xs">{seguimientosDemanda.length}</Badge>
            </div>
            {loadingInterno ? (
              <Spinner className="h-4 w-4" />
            ) : seguimientosDemanda.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-6">Sin registros.</p>
            ) : (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium text-xs w-24">Fecha</th>
                      <th className="text-left px-3 py-1.5 font-medium text-xs">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seguimientosDemanda.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {formatFecha(s.fecha)}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-pre-line leading-relaxed">
                          {s.descripcion || "—"}
                          {s.archivoUrl && (
                            <a
                              href={s.archivoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-primary underline text-xs"
                            >
                              Archivo
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Observaciones del conjunto */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Observaciones del Conjunto</h3>
              <Badge variant="outline" className="text-xs">{observacionesConjunto.length}</Badge>
            </div>
            {loadingInterno ? (
              <Spinner className="h-4 w-4" />
            ) : observacionesConjunto.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-6">Sin observaciones.</p>
            ) : (
              <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                {observacionesConjunto.map((o) => (
                  <div key={o.id} className="px-3 py-2 space-y-0.5">
                    <p className="text-xs text-muted-foreground">{formatFecha(o.fecha)}</p>
                    <p className="text-xs whitespace-pre-line leading-relaxed">{o.texto || "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>
      </div>
    </div>
  );
}
