import React, { useEffect, useState } from "react";
import {
  collectionGroup,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { db } from "@/firebase";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { BadgeTipificacion } from "@/shared/components/BadgeTipificacion";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Spinner } from "@/shared/ui/spinner";
import { toast } from "sonner";
import { RefreshCw, Search, ExternalLink, FileSearch, Send, Link2, CheckCircle2 } from "lucide-react";

const FUNCTION_URL =
  "https://us-central1-gestionglobal-9eac8.cloudfunctions.net/helloWorld";

const TIPIFICACIONES_DEMANDA: TipificacionDeuda[] = [
  TipificacionDeuda.DEMANDA,
  TipificacionDeuda.DEMANDA_ACUERDO,
  TipificacionDeuda.DEMANDA_TERMINADO,
  TipificacionDeuda.DEMANDA_INSOLVENCIA,
];

type EstadoSolicitud = "sinSolicitar" | "solicitado" | "linkRecibido";

interface FilaMonitoreo {
  deudorId: string;
  clienteId: string;
  nombreCliente: string;
  nombreDeudor: string;
  tipificacion: TipificacionDeuda;
  numeroRadicado: string;
  fechaUltimaActuacion: string | null;
  esPrivado: boolean | null;
  fechaUltimaConsulta: string | null;
  // privados
  estadoSolicitud: EstadoSolicitud;
  fechaSolicitud: string | null;
  linkJuzgado: string;
  // estado local
  consultando: boolean;
  ingresandoLink: boolean;
  linkInput: string;
}

export default function MonitoreoRadicadosPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<FilaMonitoreo[]>([]);
  const [consultandoTodos, setConsultandoTodos] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  // ── Carga inicial ──────────────────────────────────────────
  useEffect(() => {
    async function cargar() {
      try {
        const snap = await getDocs(
          query(
            collectionGroup(db, "deudores"),
            where("tipificacion", "in", TIPIFICACIONES_DEMANDA)
          )
        );

        const docs = snap.docs.filter(
          (d) => /^\d{23}$/.test((d.data().numeroRadicado ?? "").trim())
        );

        const clienteIds = [...new Set(docs.map((d) => d.ref.parent.parent!.id))];
        const clienteSnaps = await Promise.all(
          clienteIds.map((id) => getDoc(doc(db, "clientes", id)))
        );
        const nombreCliente: Record<string, string> = {};
        clienteSnaps.forEach((s) => {
          nombreCliente[s.id] = s.exists() ? (s.data()?.nombre ?? s.id) : s.id;
        });

        const resultado: FilaMonitoreo[] = docs.map((d) => {
          const data = d.data() as any;
          const clienteId = d.ref.parent.parent!.id;
          const pj = data.procesoJudicial ?? {};
          return {
            deudorId: d.id,
            clienteId,
            nombreCliente: nombreCliente[clienteId] ?? clienteId,
            nombreDeudor: data.nombre ?? "",
            tipificacion: data.tipificacion,
            numeroRadicado: (data.numeroRadicado ?? "").trim(),
            fechaUltimaActuacion: pj.fechaUltimaActuacion ?? null,
            esPrivado: pj.esPrivado ?? null,
            fechaUltimaConsulta: pj.fechaUltimaConsulta
              ? pj.fechaUltimaConsulta.toDate?.().toLocaleDateString("es-CO") ?? null
              : null,
            estadoSolicitud: (pj.estadoSolicitud as EstadoSolicitud) ?? "sinSolicitar",
            fechaSolicitud: pj.fechaSolicitud ?? null,
            linkJuzgado: pj.linkJuzgado ?? "",
            consultando: false,
            ingresandoLink: false,
            linkInput: pj.linkJuzgado ?? "",
          };
        });

        resultado.sort((a, b) => a.nombreCliente.localeCompare(b.nombreCliente));
        setFilas(resultado);
      } catch (err) {
        toast.error("Error cargando datos");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  // ── Helpers ────────────────────────────────────────────────
  function setFila(index: number, patch: Partial<FilaMonitoreo>) {
    setFilas((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function getIndex(fila: FilaMonitoreo) {
    return filas.findIndex(
      (f) => f.clienteId === fila.clienteId && f.deudorId === fila.deudorId
    );
  }

  // ── Consultar una fila (sólo públicos) ────────────────────
  async function consultarFila(index: number) {
    const fila = filas[index];
    setFila(index, { consultando: true });
    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error("Sin sesión");

      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ radicado: fila.numeroRadicado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);

      await updateDoc(doc(db, `clientes/${fila.clienteId}/deudores/${fila.deudorId}`), {
        "procesoJudicial.fechaUltimaActuacion": data.fechaUltimaActuacion ?? null,
        "procesoJudicial.esPrivado": data.esPrivado ?? false,
        "procesoJudicial.fechaUltimaConsulta": serverTimestamp(),
      });

      setFila(index, {
        fechaUltimaActuacion: data.fechaUltimaActuacion ?? null,
        esPrivado: data.esPrivado ?? false,
        fechaUltimaConsulta: new Date().toLocaleDateString("es-CO"),
        consultando: false,
      });
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
      setFila(index, { consultando: false });
    }
  }

  // ── Estado solicitud para privados ────────────────────────
  async function marcarSolicitado(fila: FilaMonitoreo) {
    const index = getIndex(fila);
    const hoy = new Date().toLocaleDateString("es-CO");
    try {
      await updateDoc(doc(db, `clientes/${fila.clienteId}/deudores/${fila.deudorId}`), {
        "procesoJudicial.estadoSolicitud": "solicitado",
        "procesoJudicial.fechaSolicitud": hoy,
      });
      setFila(index, { estadoSolicitud: "solicitado", fechaSolicitud: hoy });
      toast.success("Marcado como solicitado");
    } catch {
      toast.error("No se pudo actualizar");
    }
  }

  async function guardarLink(fila: FilaMonitoreo) {
    const index = getIndex(fila);
    const link = fila.linkInput.trim();
    if (!link) return;
    try {
      await updateDoc(doc(db, `clientes/${fila.clienteId}/deudores/${fila.deudorId}`), {
        "procesoJudicial.estadoSolicitud": "linkRecibido",
        "procesoJudicial.linkJuzgado": link,
      });
      setFila(index, {
        estadoSolicitud: "linkRecibido",
        linkJuzgado: link,
        ingresandoLink: false,
      });
      toast.success("Link guardado");
    } catch {
      toast.error("No se pudo guardar");
    }
  }

  // ── Consultar todos secuencialmente ───────────────────────
  async function consultarTodos(soloPublicos = true) {
    setConsultandoTodos(true);
    const indices = filas
      .map((_, i) => i)
      .filter((i) =>
        soloPublicos
          ? filas[i].esPrivado === false
          : filas[i].esPrivado === null
      );
    for (const idx of indices) {
      await consultarFila(idx);
      await new Promise((r) => setTimeout(r, 600));
    }
    setConsultandoTodos(false);
    toast.success("Consulta completada");
  }

  // ── Filtro ─────────────────────────────────────────────────
  const filtradas = filas.filter((f) => {
    const q = busqueda.toLowerCase();
    return (
      f.nombreCliente.toLowerCase().includes(q) ||
      f.nombreDeudor.toLowerCase().includes(q) ||
      f.numeroRadicado.includes(q)
    );
  });

  // ── Render celda privado ──────────────────────────────────
  function CeldaPrivado({ f }: { f: FilaMonitoreo }) {
    const index = getIndex(f);

    const asunto = encodeURIComponent(
      `Solicitud de acceso - Proceso radicado ${f.numeroRadicado}`
    );
    const cuerpo = encodeURIComponent(
      `Cordial saludo,\n\nSolicito el link de acceso para consultar el proceso con número de radicado ${f.numeroRadicado} correspondiente a ${f.nombreDeudor}.\n\nQuedo atento a su respuesta.\n\nGracias.`
    );
    const mailtoHref = `mailto:?subject=${asunto}&body=${cuerpo}`;

    if (f.estadoSolicitud === "linkRecibido") {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="text-xs bg-green-600 hover:bg-green-700 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Link recibido
          </Badge>
          <a
            href={f.linkJuzgado}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary text-xs underline flex items-center gap-1"
          >
            Abrir proceso <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      );
    }

    if (f.estadoSolicitud === "solicitado") {
      return (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs gap-1 border-blue-400 text-blue-600">
              <Send className="h-3 w-3" /> Correo enviado
            </Badge>
            {f.fechaSolicitud && (
              <span className="text-xs text-muted-foreground">{f.fechaSolicitud}</span>
            )}
            <a href={mailtoHref} className="text-xs text-muted-foreground underline">
              Reenviar
            </a>
          </div>
          {f.ingresandoLink ? (
            <div className="flex gap-1.5">
              <Input
                value={f.linkInput}
                onChange={(e) => setFila(index, { linkInput: e.target.value })}
                placeholder="Pega el link del juzgado…"
                className="h-7 text-xs w-52"
                onKeyDown={(e) => e.key === "Enter" && guardarLink(f)}
              />
              <Button size="sm" className="h-7 text-xs px-2" onClick={() => guardarLink(f)}>
                Guardar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2"
                onClick={() => setFila(index, { ingresandoLink: false })}
              >
                ✕
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs gap-1"
              onClick={() => setFila(index, { ingresandoLink: true })}
            >
              <Link2 className="h-3 w-3" /> Ingresar link recibido
            </Button>
          )}
        </div>
      );
    }

    // sinSolicitar
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">No se pueden revisar las actuaciones.</p>
        <a
          href={mailtoHref}
          onClick={() => marcarSolicitado(f)}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent text-xs font-medium px-2.5 py-1 transition-colors"
        >
          <Send className="h-3 w-3" /> Enviar correo al juzgado
        </a>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
        <Spinner className="h-6 w-6" />
        <span className="text-sm">Cargando radicados…</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Monitoreo Rama Judicial</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {filas.length} proceso{filas.length !== 1 ? "s" : ""} con radicado —{" "}
            {filas.filter((f) => f.esPrivado === false).length} públicos ·{" "}
            {filas.filter((f) => f.esPrivado === true).length} privados ·{" "}
            {filas.filter((f) => f.esPrivado === null).length} sin consultar
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => consultarTodos(false)}
            disabled={consultandoTodos || filas.every((f) => f.esPrivado !== null)}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${consultandoTodos ? "animate-spin" : ""}`} />
            {consultandoTodos ? "Consultando…" : `Consultar sin revisar (${filas.filter((f) => f.esPrivado === null).length})`}
          </Button>
          <Button
            onClick={() => consultarTodos(true)}
            disabled={consultandoTodos || filas.every((f) => f.esPrivado !== false)}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${consultandoTodos ? "animate-spin" : ""}`} />
            {consultandoTodos ? "Actualizando…" : "Actualizar públicos"}
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente, deudor o radicado…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay procesos con radicado registrado.
        </p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium">Deudor</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipificación</th>
                <th className="text-left px-4 py-2.5 font-medium">Radicado</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado / Última actuación</th>
                <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
                <th className="text-left px-4 py-2.5 font-medium">Consultado</th>
                <th className="w-32 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => {
                const index = getIndex(f);
                const esPrivado = f.esPrivado === true;
                const esPublico = f.esPrivado === false;
                return (
                  <tr
                    key={`${f.clienteId}-${f.deudorId}`}
                    className="border-t hover:bg-muted/20"
                  >
                    <td className="px-4 py-2 font-medium">{f.nombreCliente}</td>
                    <td
                      className="px-4 py-2 cursor-pointer hover:underline text-primary"
                      onClick={() =>
                        navigate(`/clientes/${f.clienteId}/deudores/${f.deudorId}`)
                      }
                    >
                      <span className="flex items-center gap-1">
                        {f.nombreDeudor}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <BadgeTipificacion value={f.tipificacion} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs tracking-wide">
                      {f.numeroRadicado}
                    </td>
                    <td className="px-4 py-3">
                      {f.consultando ? (
                        <Spinner className="h-4 w-4" />
                      ) : esPrivado ? (
                        <CeldaPrivado f={f} />
                      ) : f.fechaUltimaActuacion ? (
                        <span className="font-semibold text-primary">
                          {f.fechaUltimaActuacion}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sin consultar</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {f.esPrivado === null ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : esPrivado ? (
                        <Badge variant="destructive" className="text-xs">Privado</Badge>
                      ) : (
                        <Badge className="text-xs bg-green-600 hover:bg-green-700">Público</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {f.fechaUltimaConsulta ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1.5">
                        {!esPrivado && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => consultarFila(index)}
                            disabled={f.consultando || consultandoTodos}
                            className="gap-1 text-xs"
                          >
                            <RefreshCw className={`h-3 w-3 ${f.consultando ? "animate-spin" : ""}`} />
                            Actualizar
                          </Button>
                        )}
                        {esPublico && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs"
                            onClick={() =>
                              navigate(
                                `/proceso-judicial/${f.clienteId}/${f.deudorId}`
                              )
                            }
                          >
                            <FileSearch className="h-3 w-3" />
                            Ver
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
