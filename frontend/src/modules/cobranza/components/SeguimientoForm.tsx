
import { Seguimiento } from "../models/seguimiento.model";
import { TipoSeguimiento } from "../models/seguimiento.model";
import { Timestamp } from "firebase/firestore";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";





type Props = {
  open: boolean;
  onClose: () => void;
  seguimiento?: Seguimiento;
  onSave: (
    data: Omit<Seguimiento, "id">,
    archivo?: File,
    reemplazar?: boolean
  ) => Promise<void>;
  // NUEVO: para insertar el selector de Ámbito (u otro contenido)
  extraHeader?: React.ReactNode;
};

export default function SeguimientoForm({
  open,
  onClose,
  seguimiento,
  onSave,
  extraHeader,
}: Props) {
  const [fecha, setFecha] = React.useState<string>(() => {
    // yyyy-mm-dd para <input type="date">
    const d = seguimiento?.fecha?.toDate?.() ?? new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });

  const [tipoSeguimiento, setTipoSeguimiento] = React.useState<TipoSeguimiento>(seguimiento?.tipoSeguimiento ?? TipoSeguimiento.OTRO);
  const [descripcion, setDescripcion] = React.useState<string>(seguimiento?.descripcion ?? "");
  const [archivo, setArchivo] = React.useState<File | undefined>(undefined);
  const [reemplazarArchivo, setReemplazarArchivo] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState(false);


  React.useEffect(() => {
    const d = seguimiento?.fecha?.toDate?.() ?? new Date();
    setFecha(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
    setTipoSeguimiento(seguimiento?.tipoSeguimiento ?? TipoSeguimiento.OTRO);
    setDescripcion(seguimiento?.descripcion ?? "");
    setArchivo(undefined);
    setReemplazarArchivo(false);
  }, [seguimiento, open]);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaving(true);
  try {
    const fechaTs = Timestamp.fromDate(new Date(`${fecha}T00:00:00`));

    const data: Omit<Seguimiento, "id"> = {
      fecha: fechaTs,
      tipoSeguimiento,      // ✅ enum, no string
      descripcion,
      archivoUrl: seguimiento?.archivoUrl,
    };

    await onSave(data, archivo, reemplazarArchivo);
    onClose();
  } finally {
    setSaving(false);
  }
};

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{seguimiento ? "Editar seguimiento" : "Crear seguimiento"}</DialogTitle>
          {extraHeader ? <div className="mt-2">{extraHeader}</div> : null}
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Input
                placeholder="Llamada, Visita, Correo..."
                value={tipoSeguimiento}
                onChange={(e) => setTipoSeguimiento(e.target.value as TipoSeguimiento)}
              />
            </div>
          </div>

          <div>
            <Label>Descripción</Label>
            <Textarea
              className="min-h-[140px]"
              placeholder="Escribe la gestión realizada..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se respetarán los saltos de línea al mostrarla en la tabla.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Archivo (opcional)</Label>
              <Input
                type="file"
                onChange={(e) => setArchivo(e.target.files?.[0])}
              />
            </div>
            {seguimiento?.archivoUrl ? (
              <div className="flex items-center gap-2">
                <input
                  id="reemplazar"
                  type="checkbox"
                  checked={reemplazarArchivo}
                  onChange={(e) => setReemplazarArchivo(e.target.checked)}
                />
                <Label htmlFor="reemplazar">Reemplazar archivo existente</Label>
              </div>
            ) : null}
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
