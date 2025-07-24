import { useEffect, useState } from "react";
import { db } from "../../../firebase";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Checkbox } from "../../../components/ui/checkbox";

interface Cuota {
  id: string;
  pagado: boolean;
  mes: string;
  valor_esperado: number;
  fecha_limite?: string;
  observacion?: string;
}

interface Props {
  clienteId: string;
  deudorId: string;
  trigger?: boolean;
}

export default function AgreementTable({ clienteId, deudorId, trigger }: Props) {
  const [cuotas, setCuotas] = useState<Cuota[]>([]);

  useEffect(() => {
    const cargarCuotas = async () => {
      const ref = collection(db, `clientes/${clienteId}/deudores/${deudorId}/cuotas_acuerdo`);
      const snapshot = await getDocs(ref);
      const data: Cuota[] = snapshot.docs.map(doc => ({
        id: doc.id,
        pagado: doc.data().pagado ?? false,
        mes: doc.data().numero ?? "",
        valor_esperado: doc.data().cuota_acuerdo ?? 0,
        fecha_limite: doc.data().fecha_limite ?? "",
        observacion: doc.data().observacion ?? "",
      }));
      setCuotas(data);
    };

    if (deudorId) {
      cargarCuotas();
    }
  }, [clienteId, deudorId, trigger]);

  const actualizarPagado = async (cuotaId: string, nuevoEstado: boolean) => {
    try {
      const ref = doc(db, "deudores", deudorId, "cuotas_acuerdo", cuotaId);
      await updateDoc(ref, { pagado: nuevoEstado });

      setCuotas(prev =>
        prev.map(c =>
          c.id === cuotaId ? { ...c, pagado: nuevoEstado } : c
        )
      );
    } catch (error) {
      console.error("Error al actualizar 'pagado':", error);
    }
  };

  return (
    <div className="space-y-4">
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
          {cuotas.map((cuota) => (
            <TableRow key={cuota.id}>
              <TableCell>
                <Checkbox
                  checked={cuota.pagado}
                  onCheckedChange={(value) =>
                    actualizarPagado(cuota.id, Boolean(value))
                  }
                />
              </TableCell>
              <TableCell>{cuota.mes}</TableCell>
              <TableCell>
                {cuota.valor_esperado.toLocaleString("es-CO", {
                  style: "currency",
                  currency: "COP",
                })}
              </TableCell>
              <TableCell>{cuota.fecha_limite}</TableCell>
              <TableCell>{cuota.observacion || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
