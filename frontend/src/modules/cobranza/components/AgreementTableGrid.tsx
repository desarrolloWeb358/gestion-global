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
  inmuebleId: string;
}

export default function AgreementTable({ inmuebleId }: Props) {
  const [cuotas, setCuotas] = useState<Cuota[]>([]);

  useEffect(() => {
    const cargarCuotas = async () => {
      const snapshot = await getDocs(collection(db, "inmuebles", inmuebleId, "cuotas_acuerdo"));
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

    if (inmuebleId) {
      cargarCuotas();
    }
  }, [inmuebleId]);

  const actualizarPagado = async (cuotaId: string, nuevoEstado: boolean) => {
    try {
      const ref = doc(db, "inmuebles", inmuebleId, "cuotas_acuerdo", cuotaId);
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
            <TableHead>Pagado</TableHead>
            <TableHead>Mes</TableHead>
            <TableHead>Valor Esperado</TableHead>
            <TableHead>Fecha Límite</TableHead>
            <TableHead>Observación</TableHead>
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
