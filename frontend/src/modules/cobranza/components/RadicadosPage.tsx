import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase";
import { ArrowLeft, ExternalLink, Search } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { Typography } from "@/shared/design-system/components/Typography";

interface ProcesoRow {
  clienteId: string;
  deudorId: string;
  nombre: string;
  cedula: string;
  radicado: string;
  juzgado: string;
  tipificacion: string;
}

export default function RadicadosPage() {
  const navigate = useNavigate();
  const [procesos, setProcesos] = useState<ProcesoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const clientesSnap = await getDocs(
          query(collection(db, "clientes"), where("activo", "==", true))
        );
        const clientesActivos = new Set(clientesSnap.docs.map((d) => d.id));

        const snap = await getDocs(
          query(
            collectionGroup(db, "deudores"),
            where("tipificacion", "in", ["Demanda", "Demanda/Acuerdo"])
          )
        );
        const rows: ProcesoRow[] = snap.docs
          .map((d) => {
            const parts = d.ref.path.split("/");
            const data = d.data();
            return {
              clienteId: parts[1],
              deudorId: parts[3],
              nombre: data.nombre ?? "",
              cedula: data.cedula ?? "",
              radicado: String(data.numeroRadicado ?? "").trim(),
              juzgado: data.juzgado ?? "",
              tipificacion: data.tipificacion ?? "",
            };
          })
          .filter((r) => clientesActivos.has(r.clienteId) && /^\d{23}$/.test(r.radicado));
        setProcesos(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = procesos.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(q) ||
      p.radicado.includes(q) ||
      p.juzgado.toLowerCase().includes(q) ||
      p.cedula.includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <Typography variant="h2" className="!text-brand-secondary">Procesos Judiciales</Typography>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Cargando..." : `${procesos.length} procesos con radicado registrado`}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, radicado, juzgado..."
          className="pl-9"
        />
      </div>

      <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Cargando procesos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            {search ? "Sin resultados para esa búsqueda" : "No hay procesos con radicado registrado"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Deudor", "Cédula", "Radicado", "Juzgado", "Tipificación", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <tr key={`${p.clienteId}-${p.deudorId}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.cedula || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-brand-primary">{p.radicado}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{p.juzgado || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                        {p.tipificacion || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/proceso-judicial/${p.clienteId}/${p.deudorId}`}
                        className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
                      >
                        Ver detalle <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
