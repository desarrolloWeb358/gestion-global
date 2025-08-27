'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../../components/ui/tabs';
import {  Deudor } from '../models/deudores.model';
import AgreementTable from '../components/AgreementTableGrid';
import SubirPlantillaExcel from '../../../components/SubirPlantillaExcel';
import { Spinner } from '../../../components/ui/spinner';
import {  getDeudorById, obtenerAcuerdoActivo } from '../services/deudorService';
import {eliminarEstadoMensual } from '../services/estadoMensualService';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../../../components/ui/alert-dialog';
import { toast } from 'sonner';
import { AcuerdoPDFView } from '../../../components/acuerdo/AcuerdoPagoPDF';
import { AcuerdoPago, Cuota} from '../models/acuerdoPago.model';
 // Asegúrate de que este modelo exista

interface Props {
  deudor: Deudor;
  clienteId: string;
  deudorId: string;
  estadoMensualId: string;
  porcentajeHonorarios: number;
  onCuotasProcesadas: (cuotas: Cuota[]) => void;
  onCuotasGuardadas: () => void;
}

function DeudorDetailTabsWrapper() {

  const { clienteId, deudorId } = useParams<{ clienteId: string; deudorId: string }>();
  const [deudor, setDeudor] = useState<Deudor | null>(null);
  const [loading, setLoading] = useState(true);
  const [acuerdoActivo, setAcuerdoActivo] = useState<AcuerdoPago | null>(null);

useEffect(() => {
  const fetchAcuerdoActivo = async () => {
    if (!clienteId || !deudorId) return;

    const deudor = await getDeudorById(clienteId, deudorId);
    console.log("Deudor cargado:", deudor);

    if (deudor?.acuerdoActivoId) {
      const acuerdo = await obtenerAcuerdoActivo(clienteId, deudorId, deudor.acuerdoActivoId);
      setAcuerdoActivo(acuerdo);
    }
  };

  fetchAcuerdoActivo();
}, [clienteId, deudorId]);

  useEffect(() => {
    
    const cargarDeudor = async () => {
      if (!clienteId || !deudorId) return;
      const deudorCargado = await getDeudorById(clienteId, deudorId);
      setDeudor(deudorCargado);
      setLoading(false);
    };

    cargarDeudor();
  }, [clienteId, deudorId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Spinner className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!deudor || !clienteId || !deudorId) {
    return (
      <div className="flex justify-center items-center h-40">
        <p className="text-red-500 font-semibold">deudor no encontrado.</p>
      </div>
    );
  }

  return (
    <DeudorDetailTabs
      deudor={deudor}
      clienteId={clienteId}
      deudorId={deudor.id ?? deudorId} // ✅ Usar el ID real del deudor
      porcentajeHonorarios={deudor.porcentajeHonorarios ?? 0}
      onCuotasProcesadas={(cuotas) => {
        console.log("Cuotas procesadas", cuotas);
      } }
      onCuotasGuardadas={() => {
        console.log("Cuotas guardadas");
      } } estadoMensualId={''}    />
  );
}


function DeudorDetailTabs({ deudor, clienteId, deudorId,estadoMensualId,}: Props) {
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [recargarCuotas, setRecargarCuotas] = useState(false);
  const historial = deudor?.historialAcuerdos ?? [];

 

  const handleDescargarExcel = () => {
    const header = [
      ['#', 'Fecha límite', 'Deuda capital', 'Cuota capital', 'Deuda honorarios', 'Cuota honorarios', 'Total cuota'],
    ];
    const rows = cuotas.map((c) => [
      c.numero,
      c.fecha_limite,
      c.deuda_capital,
      c.cuota_capital,
      c.deuda_honorarios,
      c.honorarios,
      c.cuota_acuerdo,
    ]);
    const csv = [...header, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cuotas.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Tabs defaultValue="cronograma" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="cronograma">Cronograma de cuotas</TabsTrigger>
        <TabsTrigger value="descargar">Descargar acuerdo</TabsTrigger>
        <TabsTrigger value="historial">Historial de acuerdos</TabsTrigger>
      </TabsList>

      <TabsContent value="cronograma">
        <div className="mb-4">
          {deudor?.id && (
            <SubirPlantillaExcel
              clienteId={clienteId}
              deudorId={deudor.id}
              porcentajeHonorarios={0.1}
              onCuotasProcesadas={(cuotas) => setCuotas(cuotas)}
              onCuotasGuardadas={() => setRecargarCuotas((prev) => !prev)}
            />
          )}

        </div>

        {cuotas.length > 0 && (
          <div className="text-sm text-muted-foreground mb-4">
            {cuotas.length} cuotas procesadas.
            <button
              onClick={handleDescargarExcel}
              className="ml-4 underline text-blue-600 hover:text-blue-800"
            >
              Descargar en Excel
            </button>
          </div>
        )}

        {deudor?.id && (
          <AgreementTable
            clienteId={clienteId}
            deudorId={deudor.id}
            trigger={recargarCuotas}
          />
        )}

        <div className="text-right mt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="bg-destructive text-white px-4 py-2 rounded-md hover:bg-destructive/90 transition">
                Eliminar todas las cuotas
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción eliminará todas las cuotas del acuerdo actual. No podrás deshacer esta operación.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    try {
                      await eliminarEstadoMensual(clienteId, deudorId, estadoMensualId);
                      toast.success("Todas las cuotas fueron eliminadas");
                      setRecargarCuotas(prev => !prev);
                    } catch (error) {
                      console.error('Error al eliminar cuotas:', error);
                      toast.error("Ocurrió un error al intentar eliminar las cuotas.");
                    }
                  }}
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TabsContent>

      <TabsContent value="descargar">
        <AcuerdoPDFView clienteId={clienteId} deudorId={deudorId} />
      </TabsContent>


      <TabsContent value="historial">
        {historial.length > 0 ? (
          <ul className="space-y-2">
            {historial.map((ac, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ac.fechaCreacion.toDate().toLocaleDateString()} – #{ac.numero}
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

export default DeudorDetailTabsWrapper;
