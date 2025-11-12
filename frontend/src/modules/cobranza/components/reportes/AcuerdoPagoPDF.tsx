// src/modules/deudores/pages/AcuerdoPagoPage.tsx
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase";
import { useReactToPrint } from "react-to-print";
import {
  FileText,
  Save,
  Calendar as CalendarIcon,
  DollarSign,
  User,
  Hash,
  Clock,
  Printer,
  Plus,
  Trash2,
  Download,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Typography } from "@/shared/design-system/components/Typography";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";

import { cn } from "@/shared/lib/cn";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import numeroALetras from "@/shared/numeroALetras";
import { BackButton } from "@/shared/design-system/components/BackButton";

interface Cuota {
  numero: number;
  fechaVencimiento: Date;
  montoCuota: number;
  pagada: boolean;
}

interface AcuerdoPago {
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
  fechaCreacion?: any;
  fechaActualizacion?: any;
}

export default function AcuerdoPagoPage() {
  const { clienteId, deudorId } = useParams();
  const { can, loading: aclLoading } = useAcl();
  const canEdit = can(PERMS.Deudores_Edit);
  const printRef = useRef<HTMLDivElement>(null);

  const [deudorNombre, setDeudorNombre] = useState<string>("Cargando...");
  const [clienteNombre, setClienteNombre] = useState<string>("Cargando...");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"datos" | "vista">("datos");

  const [form, setForm] = useState<AcuerdoPago>({
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
      setDeudorNombre(deudorData?.nombre || "Sin nombre");

      // Cargar cliente
      const clienteRef = doc(db, `clientes/${clienteId}`);
      const clienteSnap = await getDoc(clienteRef);
      if (clienteSnap.exists()) {
        const clienteData = clienteSnap.data();
        setClienteNombre(clienteData?.nombre || "Cliente");
      }

      // Cargar acuerdo de pago si existe
      const acuerdo = deudorData?.acuerdoPago as AcuerdoPago | undefined;
      if (acuerdo) {
        setForm({
          numeroAcuerdo: acuerdo.numeroAcuerdo || "",
          fechaAcuerdo: acuerdo.fechaAcuerdo
            ? toDate(acuerdo.fechaAcuerdo)
            : new Date(),
          montoTotal: acuerdo.montoTotal || 0,
          montoCuota: acuerdo.montoCuota || 0,
          numeroCuotas: acuerdo.numeroCuotas || 0,
          fechaPrimeraCuota: acuerdo.fechaPrimeraCuota
            ? toDate(acuerdo.fechaPrimeraCuota)
            : new Date(),
          periodicidad: acuerdo.periodicidad || "Mensual",
          detalles: acuerdo.detalles || "",
          observaciones: acuerdo.observaciones || "",
          cuotas: acuerdo.cuotas || [],
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

    try {
      setSaving(true);
      const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);

      const acuerdoData = {
        numeroAcuerdo: form.numeroAcuerdo,
        fechaAcuerdo: form.fechaAcuerdo,
        montoTotal: form.montoTotal,
        montoCuota: form.montoCuota,
        numeroCuotas: form.numeroCuotas,
        fechaPrimeraCuota: form.fechaPrimeraCuota,
        periodicidad: form.periodicidad,
        detalles: form.detalles,
        observaciones: form.observaciones,
        cuotas: form.cuotas,
        fechaActualizacion: serverTimestamp(),
      };

      const deudorSnap = await getDoc(deudorRef);
      const currentAcuerdo = deudorSnap.data()?.acuerdoPago;
      if (!currentAcuerdo?.fechaCreacion) {
        (acuerdoData as any).fechaCreacion = serverTimestamp();
      }

      await updateDoc(deudorRef, {
        acuerdoPago: acuerdoData,
      });

      toast.success("✓ Acuerdo de pago guardado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("⚠️ Error al guardar el acuerdo de pago");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof AcuerdoPago, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                <FileText className="h-7 w-7 text-white" />
              </div>
              <div>
                <Typography variant="h1" className="!text-brand-primary font-bold">
                  Acuerdo de Pago
                </Typography>
                <Typography variant="body" className="text-muted-foreground">
                  {deudorNombre} - {clienteNombre}
                </Typography>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={saving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Guardar
              </Button>
              <Button
                variant="brand"
                onClick={handlePrint}
                className="gap-2"
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </div>
        </header>

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
                        <TableHead className="text-brand-secondary font-semibold">Fecha vencimiento</TableHead>
                        <TableHead className="text-right text-brand-secondary font-semibold">Monto</TableHead>
                        <TableHead className="text-center text-brand-secondary font-semibold">Estado</TableHead>
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
                            <span className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              cuota.pagada
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-gray-100 text-gray-700 border-gray-200"
                            )}>
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
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-brand-secondary font-medium">Observaciones</Label>
                  <Textarea
                    value={form.observaciones || ""}
                    onChange={(e) => handleChange("observaciones", e.target.value)}
                    placeholder="Observaciones adicionales..."
                    className="min-h-24 border-brand-secondary/30"
                  />
                </div>
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

                  <div className="grid md:grid-cols-2 gap-6">
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

                    <div className="space-y-1">
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
                  </div>
                </div>

                {/* Términos del acuerdo */}
                <div className="space-y-6 mb-8">
                  <Typography variant="h3" className="!text-brand-secondary font-semibold border-b border-brand-secondary/20 pb-2">
                    TÉRMINOS DEL ACUERDO
                  </Typography>

                  <div className="space-y-4 text-justify">
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

                    {form.detalles && (
                      <Typography variant="body">
                        <strong className="text-brand-secondary">TERCERA:</strong> {form.detalles}
                      </Typography>
                    )}

                    <Typography variant="body">
                      <strong className="text-brand-secondary">CUARTA:</strong> El incumplimiento de cualquiera de las cuotas establecidas dará lugar a la terminación del presente acuerdo y se procederá con las acciones legales correspondientes.
                    </Typography>
                  </div>
                </div>

                {/* Cronograma de pagos */}
                {form.cuotas && form.cuotas.length > 0 && (
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
                            <tr key={index} className={cn(
                              "border-b",
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            )}>
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
                            <td colSpan={2} className="p-3 font-bold text-brand-secondary">TOTAL</td>
                            <td className="p-3 text-right font-bold text-brand-primary">
                              ${form.montoTotal?.toLocaleString("es-CO")}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

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
                    Documento generado el {new Date().toLocaleDateString("es-CO", {
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
      </div>
    </div>
  );
}