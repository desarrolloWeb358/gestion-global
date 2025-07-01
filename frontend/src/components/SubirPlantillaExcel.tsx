// src/components/inmueble/SubirPlantillaExcel.tsx
import { db } from "../firebase"; // Asegúrate de que esta importación apunte a tu config de Firebase
import { collection, addDoc } from "firebase/firestore";
import React, { useState } from "react";
import { procesarExcel } from "../shared/procesarExcel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Input } from "../components/ui/input";
import type { CuotaAcuerdo } from "../modules/cobranza/models/inmueble.model";
import { toast } from "sonner";
interface Props {
  porcentajeHonorarios: number;
  inmuebleId: string; // 👈 nuevo prop
  onCuotasProcesadas?: (cuotas: CuotaAcuerdo[]) => void;
}

export async function guardarCuotasEnFirestore(
  inmuebleId: string,
  cuotas: CuotaAcuerdo[]
) {
  const batchErrors = [];

  for (const cuota of cuotas) {
    try {
      await addDoc(collection(db, "inmuebles", inmuebleId, "cuotas_acuerdo"), cuota);
    } catch (error) {
      console.error("Error guardando cuota:", cuota, error);
      batchErrors.push({ cuota, error });
    }
  }

  if (batchErrors.length > 0) {
    throw new Error("Algunas cuotas no se pudieron guardar");
  }
}

export default function SubirPlantillaExcel({ porcentajeHonorarios, inmuebleId, onCuotasProcesadas }: Props) {
  const [cuotas, setCuotas] = useState<CuotaAcuerdo[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const cuotasProcesadas = await procesarExcel(file, porcentajeHonorarios);
      setCuotas(cuotasProcesadas);
      onCuotasProcesadas?.(cuotasProcesadas);
    } catch (err) {
      console.error("Error procesando el archivo:", err);
    }
  };

  return (
    <div className="space-y-4">
      <Input type="file" accept=".xlsx,.xls" onChange={handleFileChange} />
            {cuotas.length > 0 && (
              <div className="border rounded-md p-4 overflow-x-auto space-y-4">
                <h3 className="font-semibold mb-2">Cuotas procesadas</h3>

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
                        <TableCell>{cuota.fecha_limite}</TableCell>
                        <TableCell>
                          {cuota.deuda_capital.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                        </TableCell>
                        <TableCell>
                          {cuota.cuota_capital.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                        </TableCell>
                        <TableCell>
                          {cuota.deuda_honorarios.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                        </TableCell>
                        <TableCell>
                          {cuota.honorarios.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                        </TableCell>
                        <TableCell>
                          {cuota.cuota_acuerdo.toLocaleString("es-CO", { style: "currency", currency: "COP" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="text-right">
                  <button
                    onClick={async () => {
                      try {
                        await guardarCuotasEnFirestore(inmuebleId, cuotas);
                        toast.success("Cuotas guardadas exitosamente");
                      } catch (err) {
                        toast.error("Error al guardar cuotas. Revisa la consola.");
                        console.error(err);
                      }
                    }}
                    className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition"
                  >
                    Guardar cuotas
                  </button>
                </div>
              </div>
            )}  
    </div>
  );
}
