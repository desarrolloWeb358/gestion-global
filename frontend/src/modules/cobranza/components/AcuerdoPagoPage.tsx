// src/modules/cobranza/pages/AcuerdoPagoPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";
import {
    FileText,
    Save,
    Calendar as CalendarIcon,
    DollarSign,
    Hash,
    Calculator,
    FileDown,
    Upload,
    ExternalLink,
    Trash2,
} from "lucide-react";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
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
import { descargarAcuerdoPagoWord } from "@/modules/cobranza/services/acuerdoPagoWordService";

import {
    obtenerAcuerdoActual,
    obtenerCuotas,
    guardarBorrador,
    firmarAcuerdoConPdf,
} from "@/modules/cobranza/services/acuerdoPagoService";

import {
    recalcularTablaDesdeValorCuota,
    recalcularTablaDesdeValorCuotaDesdeIndice,
} from "@/modules/cobranza/lib/recalcularTablaAcuerdo";

import { ACUERDO_ESTADO } from "@/shared/constants/acuerdoEstado";

import { subirYGuardarPdfFirmadoBorrador, activarAcuerdoEnFirme } from "@/modules/cobranza/services/acuerdoPagoService";

import { AlertTriangle, List } from "lucide-react";
import { listarAcuerdos, incumplirAcuerdoYCrearNuevoBorrador } from "@/modules/cobranza/services/acuerdoPagoService";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/shared/ui/dialog";

type FormBase = {
    numero: string;
    fechaAcuerdo: Date;

    capitalInicial: number;
    porcentajeHonorarios: number;

    fechaPrimeraCuota: Date;
    valorCuotaBase: number;

    detalles: string;
};

type DatosWord = {
    // Cliente
    clienteDireccion?: string;
    clienteBanco?: string;
    clienteNumeroCuenta?: string;
    clienteTipoCuenta?: string;

    // Deudor
    deudorCedula?: string;
    deudorDireccion?: string;
    deudorUbicacion?: string;
    deudorEmails?: string[];
    deudorTelefonos?: string[];
};

function toDateSafe(v: any): Date {
    if (!v) return new Date();
    if (v instanceof Date) return v;
    if (v?.toDate) return v.toDate();
    return new Date(v);
}

export default function AcuerdoPagoPage() {
    const { roles, usuarioSistema } = useUsuarioActual();
    const userRoles = roles && roles.length ? roles : usuarioSistema?.roles ?? [];
    const esCliente = userRoles.includes("cliente");
    const esDeudor = userRoles.includes("deudor");

    // Permisos
    const { clienteId, deudorId } = useParams();
    const { can, loading: aclLoading } = useAcl();

    const puedeEditar = can(PERMS.Deudores_Edit); // admin/ejecutivo normalmente
    const puedeVerHistorial = puedeEditar || esCliente || esDeudor; // cliente sí
    const puedeMarcarIncumplido = puedeEditar; // cliente NO
    const canEdit = can(PERMS.Deudores_Edit);

    const MAX_FILE_MB = 15;

    const [archivoFirmadoFile, setArchivoFirmadoFile] = useState<File | undefined>(undefined);
    const [subiendoFirmado, setSubiendoFirmado] = useState(false);

    function formatBytes(bytes: number) {
        if (!bytes && bytes !== 0) return "";
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
        const value = bytes / Math.pow(1024, i);
        return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
    }


    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [clienteNombre, setClienteNombre] = useState("Cargando...");
    const [deudorNombre, setDeudorNombre] = useState("Cargando...");

    const [currentAcuerdoId, setCurrentAcuerdoId] = useState<string | null>(null);
    const [acuerdoEstado, setAcuerdoEstado] = useState<string | null>(null); // EN_FIRME/BORRADOR/etc

    const [acuerdoURL, setAcuerdoURL] = useState<string>("");

    const [tablaKey, setTablaKey] = useState(0);

    const [datosWord, setDatosWord] = useState<DatosWord>({
        clienteDireccion: "",
        clienteBanco: "",
        clienteNumeroCuenta: "",
        clienteTipoCuenta: "",
        deudorCedula: "",
        deudorDireccion: "",
        deudorUbicacion: "",
        deudorEmails: [],
        deudorTelefonos: [],
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

    const readOnly = acuerdoEstado === ACUERDO_ESTADO.EN_FIRME;

    const [downloadingWord, setDownloadingWord] = useState(false);
    const [firmando, setFirmando] = useState(false);

    const [openHistorial, setOpenHistorial] = useState(false);
    const [historialLoading, setHistorialLoading] = useState(false);
    const [historial, setHistorial] = useState<any[]>([]);

    const historialFiltrado = useMemo(() => {
        // No mostrar el acuerdo actual (sea BORRADOR o EN_FIRME)
        if (!currentAcuerdoId) return historial;
        return historial.filter((a: any) => a.id !== currentAcuerdoId);
    }, [historial, currentAcuerdoId]);

    const [openIncumplio, setOpenIncumplio] = useState(false);
    const [incumpliendo, setIncumpliendo] = useState(false);


    const cargarHistorial = async () => {
        if (!clienteId || !deudorId) return;
        try {
            setHistorialLoading(true);
            const data = await listarAcuerdos(clienteId, deudorId);
            setHistorial(data);
        } catch (e) {
            console.error(e);
            toast.error("Error cargando historial de acuerdos");
        } finally {
            setHistorialLoading(false);
        }
    };

    const handleConfirmIncumplio = async () => {
        if (!clienteId || !deudorId) return;
        if (!currentAcuerdoId) return toast.error("No hay acuerdo actual");
        if (!readOnly) return;

        try {
            setIncumpliendo(true);
            const auth = getAuth();

            await incumplirAcuerdoYCrearNuevoBorrador({
                clienteId,
                deudorId,
                acuerdoIdEnFirme: currentAcuerdoId,
                userId: auth.currentUser?.uid,
            });

            toast.success("Acuerdo marcado como INCUMPLIDO y se creó un nuevo BORRADOR.");
            setOpenIncumplio(false);

            // recargar: obtenerAcuerdoActual te va a traer el nuevo borrador (porque ya no hay EN_FIRME activo)
            await cargarAcuerdoActual();
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || "Error marcando incumplimiento");
        } finally {
            setIncumpliendo(false);
        }
    };



    const handleSubirPdfFirmado = async () => {
        if (!clienteId || !deudorId) return;
        if (!currentAcuerdoId) return toast.error("Primero guarda el acuerdo (BORRADOR).");
        if (!archivoFirmadoFile) return toast.error("Selecciona el PDF firmado.");
        if (readOnly) return;

        try {
            setSubiendoFirmado(true);
            const auth = getAuth();
            toast.info("Subiendo PDF firmado...");

            const up = await subirYGuardarPdfFirmadoBorrador({
                clienteId,
                deudorId,
                acuerdoId: currentAcuerdoId,
                file: archivoFirmadoFile,
                userId: auth.currentUser?.uid,
            });

            setAcuerdoURL(up.url);
            setArchivoFirmadoFile(undefined);

            toast.success("✓ PDF firmado cargado. (Aún puedes reemplazarlo mientras esté en BORRADOR)");
            await cargarAcuerdoActual(); // para refrescar estado/URL
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || "Error subiendo el PDF firmado");
        } finally {
            setSubiendoFirmado(false);
        }
    };

    const handleDejarEnFirme = async () => {
        if (!clienteId || !deudorId) return;
        if (!currentAcuerdoId) return toast.error("No hay acuerdo para dejar en firme.");
        if (!acuerdoURL) return toast.error("Primero sube el PDF firmado.");
        if (readOnly) return;

        const ok = window.confirm(
            "¿Confirmas dejar este acuerdo EN FIRME?\n\nDespués no podrás editar ni reemplazar el PDF."
        );
        if (!ok) return;

        try {
            setSaving(true);
            const auth = getAuth();
            toast.info("Dejando acuerdo EN FIRME...");

            await activarAcuerdoEnFirme(
                clienteId,
                deudorId,
                currentAcuerdoId,
                acuerdoURL,
                auth.currentUser?.uid
            );

            toast.success("✓ Acuerdo EN FIRME. Solo consulta.");
            await cargarAcuerdoActual(); // esto hará readOnly=true
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || "Error dejando el acuerdo en firme");
        } finally {
            setSaving(false);
        }
    };


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
    // Recalcular saldos
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
    // Exportar Word
    // ==============================
    const handleExportWord = async () => {
        if (!clienteId || !deudorId) return;

        try {
            setDownloadingWord(true);
            toast.info("Generando Word del acuerdo...");

            const totalAcordado = totales.totalAcordado;

            const dw = (datosWord ?? {}) as any;

            const clienteDireccion = String(dw.clienteDireccion || "").trim();
            const clienteBanco = String(dw.clienteBanco || "").trim();
            const clienteNumeroCuenta = String(dw.clienteNumeroCuenta || "").trim();
            const clienteTipoCuenta = String(dw.clienteTipoCuenta || "").trim();

            const deudorCedula = String(dw.deudorCedula || "").trim();
            const deudorDireccion = String(dw.deudorDireccion || "").trim();
            const deudorUbicacion = String(dw.deudorUbicacion || "").trim();

            const deudorEmailsArr: string[] = Array.isArray(dw.deudorEmails) ? dw.deudorEmails : [];
            const deudorTelefonosArr: string[] = Array.isArray(dw.deudorTelefonos) ? dw.deudorTelefonos : [];

            const deudorEmail = String(deudorEmailsArr[0] || "").trim();
            const deudorCelular = String(deudorTelefonosArr[0] || "").trim();

            const bancoPagoTexto =
                clienteBanco && clienteNumeroCuenta
                    ? `CUOTA ACUERDO DE PAGO EN EL BANCO ${clienteBanco} CUENTA ${clienteTipoCuenta || "XXXXX"
                    } NÚMERO ${clienteNumeroCuenta} (XXXXX) SEGUIDO DE LA TORRE Y APARTAMENTO...`
                    : "XXXXX (TEXTO BANCO / REFERENCIA DE PAGO)";

            await descargarAcuerdoPagoWord({
                ciudadFirma: "Bogotá D.C.",
                fechaFirma: form.fechaAcuerdo,

                empresaNombre: "GESTION GLOBAL ACG S.A.S",
                empresaNit: "901.662.783-7",
                empresaRepresentante: "JAVIER MAURICIO GARCIA",

                entidadAcreedoraNombre: clienteNombre,
                entidadAcreedoraDireccion: clienteDireccion || "XXXXX",

                deudorNombre: deudorNombre,
                deudorDocumento: deudorCedula || "XXXXX",
                deudorCiudadDoc: "XXXXX",
                deudorDireccion: deudorDireccion || "XXXXX",
                deudorCelular: deudorCelular || "XXXXX",
                deudorEmail: deudorEmail || "XXXXX",

                deudorUbicacion: deudorUbicacion || "XXXXX",

                numeroAcuerdo: form.numero,
                capitalInicial: form.capitalInicial,
                totalAcordado,
                totalAcordadoLetras: numeroALetras(Math.round(totalAcordado)),
                fechaEstadoDeuda: form.fechaAcuerdo,

                cuotas,

                bancoPagoTexto,
                canalSoportesTexto: "Enviar soporte de pago al email XXXXX o al WhatsApp XXXXX de manera inmediata.",

                detalles: form.detalles,
            });

            toast.success("Word generado correctamente");
        } catch (e) {
            console.error(e);
            toast.error("Error generando el Word del acuerdo");
        } finally {
            setDownloadingWord(false);
        }
    };

    // ==============================
    // Cargar datos base (cliente/deudor)
    // ==============================
    const cargarClienteDeudor = async () => {
        if (!clienteId || !deudorId) return;

        // -------- Deudor --------
        const deudorRef = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
        const deudorSnap = await getDoc(deudorRef);

        if (!deudorSnap.exists()) {
            toast.error("⚠️ Deudor no encontrado");
            throw new Error("Deudor no encontrado");
        }

        const dd = deudorSnap.data() as any;

        const nombreDeudor = dd?.nombre || dd?.nombreResponsable || "Deudor";
        setDeudorNombre(nombreDeudor);

        const deudorCedula = String(dd?.cedula || "").trim();
        const deudorDireccion = String(dd?.direccion || "").trim();
        const deudorUbicacion = String(dd?.ubicacion || "").trim();

        const correos = Array.isArray(dd?.correos) ? dd.correos : [];
        const telefonos = Array.isArray(dd?.telefonos) ? dd.telefonos : [];

        const deudorEmails = correos
            .map((x: any) => String(x || "").trim())
            .filter((x: string) => x.length > 0);

        const deudorTelefonos = telefonos
            .map((x: any) => String(x || "").trim())
            .filter((x: string) => x.length > 0);

        // -------- Cliente --------
        const clienteRef = doc(db, `clientes/${clienteId}`);
        const clienteSnap = await getDoc(clienteRef);

        if (!clienteSnap.exists()) {
            toast.error("⚠️ Cliente no encontrado");
            throw new Error("Cliente no encontrado");
        }

        const cd = clienteSnap.data() as any;

        const nombreCliente = String(cd?.nombre || "Cliente").trim();
        setClienteNombre(nombreCliente);

        const clienteDireccion = String(cd?.direccion || "").trim();
        const clienteBanco = String(cd?.banco || "").trim();
        const clienteNumeroCuenta = String(cd?.numeroCuenta || "").trim();
        const clienteTipoCuenta = String(cd?.tipoCuenta || "").trim();

        setDatosWord({
            clienteDireccion,
            clienteBanco,
            clienteNumeroCuenta,
            clienteTipoCuenta,
            deudorCedula,
            deudorDireccion,
            deudorUbicacion,
            deudorEmails,
            deudorTelefonos,
        });
    };

    // ==============================
    // Cargar acuerdo actual (EN_FIRME > BORRADOR)
    // ==============================
    const cargarAcuerdoActual = async () => {
        if (!clienteId || !deudorId) return;

        const { acuerdo, acuerdoId } = await obtenerAcuerdoActual(clienteId, deudorId);

        if (!acuerdo || !acuerdoId) {
            setCurrentAcuerdoId(null);
            setAcuerdoEstado(null);
            setAcuerdoURL("");
            setCuotas([]);
            setForm((p) => ({ ...p, numero: "", detalles: "" }));
            return;
        }

        setCurrentAcuerdoId(acuerdoId);
        setAcuerdoEstado(acuerdo.estado);

        // ✅ lee acuerdoURL si existe
        setAcuerdoURL(String((acuerdo as any)?.acuerdoURL || ""));

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
            recalcularTablaDesdeValorCuota(cuotasDb, {
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

        if (!form.capitalInicial || form.capitalInicial <= 0)
            return toast.error("Ingresa el capital (deuda) inicial");
        if (!form.valorCuotaBase || form.valorCuotaBase <= 0)
            return toast.error("Ingresa la cuota base (mensual)");

        const { cuotas: gen } = generarTablaAcuerdo({
            capitalInicial: form.capitalInicial,
            porcentajeHonorarios: form.porcentajeHonorarios,
            fechaPrimeraCuota: form.fechaPrimeraCuota,
            valorCuotaBase: form.valorCuotaBase,
            maxMeses: 240,
        });

        const recalculada = recalcularTablaDesdeValorCuota(gen, {
            capitalInicial: form.capitalInicial,
            porcentajeHonorarios: form.porcentajeHonorarios,
        });

        setCuotas(recalculada);
        setTablaKey((k) => k + 1); // ✅ fuerza reset del draft

        toast.success("✓ Tabla generada. Puedes editarla antes de guardar.");
    };

    const onCuotasChange = (next: CuotaAcuerdo[], meta?: { changedIndex?: number }) => {
        if (readOnly) return;

        const base = {
            capitalInicial: form.capitalInicial,
            porcentajeHonorarios: form.porcentajeHonorarios,
        };

        const idx = meta?.changedIndex ?? 0;

        setCuotas(recalcularTablaDesdeValorCuotaDesdeIndice(next, idx, base));
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

            toast.success("✓ Acuerdo guardado (BORRADOR)");
        } catch (e) {
            console.error(e);
            toast.error("⚠️ Error guardando el acuerdo");
        } finally {
            setSaving(false);
        }
    };

    // ==============================
    // Firmar acuerdo: subir PDF + pasar a EN_FIRME
    // ==============================
    const onPickFirmado = async (file?: File | null) => {
        if (!file) return;
        if (!clienteId || !deudorId) return;
        if (!currentAcuerdoId) return toast.error("Primero guarda el acuerdo (BORRADOR) para poder firmarlo.");
        if (readOnly) return;

        const isPdf =
            file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) return toast.error("El archivo debe ser PDF");

        try {
            setFirmando(true);
            toast.info("Subiendo PDF firmado...");

            const auth = getAuth();
            const { url } = await firmarAcuerdoConPdf({
                clienteId,
                deudorId,
                acuerdoId: currentAcuerdoId,
                file,
                userId: auth.currentUser?.uid,
            });

            setAcuerdoURL(url);
            toast.success("✓ Acuerdo firmado y activado EN FIRME");

            // recarga para bloquear UI
            await cargarAcuerdoActual();
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || "Error subiendo el PDF firmado");
        } finally {
            setFirmando(false);
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
                    <Typography variant="body" >
                        Cargando información...
                    </Typography>
                </div>
            </div>
        );
    }

    if ((esCliente || esDeudor) && acuerdoEstado !== ACUERDO_ESTADO.EN_FIRME) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
                <div className="max-w-4xl mx-auto p-6 space-y-4">
                    <BackButton />
                    <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
                        <div className="p-6">
                            <Typography variant="h2" className="text-brand-secondary mb-2">
                                No hay acuerdo en firme
                            </Typography>
                            <Typography variant="body">
                                Este deudor aún no tiene un acuerdo de pago <b>EN FIRME</b> para consulta.
                            </Typography>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!puedeEditar && !esCliente && !esDeudor) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
                <div className="text-center">
                    <Typography variant="h2" className="text-brand-secondary mb-2">
                        Acceso denegado
                    </Typography>
                    <Typography variant="body">
                        No tienes permisos para acceder al acuerdo.
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
                {(saving || firmando) && (
                    <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <div className="rounded-xl bg-white shadow-lg px-6 py-5 flex items-center gap-3">
                            <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
                            <Typography variant="body" className="font-medium">
                                {saving ? "Guardando acuerdo..." : "Subiendo PDF firmado..."}
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
                                <Typography variant="body">
                                    {deudorNombre} - {clienteNombre}
                                </Typography>
                            </div>
                        </div>

                        {/* Acciones header */}
                        <div className="flex gap-2 flex-wrap items-center">


                            {/* Exportar Word (siempre disponible) */}
                            {!readOnly && (
                                <Button
                                    variant="outline"
                                    onClick={handleExportWord}
                                    disabled={downloadingWord}
                                    className="gap-2"
                                >
                                    <FileDown className="h-4 w-4" />
                                    {downloadingWord ? "Generando..." : "Exportar Word"}
                                </Button>
                            )}


                            {/* Historial: SIEMPRE disponible */}
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={async () => {
                                    setOpenHistorial(true);
                                    await cargarHistorial();
                                }}
                            >
                                <List className="h-4 w-4" />
                                Historial
                            </Button>
                            {readOnly && puedeEditar && (
                                <Button
                                    variant="destructive"
                                    className="gap-2"
                                    onClick={() => setOpenIncumplio(true)}
                                >
                                    <AlertTriangle className="h-4 w-4" />
                                    Incumplió acuerdo
                                </Button>
                            )}
                        </div>
                    </div>

                    {readOnly && (
                        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                            <Typography variant="small" className="text-orange-800">
                                Este acuerdo está <b>EN FIRME</b>. Solo se puede consultar.
                            </Typography>
                            {acuerdoURL ? (
                                <Button
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => window.open(acuerdoURL, "_blank")}
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Abrir PDF firmado
                                </Button>
                            ) : null}
                        </div>
                    )}
                </header>

                {/* Vista Datos */}
                <div className="mt-6 space-y-6">
                    {/* Información del acuerdo */}
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
                                            <Button
                                                variant="outline"
                                                disabled={readOnly}
                                                className={cn("w-full justify-start border-brand-secondary/30")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {form.fechaAcuerdo.toLocaleDateString("es-CO")}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={form.fechaAcuerdo}
                                                defaultMonth={form.fechaAcuerdo} // ✅ al abrir, se posiciona en el mes/año elegido
                                                onSelect={(date) => date && setForm((p) => ({ ...p, fechaAcuerdo: date }))}
                                                initialFocus
                                                captionLayout="dropdown"
                                                fromYear={new Date().getFullYear() - 20} // ✅ permite pasado
                                                toYear={new Date().getFullYear() + 20}   // ✅ permite futuro
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
                                    <Typography variant="small" >
                                        {form.capitalInicial ? `${numeroALetras(Math.round(form.capitalInicial))} PESOS` : ""}
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
                                            <Button
                                                variant="outline"
                                                disabled={readOnly}
                                                className={cn("w-full justify-start border-brand-secondary/30")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {form.fechaPrimeraCuota.toLocaleDateString("es-CO")}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={form.fechaPrimeraCuota}
                                                defaultMonth={form.fechaPrimeraCuota} // ✅ al abrir, se posiciona en el mes/año elegido
                                                onSelect={(date) => date && setForm((p) => ({ ...p, fechaPrimeraCuota: date }))}
                                                initialFocus
                                                captionLayout="dropdown"
                                                fromYear={new Date().getFullYear() - 20} // ✅ pasado
                                                toYear={new Date().getFullYear() + 20}   // ✅ futuro
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
                                        <p className="text-xs ">Honorarios iniciales</p>
                                        <p className="font-semibold text-orange-600">
                                            ${totales.honorariosInicial.toLocaleString("es-CO")}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs">Total acordado</p>
                                        <p className="font-semibold text-green-600">
                                            ${totales.totalAcordado.toLocaleString("es-CO")}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Botón Generar tabla (solo si NO está en firme) */}
                            {!readOnly && (
                                <div className="pt-2 flex justify-end">
                                    <Button variant="outline" onClick={onGenerarTabla} className="gap-2" disabled={readOnly}>
                                        <Calculator className="h-4 w-4" />
                                        Generar tabla
                                    </Button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Tabla amortización */}
                    {cuotas.length > 0 && (
                        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
                            <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                                    Tabla de amortización {readOnly ? "(solo lectura)" : "(editable)"}
                                </Typography>
                                <Typography variant="small">
                                    Puedes ajustar cuotas/capital/honorarios. El sistema recalcula saldos.
                                </Typography>
                            </div>
                            <div className="p-4 md:p-5">
                                <TablaAmortizacionEditable
                                    key={tablaKey}
                                    cuotas={cuotas}
                                    onChange={onCuotasChange}
                                    readOnly={readOnly}
                                />
                            </div>
                        </section>
                    )}

                    {/* Notas */}
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
                            

                            {/* Guardar (solo si NO está en firme) */}
                            {!readOnly && (
                                <div className="pt-2 flex justify-end">
                                    <Button variant="outline" onClick={handleSave} disabled={saving || readOnly} className="gap-2">
                                        <Save className="h-4 w-4" />
                                        Guardar
                                    </Button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* ===================== PDF ACUERDO FIRMADO ===================== */}
                    <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                            <Typography variant="h3" className="!text-brand-secondary font-semibold">
                                Acuerdo firmado (PDF)
                            </Typography>
                            <Typography variant="small" className="text-muted-foreground">
                                Puedes subir/reemplazar el PDF mientras esté en BORRADOR. Cuando confirmes “Dejar en firme”, ya no se podrá cambiar.
                            </Typography>
                        </div>

                        <div className="p-4 md:p-5 space-y-3">
                            <div className="space-y-2">
                                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                                    <Upload className="h-4 w-4" />
                                    Archivo adjunto
                                </Label>

                                {/* Si ya hay URL guardada (pdf cargado) */}
                                {acuerdoURL && !archivoFirmadoFile && (
                                    <div className="text-xs text-muted-foreground p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-start justify-between gap-3 flex-wrap">
                                        <div>
                                            Hay un PDF firmado cargado.
                                            {!readOnly && (
                                                <>
                                                    <br />
                                                    <span>Si seleccionas y subes uno nuevo, reemplazará el actual (mientras esté en BORRADOR).</span>
                                                </>
                                            )}
                                        </div>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="gap-2"
                                            onClick={() => window.open(acuerdoURL, "_blank")}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            Ver PDF
                                        </Button>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 flex-wrap">
                                    <Input
                                        id="archivo-acuerdo-firmado"
                                        type="file"
                                        className="hidden"
                                        accept=".pdf"
                                        disabled={saving || subiendoFirmado || readOnly}
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (!f) {
                                                setArchivoFirmadoFile(undefined);
                                                return;
                                            }

                                            const tooBig = f.size > MAX_FILE_MB * 1024 * 1024;
                                            if (tooBig) {
                                                toast.error(`El archivo supera ${MAX_FILE_MB} MB`);
                                                e.currentTarget.value = "";
                                                return;
                                            }

                                            const isPdf =
                                                f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
                                            if (!isPdf) {
                                                toast.error("Solo se permite PDF");
                                                e.currentTarget.value = "";
                                                return;
                                            }

                                            setArchivoFirmadoFile(f);
                                        }}
                                    />

                                    {/* Seleccionar archivo */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={saving || subiendoFirmado || readOnly}
                                        onClick={() => document.getElementById("archivo-acuerdo-firmado")?.click()}
                                        className="border-brand-secondary/30"
                                    >
                                        <Upload className="h-4 w-4 mr-2" />
                                        Seleccionar archivo
                                    </Button>

                                    {/* Estado seleccionado */}
                                    {archivoFirmadoFile ? (
                                        <div className="text-sm flex items-center gap-2 flex-1 min-w-[220px]">
                                            <FileText className="h-4 w-4 text-brand-primary" />
                                            <span className="font-medium">{archivoFirmadoFile.name}</span>
                                            <span className="text-muted-foreground">({formatBytes(archivoFirmadoFile.size)})</span>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground flex-1 min-w-[220px]">
                                            No hay archivo seleccionado
                                        </div>
                                    )}

                                    {/* Quitar seleccionado */}
                                    {archivoFirmadoFile && !readOnly && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setArchivoFirmadoFile(undefined)}
                                            disabled={saving || subiendoFirmado}
                                            className="hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                    )}
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    Formato permitido: PDF. Tamaño máximo: {MAX_FILE_MB} MB.
                                </p>
                            </div>

                            {/* Botones acción */}
                            {!readOnly && (
                                <div className="flex gap-2 flex-wrap justify-end pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={subiendoFirmado || saving || !archivoFirmadoFile || !currentAcuerdoId}
                                        onClick={handleSubirPdfFirmado}
                                        className="gap-2"
                                    >
                                        <Upload className="h-4 w-4" />
                                        {subiendoFirmado ? "Subiendo..." : "Subir archivo"}
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="brand"
                                        disabled={saving || subiendoFirmado || !acuerdoURL || !currentAcuerdoId}
                                        onClick={handleDejarEnFirme}
                                        className="gap-2"
                                    >
                                        <FileText className="h-4 w-4" />
                                        Dejar en firme (Acuerdo listo)
                                    </Button>
                                </div>
                            )}
                        </div>
                    </section>


                </div>

                <Dialog open={openIncumplio} onOpenChange={setOpenIncumplio}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Marcar acuerdo como INCUMPLIDO</DialogTitle>
                            <DialogDescription>
                                ¿Confirmas que el deudor incumplió este acuerdo? <br />
                                Se marcará como <b>INCUMPLIDO</b> y se creará un <b>nuevo borrador</b> para generar otro acuerdo.
                            </DialogDescription>
                        </DialogHeader>

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setOpenIncumplio(false)} disabled={incumpliendo}>
                                Cancelar
                            </Button>
                            <Button variant="destructive" onClick={handleConfirmIncumplio} disabled={incumpliendo}>
                                {incumpliendo ? "Procesando..." : "Sí, incumplió"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={openHistorial} onOpenChange={setOpenHistorial}>
                    <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Historial de acuerdos</DialogTitle>
                            <DialogDescription>
                                Aquí puedes consultar acuerdos anteriores y abrir sus PDF firmados.
                            </DialogDescription>
                        </DialogHeader>

                        {historialLoading ? (
                            <div className="py-10 text-center text-sm text-muted-foreground">Cargando historial...</div>
                        ) : (
                            <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
                                {historialFiltrado.length === 0 && (
                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                        No hay acuerdos anteriores en el historial.
                                    </div>
                                )}

                                {historialFiltrado.map((a: any) => {
                                    const fecha =
                                        a?.fechaAcuerdo?.toDate ? a.fechaAcuerdo.toDate()
                                            : a?.fechaAcuerdo ? new Date(a.fechaAcuerdo)
                                                : null;

                                    const estado = String(a?.estado || "");
                                    const url = String(a?.acuerdoURL || "");
                                    const nombreArchivo = String(a?.acuerdoNombre || "").trim();

                                    // Título: nombre del archivo, si no existe, fallback
                                    const titulo = nombreArchivo || (url ? "Acuerdo firmado" : "Acuerdo sin PDF");

                                    return (
                                        <div
                                            key={a.id}
                                            className="rounded-lg border border-brand-secondary/20 p-3 flex items-center justify-between gap-3 flex-wrap"
                                        >
                                            <div className="min-w-[240px]">
                                                <div className="text-sm font-semibold text-brand-secondary">
                                                    {titulo}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {fecha ? fecha.toLocaleDateString("es-CO") : "Sin fecha"} • Estado: {estado}
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="gap-2"
                                                    disabled={!url}
                                                    onClick={() => url && window.open(url, "_blank")}
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Ver PDF
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}

                            </div>
                        )}

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOpenHistorial(false)}>
                                Cerrar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>


            </div>
        </div>
    );
}
