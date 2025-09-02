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

import { Seguimiento, TipoSeguimiento } from "../models/seguimiento.model";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";

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

// Evita unknown[] en TS 5
const TIPO_OPTIONS = Object.values(TipoSeguimiento) as TipoSeguimiento[];

// Mostrar enums más bonitos
function humanize(val?: string) {
  if (!val) return "—";
  return val
    .replace(/[_\-]/g, " ")
    .toLowerCase()
    .replace(/^\w|\s\w/g, (m) => m.toUpperCase());
}

// DEMANDA / DEMANDA/ACUERDO → jurídico; resto → prejurídico
function defaultDestinoFromTipificacion(t?: TipificacionDeuda): DestinoColeccion {
  if (t === TipificacionDeuda.DEMANDA || t === TipificacionDeuda.DEMANDAACUERDO) {
    return "seguimientoJuridico";
  }
  return "seguimiento";
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
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  });

  const [destino, setDestino] = React.useState<DestinoColeccion>(
    destinoInicial ?? defaultDestinoFromTipificacion(tipificacionDeuda)
  );
  const [tipoSeguimiento, setTipoSeguimiento] = React.useState<TipoSeguimiento>(
    seguimiento?.tipoSeguimiento ?? TipoSeguimiento.OTRO
  );
  const [descripcion, setDescripcion] = React.useState<string>(
    seguimiento?.descripcion ?? ""
  );
  const [archivo, setArchivo] = React.useState<File | undefined>(undefined);
  const [reemplazarArchivo, setReemplazarArchivo] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const d = seguimiento?.fecha?.toDate?.() ?? new Date();
    setFecha(
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10)
    );
    setTipoSeguimiento(seguimiento?.tipoSeguimiento ?? TipoSeguimiento.OTRO);
    setDescripcion(seguimiento?.descripcion ?? "");
    setArchivo(undefined);
    setReemplazarArchivo(false);
    setDestino(destinoInicial ?? defaultDestinoFromTipificacion(tipificacionDeuda));
  }, [seguimiento, open, tipificacionDeuda, destinoInicial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <Dialog open={open} onOpenChange={onClose}>
      {/* h-[90vh] para dar altura real al contenedor y permitir h-full internos */}
      <DialogContent className="max-w-2xl w-full h-[90vh] p-0">
        <div className="flex h-full flex-col">
          {/* Header fijo */}
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-lg">
              {seguimiento ? "Editar seguimiento" : "Crear seguimiento"}
            </DialogTitle>
            {extraHeader ? <div className="mt-2">{extraHeader}</div> : null}
          </DialogHeader>

          {/* Contenido con scroll */}
          <div className="flex-1 overflow-y-auto">
            <form
              id="seguimiento-form"
              className="px-6 py-4 space-y-6"
              onSubmit={handleSubmit}
            >
              {/* Datos básicos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input
                    id="fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Destino</Label>
                  <Select
                    value={destino}
                    onValueChange={(v: string) =>
                      setDestino(v as DestinoColeccion)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona dónde guardar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seguimiento">Prejurídico</SelectItem>
                      <SelectItem value="seguimientoJuridico">Jurídico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={tipoSeguimiento}
                    onValueChange={(v: string) =>
                      setTipoSeguimiento(v as TipoSeguimiento)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_OPTIONS.map((val) => (
                        <SelectItem key={val} value={val}>
                          {humanize(val)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Descripción */}
              <div>
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  className="min-h-[160px] leading-relaxed"
                  placeholder="Escribe la gestión realizada..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Se respetarán los saltos de línea al mostrarla en la tabla.
                </p>
              </div>

              <Separator />

              {/* Archivo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <Label htmlFor="archivo">Archivo (opcional)</Label>
                  <Input
                    id="archivo"
                    type="file"
                    onChange={(e) => setArchivo(e.target.files?.[0])}
                  />
                  {archivoNombre ? (
                    <span className="text-xs text-muted-foreground">
                      {archivoNombre}
                    </span>
                  ) : null}
                </div>

                {seguimiento?.archivoUrl ? (
                  <div className="flex items-center gap-2 pt-2 md:pt-0">
                    <input
                      id="reemplazar"
                      type="checkbox"
                      checked={reemplazarArchivo}
                      onChange={(e) => setReemplazarArchivo(e.target.checked)}
                    />
                    <Label htmlFor="reemplazar">
                      Reemplazar archivo existente
                    </Label>
                  </div>
                ) : null}
              </div>
            </form>
          </div>

          {/* Footer sticky */}
          <div className="p-4 border-t">
            <Button
              type="submit"
              form="seguimiento-form"
              className="w-full"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
