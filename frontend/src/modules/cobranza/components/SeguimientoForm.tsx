// src/modules/cobranza/components/SeguimientoForm.tsx
import * as React from "react";
import { Timestamp } from "firebase/firestore";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";
import { Separator } from "@/shared/ui/separator";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";

import { Seguimiento } from "../models/seguimiento.model";
// imports nuevos:
import { TIPO_SEGUIMIENTO, TipoSeguimientoCode, codeToLabel } from "@/shared/constants/tipoSeguimiento";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

// locale español para el calendario (react-day-picker via date-fns)
import { es } from "date-fns/locale";

// ⬇️ NUEVO: portal para overlay global
import { createPortal } from "react-dom";

export type DestinoColeccion = "seguimiento" | "seguimientoJuridico";

type Props = {
  open: boolean;
  onClose: () => void;
  seguimiento?: Seguimiento;
  onSaveWithDestino?: (
    destino: DestinoColeccion,
    data: Omit<Seguimiento, "id">,
    archivo?: File,
    reemplazar?: boolean
  ) => Promise<void>;
  tipificacionDeuda?: TipificacionDeuda;
  destinoInicial?: DestinoColeccion;
  extraHeader?: React.ReactNode;
};

// === Helpers & Consts ===
const TIPO_OPTIONS = TIPO_SEGUIMIENTO;

function humanize(val?: string) {
  if (!val) return "—";
  return val
    .replace(/[_\-]/g, " ")
    .toLowerCase()
    .replace(/^\w|\s\w/g, (m) => m.toUpperCase());
}

function defaultDestinoFromTipificacion(t?: TipificacionDeuda): DestinoColeccion {
  if (t === TipificacionDeuda.DEMANDA || t === TipificacionDeuda.DEMANDAACUERDO) {
    return "seguimientoJuridico";
  }
  return "seguimiento";
}

function toLocalISODateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ✅ Parsear "YYYY-MM-DD" a Date EN LOCAL (no uses new Date("YYYY-MM-DD"))
function parseLocalDateString(s?: string) {
  if (!s) return undefined as unknown as Date | undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1); // Date local
}

function toISO(d?: Date) {
  return d ? toLocalISODateString(d) : "";
}

// === NUEVO: Overlay global bloqueante con portal ===
function GlobalSavingOverlay() {
  React.useEffect(() => {
    // bloquear scroll y mostrar cursor de espera
    document.body.classList.add("overflow-hidden");
    document.body.style.cursor = "wait";
    // opcional: marcar toda la app como "ocupada"
    document.documentElement.setAttribute("aria-busy", "true");
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.body.style.cursor = "";
      document.documentElement.removeAttribute("aria-busy");
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] bg-black/30 backdrop-blur-sm"
      // asegurar que captura todos los eventos
      style={{ pointerEvents: "auto" }}
      aria-live="polite"
      aria-label="Guardando, por favor espera"
      role="status"
    >
      <div className="w-full h-full grid place-items-center">
        <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Guardando…</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

// === DatePicker (popover) ===
function FechaPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const date = value ? parseLocalDateString(value) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal"
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date
            ? date.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })
            : "Fecha"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange(d ? toLocalISODateString(d) : "")}
          locale={es}
          initialFocus
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function SeguimientoForm({
  open,
  onClose,
  seguimiento,
  onSaveWithDestino,
  tipificacionDeuda,
  destinoInicial,
  extraHeader,
}: Props) {
  const [fecha, setFecha] = React.useState<string>(() => {
    const d = seguimiento?.fecha?.toDate?.() ?? new Date();
    return toLocalISODateString(d);
  });

  const [destino, setDestino] = React.useState<DestinoColeccion>(
    destinoInicial ?? defaultDestinoFromTipificacion(tipificacionDeuda)
  );


  const [tipoSeguimiento, setTipoSeguimiento] = React.useState<TipoSeguimientoCode>(
    seguimiento?.tipoSeguimiento ?? "otro"
  );

  const [descripcion, setDescripcion] = React.useState<string>(
    seguimiento?.descripcion ?? ""
  );
  const [archivo, setArchivo] = React.useState<File | undefined>(undefined);
  const [reemplazarArchivo, setReemplazarArchivo] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const d = seguimiento?.fecha?.toDate?.() ?? new Date();
    setFecha(toLocalISODateString(d));
    setTipoSeguimiento(seguimiento?.tipoSeguimiento ?? "otro");
    setDescripcion(seguimiento?.descripcion ?? "");
    setArchivo(undefined);
    setReemplazarArchivo(false);
    setDestino(destinoInicial ?? defaultDestinoFromTipificacion(tipificacionDeuda));
  }, [seguimiento, open, tipificacionDeuda, destinoInicial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const fechaTs = Timestamp.fromDate(new Date(`${fecha}T00:00:00`));
      const data: Omit<Seguimiento, "id"> = {
        fecha: fechaTs,
        tipoSeguimiento,
        descripcion,
        archivoUrl: seguimiento?.archivoUrl,
      };
      if (onSaveWithDestino) {
        await onSaveWithDestino(destino, data, archivo, reemplazarArchivo);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const archivoNombre =
    archivo?.name ?? (seguimiento?.archivoUrl ? "Archivo cargado" : "");

  return (
    <>
      {/* ⬇️ Overlay global a pantalla completa cuando saving = true */}
      {saving && <GlobalSavingOverlay />}

      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl w-[95vw] md:w-full h-[90vh] !p-0 rounded-none md:rounded-xl overflow-hidden">
          {/* Wrapper principal */}
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            {/* Header */}
            <DialogHeader className="sticky top-0 z-10 p-4 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <DialogTitle className="text-lg md:text-xl">
                {seguimiento ? "Editar seguimiento" : "Crear seguimiento"}
              </DialogTitle>
              {extraHeader ? <div className="mt-2">{extraHeader}</div> : null}
            </DialogHeader>

            {/* Contenido scrolleable */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <form
                id="seguimiento-form"
                className="px-6 py-5 space-y-6"
                onSubmit={handleSubmit}
                // mientras guarda, ignora cualquier interacción dentro del form
                style={saving ? { pointerEvents: "none" } : undefined}
              >
                {/* Datos básicos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-start">
                  {/* Fecha */}
                  <div className="space-y-2">
                    <Label className="text-sm">Fecha</Label>
                    <FechaPicker value={fecha} onChange={setFecha} disabled={saving} />
                    <input type="hidden" name="fecha" value={fecha} />
                  </div>

                  {/* Destino */}
                  <div className="space-y-2">
                    <Label className="text-sm">Destino</Label>
                    <Select
                      value={destino}
                      onValueChange={(v: string) => setDestino(v as DestinoColeccion)}
                      disabled={saving}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Selecciona dónde guardar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="seguimiento">Prejurídico</SelectItem>
                        <SelectItem value="seguimientoJuridico">Jurídico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tipo */}
                  <div className="space-y-2">
                    <Label className="text-sm">Tipo</Label>
                    <Select
                      value={tipoSeguimiento}
                      onValueChange={(v: string) =>
                        setTipoSeguimiento(v as TipoSeguimientoCode)
                      }
                      disabled={saving}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_OPTIONS.map((o) => (
                          <SelectItem key={o.code} value={o.code}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Descripción */}
                <div className="space-y-2">
                  <Label htmlFor="descripcion" className="text-sm">
                    Descripción
                  </Label>
                  <Textarea
                    id="descripcion"
                    className="min-h-[160px] leading-relaxed resize-y"
                    placeholder="Escribe la gestión realizada..."
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se respetarán los saltos de línea al mostrarla en la tabla.
                  </p>
                </div>

                <Separator />

                {/* Archivo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="archivo" className="text-sm">
                      Archivo (opcional)
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="archivo"
                        type="file"
                        onChange={(e) => setArchivo(e.target.files?.[0])}
                        disabled={saving}
                      />
                      {archivoNombre ? (
                        <span className="text-xs text-muted-foreground">
                          {archivoNombre}
                        </span>
                      ) : null}
                    </div>
                    {archivo ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => setArchivo(undefined)}
                        disabled={saving}
                      >
                        Quitar archivo
                      </Button>
                    ) : null}
                  </div>

                  {seguimiento?.archivoUrl ? (
                    <div className="flex items-center gap-2 pt-2 md:pt-0">
                      <input
                        id="reemplazar"
                        type="checkbox"
                        className="h-4 w-4 rounded border-muted-foreground/40"
                        checked={reemplazarArchivo}
                        onChange={(e) => setReemplazarArchivo(e.target.checked)}
                        disabled={saving}
                      />
                      <Label htmlFor="reemplazar" className="text-sm">
                        Reemplazar archivo existente
                      </Label>
                    </div>
                  ) : null}
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-base font-medium"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  form="seguimiento-form"
                  className="h-11 text-base font-medium"
                  disabled={saving}
                >
                  {saving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Guardando…
                    </span>
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
