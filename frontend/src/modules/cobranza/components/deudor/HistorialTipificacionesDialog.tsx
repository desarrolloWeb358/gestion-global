import { useState, useEffect } from "react";
import { Trash2, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

import {
  obtenerHistorialTipificaciones,
  reemplazarHistorialTipificaciones,
} from "../../services/historialTipificacionesService";

/*
 * Editor del historial de tipificaciones del deudor, y con él el único punto de
 * la app donde la tipificación cambia: el campo es de solo lectura en los
 * formularios porque la tipificación activa se deriva del último registro del
 * historial, no se escribe a mano.
 *
 * Vive aparte porque lo abren dos pantallas -- el listado de deudores y la ficha
 * del deudor -- y ambas deben mostrar el mismo editor.
 */

/** Timestamp-like -> Date */
const toDateSafe = (v: any): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  return undefined;
};

export function applyHonorariosDefaultByTip(tip: TipificacionDeuda, prev?: number | string) {
  const esDemanda =
    tip === TipificacionDeuda.DEMANDA ||
    tip === TipificacionDeuda.DEMANDA_ACUERDO ||
    tip === TipificacionDeuda.DEMANDA_TERMINADO ||
    tip === TipificacionDeuda.DEMANDA_INSOLVENCIA;

  const esGestionando = tip === TipificacionDeuda.GESTIONANDO;

  if (esDemanda) return 20;
  if (esGestionando) return 15;

  const current = prev === "" || prev === undefined || prev === null ? undefined : Number(prev);
  return Number.isFinite(current as any) ? Number(current) : 15;
}

export function HistorialTipificacionesDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly: boolean;
  saving: boolean;
  clienteId: string;
  deudorId: string;
  onSaved: (historialOrdenado: Array<{ fecha: Date; tipificacion: TipificacionDeuda }>) => void;
}) {
  const { open, onOpenChange, readOnly, saving, clienteId, deudorId, onSaved } = props;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id?: string; fecha: Date; tipificacion: TipificacionDeuda }>>([]);
  const [busy, setBusy] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const raw = await obtenerHistorialTipificaciones(clienteId, deudorId);
      const mapped = raw
        .map((x) => ({
          id: x.id,
          fecha: toDateSafe(x.fecha) ?? new Date(),
          tipificacion: (x.tipificacion ?? TipificacionDeuda.GESTIONANDO) as TipificacionDeuda,
        }))
        .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
      setItems(mapped);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error cargando historial");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && clienteId && deudorId) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteId, deudorId]);

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        fecha: new Date(),
        tipificacion: TipificacionDeuda.GESTIONANDO,
      },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<{ fecha: Date; tipificacion: TipificacionDeuda }>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  };

  const removeRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const guardar = async () => {
    if (readOnly) return;

    // Validación mínima
    if (items.length === 0) {
      toast.error("Debes tener al menos 1 registro de tipificación.");
      return;
    }
    for (const it of items) {
      if (!it.fecha || isNaN(it.fecha.getTime())) {
        toast.error("Hay un registro con fecha inválida.");
        return;
      }
      if (!it.tipificacion) {
        toast.error("Hay un registro sin tipificación.");
        return;
      }
    }

    // Ordenar por fecha asc
    const ordenado = [...items].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    setBusy(true);
    try {
      // Reemplazar el historial completo
      await reemplazarHistorialTipificaciones(
        clienteId,
        deudorId,
        ordenado.map((x) => ({
          fecha: Timestamp.fromDate(x.fecha),
          tipificacion: x.tipificacion
        }))

      );

      toast.success("Historial de tipificaciones guardado.");
      onSaved(ordenado);
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error guardando historial");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !busy && onOpenChange(v)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-brand-primary text-xl font-bold">
            Historial de tipificaciones
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center">
            <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
            <Typography variant="body">Cargando historial...</Typography>
          </div>
        ) : (
          <div className="space-y-4">


            <div className="overflow-x-auto rounded-lg border border-brand-secondary/10">
              <Table>
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold w-56">Fecha inicio</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Tipificación</TableHead>
                    <TableHead className="text-brand-secondary font-semibold text-center w-24">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={it.id ?? idx} className="border-brand-secondary/5">
                      <TableCell className="align-top">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal border-brand-secondary/30",
                                !it.fecha && "text-muted-foreground"
                              )}
                              disabled={readOnly || busy || saving}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {it.fecha ? format(it.fecha, "PPP", { locale: es }) : "Selecciona fecha"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={it.fecha}
                              defaultMonth={it.fecha ?? new Date()}
                              onSelect={(date) => updateRow(idx, { fecha: date ?? new Date() })}
                              initialFocus
                              captionLayout="dropdown"
                              fromYear={new Date().getFullYear() - 20}
                              toYear={new Date().getFullYear() + 20}
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>

                      <TableCell className="align-top">
                        <Select
                          disabled={readOnly || busy || saving}
                          value={it.tipificacion}
                          onValueChange={(v) => updateRow(idx, { tipificacion: v as TipificacionDeuda })}
                        >
                          <SelectTrigger className="border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20">
                            <SelectValue placeholder="Selecciona una tipificación" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(TipificacionDeuda).map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>


                      </TableCell>

                      <TableCell className="text-center align-top">
                        {!readOnly && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="hover:bg-red-50"
                            onClick={() => removeRow(idx)}
                            disabled={busy || saving}
                            title="Eliminar fila"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No hay historial. Agrega el primer registro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {!readOnly && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRow}
                  disabled={busy || saving}
                  className="border-brand-secondary/30"
                >
                  + Agregar registro
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={busy || saving}
                    className="border-brand-secondary/30"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="brand"
                    onClick={guardar}
                    disabled={busy || saving}
                  >
                    Guardar historial
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {readOnly && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
