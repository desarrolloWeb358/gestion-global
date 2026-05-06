import React, { useEffect, useState } from "react";
import { collectionGroup, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "@/firebase";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { BadgeTipificacion } from "@/shared/components/BadgeTipificacion";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Spinner } from "@/shared/ui/spinner";
import { Search, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";

const TIPIFICACIONES_DEMANDA: TipificacionDeuda[] = [
  TipificacionDeuda.DEMANDA,
  TipificacionDeuda.DEMANDA_ACUERDO,
  TipificacionDeuda.DEMANDA_TERMINADO,
  TipificacionDeuda.DEMANDA_INSOLVENCIA,
];

interface FilaDemandado {
  deudorId: string;
  clienteId: string;
  nombre: string;
  cedula: string;
  tipificacion: TipificacionDeuda;
  numeroRadicado: string;
  juzgado: string;
}

export default function RadicadosPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<FilaDemandado[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    async function cargar() {
      try {
        const q = query(
          collectionGroup(db, "deudores"),
          where("tipificacion", "in", TIPIFICACIONES_DEMANDA)
        );
        const snap = await getDocs(q);
        const resultado: FilaDemandado[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const clienteId = d.ref.parent.parent?.id ?? "";
          return {
            deudorId: d.id,
            clienteId,
            nombre: data.nombre ?? "",
            cedula: data.cedula ?? "",
            tipificacion: data.tipificacion,
            numeroRadicado: data.numeroRadicado ?? "",
            juzgado: data.juzgado ?? "",
          };
        });
        resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
        setFilas(resultado);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  const filtradas = filas.filter((f) => {
    const q = busqueda.toLowerCase();
    return (
      f.nombre.toLowerCase().includes(q) ||
      f.cedula.includes(q) ||
      f.numeroRadicado.includes(q) ||
      f.juzgado.toLowerCase().includes(q)
    );
  });

  const conRadicado = filtradas.filter(
    (f) => f.numeroRadicado.trim().length === 23
  );
  const sinRadicado = filtradas.filter(
    (f) => f.numeroRadicado.trim().length !== 23
  );

  const irADeudor = (f: FilaDemandado) =>
    navigate(`/clientes/${f.clienteId}/deudores/${f.deudorId}`);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
        <Spinner className="h-6 w-6" />
        <span className="text-sm">Cargando demandados…</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Procesos judiciales</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Todos los deudores en etapa de demanda —{" "}
          <span className="text-green-600 font-medium">{conRadicado.length} con radicado</span>
          {" · "}
          <span className="text-destructive font-medium">{sinRadicado.length} sin radicado</span>
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, cédula, radicado, juzgado…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Con radicado */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <h3 className="font-semibold text-base">Con radicado ({conRadicado.length})</h3>
        </div>

        {conRadicado.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-6">Sin resultados.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Nombre</th>
                  <th className="text-left px-4 py-2 font-medium">Cédula</th>
                  <th className="text-left px-4 py-2 font-medium">Tipificación</th>
                  <th className="text-left px-4 py-2 font-medium">Radicado</th>
                  <th className="text-left px-4 py-2 font-medium">Juzgado</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {conRadicado.map((f) => (
                  <tr
                    key={`${f.clienteId}-${f.deudorId}`}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => irADeudor(f)}
                  >
                    <td className="px-4 py-2 font-medium">{f.nombre}</td>
                    <td className="px-4 py-2 text-muted-foreground">{f.cedula || "—"}</td>
                    <td className="px-4 py-2">
                      <BadgeTipificacion value={f.tipificacion} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs tracking-wide">{f.numeroRadicado}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{f.juzgado || "—"}</td>
                    <td className="px-4 py-2">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sin radicado */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <h3 className="font-semibold text-base">Sin radicado ({sinRadicado.length})</h3>
        </div>

        {sinRadicado.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-6">Todos los demandados tienen radicado.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Nombre</th>
                  <th className="text-left px-4 py-2 font-medium">Cédula</th>
                  <th className="text-left px-4 py-2 font-medium">Tipificación</th>
                  <th className="text-left px-4 py-2 font-medium">Juzgado</th>
                  <th className="text-left px-4 py-2 font-medium">Estado radicado</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {sinRadicado.map((f) => (
                  <tr
                    key={`${f.clienteId}-${f.deudorId}`}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => irADeudor(f)}
                  >
                    <td className="px-4 py-2 font-medium">{f.nombre}</td>
                    <td className="px-4 py-2 text-muted-foreground">{f.cedula || "—"}</td>
                    <td className="px-4 py-2">
                      <BadgeTipificacion value={f.tipificacion} />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{f.juzgado || "—"}</td>
                    <td className="px-4 py-2">
                      <Badge variant="destructive" className="text-xs">Sin radicado</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
