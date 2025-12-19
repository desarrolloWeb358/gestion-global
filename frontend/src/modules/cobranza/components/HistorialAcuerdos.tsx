// src/modules/cobranza/components/HistorialAcuerdos.tsx
/*
import { useState, useEffect } from "react";
import { Clock, FileText, Eye, Download } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { toast } from "sonner";

interface HistorialAcuerdosProps {
  clienteId: string;
  deudorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCOP = (v: number) => `$ ${Math.round(v).toLocaleString("es-CO")}`;

const formatFecha = (timestamp: any) => {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getEstadoBadge = (estado?: string) => {
  const estilos = {
    activo: "bg-green-100 text-green-700 border-green-200",
    cumplido: "bg-blue-100 text-blue-700 border-blue-200",
    incumplido: "bg-red-100 text-red-700 border-red-200",
    cancelado: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        estilos[estado as keyof typeof estilos] || estilos.activo
      )}
    >
      {estado || "activo"}
    </span>
  );
};

export default function HistorialAcuerdos({
  clienteId,
  deudorId,
  open,
  onOpenChange,
}: HistorialAcuerdosProps) {
  const [historial, setHistorial] = useState<HistorialAcuerdoPago[]>([]);
  const [loading, setLoading] = useState(false);
  const [acuerdoSeleccionado, setAcuerdoSeleccionado] = useState<HistorialAcuerdoPago | null>(null);
  const [detalleOpen, setDetalleOpen] = useState(false);

  useEffect(() => {
    if (open) {
      cargarHistorial();
    }
  }, [open, clienteId, deudorId]);

  const cargarHistorial = async () => {
    try {
      setLoading(true);
      const datos = await obtenerHistorialAcuerdos(clienteId, deudorId);
      setHistorial(datos);
    } catch (error) {
      console.error("Error al cargar historial:", error);
      toast.error("Error al cargar el historial de acuerdos");
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = (acuerdo: HistorialAcuerdoPago) => {
    setAcuerdoSeleccionado(acuerdo);
    setDetalleOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Historial de Acuerdos de Pago ({historial.length} versiones)
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="py-12 text-center">
              <div className="h-8 w-8 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
              <Typography variant="small" className="text-muted-foreground">
                Cargando historial...
              </Typography>
            </div>
          ) : historial.length === 0 ? (
            <div className="py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-brand-primary/10">
                  <FileText className="h-8 w-8 text-brand-primary/60" />
                </div>
                <Typography variant="body" className="text-muted-foreground">
                  No hay historial de acuerdos registrado
                </Typography>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-brand-secondary/10 overflow-hidden">
              <Table>
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Versión</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Número</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Fecha Creación</TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold">
                      Valor Total
                    </TableHead>
                    <TableHead className="text-center text-brand-secondary font-semibold">
                      Cuotas
                    </TableHead>
                    <TableHead className="text-center text-brand-secondary font-semibold">
                      Estado
                    </TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Guardado</TableHead>
                    <TableHead className="text-center text-brand-secondary font-semibold">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historial.map((acuerdo, index) => (
                    <TableRow
                      key={acuerdo.historialId}
                      className={cn(
                        "border-brand-secondary/5 transition-colors",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-primary/10 text-brand-primary font-bold text-sm">
                          {acuerdo.version}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{acuerdo.numero || "—"}</TableCell>
                      <TableCell>{formatFecha(acuerdo.fechaCreacion)}</TableCell>
                      <TableCell className="text-right font-semibold text-brand-primary">
                        {formatCOP(acuerdo.valorTotal)}
                      </TableCell>
                      <TableCell className="text-center">{acuerdo.cuotas?.length || 0}</TableCell>
                      <TableCell className="text-center">
                        {getEstadoBadge(acuerdo.estado)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFecha(acuerdo.fechaGuardado)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVerDetalle(acuerdo)}
                            className="hover:bg-brand-primary/10"
                          >
                            <Eye className="h-4 w-4 text-brand-primary" />
                          </Button>
                          {acuerdo.archivoUrl && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(acuerdo.archivoUrl, "_blank")}
                              className="hover:bg-brand-primary/10"
                            >
                              <Download className="h-4 w-4 text-brand-primary" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {// Diálogo de detalle 
      {acuerdoSeleccionado && (
        <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-brand-primary text-xl font-bold">
                Detalle del Acuerdo - Versión {acuerdoSeleccionado.version}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {// Información básica 
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Typography variant="small" className="text-muted-foreground">
                    Número de acuerdo
                  </Typography>
                  <Typography variant="body" className="font-medium">
                    {acuerdoSeleccionado.numero}
                  </Typography>
                </div>

                <div className="space-y-1">
                  <Typography variant="small" className="text-muted-foreground">
                    Fecha de creación
                  </Typography>
                  <Typography variant="body" className="font-medium">
                    {formatFecha(acuerdoSeleccionado.fechaCreacion)}
                  </Typography>
                </div>

                <div className="space-y-1">
                  <Typography variant="small" className="text-muted-foreground">
                    Valor total
                  </Typography>
                  <Typography variant="h3" className="!text-brand-primary">
                    {formatCOP(acuerdoSeleccionado.valorTotal)}
                  </Typography>
                </div>

                <div className="space-y-1">
                  <Typography variant="small" className="text-muted-foreground">
                    Número de cuotas
                  </Typography>
                  <Typography variant="body" className="font-medium">
                    {acuerdoSeleccionado.cuotas?.length || 0} cuotas
                  </Typography>
                </div>

                {acuerdoSeleccionado.porcentajeHonorarios && (
                  <div className="space-y-1">
                    <Typography variant="small" className="text-muted-foreground">
                      Porcentaje de honorarios
                    </Typography>
                    <Typography variant="body" className="font-medium text-orange-600">
                      {acuerdoSeleccionado.porcentajeHonorarios}%
                    </Typography>
                  </div>
                )}

                <div className="space-y-1">
                  <Typography variant="small" className="text-muted-foreground">
                    Estado
                  </Typography>
                  <div>{getEstadoBadge(acuerdoSeleccionado.estado)}</div>
                </div>
              </div>

              {// Descripción *
              {acuerdoSeleccionado.descripcion && (
                <div className="space-y-2">
                  <Typography variant="small" className="text-muted-foreground font-medium">
                    Descripción
                  </Typography>
                  <Typography variant="body" className="text-justify">
                    {acuerdoSeleccionado.descripcion}
                  </Typography>
                </div>
              )}

              {// Tabla de cuotas *
              {acuerdoSeleccionado.cuotas && acuerdoSeleccionado.cuotas.length > 0 && (
                <div className="space-y-3">
                  <Typography variant="h3" className="!text-brand-secondary font-semibold">
                    Cronograma de cuotas
                  </Typography>
                  <div className="rounded-lg border border-brand-secondary/10 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                        <TableRow>
                          <TableHead className="text-brand-secondary font-semibold">#</TableHead>
                          <TableHead className="text-brand-secondary font-semibold">
                            Fecha de pago
                          </TableHead>
                          <TableHead className="text-right text-brand-secondary font-semibold">
                            Valor
                          </TableHead>
                          <TableHead className="text-center text-brand-secondary font-semibold">
                            Estado
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {acuerdoSeleccionado.cuotas.map((cuota, idx) => (
                          <TableRow
                            key={idx}
                            className={cn(
                              "border-brand-secondary/5",
                              idx % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]"
                            )}
                          >
                            <TableCell className="font-medium">{cuota.numero}</TableCell>
                            <TableCell>{formatFecha(cuota.fechaPago)}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCOP(cuota.valor)}
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                  cuota.pagado
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : "bg-gray-100 text-gray-700 border-gray-200"
                                )}
                              >
                                {cuota.pagado ? "Pagada" : "Pendiente"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {// Motivo del cambio *
              {acuerdoSeleccionado.motivoCambio && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <Typography variant="small" className="text-blue-600 font-medium">
                    Motivo del cambio
                  </Typography>
                  <Typography variant="body" className="text-blue-700">
                    {acuerdoSeleccionado.motivoCambio}
                  </Typography>
                </div>
              )}

              {// Archivo adjunto *
              {acuerdoSeleccionado.archivoUrl && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.open(acuerdoSeleccionado.archivoUrl, "_blank")}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Descargar documento
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
  */