'use client';

import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { procesarExcel } from '../shared/procesarExcel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import type { Cuota } from '../modules/cobranza/models/deudores.model';

interface Props {
  porcentajeHonorarios: number;
  deudorId: string;
  clienteId: string;
  onCuotasProcesadas?: (cuotas: Cuota[]) => void;
  onCuotasGuardadas?: () => void;
}

export default function SubirPlantillaExcel({
  porcentajeHonorarios,
  deudorId,
  clienteId,
  onCuotasProcesadas,
  onCuotasGuardadas,
}: Props) {
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const cuotasProcesadas = await procesarExcel(file, porcentajeHonorarios);

      const cuotasValidadas = cuotasProcesadas.map((cuota) => {
        const fecha = new Date(cuota.fecha_limite);
        const fecha_valida = !isNaN(fecha.getTime());

        return {
          ...cuota,
          fecha_limite: fecha_valida ? fecha.toISOString().split('T')[0] : 'Fecha inválida',
          acuerdo_pago: cuota.cuota_capital + cuota.honorarios,
        };
      });

      setCuotas(cuotasValidadas);
      onCuotasProcesadas?.(cuotasValidadas);
    } catch (err) {
      console.error('Error procesando el archivo:', err);
      toast.error('Error al procesar el archivo. Verifica el formato.');
    }
  };

  const guardarCuotasEnFirestore = async () => {
    setLoading(true);
    const batchErrors = [];

    for (const cuota of cuotas) {
      try {
        await addDoc(
          collection(db, `clientes/${clienteId}/deudores/${deudorId}/cuotas_acuerdo`),
          cuota
        );
      } catch (error) {
        console.error("Error guardando cuota:", cuota, error);
        batchErrors.push({ cuota, error });
      }
    }

    // 👇 ACTUALIZA el documento del deudor con las cuotas
    try {
      const deudorRef = doc(db, "clientes", clienteId, "deudores", deudorId);
      await updateDoc(deudorRef, {
        "acuerdo_pago.cuotas": cuotas,
      });
    } catch (err) {
      console.error("Error actualizando acuerdo_pago.cuotas:", err);
      toast.error("Error al actualizar el acuerdo de pago.");
      setLoading(false);
      return;
    }

    setLoading(false);

    if (batchErrors.length > 0) {
      toast.error("Algunas cuotas no se pudieron guardar.");
    } else {
      toast.success(`Cuotas guardadas exitosamente (${cuotas.length})`);
      setCuotas([]);
      onCuotasGuardadas?.(); // 👈 Notifica para recargar el PDF
    }
  };


  return (
    <div className="space-y-4">
      <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
      {cuotas.length > 0 && (
        <div className="border rounded-md p-4 overflow-x-auto space-y-4">
          <h3 className="font-semibold mb-2">
            {cuotas.length} cuotas procesadas
          </h3>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuota</TableHead>
                <TableHead>Fecha límite</TableHead>
                <TableHead>Deuda capital</TableHead>
                <TableHead>Cuota capital</TableHead>
                <TableHead>Deuda honorarios</TableHead>
                <TableHead>Cuota honorarios</TableHead>
                <TableHead>Total cuota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cuotas.map((cuota, index) => (
                <TableRow key={index}>
                  <TableCell>{cuota.numero}</TableCell>
                  <TableCell className={cuota.fecha_limite === 'Fecha inválida' ? 'text-red-500' : ''}>
                    {cuota.fecha_limite}
                  </TableCell>
                  <TableCell>
                    {cuota.deuda_capital.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                  </TableCell>
                  <TableCell>
                    {cuota.cuota_capital.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                  </TableCell>
                  <TableCell>
                    {cuota.deuda_honorarios.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                  </TableCell>
                  <TableCell>
                    {cuota.honorarios.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                  </TableCell>
                  <TableCell>
                    {cuota.acuerdo_pago.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="text-right">
            <button
              type="button"
              disabled={loading}
              onClick={guardarCuotasEnFirestore}
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar cuotas'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
