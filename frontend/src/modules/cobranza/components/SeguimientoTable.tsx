// src/pages/SeguimientoTable.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from "../../../components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../../components/ui/table";
import { Edit, Trash2, Plus, ArrowLeft } from "lucide-react";
import SeguimientoForm from '../../../components/SeguimientoForm';
import { Seguimiento } from '../models/seguimiento.model';
import { getSeguimientos, deleteSeguimiento, addSeguimiento, updateSeguimiento } from '../services/seguimientoService';
import { useLoading } from "../../../context/LoadingContext";
import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../../../firebase';




export default function SeguimientoTable() {
  const navigate = useNavigate();
  const { clienteId, deudorId } = useParams<{ clienteId: string; deudorId: string }>();
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [seguimientoActual, setSeguimientoActual] = useState<Seguimiento | null>(null);
  const { setLoading } = useLoading();

  const fetchData = async () => {
    if (!clienteId || !deudorId) return;
    setLoading(true);
    const data = await getSeguimientos(clienteId, deudorId);
    setSeguimientos(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [clienteId, deudorId]);


  const handleEliminar = async (seg: Seguimiento) => {
    if (seg.archivoUrl) {
      try {
        await deleteObject(ref(storage, seg.archivoUrl));
      } catch (e) {
        console.warn("Error al eliminar archivo:", e);
      }
    }
    await deleteSeguimiento(clienteId!, deudorId!, seg.id!);
    fetchData();
  };




  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <h2 className="absolute left-1/2 transform -translate-x-1/2 text-2xl font-bold text-center">Seguimientos pre-juridico</h2>
        </div>
        <Button onClick={() => {
          setSeguimientoActual(null);
          setOpenForm(true);
        }}>
          <Plus className="w-4 h-4 mr-2" /> Crear Seguimiento
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Archivo</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {seguimientos.map((seg) => (
            <TableRow key={seg.id}>
              <TableCell>{seg.fecha?.toDate().toLocaleDateString()}</TableCell>
              <TableCell className="capitalize">
                {seg.tipoSeguimiento ?? "No registrado"}
              </TableCell>
              <TableCell>{seg.descripcion}</TableCell>
              <TableCell>
                {seg.archivoUrl ? (
                  <a href={seg.archivoUrl} target="_blank" rel="noopener noreferrer" className="underline text-blue-500">Ver</a>
                ) : "-"}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => {
                    setSeguimientoActual(seg);
                    setOpenForm(true);
                  }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleEliminar(seg)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SeguimientoForm
        open={openForm}
        onClose={() => {
          setOpenForm(false);
          setSeguimientoActual(null);
        }}
        seguimiento={seguimientoActual || undefined}
        onSave={async (data, archivo, reemplazar) => {
          if (!clienteId || !deudorId) return;

          if (seguimientoActual && seguimientoActual.id) {
            // Editar seguimiento existente
            await updateSeguimiento(
              clienteId,
              deudorId,
              seguimientoActual.id,
              data,
              archivo,
              reemplazar
            );
          } else {
            // Crear nuevo seguimiento
            await addSeguimiento(clienteId, deudorId, data, archivo);
          }

          await fetchData();
          setOpenForm(false);
          setSeguimientoActual(null);
        }}

      />
    </div>
  );
}
