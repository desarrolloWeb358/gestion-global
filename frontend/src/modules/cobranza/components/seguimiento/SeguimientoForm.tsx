// src/modules/cobranza/components/SeguimientoForm.tsx
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
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

import { Seguimiento } from "../../models/seguimiento.model";
// imports nuevos:
import { TIPO_SEGUIMIENTO, TipoSeguimientoCode, codeToLabel } from "@/shared/constants/tipoSeguimiento";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

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
  if (t === TipificacionDeuda.DEMANDA || t === TipificacionDeuda.DEMANDA_ACUERDO) {
    return "seguimientoJuridico";
  }
  return "seguimiento";
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

export default function SeguimientoForm({
  open,
  onClose,
  seguimiento,
  onSaveWithDestino,
  tipificacionDeuda,
  destinoInicial,
  extraHeader,
}: Props) {
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
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  const isDirty = descripcion.trim() !== "";

  function tryClose() {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }

  React.useEffect(() => {
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
      const data: Omit<Seguimiento, "id"> = {
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

      <AlertDialog open={showExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Si sales ahora, cualquier información que hayas ingresado se perderá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowExitConfirm(false)}>
              Quedarme aquí
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setShowExitConfirm(false); onClose(); }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) tryClose(); }}>
        <DialogContent
          className="max-w-3xl w-[95vw] md:w-full h-[90vh] !p-0 rounded-none md:rounded-xl overflow-hidden"
          onInteractOutside={(e) => { e.preventDefault(); setShowExitConfirm(true); }}
          onEscapeKeyDown={(e) => { e.preventDefault(); tryClose(); }}
        >
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
                  {/* Fecha — solo lectura; creación = hoy, edición = fecha original del registro */}
                  <div className="space-y-2">
                    <Label className="text-sm">Fecha</Label>
                    <div className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed select-none">
                      <CalendarIcon className="h-4 w-4 shrink-0" />
                      <span>
                        {(seguimiento?.fecha?.toDate?.() ?? new Date()).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    </div>
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
                        title="Reemplazar archivo existente"
                        aria-label="Reemplazar archivo existente"
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
                  onClick={tryClose}
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
