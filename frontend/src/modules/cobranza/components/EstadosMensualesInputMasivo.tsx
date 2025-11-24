import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Label } from "@/shared/ui/label";
import { toast } from "sonner";
import { Deudor } from "../models/deudores.model";
import { obtenerDeudorPorCliente } from "../services/deudorService";
import { upsertEstadoMensualPorMes } from "../services/estadoMensualService";
import { db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Calendar, DollarSign, Save, TrendingUp, Users } from "lucide-react";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { BackButton } from "@/shared/design-system/components/BackButton";

interface FilaEstadoBase {
  deudorId: string;
  nombre: string;
  ubicacion: string;
  porcentajeHonorarios: string;
  deuda: string;
  recaudo: string;
  acuerdo?: string;
}

export default function EstadosMensualesInputMasivo() {
  const { clienteId } = useParams();

  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [mesGlobal, setMesGlobal] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [filas, setFilas] = useState<FilaEstadoBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Traer nombre del cliente
  useEffect(() => {
    if (!clienteId) return;
    let cancel = false;

    (async () => {
      try {
        const tryUserCollections = async (): Promise<string | null> => {
          const usersCollections = ["usuariosSistema", "usuarios"];
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

        const nombreUsuario = await tryUserCollections();
        const resolved =
          nombreUsuario ?? (await tryClienteCollection()) ?? "Cliente";

        if (!cancel) setClienteNombre(resolved);
      } catch (e) {
        console.error(e);
        if (!cancel) setClienteNombre("Cliente");
      }
    })();

    return () => {
      cancel = true;
    };
  }, [clienteId]);

  // Cargar deudores
  useEffect(() => {
    if (!clienteId) return;
    (async () => {
      setLoading(true);
      try {
        const deudores: Deudor[] = await obtenerDeudorPorCliente(clienteId);
        const nuevasFilas: FilaEstadoBase[] = deudores.map((d) => ({
          deudorId: d.id!,
          nombre: d.nombre || "Sin nombre",
          ubicacion: d.ubicacion || "",
          // 👉 usamos el porcentaje del deudor si existe, si no 15
          porcentajeHonorarios:
            d.porcentajeHonorarios !== undefined && d.porcentajeHonorarios !== null
              ? String(d.porcentajeHonorarios)
              : "15",
          deuda: "",
          recaudo: "",
          acuerdo: "",
        }));
        setFilas(nuevasFilas);
      } catch (e: any) {
        console.error(e);
        toast.error("⚠️ No se pudieron cargar los deudores del cliente.");
        setFilas([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [clienteId]);

  const handleChange = (
    index: number,
    field: keyof FilaEstadoBase,
    value: string
  ) => {
    setFilas((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleChangePorcentaje = (index: number, raw: string) => {
    // Permitimos campo vacío mientras escribe
    if (raw === "") {
      handleChange(index, "porcentajeHonorarios", "");
      return;
    }
    let num = Number(raw);
    if (Number.isNaN(num)) num = 0;
    // clamp 0–20
    num = Math.max(0, Math.min(20, num));
    handleChange(index, "porcentajeHonorarios", String(num));
  };

  const guardarTodos = async () => {
    if (!clienteId) return;

    if (!/^\d{4}-\d{2}$/.test(mesGlobal)) {
      toast.error("Selecciona un mes válido (YYYY-MM).");
      return;
    }

    const porGuardar = filas.filter(
      (f) => f.deuda.trim() !== "" && f.recaudo.trim() !== ""
    );
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
          const acuerdoNum = fila.acuerdo?.trim()
            ? Number.parseFloat(fila.acuerdo)
            : 0;
          const porcentajeParse = fila.porcentajeHonorarios?.trim()
            ? Number.parseFloat(fila.porcentajeHonorarios)
            : 15;

          const deuda = Number.isNaN(deudaNum) ? 0 : deudaNum;
          const recaudo = Number.isNaN(recaudoNum) ? 0 : recaudoNum;
          const acuerdo = Number.isNaN(acuerdoNum) ? 0 : acuerdoNum;

          // 👇 clamp 0–20 en el cálculo
          let porc = Number.isNaN(porcentajeParse) ? 15 : porcentajeParse;
          porc = Math.max(0, Math.min(20, porc));

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
        `✓ Se guardaron ${porGuardar.length} fila(s).` +
          (omitidas > 0 ? ` Omitidas ${omitidas} sin deuda y/o recaudo.` : "")
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "⚠️ Error al guardar algunos estados.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-4" />
          <Typography variant="body" className="text-muted">
            Cargando deudores...
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Overlay guardando */}
        {saving && (
          <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="rounded-xl bg-white shadow-lg px-6 py-5 flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
              <div className="text-sm">
                <Typography variant="body" className="font-medium">
                  Guardando estados mensuales...
                </Typography>
                <Typography variant="small" className="text-muted-foreground">
                  Por favor espera un momento.
                </Typography>
              </div>
            </div>
          </div>
        )}

        {/* Back Button */}
        <BackButton />

        {/* Header */}
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow-lg">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
            <div>
              <Typography variant="h1" className="!text-brand-primary font-bold">
                Ingreso Masivo de Estados Mensuales
              </Typography>
              <Typography variant="body" className="text-muted-foreground">
                Registra los estados de todos los deudores a la vez
              </Typography>
            </div>
          </div>

          {/* Info del cliente */}
          <div className="rounded-2xl border border-brand-primary/20 bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <Users className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <Typography variant="small" className="text-muted-foreground">
                  Conjunto
                </Typography>
                <Typography
                  variant="h3"
                  className="!text-brand-secondary font-semibold"
                >
                  {clienteNombre}
                </Typography>
              </div>
            </div>
          </div>
        </header>

        {/* Selector de mes */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-primary" />
              <Typography
                variant="h3"
                className="!text-brand-secondary font-semibold"
              >
                Seleccionar mes
              </Typography>
            </div>
          </div>

          <div className="p-4 md:p-5">
            <div className="max-w-xs">
              <Label className="text-brand-secondary font-medium flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" />
                Mes *
              </Label>
              <Input
                type="month"
                value={mesGlobal ?? ""}
                onChange={(e) => setMesGlobal(e.target.value.slice(0, 7))}
                disabled={saving}
                className="border-brand-secondary/30"
              />
            </div>
          </div>
        </section>

        {/* Tabla de ingreso */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-brand-primary" />
                <Typography
                  variant="h3"
                  className="!text-brand-secondary font-semibold"
                >
                  Datos de deudores
                </Typography>
              </div>
              <Typography variant="small" className="text-muted-foreground">
                {filas.length} deudor{filas.length !== 1 ? "es" : ""}
              </Typography>
            </div>
          </div>

          <div className="overflow-x-auto">
            <fieldset disabled={saving}>
              <Table className="min-w-[900px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">
                      Deudor
                    </TableHead>
                    <TableHead className="text-brand-secondary font-semibold">
                      Ubicación
                    </TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold w-[140px]">
                      % Hon.
                    </TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold w-[180px]">
                      Deuda
                    </TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold w-[180px]">
                      Recaudo
                    </TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold w-[180px]">
                      Acuerdo
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filas.map((fila, i) => (
                    <TableRow
                      key={fila.deudorId}
                      className={cn(
                        "border-brand-secondary/5 transition-colors",
                        i % 2 === 0
                          ? "bg-white"
                          : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="font-medium text-gray-700">
                        {fila.nombre}
                      </TableCell>
                      <TableCell className="font-medium text-gray-700">
                        {fila.ubicacion}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={20}
                          value={fila.porcentajeHonorarios ?? ""}
                          onChange={(e) =>
                            handleChangePorcentaje(
                              i,
                              e.target.value
                            )
                          }
                          className="text-right border-brand-secondary/30"
                          placeholder="0–20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={fila.deuda ?? ""}
                          onChange={(e) =>
                            handleChange(i, "deuda", e.target.value)
                          }
                          className="text-right border-brand-secondary/30"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={fila.recaudo ?? ""}
                          onChange={(e) =>
                            handleChange(i, "recaudo", e.target.value)
                          }
                          className="text-right border-brand-secondary/30"
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={fila.acuerdo ?? ""}
                          onChange={(e) =>
                            handleChange(i, "acuerdo", e.target.value)
                          }
                          className="text-right border-brand-secondary/30"
                          placeholder="0.00"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </fieldset>
          </div>

          {/* Footer con botón guardar */}
          <div className="border-t border-brand-secondary/10 bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5">
            <div className="flex justify-end">
              <Button
                onClick={guardarTodos}
                disabled={saving}
                variant="brand"
                className="gap-2 shadow-md hover:shadow-lg transition-all"
              >
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar todos los estados
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* Nota informativa */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Typography variant="small" className="text-blue-800">
            <strong>Nota:</strong> Solo se guardarán las filas que tengan al
            menos Deuda y Recaudo completados. Las filas vacías serán omitidas
            automáticamente. El porcentaje de honorarios se limita entre 0% y
            20%.
          </Typography>
        </div>
      </div>
    </div>
  );
}
