import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";
import { useReactToPrint } from "react-to-print";
import {
    FileText,
    Save,
    Calendar as CalendarIcon,
    DollarSign,
    Hash,
    Calculator,
    Printer,
    FileDown,
    History,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { getAuth } from "firebase/auth";

import numeroALetras from "@/shared/numeroALetras";

import type { AcuerdoPago, CuotaAcuerdo } from "@/modules/cobranza/models/acuerdoPago.model";
import { generarTablaAcuerdo } from "@/modules/cobranza/lib/generarTablaAcuerdo";
import TablaAmortizacionEditable from "@/modules/cobranza/components/TablaAmortizacionEditable";

import {
    obtenerAcuerdoActual,
    obtenerCuotas,
    guardarBorrador,
} from "@/modules/cobranza/services/acuerdoPagoService";

import { ACUERDO_ESTADO } from "@/shared/constants/acuerdoEstado";

type FormBase = {
    numero: string;
    fechaAcuerdo: Date;

    capitalInicial: number;
    porcentajeHonorarios: number;

    fechaPrimeraCuota: Date;
    valorCuotaBase: number;

    detalles: string;
};

function toDateSafe(v: any): Date {
    if (!v) return new Date();
    if (v instanceof Date) return v;
    if (v?.toDate) return v.toDate();
    return new Date(v);
}

export default function AcuerdoPagoPage() {
    const { clienteId, deudorId } = useParams();
    const { can, loading: aclLoading } = useAcl();
    const canEdit = can(PERMS.Deudores_Edit);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tab, setTab] = useState<"datos" | "vista">("datos");

    const [clienteNombre, setClienteNombre] = useState("Cargando...");
    const [deudorNombre, setDeudorNombre] = useState("Cargando...");

    const [currentAcuerdoId, setCurrentAcuerdoId] = useState<string | null>(null);
    const [acuerdoEstado, setAcuerdoEstado] = useState<string | null>(null); // EN_FIRME/BORRADOR/etc

    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: "Acuerdo_Pago",
    });

    const [form, setForm] = useState<FormBase>({
        numero: "",
        fechaAcuerdo: new Date(),
        capitalInicial: 0,
        porcentajeHonorarios: 15,
        fechaPrimeraCuota: new Date(),
        valorCuotaBase: 0,
        detalles: "",
    });

    const [cuotas, setCuotas] = useState<CuotaAcuerdo[]>([]);
    const [motivoCambio, setMotivoCambio] = useState("");

    const readOnly = acuerdoEstado === ACUERDO_ESTADO.EN_FIRME;

    // ==============================
    // Totales
    // ==============================
    const totales = useMemo(() => {
        const honorariosInicial = Math.round(form.capitalInicial * (form.porcentajeHonorarios / 100));
        const totalAcordado = Math.round(form.capitalInicial + honorariosInicial);

        const sumCuota = Math.round(cuotas.reduce((s, c) => s + (c.valorCuota || 0), 0));
        const sumCap = Math.round(cuotas.reduce((s, c) => s + (c.capitalCuota || 0), 0));
        const sumHon = Math.round(cuotas.reduce((s, c) => s + (c.honorariosCuota || 0), 0));

        return { honorariosInicial, totalAcordado, sumCuota, sumCap, sumHon };
    }, [form.capitalInicial, form.porcentajeHonorarios, cuotas]);

    // ==============================
    // Recalcular saldos (arreglado)
    // - si no pasas base, usa el form actual
    // ==============================
    const recalcularSaldos = (
        cuotasEdit: CuotaAcuerdo[],
        base?: { capitalInicial: number; porcentajeHonorarios: number }
    ) => {
        const capitalInicial = Math.round(base?.capitalInicial ?? form.capitalInicial ?? 0);
        const porcentajeHonorarios = Number(base?.porcentajeHonorarios ?? form.porcentajeHonorarios ?? 0);

        let capSaldo = capitalInicial;
        let honSaldo = Math.round(capitalInicial * (porcentajeHonorarios / 100));

        return cuotasEdit.map((c) => {
            const capCuota = Math.round(c.capitalCuota || 0);
            const honCuota = Math.round(c.honorariosCuota || 0);
            const valorCuota = Math.round(c.valorCuota ?? (capCuota + honCuota));

            const next: CuotaAcuerdo = {
                ...c,
                valorCuota,
                capitalSaldoAntes: capSaldo,
                capitalSaldoDespues: capSaldo - capCuota,
                honorariosSaldoAntes: honSaldo,
                honorariosSaldoDespues: honSaldo - honCuota,
            };

            capSaldo -= capCuota;
            honSaldo -= honCuota;

            return next;
        });
    };

    // ==============================
    // Cargar datos base (cliente/deudor)
    // ==============================
    const cargarClienteDeudor = async () => {
        if (!clienteId || !deudorId) return;

        const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
        const deudorSnap = await getDoc(deudorRef);
        if (!deudorSnap.exists()) {
            toast.error("⚠️ Deudor no encontrado");
            throw new Error("Deudor no encontrado");
        }

        const dd = deudorSnap.data() as any;
        setDeudorNombre(dd?.nombre || dd?.nombreResponsable || "Deudor");

        const clienteRef = doc(db, `clientes/${clienteId}`);
        const clienteSnap = await getDoc(clienteRef);
        if (clienteSnap.exists()) {
            const cd = clienteSnap.data() as any;
            setClienteNombre(cd?.nombre || "Cliente");
        }
    };

    // ==============================
    // Cargar acuerdo actual (EN_FIRME > BORRADOR)
    // ==============================
    const cargarAcuerdoActual = async () => {
        if (!clienteId || !deudorId) return;

        const { acuerdo, acuerdoId } = await obtenerAcuerdoActual(clienteId, deudorId);

        if (!acuerdo || !acuerdoId) {
            // nuevo
            setCurrentAcuerdoId(null);
            setAcuerdoEstado(null);
            setCuotas([]);
            setForm((p) => ({
                ...p,
                numero: "",
                detalles: "",
            }));
            return;
        }

        setCurrentAcuerdoId(acuerdoId);
        setAcuerdoEstado(acuerdo.estado);

        setForm({
            numero: acuerdo.numero || "",
            fechaAcuerdo: toDateSafe(acuerdo.fechaAcuerdo),
            capitalInicial: Number(acuerdo.capitalInicial || 0),
            porcentajeHonorarios: Number(acuerdo.porcentajeHonorarios || 15),
            fechaPrimeraCuota: toDateSafe(acuerdo.fechaPrimeraCuota),
            valorCuotaBase: Number(acuerdo.valorCuotaBase || 0),
            detalles: acuerdo.detalles || "",
        });

        const cuotasDb = await obtenerCuotas(clienteId, deudorId, acuerdoId);
        setCuotas(
            recalcularSaldos(cuotasDb, {
                capitalInicial: Number(acuerdo.capitalInicial || 0),
                porcentajeHonorarios: Number(acuerdo.porcentajeHonorarios || 15),
            })
        );
    };

    // ==============================
    // Init
    // ==============================
    useEffect(() => {
        (async () => {
            if (!clienteId || !deudorId) return;

            try {
                setLoading(true);
                await cargarClienteDeudor();
                await cargarAcuerdoActual();
            } catch (e) {
                console.error(e);
                toast.error("⚠️ Error cargando datos");
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clienteId, deudorId]);

    // ==============================
    // Generar tabla
    // ==============================
    const onGenerarTabla = () => {
        if (readOnly) return;

        if (!form.capitalInicial || form.capitalInicial <= 0) return toast.error("Ingresa el capital (deuda) inicial");
        if (!form.valorCuotaBase || form.valorCuotaBase <= 0) return toast.error("Ingresa la cuota base (mensual)");

        const { cuotas: gen } = generarTablaAcuerdo({
            capitalInicial: form.capitalInicial,
            porcentajeHonorarios: form.porcentajeHonorarios,
            fechaPrimeraCuota: form.fechaPrimeraCuota,
            valorCuotaBase: form.valorCuotaBase,
            maxMeses: 240,
        });

        setCuotas(
            recalcularSaldos(gen, {
                capitalInicial: form.capitalInicial,
                porcentajeHonorarios: form.porcentajeHonorarios,
            })
        );

        toast.success("✓ Tabla generada. Puedes editarla antes de guardar.");
    };

    const onCuotasChange = (next: CuotaAcuerdo[]) => {
        if (readOnly) return;
        setCuotas(
            recalcularSaldos(next, {
                capitalInicial: form.capitalInicial,
                porcentajeHonorarios: form.porcentajeHonorarios,
            })
        );
    };

    // ==============================
    // Guardar (solo BORRADOR)
    // ==============================
    const handleSave = async () => {
        if (!clienteId || !deudorId || !canEdit) return;
        if (readOnly) return toast.error("Este acuerdo está EN FIRME y no se puede editar.");

        if (!form.numero.trim()) return toast.error("El número de acuerdo es obligatorio");
        if (!form.capitalInicial || form.capitalInicial <= 0) return toast.error("El capital inicial debe ser > 0");
        if (!form.valorCuotaBase || form.valorCuotaBase <= 0) return toast.error("La cuota base debe ser > 0");
        if (!cuotas.length) return toast.error("Primero genera la tabla de amortización");

        try {
            setSaving(true);
            const auth = getAuth();

            const honorariosInicial = Math.round(form.capitalInicial * (form.porcentajeHonorarios / 100));
            const totalAcordado = Math.round(form.capitalInicial + honorariosInicial);

            const acuerdoPayload: Omit<AcuerdoPago, "id" | "fechaCreacion" | "fechaActualizacion"> = {
                numero: form.numero,
                fechaAcuerdo: Timestamp.fromDate(form.fechaAcuerdo),

                capitalInicial: Math.round(form.capitalInicial),
                porcentajeHonorarios: Math.round(form.porcentajeHonorarios),

                honorariosInicial,
                totalAcordado,

                fechaPrimeraCuota: Timestamp.fromDate(form.fechaPrimeraCuota),
                valorCuotaBase: Math.round(form.valorCuotaBase),

                detalles: form.detalles,

                estado: ACUERDO_ESTADO.BORRADOR,
                esActivo: false,

                creadoPor: auth.currentUser?.uid,
                actualizadoPor: auth.currentUser?.uid,
            };

            const cuotasFinal = recalcularSaldos(cuotas, {
                capitalInicial: form.capitalInicial,
                porcentajeHonorarios: form.porcentajeHonorarios,
            }).map((c) => ({
                ...c,
                valorCuota: Math.round(c.valorCuota),
                capitalCuota: Math.round(c.capitalCuota),
                honorariosCuota: Math.round(c.honorariosCuota),
            }));

            const r = await guardarBorrador(
                clienteId,
                deudorId,
                acuerdoPayload,
                cuotasFinal,
                auth.currentUser?.uid,
                currentAcuerdoId ?? undefined
            );

            setCurrentAcuerdoId(r.acuerdoId);
            setAcuerdoEstado(ACUERDO_ESTADO.BORRADOR);
            setMotivoCambio("");

            toast.success("✓ Acuerdo guardado (BORRADOR)");
        } catch (e) {
            console.error(e);
            toast.error("⚠️ Error guardando el acuerdo");
        } finally {
            setSaving(false);
        }
    };

    // ==============================
    // UI
    // ==============================
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
                        No tienes permisos para crear/editar acuerdos.
                    </Typography>
                </div>
            </div>
        );
    }

    const titulo =
        acuerdoEstado === ACUERDO_ESTADO.EN_FIRME
            ? "Acuerdo de Pago (En firme)"
            : acuerdoEstado === ACUERDO_ESTADO.BORRADOR
                ? "Acuerdo de Pago (Borrador)"
                : "Nuevo Acuerdo de Pago";

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
            <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
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

                <BackButton />

                {/* Header */}
                <header className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg">
                                <FileText className="h-7 w-7 text-white" />
                            </div>
                            <div>
                                <Typography variant="h1" className="!text-brand-primary font-bold">
                                    {titulo}
                                </Typography>
                                <Typography variant="body" className="text-muted-foreground">
                                    {deudorNombre} - {clienteNombre}
                                </Typography>
                            </div>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            <Button variant="outline" onClick={onGenerarTabla} className="gap-2" disabled={readOnly}>
                                <Calculator className="h-4 w-4" />
                                Generar tabla
                            </Button>

                            <Button variant="outline" onClick={handleSave} disabled={saving || readOnly} className="gap-2">
                                <Save className="h-4 w-4" />
                                Guardar
                            </Button>

                            <Button variant="outline" disabled className="gap-2">
                                <History className="h-4 w-4" />
                                Historial
                            </Button>

                            <Button variant="outline" disabled className="gap-2">
                                <FileDown className="h-4 w-4" />
                                Exportar Word
                            </Button>

                            <Button variant="brand" onClick={handlePrint} className="gap-2" disabled={!cuotas.length}>
                                <Printer className="h-4 w-4" />
                                Imprimir
                            </Button>
                        </div>
                    </div>

                    {readOnly && (
                        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                            <Typography variant="small" className="text-orange-800">
                                Este acuerdo está <b>EN FIRME</b>. No se puede editar desde aquí.
                            </Typography>
                        </div>
                    )}
                </header>

                {/* Tabs */}
                <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
                    <TabsList className="grid grid-cols-2 w-full bg-white border border-brand-secondary/20 p-1 rounded-xl">
                        <TabsTrigger value="datos" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white rounded-lg">
                            <FileText className="h-4 w-4 mr-2" />
                            Datos
                        </TabsTrigger>
                        <TabsTrigger value="vista" className="data-[state=active]:bg-brand-primary data-[state=active]:text-white rounded-lg">
                            <Printer className="h-4 w-4 mr-2" />
                            Vista previa
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="datos" className="mt-6 space-y-6">
                        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
                            <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                                    Información del acuerdo
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
                                            value={form.numero}
                                            disabled={readOnly}
                                            onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))}
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
                                                <Button variant="outline" disabled={readOnly} className={cn("w-full justify-start border-brand-secondary/30")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {form.fechaAcuerdo.toLocaleDateString("es-CO")}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={form.fechaAcuerdo}
                                                    onSelect={(date) => date && setForm((p) => ({ ...p, fechaAcuerdo: date }))}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label className="text-brand-secondary font-medium flex items-center gap-2">
                                            <DollarSign className="h-4 w-4" />
                                            Capital inicial (deuda) *
                                        </Label>
                                        <Input
                                            type="number"
                                            value={form.capitalInicial || ""}
                                            disabled={readOnly}
                                            onChange={(e) => setForm((p) => ({ ...p, capitalInicial: Number(e.target.value || 0) }))}
                                            className="border-brand-secondary/30"
                                        />
                                        <Typography variant="small" className="text-muted-foreground">
                                            {form.capitalInicial ? numeroALetras(Math.round(form.capitalInicial)) : ""}
                                        </Typography>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-brand-secondary font-medium">% Honorarios</Label>
                                        <Input
                                            type="number"
                                            value={form.porcentajeHonorarios}
                                            disabled={readOnly}
                                            onChange={(e) => setForm((p) => ({ ...p, porcentajeHonorarios: Number(e.target.value || 0) }))}
                                            className="border-brand-secondary/30"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label className="text-brand-secondary font-medium">Fecha primera cuota</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" disabled={readOnly} className={cn("w-full justify-start border-brand-secondary/30")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {form.fechaPrimeraCuota.toLocaleDateString("es-CO")}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={form.fechaPrimeraCuota}
                                                    onSelect={(date) => date && setForm((p) => ({ ...p, fechaPrimeraCuota: date }))}
                                                    initialFocus
                                                    captionLayout="dropdown"
                                                    fromYear={new Date().getFullYear()}
                                                    toYear={new Date().getFullYear() + 5}
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-brand-secondary font-medium">Cuota base (mensual) *</Label>
                                        <Input
                                            type="number"
                                            value={form.valorCuotaBase || ""}
                                            disabled={readOnly}
                                            onChange={(e) => setForm((p) => ({ ...p, valorCuotaBase: Number(e.target.value || 0) }))}
                                            className="border-brand-secondary/30"
                                        />
                                    </div>
                                </div>

                                <div className="rounded-lg bg-brand-primary/5 border border-brand-primary/10 p-4">
                                    <div className="grid md:grid-cols-3 gap-3">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Honorarios iniciales</p>
                                            <p className="font-semibold text-orange-600">${totales.honorariosInicial.toLocaleString("es-CO")}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total acordado</p>
                                            <p className="font-semibold text-green-600">${totales.totalAcordado.toLocaleString("es-CO")}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {cuotas.length > 0 && (
                            <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
                                <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                                    <Typography variant="h3" className="!text-brand-secondary font-semibold">
                                        Tabla de amortización {readOnly ? "(solo lectura)" : "(editable)"}
                                    </Typography>
                                    <Typography variant="small" className="text-muted-foreground">
                                        Puedes ajustar cuotas/capital/honorarios. El sistema recalcula saldos.
                                    </Typography>
                                </div>
                                <div className="p-4 md:p-5">
                                    <TablaAmortizacionEditable cuotas={cuotas} onChange={onCuotasChange} readOnly={readOnly} />
                                </div>
                            </section>
                        )}

                        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
                            <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                                    Notas
                                </Typography>
                            </div>
                            <div className="p-4 md:p-5 space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-brand-secondary font-medium">Detalles</Label>
                                    <Textarea
                                        value={form.detalles}
                                        disabled={readOnly}
                                        onChange={(e) => setForm((p) => ({ ...p, detalles: e.target.value }))}
                                        className="min-h-28 border-brand-secondary/30"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-brand-secondary font-medium">Motivo del cambio (historial)</Label>
                                    <Input
                                        value={motivoCambio}
                                        disabled={readOnly}
                                        onChange={(e) => setMotivoCambio(e.target.value)}
                                        className="border-brand-secondary/30"
                                        placeholder="Ej: Ajuste negociado con el deudor"
                                    />
                                </div>
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="vista" className="mt-6">
                        <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
                            <div ref={printRef} className="p-8 md:p-12 print:p-8">
                                <div className="text-center mb-8">
                                    <Typography variant="h1" className="!text-2xl font-bold text-brand-primary mb-2">
                                        ACUERDO DE PAGO
                                    </Typography>
                                    <Typography variant="body" className="text-muted-foreground">
                                        No. {form.numero || "___________"}
                                    </Typography>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6 mb-6">
                                    <div className="p-4 rounded-lg bg-brand-primary/5 border border-brand-primary/10">
                                        <Typography variant="small" className="text-muted-foreground">
                                            Acreedor
                                        </Typography>
                                        <Typography variant="body" className="font-semibold">
                                            {clienteNombre}
                                        </Typography>
                                    </div>
                                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                                        <Typography variant="small" className="text-muted-foreground">
                                            Deudor
                                        </Typography>
                                        <Typography variant="body" className="font-semibold">
                                            {deudorNombre}
                                        </Typography>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-3 gap-6 mb-8">
                                    <div>
                                        <Typography variant="small" className="text-muted-foreground">
                                            Capital
                                        </Typography>
                                        <Typography variant="body" className="font-bold text-blue-600">
                                            ${Math.round(form.capitalInicial).toLocaleString("es-CO")}
                                        </Typography>
                                    </div>
                                    <div>
                                        <Typography variant="small" className="text-muted-foreground">
                                            Honorarios ({form.porcentajeHonorarios}%)
                                        </Typography>
                                        <Typography variant="body" className="font-bold text-orange-600">
                                            ${totales.honorariosInicial.toLocaleString("es-CO")}
                                        </Typography>
                                    </div>
                                    <div>
                                        <Typography variant="small" className="text-muted-foreground">
                                            Total acuerdo
                                        </Typography>
                                        <Typography variant="body" className="font-bold text-green-600">
                                            ${totales.totalAcordado.toLocaleString("es-CO")}
                                        </Typography>
                                    </div>
                                </div>

                                {cuotas.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse text-sm">
                                            <thead>
                                                <tr className="bg-brand-primary/10 border-b-2 border-brand-primary/20">
                                                    <th className="p-2 text-center">#</th>
                                                    <th className="p-2 text-right">Cuota</th>
                                                    <th className="p-2 text-right">Honorarios</th>
                                                    <th className="p-2 text-right">Capital</th>
                                                    <th className="p-2 text-right">Saldo Cap.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {cuotas.map((c) => (
                                                    <tr key={c.numero} className="border-b">
                                                        <td className="p-2 text-center">{c.numero}</td>
                                                        <td className="p-2 text-right">${Math.round(c.valorCuota).toLocaleString("es-CO")}</td>
                                                        <td className="p-2 text-right">${Math.round(c.honorariosCuota).toLocaleString("es-CO")}</td>
                                                        <td className="p-2 text-right">${Math.round(c.capitalCuota).toLocaleString("es-CO")}</td>
                                                        <td className="p-2 text-right">${Math.round(c.capitalSaldoDespues).toLocaleString("es-CO")}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {form.detalles && (
                                    <div className="mt-6">
                                        <Typography variant="small" className="text-muted-foreground">
                                            Detalles
                                        </Typography>
                                        <Typography variant="body">{form.detalles}</Typography>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
