// modules/cobranza/components/SeguimientoTable.tsx
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SeguimientoForm from "./SeguimientoForm";
import { Seguimiento, TipoSeguimiento } from "../models/seguimiento.model";
import { Timestamp } from "firebase/firestore";

export default function SeguimientoTable() {
  const navigate = useNavigate();
  const { clienteId, deudorId } = useParams();

  const [open, setOpen] = React.useState(false);
  const [seleccionado, setSeleccionado] = React.useState<Seguimiento | undefined>(undefined);

  // ej. guardar en tu servicio
  const onSave = async (
    data: Omit<Seguimiento, "id">,
    archivo?: File,
    reemplazar?: boolean
  ) => {
    // TODO: llama a tu servicio de guardar / subir archivo
    // await crearOActualizarSeguimiento(clienteId!, deudorId!, data, archivo, reemplazar)
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-xl font-semibold">Seguimientoss</h2>
        <Button onClick={() => { setSeleccionado(undefined); setOpen(true); }}>
          Nuevo seguimiento
        </Button>
      </div>

      {/* aquí podrías listar los seguimientos existentes... */}

      <SeguimientoForm
        open={open}
        onClose={() => setOpen(false)}
        seguimiento={seleccionado}
        onSave={onSave}
      />
    </div>
  );
}
