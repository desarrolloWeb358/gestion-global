// src/modules/deudores/pages/AcuerdoPagoPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";
import { useReactToPrint } from "react-to-print";
import {
  FileText,
  Save,
  Calendar as CalendarIcon,
  DollarSign,
  Hash,
  Clock,
  Printer,
  FileDown,
  Calculator,
  History,
  AlertCircle,
  CheckCircle,
  XCircle,
  Ban,
  MoreVertical,
} from "lucide-react";
import { exportarAcuerdoWord } from "@/modules/cobranza/services/exportarAcuerdoWord";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { Typography } from "@/shared/design-system/components/Typography";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import TablaAmortizacion, { type DatosAmortizacion } from "@/modules/cobranza/components/TablaAmortizacion";
import HistorialAcuerdos from "@/modules/cobranza/components/HistorialAcuerdos";
import { guardarAcuerdoEnHistorial, cambiarEstadoAcuerdo } from "@/modules/cobranza/services/acuerdoPagoService";

import { cn } from "@/shared/lib/cn";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import numeroALetras from "@/shared/numeroALetras";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { getAuth } from "firebase/auth";
import type { AcuerdoPago } from "@/modules/cobranza/models/acuerdoPago.model";

interface Cuota {
  numero: number;
  fechaVencimiento: Date;
  montoCuota: number;
  pagada: boolean;
}

interface FormAcuerdoPago {
  numeroAcuerdo?: string;
  fechaAcuerdo?: Date;
  montoTotal?: number;
  montoCuota?: number;
  numeroCuotas?: number;
  fechaPrimeraCuota?: Date;
  periodicidad?: string;
  detalles?: string;
  observaciones?: string;
  cuotas?: Cuota[];
  tablaAmortizacion?: DatosAmortizacion;
  archivoUrl?: string;
  estado?: "activo" | "cumplido" | "incumplido" | "cancelado";
}

export default function AcuerdoPagoPage() {
  const [clienteDatos, setClienteDatos] = useState<any>(null);
  const [deudorDatos, setDeudorDatos] = useState<any>(null);
  const { clienteId, deudorId } = useParams();
  const { can, loading: aclLoading } = useAcl();
  const canEdit = can(PERMS.Deudores_Edit);
  const printRef = useRef<HTMLDivElement>(null);

  const [deudorNombre, setDeudorNombre] = useState<string>("Cargando...");
  const [clienteNombre, setClienteNombre] = useState<string>("Cargando...");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"datos" | "vista">("datos");
  const [dialogAmortizacionOpen, setDialogAmortizacionOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [motivoCambio, setMotivoCambio] = useState("");

  // Estados para cambio de estado del acuerdo
  const [cambiarEstadoOpen, setCambiarEstadoOpen] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<"activo" | "cumplido" | "incumplido" | "cancelado">("activo");
  const [motivoEstado, setMotivoEstado] = useState("");
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const [form, setForm] = useState<FormAcuerdoPago>({
    numeroAcuerdo: "",
    fechaAcuerdo: new Date(),
    montoTotal: 0,
    montoCuota: 0,
    numeroCuotas: 0,
    fechaPrimeraCuota: new Date(),
    periodicidad: "Mensual",
    detalles: "",
    observaciones: "",
    cuotas: [],
    tablaAmortizacion: undefined,
    archivoUrl: "",
    estado: "activo",
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Acuerdo_Pago_${form.numeroAcuerdo || "SN"}`,
  });

  useEffect(() => {
    loadData();
  }, [clienteId, deudorId]);

  // Generar cuotas automáticamente cuando cambien los valores
  useEffect(() => {
    if (form.numeroCuotas && form.montoCuota && form.fechaPrimeraCuota) {
      generarCuotas();
    }
  }, [form.numeroCuotas, form.montoCuota, form.fechaPrimeraCuota, form.periodicidad]);

  const loadData = async () => {
    if (!clienteId || !deudorId) return;

    try {
      setLoading(true);

      // Cargar deudor
      const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
      const deudorSnap = await getDoc(deudorRef);

      if (!deudorSnap.exists()) {
        toast.error("⚠️ Deudor no encontrado");
        return;
      }

      const deudorData = deudorSnap.data();
      setDeudorDatos(deudorData);
      setDeudorNombre(deudorData?.nombre || "Sin nombre");

      // Cargar cliente
      const clienteRef = doc(db, `clientes/${clienteId}`);
      const clienteSnap = await getDoc(clienteRef);
      if (clienteSnap.exists()) {
        const clienteData = clienteSnap.data();
        setClienteDatos(clienteData);
        setClienteNombre(clienteData?.nombre || "Cliente");
      }

      // Cargar acuerdo de pago si existe (modelo nuevo)
      const acuerdo = deudorData?.acuerdoPago as any;
      if (acuerdo) {
        setForm({
          numeroAcuerdo: acuerdo.numero || "",
          fechaAcuerdo: acuerdo.fechaCreacion ? toDate(acuerdo.fechaCreacion) : new Date(),
          montoTotal: acuerdo.valorTotal || 0,
          montoCuota: acuerdo.cuotas?.[0]?.valor || 0,
          numeroCuotas: acuerdo.cuotas?.length || 0,
          fechaPrimeraCuota: acuerdo.cuotas?.[0]?.fechaPago 
            ? toDate(acuerdo.cuotas[0].fechaPago) 
            : new Date(),
          periodicidad: "Mensual",
          detalles: acuerdo.descripcion || "",
          observaciones: "",
          cuotas: acuerdo.cuotas?.map((c: any) => ({
            numero: c.numero,
            fechaVencimiento: toDate(c.fechaPago),
            montoCuota: c.valor,
            pagada: c.pagado || false,
          })) || [],
          archivoUrl: acuerdo.archivoUrl || "",
          estado: acuerdo.estado || "activo",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error("⚠️ Error al cargar la información");
    } finally {
      setLoading(false);
    }
  };

  const toDate = (value: any): Date => {
    if (typeof value?.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    return new Date(value);
  };

  const generarCuotas = () => {
    if (!form.numeroCuotas || !form.montoCuota || !form.fechaPrimeraCuota) return;

    const cuotas: Cuota[] = [];
    let fechaActual = new Date(form.fechaPrimeraCuota);

    for (let i = 0; i < form.numeroCuotas; i++) {
      cuotas.push({
        numero: i + 1,
        fechaVencimiento: new Date(fechaActual),
        montoCuota: form.montoCuota,
        pagada: false,
      });

      // Calcular siguiente fecha según periodicidad
      if (form.periodicidad === "Semanal") {
        fechaActual.setDate(fechaActual.getDate() + 7);
      } else if (form.periodicidad === "Quincenal") {
        fechaActual.setDate(fechaActual.getDate() + 15);
      } else {
        // Mensual
        fechaActual.setMonth(fechaActual.getMonth() + 1);
      }
    }

    setForm((prev) => ({ ...prev, cuotas }));
  };

  const handleGuardarAmortizacion = async (datos: DatosAmortizacion) => {
    // Guardar la tabla de amortización en el estado del formulario
    setForm((prev) => ({
      ...prev,
      tablaAmortizacion: datos,
      montoTotal: datos.valorTotal * (1 + datos.tasaInteres / 100), // Total con intereses
      numeroCuotas: datos.numeroCuotas,
      fechaPrimeraCuota: datos.fechaInicial,
      periodicidad:
        datos.periodicidad === "mensual"
          ? "Mensual"
          : datos.periodicidad === "quincenal"
          ? "Quincenal"
          : "Semanal",
      // Mapear las cuotas de la tabla de amortización
      cuotas: datos.cuotas.map(c => ({
        numero: c.numero,
        fechaVencimiento: c.fechaPago,
        montoCuota: c.cuota,
        pagada: false,
      })),
    }));

    toast.success("Tabla de amortización aplicada al acuerdo");
    setDialogAmortizacionOpen(false);
  };

  const handleSave = async () => {
    if (!clienteId || !deudorId || !canEdit) return;

    // Validaciones
    if (!form.numeroAcuerdo) {
      toast.error("El número de acuerdo es obligatorio");
      return;
    }

    if (!form.montoTotal || form.montoTotal <= 0) {
      toast.error("El monto total debe ser mayor a 0");
      return;
    }

    // Validar que no sea incumplido o cancelado
    if (form.estado === "incumplido" || form.estado === "cancelado") {
      toast.error("No se puede editar un acuerdo incumplido o cancelado");
      return;
    }

    try {
      setSaving(true);
      const auth = getAuth();
      const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);

      // Construir el objeto acuerdo según el modelo
      const acuerdoData: AcuerdoPago = {
        numero: form.numeroAcuerdo,
        fechaCreacion: form.fechaAcuerdo ? Timestamp.fromDate(form.fechaAcuerdo) : Timestamp.now(),
        descripcion: form.detalles || form.observaciones || "",
        valorTotal: form.montoTotal,
        porcentajeHonorarios: form.tablaAmortizacion?.tasaInteres,
        cuotas: (form.cuotas || []).map(c => ({
          numero: c.numero,
          fechaPago: Timestamp.fromDate(c.fechaVencimiento),
          valor: c.montoCuota,
          pagado: c.pagada || false,
          observacion: ""
        })),
        archivoUrl: form.archivoUrl,
      };

      // Guardar en historial
      await guardarAcuerdoEnHistorial(
        clienteId,
        deudorId,
        acuerdoData,
        motivoCambio || "Actualización de acuerdo",
        auth.currentUser?.uid
      );

      // Actualizar el acuerdo actual
      await updateDoc(deudorRef, {
        acuerdoPago: {
          ...acuerdoData,
          estado: form.estado || "activo",
        },
        fechaActualizacion: serverTimestamp(),
      });

      setMotivoCambio("");
      toast.success("✓ Acuerdo de pago guardado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("⚠️ Error al guardar el acuerdo de pago");
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarEstado = async () => {
    if (!clienteId || !deudorId) return;
    
    if (!motivoEstado.trim()) {
      toast.error("Por favor, ingresa un motivo para el cambio de estado");
      return;
    }

    try {
      setCambiandoEstado(true);
      const auth = getAuth();
      
      await cambiarEstadoAcuerdo(
        clienteId,
        deudorId,
        nuevoEstado,
        motivoEstado,
        auth.currentUser?.uid
      );

      // Actualizar el estado local
      setForm(prev => ({ ...prev, estado: nuevoEstado }));
      
      setCambiarEstadoOpen(false);
      setMotivoEstado("");
      toast.success(`✓ Estado del acuerdo cambiado a: ${nuevoEstado}`);
      
      // Recargar datos
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error("⚠️ Error al cambiar el estado del acuerdo");
    } finally {
      setCambiandoEstado(false);
    }
  };

  const getEstadoBadge = (estado?: string) => {
    const estilos = {
      activo: {
        className: "bg-green-100 text-green-700 border-green-200",
        icon: CheckCircle,
        label: "Activo"
      },
      cumplido: {
        className: "bg-blue-100 text-blue-700 border-blue-200",
        icon: CheckCircle,
        label: "Cumplido"
      },
      incumplido: {
        className: "bg-red-100 text-red-700 border-red-200",
        icon: XCircle,
        label: "Incumplido"
      },
      cancelado: {
        className: "bg-gray-100 text-gray-700 border-gray-200",
        icon: Ban,
        label: "Cancelado"
      },
    };

    const config = estilos[estado as keyof typeof estilos] || estilos.activo;
    const Icon = config.icon;

    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        config.className
      )}>
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </span>
    );
  };

  const handleChange = (field: keyof FormAcuerdoPago, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleExportWord = async () => {
    if (!form.numeroAcuerdo || !form.montoTotal) {
      toast.error("Completa los datos del acuerdo antes de exportar");
      return;
    }

    if (!clienteDatos || !deudorDatos) {
      toast.error("Faltan datos del cliente o deudor");
      return;
    }

    try {
      const cliente = {
        nombre: clienteDatos?.nombre || clienteNombre || "CLIENTE SIN NOMBRE",
        nit: clienteDatos?.nit || "",
        direccion: clienteDatos?.direccion || "",
        banco: clienteDatos?.banco || "CAJA SOCIAL",
        numeroCuenta: clienteDatos?.numeroCuenta || "",
        numeroConvenio: clienteDatos?.numeroConvenio || "",
        email: clienteDatos?.email || "carterazona1@gestionglobalacg.com",
        whatsapp: clienteDatos?.whatsapp || "3123152594",
      };

      const deudor = {
        nombre: deudorDatos?.nombre || deudorDatos?.nombreResponsable || deudorNombre || "DEUDOR SIN NOMBRE",
        cedula: deudorDatos?.cedula || deudorDatos?.cedulaResponsable || "",
        direccion: deudorDatos?.direccion || "",
        email: deudorDatos?.email || deudorDatos?.correos?.[0] || "",
        telefono: deudorDatos?.telefono || deudorDatos?.telefonos?.[0] || "",
        inmueble: deudorDatos?.torre && deudorDatos?.apartamento
          ? `TORRE ${deudorDatos.torre} APARTAMENTO ${deudorDatos.apartamento}`
          : deudorDatos?.apartamento
            ? `APARTAMENTO ${deudorDatos.apartamento}`
            : deudorDatos?.casa
              ? `CASA ${deudorDatos.casa}`
              : "",
      };

      await exportarAcuerdoWord(form, cliente, deudor, numeroALetras);
      toast.success("✓ Acuerdo exportado exitosamente");
    } catch (error) {
      console.error("Error al exportar:", error);
      toast.error("⚠️ Error al exportar el acuerdo");
    }
  };

  if (aclLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-4" />
          <Typography variant="body" className="text-muted">
            Cargando información...
          </Typography>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Typography variant="h2" className="text-brand-secondary mb-2">
            Acceso denegado
          </Typography>
          <Typography variant="body" className="text-muted">
            No tienes permisos para editar acuerdos de pago.
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Overlay guardando */}
        {saving && (
          <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="rounded-xl bg-white shadow-lg px-6 py-5 flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
              <Typography variant="body" className="font-medium">
                Guardando acuerdo...
              </Typography>
            </div>
          </div>
        )}

        {/* Back Button */}
        <BackButton />

        {/* Header */}
        <header className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <Typography variant="h1" className="!text-brand-primary font-bold">
                    Acuerdo de Pago
                  </Typography>
                  {getEstadoBadge(form.estado)}
                </div>
                <Typography variant="body" className="text-muted-foreground">
                  {deudorNombre} - {clienteNombre}
                </Typography>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {/* Menú de acciones de estado */}
              {form.numeroAcuerdo && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <MoreVertical className="h-4 w-4" />
                      Estado
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() => {
                        setNuevoEstado("activo");
                        setCambiarEstadoOpen(true);
                      }}
                      disabled={form.estado === "activo"}
                      className="gap-2"
                    >
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Marcar como Activo</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setNuevoEstado("cumplido");
                        setCambiarEstadoOpen(true);
                      }}
                      disabled={form.estado === "cumplido"}
                      className="gap-2"
                    >
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <span>Marcar como Cumplido</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setNuevoEstado("incumplido");
                        setCambiarEstadoOpen(true);
                      }}
                      disabled={form.estado === "incumplido"}
                      className="gap-2 text-red-600"
                    >
                      <XCircle className="h-4 w-4" />
                      <span>Marcar como Incumplido</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setNuevoEstado("cancelado");
                        setCambiarEstadoOpen(true);
                      }}
                      disabled={form.estado === "cancelado"}
                      className="gap-2 text-gray-600"
                    >
                      <Ban className="h-4 w-4" />
                      <span>Marcar como Cancelado</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Botón tabla de amortización */}
              <Dialog open={dialogAmortizacionOpen} onOpenChange={setDialogAmortizacionOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Calculator className="h-4 w-4" />
                    Tabla de amortización
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
                      <Calculator className="h-5 w-5" />
                      Tabla de amortización
                    </DialogTitle>
                  </DialogHeader>
                  <TablaAmortizacion
                    clienteId={clienteId}
                    deudorId={deudorId}
                    onGuardar={handleGuardarAmortizacion}
                    datosIniciales={form.tablaAmortizacion}
                  />
                </DialogContent>
              </Dialog>

              {/* Botón historial */}
              <Button
                variant="outline"
                onClick={() => setHistorialOpen(true)}
                className="gap-2"
              >
                <History className="h-4 w-4" />
                Ver historial
              </Button>

              <Button
                variant="outline"
                onClick={handleSave}
                disabled={saving || form.estado === "incumplido" || form.estado === "cancelado"}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Guardar
              </Button>
              <Button
                variant="outline"
                onClick={handleExportWord}
                disabled={!form.numeroAcuerdo || !form.montoTotal}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                Exportar Word
              </Button>
              <Button variant="brand" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </div>
        </header>

        {/* Alerta de estado */}
        {(form.estado === "incumplido" || form.estado === "cancelado") && (
          <div className={cn(
            "rounded-xl border p-4",
            form.estado === "incumplido" 
              ? "bg-red-50 border-red-200" 
              : "bg-gray-50 border-gray-200"
          )}>
            <div className="flex items-start gap-3">
              {form.estado === "incumplido" ? (
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <Ban className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <Typography 
                  variant="body" 
                  className={cn(
                    "font-semibold",
                    form.estado === "incumplido" ? "text-red-700" : "text-gray-700"
                  )}
                >
                  {form.estado === "incumplido" 
                    ? "Este acuerdo ha sido marcado como INCUMPLIDO" 
                    : "Este acuerdo ha sido CANCELADO"}
                </Typography>
                <Typography 
                  variant="small" 
                  className={cn(
                    form.estado === "incumplido" ? "text-red-600" : "text-gray-600"
                  )}
                >
                  No se pueden realizar modificaciones en este acuerdo. 
                  Puedes ver el historial para más detalles o crear un nuevo acuerdo.
                </Typography>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full bg-white border border-brand-secondary/20 p-1 rounded-xl">
            <TabsTrigger
              value="datos"
              className="data-[state=active]:bg-brand-primary data-[state=active]:text-white rounded-lg transition-all"
            >
              <FileText className="h-4 w-4 mr-2" />
              Datos del Acuerdo
            </TabsTrigger>
            <TabsTrigger
              value="vista"
              className="data-[state=active]:bg-brand-primary data-[state=active]:text-white rounded-lg transition-all"
            >
              <Printer className="h-4 w-4 mr-2" />
              Vista Previa
            </TabsTrigger>
          </TabsList>

          {/* TAB DATOS */}
          <TabsContent value="datos" className="mt-6 space-y-6">
            {/* Información básica */}
            <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  Información básica
                </Typography>
              </div>

              <div className="p-4 md:p-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Número de acuerdo *
                    </Label>
                    <Input
                      value={form.numeroAcuerdo || ""}
                      onChange={(e) => handleChange("numeroAcuerdo", e.target.value)}
                      placeholder="Ej: ACU-2025-001"
                      className="border-brand-secondary/30"
                      disabled={form.estado === "incumplido" || form.estado === "cancelado"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Fecha del acuerdo
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start border-brand-secondary/30",
                            !form.fechaAcuerdo && "text-muted-foreground"
                          )}
                          disabled={form.estado === "incumplido" || form.estado === "cancelado"}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.fechaAcuerdo
                            ? form.fechaAcuerdo.toLocaleDateString("es-CO")
                            : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.fechaAcuerdo}
                          onSelect={(date) => handleChange("fechaAcuerdo", date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Monto total *
                    </Label>
                    <Input
                      type="number"
                      value={form.montoTotal || ""}
                      onChange={(e) => handleChange("montoTotal", Number(e.target.value))}
                      placeholder="0.00"
                      className="border-brand-secondary/30"
                      disabled={form.estado === "incumplido" || form.estado === "cancelado"}
                    />
                    <Typography variant="small" className="text-muted-foreground">
                      {form.montoTotal ? numeroALetras(form.montoTotal) : ""}
                    </Typography>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Monto por cuota
                    </Label>
                    <Input
                      type="number"
                      value={form.montoCuota || ""}
                      onChange={(e) => handleChange("montoCuota", Number(e.target.value))}
                      placeholder="0.00"
                      className="border-brand-secondary/30"
                      disabled={form.estado === "incumplido" || form.estado === "cancelado"}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Número de cuotas
                    </Label>
                    <Input
                      type="number"
                      value={form.numeroCuotas || ""}
                      onChange={(e) => handleChange("numeroCuotas", Number(e.target.value))}
                      placeholder="0"
                      className="border-brand-secondary/30"
                      disabled={form.estado === "incumplido" || form.estado === "cancelado"}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Periodicidad
                    </Label>
                    <select
                      value={form.periodicidad || "Mensual"}
                      onChange={(e) => handleChange("periodicidad", e.target.value)}
                      className="w-full rounded-md border border-brand-secondary/30 px-3 py-2 text-sm focus:border-brand-primary focus:ring-brand-primary/20"
                      disabled={form.estado === "incumplido" || form.estado === "cancelado"}
                    >
                      <option value="Semanal">Semanal</option>
                      <option value="Quincenal">Quincenal</option>
                      <option value="Mensual">Mensual</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      Fecha primera cuota
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start border-brand-secondary/30",
                            !form.fechaPrimeraCuota && "text-muted-foreground"
                          )}
                          disabled={form.estado === "incumplido" || form.estado === "cancelado"}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.fechaPrimeraCuota
                            ? form.fechaPrimeraCuota.toLocaleDateString("es-CO")
                            : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.fechaPrimeraCuota}
                          onSelect={(date) => handleChange("fechaPrimeraCuota", date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Indicador si hay tabla de amortización */}
                {form.tablaAmortizacion && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-green-600" />
                      <div>
                        <Typography variant="body" className="text-green-700 font-medium">
                          Tabla de amortización aplicada
                        </Typography>
                        <Typography variant="small" className="text-green-600">
                          {form.tablaAmortizacion.numeroCuotas} cuotas • Tasa: {form.tablaAmortizacion.tasaInteres}% •{" "}
                          Periodicidad: {form.tablaAmortizacion.periodicidad}
                        </Typography>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Tabla de cuotas */}
            {form.cuotas && form.cuotas.length > 0 && (
              <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                  <Typography variant="h3" className="!text-brand-secondary font-semibold">
                    Cronograma de cuotas ({form.cuotas.length})
                  </Typography>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                      <TableRow className="border-brand-secondary/10">
                        <TableHead className="text-brand-secondary font-semibold">#</TableHead>
                        <TableHead className="text-brand-secondary font-semibold">
                          Fecha vencimiento
                        </TableHead>
                        <TableHead className="text-right text-brand-secondary font-semibold">
                          Monto
                        </TableHead>
                        <TableHead className="text-center text-brand-secondary font-semibold">
                          Estado
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.cuotas.map((cuota, index) => (
                        <TableRow
                          key={index}
                          className={cn(
                            "border-brand-secondary/5",
                            index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]"
                          )}
                        >
                          <TableCell className="font-medium">{cuota.numero}</TableCell>
                          <TableCell>
                            {new Date(cuota.fechaVencimiento).toLocaleDateString("es-CO")}
                          </TableCell>
                          <TableCell className="text-right">
                            ${cuota.montoCuota.toLocaleString("es-CO")}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                cuota.pagada
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : "bg-gray-100 text-gray-700 border-gray-200"
                              )}
                            >
                              {cuota.pagada ? "Pagada" : "Pendiente"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            )}

            {/* Observaciones */}
            <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  Notas adicionales
                </Typography>
              </div>

              <div className="p-4 md:p-5 space-y-4">
                <div className="space-y-2">
                  <Label className="text-brand-secondary font-medium">Detalles del acuerdo</Label>
                  <Textarea
                    value={form.detalles || ""}
                    onChange={(e) => handleChange("detalles", e.target.value)}
                    placeholder="Descripción detallada del acuerdo..."
                    className="min-h-32 border-brand-secondary/30"
                    disabled={form.estado === "incumplido" || form.estado === "cancelado"}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-brand-secondary font-medium">Observaciones</Label>
                  <Textarea
                    value={form.observaciones || ""}
                    onChange={(e) => handleChange("observaciones", e.target.value)}
                    placeholder="Observaciones adicionales..."
                    className="min-h-24 border-brand-secondary/30"
                    disabled={form.estado === "incumplido" || form.estado === "cancelado"}
                  />
                </div>

                {form.estado !== "incumplido" && form.estado !== "cancelado" && (
                  <div className="space-y-2">
                    <Label className="text-brand-secondary font-medium">
                      Motivo del cambio (se guardará en el historial)
                    </Label>
                    <Input
                      value={motivoCambio}
                      onChange={(e) => setMotivoCambio(e.target.value)}
                      placeholder="Ej: Ajuste de cuotas por solicitud del deudor"
                      className="border-brand-secondary/30"
                    />
                    <Typography variant="small" className="text-muted-foreground">
                      Este motivo se guardará en el historial al guardar el acuerdo
                    </Typography>
                  </div>
                )}
              </div>
            </section>
          </TabsContent>

          {/* TAB VISTA PREVIA */}
          <TabsContent value="vista" className="mt-6">
            <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
              <div ref={printRef} className="p-8 md:p-12 print:p-8">
                {/* Encabezado del documento */}
                <div className="text-center mb-8">
                  <Typography variant="h1" className="!text-2xl font-bold text-brand-primary mb-2">
                    ACUERDO DE PAGO
                  </Typography>
                  <Typography variant="body" className="text-muted-foreground">
                    No. {form.numeroAcuerdo || "___________"}
                  </Typography>
                </div>

                {/* Información de las partes */}
                <div className="space-y-6 mb-8">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Typography variant="h3" className="!text-brand-secondary font-semibold text-sm">
                        ACREEDOR
                      </Typography>
                      <div className="p-4 rounded-lg bg-brand-primary/5 border border-brand-primary/10">
                        <Typography variant="body" className="font-medium">
                          {clienteNombre}
                        </Typography>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Typography variant="h3" className="!text-brand-secondary font-semibold text-sm">
                        DEUDOR
                      </Typography>
                      <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                        <Typography variant="body" className="font-medium">
                          {deudorNombre}
                        </Typography>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <Typography variant="small" className="text-muted-foreground">
                        Fecha del acuerdo
                      </Typography>
                      <Typography variant="body" className="font-medium">
                        {form.fechaAcuerdo?.toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </Typography>
                    </div>

                    {form.tablaAmortizacion ? (
                      <>
                        <div className="space-y-1">
                          <Typography variant="small" className="text-muted-foreground">
                            Capital inicial
                          </Typography>
                          <Typography variant="body" className="font-bold text-blue-600">
                            ${form.tablaAmortizacion.valorTotal.toLocaleString("es-CO")}
                          </Typography>
                        </div>

                        <div className="space-y-1">
                          <Typography variant="small" className="text-muted-foreground">
                            Honorarios ({form.tablaAmortizacion.tasaInteres}%)
                          </Typography>
                          <Typography variant="body" className="font-bold text-orange-600">
                            ${(form.tablaAmortizacion.valorTotal * (form.tablaAmortizacion.tasaInteres / 100)).toLocaleString("es-CO")}
                          </Typography>
                        </div>

                        <div className="space-y-1 md:col-span-3">
                          <Typography variant="small" className="text-muted-foreground">
                            Total del acuerdo
                          </Typography>
                          <Typography variant="h3" className="!text-green-600 font-bold">
                            ${(form.tablaAmortizacion.valorTotal * (1 + form.tablaAmortizacion.tasaInteres / 100)).toLocaleString("es-CO")}
                          </Typography>
                          <Typography variant="small" className="text-muted-foreground italic">
                            ({form.tablaAmortizacion.valorTotal 
                              ? numeroALetras(form.tablaAmortizacion.valorTotal * (1 + form.tablaAmortizacion.tasaInteres / 100)) 
                              : ""})
                          </Typography>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1 md:col-span-2">
                        <Typography variant="small" className="text-muted-foreground">
                          Monto total adeudado
                        </Typography>
                        <Typography variant="h3" className="!text-brand-primary font-bold">
                          ${form.montoTotal?.toLocaleString("es-CO")}
                        </Typography>
                        <Typography variant="small" className="text-muted-foreground italic">
                          ({form.montoTotal ? numeroALetras(form.montoTotal) : ""})
                        </Typography>
                      </div>
                    )}
                  </div>
                </div>

                {/* Términos del acuerdo */}
                <div className="space-y-6 mb-8">
                  <Typography variant="h3" className="!text-brand-secondary font-semibold border-b border-brand-secondary/20 pb-2">
                    TÉRMINOS DEL ACUERDO
                  </Typography>

                  <div className="space-y-4 text-justify">
                    {form.tablaAmortizacion ? (
                      <>
                        <Typography variant="body">
                          <strong className="text-brand-secondary">PRIMERA:</strong> El deudor reconoce una deuda por concepto de capital de{" "}
                          <strong>${form.tablaAmortizacion.valorTotal.toLocaleString("es-CO")}</strong> (
                          {numeroALetras(form.tablaAmortizacion.valorTotal)}), más honorarios del{" "}
                          <strong>{form.tablaAmortizacion.tasaInteres}%</strong> equivalentes a{" "}
                          <strong>${(form.tablaAmortizacion.valorTotal * (form.tablaAmortizacion.tasaInteres / 100)).toLocaleString("es-CO")}</strong>, 
                          para un total de{" "}
                          <strong>${(form.tablaAmortizacion.valorTotal * (1 + form.tablaAmortizacion.tasaInteres / 100)).toLocaleString("es-CO")}</strong> (
                          {numeroALetras(form.tablaAmortizacion.valorTotal * (1 + form.tablaAmortizacion.tasaInteres / 100))}).
                        </Typography>

                        <Typography variant="body">
                          <strong className="text-brand-secondary">SEGUNDA:</strong> El deudor se compromete a cancelar esta obligación en{" "}
                          <strong>{form.tablaAmortizacion.numeroCuotas}</strong> cuotas {form.tablaAmortizacion.periodicidad}es de{" "}
                          <strong>
                            ${((form.tablaAmortizacion.valorTotal * (1 + form.tablaAmortizacion.tasaInteres / 100)) / form.tablaAmortizacion.numeroCuotas).toLocaleString("es-CO")}
                          </strong> cada una.
                        </Typography>

                        <Typography variant="body">
                          <strong className="text-brand-secondary">TERCERA:</strong> La primera cuota vencerá el día{" "}
                          <strong>
                            {form.tablaAmortizacion.fechaInicial.toLocaleDateString("es-CO", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </strong>
                          , y las siguientes cuotas vencerán de manera {form.tablaAmortizacion.periodicidad} según el cronograma establecido.
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Typography variant="body">
                          <strong className="text-brand-secondary">PRIMERA:</strong> El deudor se compromete a pagar la suma total de{" "}
                          <strong>${form.montoTotal?.toLocaleString("es-CO")}</strong> ({form.montoTotal ? numeroALetras(form.montoTotal) : ""}), en{" "}
                          <strong>{form.numeroCuotas}</strong> cuotas {form.periodicidad?.toLowerCase()}s de{" "}
                          <strong>${form.montoCuota?.toLocaleString("es-CO")}</strong> cada una.
                        </Typography>

                        <Typography variant="body">
                          <strong className="text-brand-secondary">SEGUNDA:</strong> La primera cuota vencerá el día{" "}
                          <strong>
                            {form.fechaPrimeraCuota?.toLocaleDateString("es-CO", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </strong>
                          , y las siguientes cuotas vencerán de manera {form.periodicidad?.toLowerCase()} según el cronograma establecido.
                        </Typography>
                      </>
                    )}

                    {form.detalles && (
                      <Typography variant="body">
                        <strong className="text-brand-secondary">{form.tablaAmortizacion ? "CUARTA" : "TERCERA"}:</strong> {form.detalles}
                      </Typography>
                    )}

                    <Typography variant="body">
                      <strong className="text-brand-secondary">{form.tablaAmortizacion ? (form.detalles ? "QUINTA" : "CUARTA") : (form.detalles ? "CUARTA" : "TERCERA")}:</strong> El incumplimiento de cualquiera de las cuotas establecidas dará lugar a la terminación del presente acuerdo y se procederá con las acciones legales correspondientes.
                    </Typography>
                  </div>
                </div>

                {/* Cronograma de pagos - Usar tabla de amortización si existe */}
                {form.tablaAmortizacion && form.tablaAmortizacion.cuotas.length > 0 ? (
                  <div className="mb-8">
                    <Typography variant="h3" className="!text-brand-secondary font-semibold border-b border-brand-secondary/20 pb-2 mb-4">
                      CRONOGRAMA DE PAGOS (TABLA DE AMORTIZACIÓN)
                    </Typography>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-brand-primary/10 border-b-2 border-brand-primary/20">
                            <th className="text-center p-2 font-semibold text-brand-secondary border-r">#</th>
                            <th className="text-center p-2 font-semibold text-brand-secondary border-r">Fecha</th>
                            <th className="text-right p-2 font-semibold text-brand-secondary border-r">Saldo Inicial</th>
                            <th className="text-right p-2 font-semibold text-brand-secondary border-r">Cuota</th>
                            <th className="text-right p-2 font-semibold text-brand-secondary border-r">Honorarios</th>
                            <th className="text-right p-2 font-semibold text-brand-secondary border-r">Capital</th>
                            <th className="text-right p-2 font-semibold text-brand-secondary">Saldo Final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.tablaAmortizacion.cuotas.map((cuota, index) => (
                            <tr
                              key={index}
                              className={cn(
                                "border-b",
                                index % 2 === 0 ? "bg-white" : "bg-gray-50"
                              )}
                            >
                              <td className="p-2 text-center border-r">{cuota.numero}</td>
                              <td className="p-2 text-center border-r">
                                {new Date(cuota.fechaPago).toLocaleDateString("es-CO", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="p-2 text-right border-r">
                                ${Math.round(cuota.saldoInicial).toLocaleString("es-CO")}
                              </td>
                              <td className="p-2 text-right font-medium border-r text-brand-primary">
                                ${Math.round(cuota.cuota).toLocaleString("es-CO")}
                              </td>
                              <td className="p-2 text-right border-r text-orange-600">
                                ${Math.round(cuota.interes).toLocaleString("es-CO")}
                              </td>
                              <td className="p-2 text-right border-r text-green-600">
                                ${Math.round(cuota.capital).toLocaleString("es-CO")}
                              </td>
                              <td className="p-2 text-right">
                                ${Math.round(cuota.saldoFinal).toLocaleString("es-CO")}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-brand-primary/10 border-t-2 border-brand-primary/20 font-bold">
                            <td colSpan={3} className="p-2 text-right border-r text-brand-secondary">
                              TOTALES
                            </td>
                            <td className="p-2 text-right border-r text-brand-secondary">
                              ${Math.round(form.tablaAmortizacion.cuotas.reduce((sum, c) => sum + c.cuota, 0)).toLocaleString("es-CO")}
                            </td>
                            <td className="p-2 text-right border-r text-brand-secondary">
                              ${Math.round(form.tablaAmortizacion.cuotas.reduce((sum, c) => sum + c.interes, 0)).toLocaleString("es-CO")}
                            </td>
                            <td className="p-2 text-right border-r text-brand-secondary">
                              ${Math.round(form.tablaAmortizacion.cuotas.reduce((sum, c) => sum + c.capital, 0)).toLocaleString("es-CO")}
                            </td>
                            <td className="p-2 text-right text-brand-secondary">$ 0</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : form.cuotas && form.cuotas.length > 0 ? (
                  <div className="mb-8">
                    <Typography variant="h3" className="!text-brand-secondary font-semibold border-b border-brand-secondary/20 pb-2 mb-4">
                      CRONOGRAMA DE PAGOS
                    </Typography>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-brand-primary/10 border-b-2 border-brand-primary/20">
                            <th className="text-left p-3 font-semibold text-brand-secondary">Cuota</th>
                            <th className="text-left p-3 font-semibold text-brand-secondary">Fecha de vencimiento</th>
                            <th className="text-right p-3 font-semibold text-brand-secondary">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.cuotas.map((cuota, index) => (
                            <tr
                              key={index}
                              className={cn(
                                "border-b",
                                index % 2 === 0 ? "bg-white" : "bg-gray-50"
                              )}
                            >
                              <td className="p-3">{cuota.numero}</td>
                              <td className="p-3">
                                {new Date(cuota.fechaVencimiento).toLocaleDateString("es-CO", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="p-3 text-right font-medium">
                                ${cuota.montoCuota.toLocaleString("es-CO")}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-brand-primary/10 border-t-2 border-brand-primary/20">
                            <td colSpan={2} className="p-3 font-bold text-brand-secondary">
                              TOTAL
                            </td>
                            <td className="p-3 text-right font-bold text-brand-primary">
                              ${form.montoTotal?.toLocaleString("es-CO")}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {/* Observaciones */}
                {form.observaciones && (
                  <div className="mb-8">
                    <Typography variant="h3" className="!text-brand-secondary font-semibold border-b border-brand-secondary/20 pb-2 mb-4">
                      OBSERVACIONES
                    </Typography>
                    <Typography variant="body" className="text-justify">
                      {form.observaciones}
                    </Typography>
                  </div>
                )}

                {/* Firmas */}
                <div className="grid md:grid-cols-2 gap-12 mt-16">
                  <div className="space-y-2">
                    <div className="border-t-2 border-gray-400 pt-2">
                      <Typography variant="body" className="font-semibold text-center">
                        {clienteNombre}
                      </Typography>
                      <Typography variant="small" className="text-center text-muted-foreground">
                        ACREEDOR
                      </Typography>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="border-t-2 border-gray-400 pt-2">
                      <Typography variant="body" className="font-semibold text-center">
                        {deudorNombre}
                      </Typography>
                      <Typography variant="small" className="text-center text-muted-foreground">
                        DEUDOR
                      </Typography>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center">
                  <Typography variant="small" className="text-muted-foreground">
                    Documento generado el{" "}
                    {new Date().toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </Typography>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialog para cambiar estado */}
        <AlertDialog open={cambiarEstadoOpen} onOpenChange={setCambiarEstadoOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Cambiar estado del acuerdo
              </AlertDialogTitle>
              <AlertDialogDescription>
                Estás a punto de cambiar el estado del acuerdo a:{" "}
                <strong className="capitalize">{nuevoEstado}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4 py-4">
              {nuevoEstado === "incumplido" && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <Typography variant="small" className="text-red-700 font-medium">
                        Atención: Acuerdo incumplido
                      </Typography>
                      <Typography variant="small" className="text-red-600">
                        Al marcar este acuerdo como incumplido, no podrás editarlo más. 
                        Asegúrate de que esta acción sea correcta.
                      </Typography>
                    </div>
                  </div>
                </div>
              )}

              {nuevoEstado === "cancelado" && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                  <div className="flex gap-2">
                    <Ban className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <Typography variant="small" className="text-gray-700 font-medium">
                        Cancelación del acuerdo
                      </Typography>
                      <Typography variant="small" className="text-gray-600">
                        El acuerdo será marcado como cancelado y no podrá ser editado.
                      </Typography>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium">
                  Motivo del cambio de estado *
                </Label>
                <Textarea
                  value={motivoEstado}
                  onChange={(e) => setMotivoEstado(e.target.value)}
                  placeholder={
                    nuevoEstado === "incumplido"
                      ? "Ej: El deudor no ha cumplido con las cuotas acordadas..."
                      : nuevoEstado === "cumplido"
                      ? "Ej: Todas las cuotas fueron pagadas exitosamente..."
                      : nuevoEstado === "cancelado"
                      ? "Ej: El acuerdo fue cancelado por mutuo acuerdo..."
                      : "Describe el motivo del cambio..."
                  }
                  className="min-h-24 border-brand-secondary/30"
                />
                <Typography variant="small" className="text-muted-foreground">
                  Este motivo quedará registrado en el historial
                </Typography>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={cambiandoEstado}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCambiarEstado}
                disabled={cambiandoEstado || !motivoEstado.trim()}
                className={cn(
                  nuevoEstado === "incumplido" && "bg-red-600 hover:bg-red-700",
                  nuevoEstado === "cancelado" && "bg-gray-600 hover:bg-gray-700",
                  nuevoEstado === "cumplido" && "bg-blue-600 hover:bg-blue-700",
                  nuevoEstado === "activo" && "bg-green-600 hover:bg-green-700"
                )}
              >
                {cambiandoEstado ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white mr-2" />
                    Cambiando...
                  </>
                ) : (
                  <>Confirmar cambio</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Componente de historial */}
        {clienteId && deudorId && (
          <HistorialAcuerdos
            clienteId={clienteId}
            deudorId={deudorId}
            open={historialOpen}
            onOpenChange={setHistorialOpen}
          />
        )}
      </div>
    </div>
  );
}