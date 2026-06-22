import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Label } from "@/shared/ui/label";
import { toast } from "sonner";
import { Deudor } from "../../models/deudores.model";
import { obtenerDeudorPorCliente, actualizarDeudorDatos } from "../../services/deudorService";
import { upsertEstadoMensualPorMes } from "../../services/estadoMensualService";
import { db } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Calendar, DollarSign, Save, TrendingUp, Users } from "lucide-react";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { tipificacionColorMap } from "@/shared/constants/tipificacionColors";
import { Checkbox } from "@/shared/ui/checkbox";

interface FilaEstadoBase {
  deudorId: string;
  nombre: string;
  ubicacion: string;
  tipificacion: TipificacionDeuda;
  porcentajeHonorarios: string;
  deuda: string;
  recaudo: string;
  tieneExistente?: boolean;
}

const TIPIFICACIONES_FILTRABLES: TipificacionDeuda[] = [
  TipificacionDeuda.GESTIONANDO,
  TipificacionDeuda.DEMANDA,
  TipificacionDeuda.ACUERDO,
  TipificacionDeuda.DEMANDA_ACUERDO,
];

function ubicacionToSortableNumber(ubicacion: string) {
  const onlyDigits = (ubicacion ?? "").replace(/\D/g, "");
  return onlyDigits ? Number(onlyDigits) : Number.POSITIVE_INFINITY;
}

export default function EstadosMensualesInputMasivo() {

  const { clienteId } = useParams();

  const [tipificacionesSeleccionadas, setTipificacionesSeleccionadas] =
    useState<TipificacionDeuda[]>([
      TipificacionDeuda.GESTIONANDO,
      TipificacionDeuda.DEMANDA,
      TipificacionDeuda.ACUERDO,
      TipificacionDeuda.DEMANDA_ACUERDO,
    ]);

  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [mesGlobal, setMesGlobal] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [filas, setFilas] = useState<FilaEstadoBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cargandoExistentes, setCargandoExistentes] = useState(false);
  const [deudoresCargados, setDeudoresCargados] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(true);
  const [mesModalTemp, setMesModalTemp] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );

  // Estructura base de deudores (sin estados) para reutilizar al cargar mes
  const filasBaseRef = useRef<FilaEstadoBase[]>([]);

  // Traer nombre del cliente
  useEffect(() => {
    if (!clienteId) return;
    let cancel = false;

    (async () => {
      try {
        const tryUserCollections = async (): Promise<string | null> => {
          const usersCollections = "usuarios";
          const ref = doc(db, usersCollections, String(clienteId));
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const u = snap.data() as Partial<UsuarioSistema>;
            const nombre = (u?.nombre ?? "").toString().trim();
            if (nombre) return nombre;
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

  // Precarga los estados existentes del mes sobre una lista de filas base
  const aplicarEstadosMes = async (mes: string, base: FilaEstadoBase[]) => {
    if (!clienteId || base.length === 0 || !mes) return;
    setCargandoExistentes(true);
    try {
      const resultado = await Promise.all(
        base.map(async (fila) => {
          try {
            const snap = await getDoc(
              doc(db, `clientes/${clienteId}/deudores/${fila.deudorId}/estadosMensuales/${mes}`)
            );
            if (snap.exists()) {
              const d = snap.data();
              return {
                ...fila,
                deuda: d.deuda != null ? String(d.deuda) : "",
                recaudo: d.recaudo != null ? String(d.recaudo) : "",
                porcentajeHonorarios:
                  d.porcentajeHonorarios != null
                    ? String(d.porcentajeHonorarios)
                    : fila.porcentajeHonorarios,
                tieneExistente: true,
              };
            }
          } catch { /* ignorar errores por deudor individual */ }
          return { ...fila, deuda: "", recaudo: "", tieneExistente: false };
        })
      );
      setFilas(resultado);
    } finally {
      setCargandoExistentes(false);
    }
  };

  const confirmarModal = () => {
    if (!mesModalTemp) return;
    setMesGlobal(mesModalTemp);
    setModalAbierto(false);
  };

  // Cargar deudores solo después de confirmar el mes en el modal
  useEffect(() => {
    if (!clienteId || modalAbierto) return;

    const cargar = async () => {
      setLoading(true);
      try {
        const deudores: Deudor[] = await obtenerDeudorPorCliente(clienteId);

        const nuevasFilas: FilaEstadoBase[] = deudores.map((d) => {
          const tipificacion = d.tipificacion ?? TipificacionDeuda.GESTIONANDO;
          const esDemanda =
            tipificacion === TipificacionDeuda.DEMANDA ||
            tipificacion === TipificacionDeuda.DEMANDA_ACUERDO;

          const tienePorc =
            d.porcentajeHonorarios !== undefined &&
            d.porcentajeHonorarios !== null &&
            d.porcentajeHonorarios !== 0;

          const porcDb = tienePorc
            ? String(d.porcentajeHonorarios)
            : esDemanda
            ? "20"
            : "0";

          return {
            deudorId: d.id!,
            nombre: d.nombre || "Sin nombre",
            ubicacion: d.ubicacion || "",
            tipificacion,
            porcentajeHonorarios: porcDb,
            deuda: "",
            recaudo: "",
            tieneExistente: false,
          };
        });

        filasBaseRef.current = nuevasFilas;
        setDeudoresCargados(true);
      } catch (error) {
        console.error(error);
        toast.error("No se pudieron cargar los deudores");
        setFilas([]);
      } finally {
        setLoading(false);
      }
    };

    cargar();
  }, [clienteId, modalAbierto]);

  // Carga automática al cambiar el mes (o al terminar de cargar deudores)
  useEffect(() => {
    if (!deudoresCargados || !mesGlobal) return;
    aplicarEstadosMes(mesGlobal, filasBaseRef.current);
  }, [mesGlobal, deudoresCargados]);



  // ✅ Filtrar + ordenar (solo para render)
  const filasVisibles = filas
    .filter((f) => tipificacionesSeleccionadas.includes(f.tipificacion))
    .slice()
    .sort(
      (a, b) =>
        ubicacionToSortableNumber(a.ubicacion) -
        ubicacionToSortableNumber(b.ubicacion)
    );

  const handleChangeById = (
    deudorId: string,
    field: keyof FilaEstadoBase,
    value: string
  ) => {
    setFilas((prev) =>
      prev.map((f) => (f.deudorId === deudorId ? { ...f, [field]: value } : f))
    );
  };

  const handleChangePorcentajeById = (deudorId: string, raw: string) => {
    if (raw === "") {
      handleChangeById(deudorId, "porcentajeHonorarios", "");
      return;
    }
    let num = Number(raw);
    if (Number.isNaN(num)) num = 0;
    num = Math.max(0, Math.min(20, num));
    handleChangeById(deudorId, "porcentajeHonorarios", String(num));
  };


  const guardarTodos = async () => {
    if (!clienteId) return;

    if (!/^\d{4}-\d{2}$/.test(mesGlobal)) {
      toast.error("Selecciona un mes válido (YYYY-MM).");
      return;
    }

    const porGuardar = filas.filter((f) => {
      const deudaOk = f.deuda.trim() !== "" && Number(f.deuda) >= 0;
      const recaudoOk = f.recaudo.trim() !== "" && Number(f.recaudo) >= 0;
      

      // ✅ guardar si hay al menos uno diligenciado
      return deudaOk || recaudoOk;
    });

    const omitidas = filas.length - porGuardar.length;

    if (porGuardar.length === 0) {
      toast.error("No hay filas válidas: diligencia al menos uno (Deuda o Recaudo).");
      return;
    }

    try {
      setSaving(true);

      await Promise.all(
        porGuardar.map(async (fila) => {
          const deudaNum = Number.parseFloat(fila.deuda);
          const recaudoNum = Number.parseFloat(fila.recaudo);          

          const porcentajeParse = fila.porcentajeHonorarios?.trim()
            ? Number.parseFloat(fila.porcentajeHonorarios)
            : 15;


          const deuda = Number.isNaN(deudaNum) ? 0 : deudaNum;
          const recaudo = Number.isNaN(recaudoNum) ? 0 : recaudoNum;          

          let porc = Number.isNaN(porcentajeParse) ? 15 : porcentajeParse;
          porc = Math.max(0, Math.min(20, porc));

          const round0 = (n: number) => Math.round(n);

          const pct = porc / 100;          

          const honorariosDeuda = deuda > 0 ? round0(deuda * pct) : 0;
          
          const honorariosRecaudo = recaudo > 0 ? round0(recaudo * pct) : 0;            

          await upsertEstadoMensualPorMes(clienteId, fila.deudorId, {
            mes: mesGlobal,
            deuda: round0(deuda),
            recaudo: round0(recaudo),            
            porcentajeHonorarios: porc,

            honorariosDeuda,            
            honorariosRecaudo,

            recibo: "",
            observaciones: "",
          });

          // ✅ Persistir el % también en el documento del deudor (si lo cambiaron)
          await actualizarDeudorDatos(clienteId, fila.deudorId, {
            porcentajeHonorarios: porc,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">

      {/* Modal selección de mes */}
      {modalAbierto && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <Typography variant="h3" className="!text-brand-secondary font-bold">
                  Seleccionar mes
                </Typography>
                <Typography variant="small" className="text-muted-foreground">
                  Elige el mes para el ingreso masivo de estados
                </Typography>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Mes *
              </Label>
              <Input
                type="month"
                value={mesModalTemp}
                onChange={(e) => setMesModalTemp(e.target.value.slice(0, 7))}
                className="border-brand-secondary/30"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") confirmarModal(); }}
              />
            </div>

            <Button
              type="button"
              variant="brand"
              className="w-full gap-2"
              disabled={!mesModalTemp}
              onClick={confirmarModal}
            >
              <Calendar className="h-4 w-4" />
              Continuar
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {loading && (
          <div className="fixed inset-0 z-[900] bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-lg px-6 py-5 text-center">
              <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
              <Typography variant="body">Cargando deudores...</Typography>
            </div>
          </div>
        )}
        {saving && (
          <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="rounded-xl bg-white shadow-lg px-6 py-5 flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
              <div className="text-sm">
                <Typography variant="body" className="font-medium">
                  Guardando estados mensuales...
                </Typography>
                <Typography variant="small">Por favor espera un momento.</Typography>
              </div>
            </div>
          </div>
        )}

        <BackButton />

        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow-lg">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
            <div>
              <Typography variant="h1" className="!text-brand-primary font-bold">
                Ingreso Masivo de Estados Mensuales
              </Typography>
              <Typography variant="body">
                Registra los estados de todos los deudores a la vez
              </Typography>
            </div>
          </div>

          <div className="rounded-2xl border border-brand-primary/20 bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <Users className="h-5 w-5 text-brand-primary" />
              </div>
              <div>
                <Typography variant="small">Conjunto</Typography>
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  {clienteNombre}
                </Typography>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
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
              <div className="flex items-center gap-2">
                <Input
                  type="month"
                  value={mesGlobal ?? ""}
                  onChange={(e) => setMesGlobal(e.target.value.slice(0, 7))}
                  disabled={saving || cargandoExistentes}
                  className="border-brand-secondary/30"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Al cambiar el mes se cargan automáticamente los datos guardados de ese mes.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          {/* ✅ Filtros */}
          <div className="p-4 md:p-5 border-b border-brand-secondary/10 bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
            <div className="flex flex-wrap items-center gap-3">
              <Typography variant="small" className="text-muted-foreground mr-2">
                Filtrar tipificación:
              </Typography>

              {TIPIFICACIONES_FILTRABLES.map((t) => {
                const checked = tipificacionesSeleccionadas.includes(t);

                return (
                  <label
                    key={t}
                    className="flex items-center gap-2 rounded-xl border border-brand-secondary/15 bg-white px-3 py-2 shadow-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const isChecked = Boolean(v);
                        setTipificacionesSeleccionadas((prev) => {
                          if (isChecked) return Array.from(new Set([...prev, t]));
                          return prev.filter((x) => x !== t);
                        });
                      }}
                    />
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold border
                        ${tipificacionColorMap[t] ??
                        "bg-gray-100 text-gray-700 border-gray-300"
                        }
                      `}
                    >
                      {String(t).replaceAll("_", " ")}
                    </span>
                  </label>
                );
              })}

              <Button
                type="button"
                variant="outline"
                className="ml-auto"
                onClick={() =>
                  setTipificacionesSeleccionadas([
                    TipificacionDeuda.GESTIONANDO,
                    TipificacionDeuda.DEMANDA,
                    TipificacionDeuda.ACUERDO,
                    TipificacionDeuda.DEMANDA_ACUERDO,
                  ])
                }
              >
                Ver todos
              </Button>
            </div>
          </div>

          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-brand-primary" />
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  Datos de deudores
                </Typography>
              </div>
              <Typography variant="small">
                {filasVisibles.length} deudor{filasVisibles.length !== 1 ? "es" : ""}
              </Typography>
            </div>
          </div>

          {cargandoExistentes && (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 border-b border-blue-100 text-sm text-blue-700">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
              Cargando datos existentes del mes...
            </div>
          )}

          <div className="overflow-x-auto">
            <fieldset disabled={saving || cargandoExistentes}>
              <Table className="min-w-[1000px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Deudor</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Inmueble</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Tipificación</TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold w-[90px]">
                      % Hon.
                    </TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold w-[260px]">
                      Deuda
                    </TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold w-[260px]">
                      Recaudo
                    </TableHead>                    
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filasVisibles.map((fila, i) => {
                    const esDemanda =
                      fila.tipificacion === TipificacionDeuda.DEMANDA ||
                      fila.tipificacion === TipificacionDeuda.DEMANDA_ACUERDO;

                    return (
                      <TableRow
                        key={fila.deudorId}
                        className={cn(
                          "border-brand-secondary/5 transition-colors",
                          fila.tieneExistente
                            ? "bg-blue-50/50 hover:bg-blue-50"
                            : i % 2 === 0
                            ? "bg-white hover:bg-brand-primary/5"
                            : "bg-brand-primary/[0.02] hover:bg-brand-primary/5"
                        )}
                      >
                        <TableCell className="font-medium text-gray-700">{fila.nombre}</TableCell>
                        <TableCell className="font-medium text-gray-700">{fila.ubicacion}</TableCell>

                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold border
              ${tipificacionColorMap[fila.tipificacion] ?? "bg-gray-100 text-gray-700 border-gray-300"}
            `}
                          >
                            {String(fila.tipificacion).replaceAll("_", " ")}
                          </span>
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            value={fila.porcentajeHonorarios ?? ""}
                            onChange={(e) => handleChangePorcentajeById(fila.deudorId, e.target.value)}
                            className="w-full text-right border-brand-secondary/30"
                            placeholder="0–20"
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={fila.deuda ?? ""}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => handleChangeById(fila.deudorId, "deuda", e.target.value)}
                            className="w-full text-right border-brand-secondary/30"
                            placeholder="0"
                          />
                        </TableCell>

                        <TableCell>
                          <Input
                            type="number"
                            inputMode="decimal"
                            value={fila.recaudo ?? ""}
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                            onChange={(e) => handleChangeById(fila.deudorId, "recaudo", e.target.value)}
                            className="w-full text-right border-brand-secondary/30"
                            placeholder="0"
                          />
                        </TableCell>
                        
                      </TableRow>
                    );
                  })}
                </TableBody>

              </Table>
            </fieldset>
          </div>

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
                    Guardar todos los estados.
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <Typography variant="small" className="text-blue-800">
            <strong>Nota:</strong> Solo se guardarán las filas que tengan al menos{" "}
            Deuda y Recaudo completados. Las filas vacías serán omitidas automáticamente.
            El porcentaje de honorarios se limita entre 0% y 20%.
          </Typography>
        </div>
      </div>
    </div>
  );
}
