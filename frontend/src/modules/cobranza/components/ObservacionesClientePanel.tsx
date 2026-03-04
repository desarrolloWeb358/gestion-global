import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";

import {
  addObservacionCliente,
  getObservacionesCliente,
} from "@/modules/cobranza/services/observacionClienteService";

import { ObservacionCliente } from "@/modules/cobranza/models/observacionCliente.model";

type Props = {
  clienteId: string;
  deudorId: string;
  allowAdd?: boolean;
  defaultOrder?: "asc" | "desc";
  showDate?: boolean;
  onAfterAdd?: () => void;
};

export default function ObservacionesClientePanel({
  clienteId,
  deudorId,
  allowAdd = false,
  showDate = true,
  onAfterAdd,
}: Props) {

  const [items, setItems] = React.useState<ObservacionCliente[]>([]);
  const [texto, setTexto] = React.useState("");
  const [archivo, setArchivo] = React.useState<File | undefined>();
  const [loading, setLoading] = React.useState(false);

  // =============================
  // Cargar observaciones
  // =============================

  async function cargarObservaciones() {
    if (!clienteId || !deudorId) return;

    setLoading(true);

    try {
      const data = await getObservacionesCliente(clienteId, deudorId);
      setItems(data);
    } catch (err) {
      console.error(err);
      toast.error("No se pudieron cargar las observaciones.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    cargarObservaciones();
  }, [clienteId, deudorId]);

  // =============================
  // Guardar observación
  // =============================

  async function handleGuardar() {
    if (!texto.trim()) {
      toast.error("Debes escribir una observación.");
      return;
    }

    try {
      await addObservacionCliente(clienteId, deudorId, texto, archivo);

      setTexto("");
      setArchivo(undefined);

      toast.success("Observación agregada.");

      await cargarObservaciones();

      if (onAfterAdd) onAfterAdd();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo guardar la observación.");
    }
  }

  return (
    <div className="space-y-6">

      {/* =============================
          FORMULARIO
      ============================= */}

      {allowAdd && (
        <div className="space-y-3">

          <Textarea
            placeholder="Escribe una observación..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />

          {/* SUBIR ARCHIVO */}

          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            className="text-sm"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setArchivo(e.target.files[0]);
              }
            }}
          />

          <Button onClick={handleGuardar}>
            Guardar observación
          </Button>

        </div>
      )}

      {/* =============================
          TABLA
      ============================= */}

      {loading ? (
        <p className="text-sm">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm">No hay observaciones registradas.</p>
      ) : (

        <Table>

          <TableHeader>
            <TableRow>

              {showDate && (
                <TableHead className="w-[140px]">
                  Fecha
                </TableHead>
              )}

              <TableHead>
                Observación
              </TableHead>

              <TableHead className="w-[140px]">
                Archivo
              </TableHead>

            </TableRow>
          </TableHeader>

          <TableBody>

            {items.map((obs) => (
              <TableRow key={obs.id}>

                {showDate && (
                  <TableCell>
                    {obs.fecha && typeof (obs.fecha as any).toDate === "function"
                      ? (obs.fecha as any).toDate().toLocaleDateString("es-CO")
                      : "—"}
                  </TableCell>
                )}

                <TableCell>
                  <div className="whitespace-pre-wrap text-sm">
                    {obs.texto}
                  </div>
                </TableCell>

                <TableCell>

                  {obs.archivoUrl ? (
                    <a
                      href={obs.archivoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-sm"
                    >
                      Ver archivo
                    </a>
                  ) : (
                    "—"
                  )}

                </TableCell>

              </TableRow>
            ))}

          </TableBody>

        </Table>

      )}

    </div>
  );
}