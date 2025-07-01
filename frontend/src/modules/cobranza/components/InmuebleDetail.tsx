import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Checkbox } from "../../../components/ui/checkbox";
import { Inmueble } from "../../../modules/cobranza/models/inmueble.model";
import AgreementTable from "../components/AgreementTableGrid"
import SubirPlantillaExcel from "../../../components/SubirPlantillaExcel";

interface Props {
  inmueble?: Inmueble;
}

export default function InmuebleDetailTabs({ inmueble }: Props) {
  const acuerdo = inmueble?.acuerdo_pago;
  const historial = inmueble?.historial_acuerdos ?? [];



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
            porcentajeHonorarios={10} // puedes ajustar este número dinámicamente
            inmuebleId={inmueble?.id || "sin-id"} // asegúrate de que inmueble.id exista
          />
        </div>
        <AgreementTable inmuebleId={""} />
        {acuerdo && acuerdo.cuotas && acuerdo.cuotas.length > 0 ? (
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
        {acuerdo ? (
          acuerdo.numero && acuerdo.fecha_acuerdo ? (
            <div className="space-y-2">
              <p className="font-semibold">Acuerdo #{acuerdo.numero}</p>
              {/** Este campo puede no estar si no hay archivo */}
              {'archivoUrl' in acuerdo && (acuerdo as any).archivoUrl ? (
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
          )
        ) : (
          <p>No hay acuerdo actual disponible.</p>
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
