import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { toast } from "sonner";
import { Deudor } from "../models/deudores.model";
import { obtenerDeudorPorCliente } from "../services/deudorService";
import { upsertEstadoMensualPorMes } from "../services/estadoMensualService";
import { db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

interface FilaEstadoBase {
  deudorId: string;
  nombre: string;
  porcentajeHonorarios: string; // string por input controlado (ej. "15")
  deuda: string;                // string por input controlado
  recaudo: string;              // string por input controlado
  acuerdo?: string;             // string por input controlado (opcional)
}

export default function EstadosMensualesInputMasivo() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [mesGlobal, setMesGlobal] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [filas, setFilas] = useState<FilaEstadoBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Traer nombre solo desde clientes/{clienteId}
 useEffect(() => {
  if (!clienteId) return;
  let cancel = false;

  (async () => {
    try {
      // 1) Intentar como UsuarioSistema
      const tryUserCollections = async (): Promise<string | null> => {
        const usersCollections = ["usuariosSistema", "usuarios"]; // por si usas otro nombre
        for (const col of usersCollections) {
          const ref = doc(db, col, String(clienteId));
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const u = snap.data() as Partial<UsuarioSistema>;
            const nombre = (u?.nombre ?? "").toString().trim();
            if (nombre) return nombre;
          }
        }
        return null;
      };

      // 2) Fallback a clientes/{clienteId}
      const tryClienteCollection = async (): Promise<string | null> => {
        const ref = doc(db, "clientes", String(clienteId));
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data() as any;
          const nombre =
            (d?.nombre && String(d.nombre).trim()) ||
            (d?.razonSocial && String(d.razonSocial).trim());
          if (nombre) return nombre;
        }
        return null;
      };

      // Resolver nombre
      const nombreUsuario = await tryUserCollections();
      const resolved =
        nombreUsuario ??
        (await tryClienteCollection()) ??
        "Cliente";

      if (!cancel) setClienteNombre(resolved);
    } catch (e) {
      console.error(e);
      if (!cancel) setClienteNombre("Cliente");
    }
  })();

  return () => {
    cancel = true;
  };
}, [clienteId, db]);
  // Cargar deudores y preparar filas
  useEffect(() => {
    if (!clienteId) return;
    (async () => {
      setLoading(true);
      try {
        const deudores: Deudor[] = await obtenerDeudorPorCliente(clienteId);
        const nuevasFilas: FilaEstadoBase[] = deudores.map((d) => ({
          deudorId: d.id!,
          nombre: d.nombre || "Sin nombre",
          porcentajeHonorarios: "15",
          deuda: "",
          recaudo: "",
          acuerdo: "",
        }));
        setFilas(nuevasFilas);
      } catch (e: any) {
        console.error(e);
        toast.error("No se pudieron cargar los deudores del cliente.");
        setFilas([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [clienteId]);

  const handleChange = (index: number, field: keyof FilaEstadoBase, value: string) => {
    setFilas((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const guardarTodos = async () => {
    if (!clienteId) return;

    if (!/^\d{4}-\d{2}$/.test(mesGlobal)) {
      toast.error("Selecciona un mes válido (YYYY-MM).");
      return;
    }

    const porGuardar = filas.filter((f) => f.deuda.trim() !== "" && f.recaudo.trim() !== "");
    const omitidas = filas.length - porGuardar.length;

    if (porGuardar.length === 0) {
      toast.error("No hay filas completas (deuda y recaudo) para guardar.");
      return;
    }

    try {
      setSaving(true);

      await Promise.all(
        porGuardar.map(async (fila) => {
          const deudaNum = Number.parseFloat(fila.deuda);
          const recaudoNum = Number.parseFloat(fila.recaudo);
          const acuerdoNum = fila.acuerdo?.trim() ? Number.parseFloat(fila.acuerdo) : 0;
          const porcentaje = fila.porcentajeHonorarios?.trim()
            ? Number.parseFloat(fila.porcentajeHonorarios)
            : 15;

          const deuda = Number.isNaN(deudaNum) ? 0 : deudaNum;
          const recaudo = Number.isNaN(recaudoNum) ? 0 : recaudoNum;
          const acuerdo = Number.isNaN(acuerdoNum) ? 0 : acuerdoNum;
          const porc = Number.isNaN(porcentaje) ? 15 : porcentaje;

          const honorariosDeuda = (deuda * porc) / 100;
          const honorariosAcuerdo = (acuerdo * porc) / 100;

          await upsertEstadoMensualPorMes(clienteId, fila.deudorId, {
            mes: mesGlobal,
            deuda,
            recaudo,
            acuerdo,
            porcentajeHonorarios: porc,
            honorariosDeuda,
            honorariosAcuerdo,
            recibo: "",
            observaciones: "",
          });
        })
      );

      toast.success(
        `Se guardaron ${porGuardar.length} fila(s).` +
          (omitidas > 0 ? ` Omitidas ${omitidas} sin deuda y/o recaudo.` : "")
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Error al guardar algunos estados.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Cargando…</div>;

  return (
    <div className="p-6 space-y-6">
      {saving && (
        <div className="fixed inset-0 z-[1000] bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
          <div className="rounded-xl bg-white dark:bg-neutral-900 shadow-lg px-6 py-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <div className="text-sm">
              <div className="font-medium">Guardando…</div>
              <div className="text-muted-foreground">Por favor espera un momento.</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1" {...(saving ? { inert: "" as unknown as boolean } : {})}>
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)}>
            ← Volver
          </Button>
          <h1 className="text-2xl font-bold text-center flex-1">
            Ingreso Masivo de Estados Mensuales
          </h1>
          <div className="w-[85px]" />
        </div>

      <p className="text-lg text-muted-foreground text-center">
  Conjunto: <span className="font-semibold text-gray-900">{clienteNombre}</span>
</p>
      </div>

      <div className="flex items-center gap-3">
        <label className="font-medium">Mes:</label>
        <Input
          type="month"
          value={mesGlobal ?? ""}
          onChange={(e) => setMesGlobal(e.target.value.slice(0, 7))}
          className="max-w-[200px]"
          disabled={saving}
        />
      </div>

      <div className="relative">
        <fieldset disabled={saving} className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Deudor</th>
                  <th className="p-2 text-right">Deuda</th>
                  <th className="p-2 text-right">Recaudo</th>
                  <th className="p-2 text-right">Acuerdo</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, i) => (
                  <tr key={fila.deudorId} className="border-t">
                    <td className="p-2">{fila.nombre}</td>
                    <td className="p-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={fila.deuda ?? ""}
                        onChange={(e) => handleChange(i, "deuda", e.target.value)}
                        className="text-right"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={fila.recaudo ?? ""}
                        onChange={(e) => handleChange(i, "recaudo", e.target.value)}
                        className="text-right"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={fila.acuerdo ?? ""}
                        onChange={(e) => handleChange(i, "acuerdo", e.target.value)}
                        className="text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button onClick={guardarTodos} className="mt-4" disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Guardando…
              </span>
            ) : (
              "Guardar todos los estados"
            )}
          </Button>
        </fieldset>
      </div>
    </div>
  );
}
