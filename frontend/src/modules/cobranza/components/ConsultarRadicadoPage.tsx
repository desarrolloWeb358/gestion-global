import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { ArrowLeft, Search, AlertCircle, Lock, FileText } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Typography } from "@/shared/design-system/components/Typography";

const CF_URL = "https://us-central1-gestionglobal-9eac8.cloudfunctions.net/helloWorld";

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

export default function ConsultarRadicadoPage() {
  const navigate = useNavigate();
  const [radicado, setRadicado] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConsultar() {
    const num = radicado.replace(/\D/g, "");
    if (num.length !== 23) {
      setError("El número de radicado debe tener exactamente 23 dígitos.");
      return;
    }
    setLoading(true);
    setError(null);
    setResultado(null);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const resp = await fetch(CF_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ radicado: num }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Error al consultar");
      setResultado(data as ResultadoConsulta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al consultar el radicado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <Typography variant="h2" className="!text-brand-secondary">Consultar Radicado</Typography>
          <p className="text-sm text-gray-500 mt-0.5">Consulta el estado de un proceso en la Rama Judicial</p>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm p-5 space-y-4">
        <div className="space-y-1.5">
          <Label>Número de radicado (23 dígitos)</Label>
          <div className="flex gap-2">
            <Input
              value={radicado}
              onChange={(e) => setRadicado(e.target.value.replace(/\D/g, ""))}
              placeholder="Ej: 11001310300120200012300"
              maxLength={23}
              className="font-mono"
            />
            <Button onClick={handleConsultar} disabled={loading} className="bg-brand-primary hover:bg-brand-secondary gap-2">
              <Search className="h-4 w-4" />
              {loading ? "Consultando..." : "Consultar"}
            </Button>
          </div>
          <p className="text-xs text-gray-400">{radicado.length}/23 dígitos</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>

      {resultado && (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            {resultado.esPrivado
              ? <Lock className="h-5 w-5 text-amber-500" />
              : <FileText className="h-5 w-5 text-brand-primary" />
            }
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Proceso {resultado.radicado}
            </Typography>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Despacho", value: resultado.despacho },
              { label: "Departamento", value: resultado.departamento },
              { label: "Sujetos procesales", value: resultado.sujetosProcesales },
              { label: "Última actuación", value: resultado.fechaUltimaActuacion ?? "—" },
              { label: "Total actuaciones", value: String(resultado.totalActuaciones) },
              { label: "Estado", value: resultado.esPrivado ? "Privado" : "Público" },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-sm font-medium text-gray-800 break-words">{value || "—"}</p>
              </div>
            ))}
          </div>

          {!resultado.esPrivado && resultado.actuaciones.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Actuaciones recientes</p>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {resultado.actuaciones.map((act) => (
                  <div key={act.numero} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-brand-primary">{act.tipo}</span>
                      <span className="text-xs text-gray-400">{act.fecha}</span>
                    </div>
                    {act.anotacion && (
                      <p className="text-xs text-gray-600 leading-relaxed">{act.anotacion}</p>
                    )}
                    {act.conDocumentos && (
                      <span className="mt-1 inline-block text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                        Con documentos
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
