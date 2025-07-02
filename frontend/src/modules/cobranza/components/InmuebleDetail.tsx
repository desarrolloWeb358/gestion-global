"use client";

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Checkbox } from "../../../components/ui/checkbox";
import { Typography } from "@mui/material";
import { Inmueble } from "../../../modules/cobranza/models/inmueble.model";
import AgreementTable from "../components/AgreementTableGrid";
import SubirPlantillaExcel from "../../../components/SubirPlantillaExcel";
import { db } from "../../../firebase";
import { doc as fsDoc, getDoc } from "firebase/firestore";
//import * as XLSX from "xlsx";

export default function InmuebleDetailTabsWrapper() {
  const { clienteId, inmuebleId } = useParams<{ clienteId: string; inmuebleId: string }>();
  const [inmueble, setInmueble] = useState<Inmueble | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!clienteId || !inmuebleId) return;
      const snap = await getDoc(fsDoc(db, "clientes", clienteId, "inmuebles", inmuebleId));
      if (snap.exists()) {
        const data = snap.data() as Inmueble;
        setInmueble({ id: snap.id, ...data });
      } else {
        setInmueble(null);
      }
      setLoading(false);
    };
    load();
  }, [clienteId, inmuebleId]);

  if (loading) return <Typography>Cargando proceso...</Typography>;
  if (!inmueble) return <Typography color="error">Inmueble no encontrado.</Typography>;

  return <InmuebleDetailTabs inmueble={inmueble} />;
}

interface Props {
  inmueble: Inmueble;
}

function InmuebleDetailTabs({ inmueble }: Props) {
  const acuerdo = inmueble.acuerdo_pago;
  const historial = inmueble.historial_acuerdos ?? [];

  return (
    <Tabs defaultValue="cronograma" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="cronograma">Cronograma de cuotas</TabsTrigger>
        <TabsTrigger value="descargar">Descargar acuerdo</TabsTrigger>
        <TabsTrigger value="historial">Historial de acuerdos</TabsTrigger>
      </TabsList>

      {/* TAB: CRONOGRAMA DE CUOTAS */}
      <TabsContent value="cronograma">
        <div className="mb-4">
          <SubirPlantillaExcel
            porcentajeHonorarios={10}
            inmuebleId={inmueble.id || "sin-id"}
          />
        </div>

        <AgreementTable inmuebleId={inmueble.id || ""} />

        {acuerdo?.cuotas?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pagado</TableHead>
                <TableHead>Mes</TableHead>
                <TableHead>Valor esperado</TableHead>
                <TableHead>Fecha límite</TableHead>
                <TableHead>Observación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acuerdo.cuotas.map((cuota, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Checkbox checked={cuota.pagado} disabled />
                  </TableCell>
                  <TableCell>{cuota.mes}</TableCell>
                  <TableCell>${cuota.valor_esperado.toLocaleString()}</TableCell>
                  <TableCell>{cuota.fecha_limite || '-'}</TableCell>
                  <TableCell>{cuota.observacion || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p>No hay cuotas registradas.</p>
        )}
      </TabsContent>

      {/* TAB: DESCARGAR ACUERDO ACTUAL */}
      <TabsContent value="descargar">
        {acuerdo?.numero && acuerdo.fecha_acuerdo ? (
          <div className="space-y-2">
            <p className="font-semibold">Acuerdo #{acuerdo.numero}</p>
            {"archivoUrl" in acuerdo && (acuerdo as any).archivoUrl ? (
              <a
                href={(acuerdo as any).archivoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Descargar archivo del acuerdo
              </a>
            ) : (
              <p className="text-muted-foreground">No se cargó archivo para este acuerdo</p>
            )}
          </div>
        ) : (
          <p>No hay acuerdo actual para mostrar.</p>
        )}
      </TabsContent>

      {/* TAB: HISTORIAL DE ACUERDOS */}
      <TabsContent value="historial">
        {historial.length > 0 ? (
          <ul className="space-y-2">
            {historial.map((ac, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ac.fecha_acuerdo} – #{ac.numero}
                </span>
                {ac.archivoUrl ? (
                  <a
                    href={ac.archivoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Descargar
                  </a>
                ) : (
                  <span className="text-muted-foreground">Sin archivo</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay historial de acuerdos previos.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
