import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Spinner } from "@/shared/ui/spinner";

interface Actuacion {
  numero: number;
  fecha: string;
  tipo: string;
  anotacion: string;
  conDocumentos: boolean;
}

interface ResultadoConsulta {
  fuente: "CPNU";
  radicado: string;
  despacho: string;
  departamento: string;
  sujetosProcesales: string;
  fechaUltimaActuacion: string | null;
  esPrivado: boolean;
  actuaciones: Actuacion[];
  totalActuaciones: number;
}

const FUNCTION_URL =
  "https://us-central1-gestionglobal-9eac8.cloudfunctions.net/helloWorld";

export default function ConsultarRadicadoPage() {
  const [radicado, setRadicado] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);

  const handleConsultar = async () => {
    const num = radicado.trim();
    if (num.length !== 23) {
      setError("El número de radicado debe tener exactamente 23 dígitos.");
      return;
    }

    setLoading(true);
    setError("");
    setResultado(null);

    try {
      const token = await getAuth().currentUser?.getIdToken();
      if (!token) throw new Error("No hay sesión activa.");

      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ radicado: num }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setResultado(data as ResultadoConsulta);
    } catch (err: unknown) {
      const msg = (err as any)?.message ?? "Error de conexión";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">

      <div>
        <h2 className="text-2xl font-bold">Consulta Rama Judicial</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Consulta el estado del proceso en el sistema nacional de Rama Judicial (CPNU).
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Input
          placeholder="Ej: 25754418900420220087500"
          value={radicado}
          onChange={(e) => setRadicado(e.target.value.replace(/\D/g, "").slice(0, 23))}
          className="max-w-sm font-mono tracking-wider"
          maxLength={23}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleConsultar()}
        />
        <span className={`text-xs self-center ${radicado.length === 23 ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
          {radicado.length}/23
        </span>
        <Button onClick={handleConsultar} disabled={loading || radicado.length !== 23}>
          {loading ? "Consultando…" : "Consultar"}
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
          <Spinner className="h-8 w-8" />
          <p className="text-sm">Consultando Rama Judicial…</p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {resultado && (
        <div className="space-y-6">

          {/* Badge de estado */}
          <div className="flex items-center gap-2">
            {resultado.esPrivado ? (
              <Badge variant="destructive">Proceso reservado</Badge>
            ) : (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">Proceso público</Badge>
            )}
          </div>

          {/* Info del proceso */}
          <div className="border rounded-lg p-4 space-y-4 bg-card">
            <h3 className="font-semibold text-base">Información del Proceso</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Número de Radicado</p>
                <p className="font-mono font-semibold">{resultado.radicado}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Despacho</p>
                <p className="font-medium">{resultado.despacho || "—"}</p>
              </div>
              {resultado.departamento && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Departamento</p>
                  <p>{resultado.departamento}</p>
                </div>
              )}
              {resultado.sujetosProcesales && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Sujetos Procesales</p>
                  <p className="whitespace-pre-line">{resultado.sujetosProcesales}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Última Actuación</p>
                <p className="font-semibold text-primary text-base">
                  {resultado.fechaUltimaActuacion ?? "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Aviso proceso privado con links */}
          {resultado.esPrivado && (
            <div className="rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-5 space-y-3">
              <div>
                <p className="font-semibold text-orange-900 dark:text-orange-200">
                  Este proceso no expone sus actuaciones públicamente
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  Rama Judicial lo registra como reservado. Para consultar el estado de las
                  actuaciones puedes ingresar directamente a los portales oficiales:
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={`https://consultaprocesos.ramajudicial.gov.co/procesos/numeroradicacion`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md bg-orange-700 hover:bg-orange-800 text-white text-sm font-medium px-4 py-2 transition-colors"
                >
                  Consultar en CPNU
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>

                <a
                  href="https://procesos.ramajudicial.gov.co/procesoscs/ConsultaJusticias21.aspx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-orange-700 text-orange-800 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-sm font-medium px-4 py-2 transition-colors"
                >
                  Consultar en Justicia XXI (Pequeñas Causas)
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </div>

              <p className="text-xs text-orange-600 dark:text-orange-400">
                Radicado: <span className="font-mono font-semibold">{resultado.radicado}</span>
                {" "}— cópialo para buscarlo en el portal.
              </p>
            </div>
          )}

          {/* Tabla de actuaciones */}
          {!resultado.esPrivado && (
            <div>
              <h3 className="font-semibold text-base mb-2">
                Actuaciones judiciales{" "}
                {resultado.totalActuaciones > 0 && (
                  <span className="text-muted-foreground text-sm font-normal">
                    ({resultado.totalActuaciones} total)
                  </span>
                )}
              </h3>

              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      <TableHead className="w-[110px]">Fecha</TableHead>
                      <TableHead className="w-[200px]">Actuación</TableHead>
                      <TableHead>Anotación</TableHead>
                                  <TableHead className="w-[70px] text-center">Docs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.actuaciones.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={resultado.fuente === "CPNU" ? 5 : 4}
                          className="text-center text-muted-foreground py-8"
                        >
                          Sin actuaciones registradas
                        </TableCell>
                      </TableRow>
                    ) : (
                      resultado.actuaciones.map((act) => (
                        <TableRow key={act.numero}>
                          <TableCell className="text-center text-muted-foreground text-xs">
                            {act.numero}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {act.fecha || "—"}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {act.tipo || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                            {act.anotacion || "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {act.conDocumentos ? (
                              <Badge variant="outline" className="text-xs">Sí</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">No</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
