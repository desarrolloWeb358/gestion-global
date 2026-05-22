import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/firebase";
import {
    User,
    Users,
    FileText,
    DollarSign,
    TrendingUp,
    Building2,
    MessageSquare,
    MessageCircle,
    ScrollText,
    Download,
} from "lucide-react";

import { Cliente } from "@/modules/clientes/models/cliente.model";
import { ClienteInfoCard } from "./ClienteInfoCard";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { Button } from "@/shared/ui/button";
import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { Deudor } from "@/modules/cobranza/models/deudores.model";
import { obtenerDeudorPorCliente } from "@/modules/cobranza/services/deudorService";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { obtenerUltimoContrato, formatFechaContrato } from "@/modules/contratos/services/contratoService";
import type { Contrato } from "@/modules/contratos/models/contrato.model";


export default function ClientePage() {
    const { clienteId } = useParams();
    const navigate = useNavigate();

    const { can, loading: aclLoading } = useAcl();

    // Permiso específico para ver el botón de "Recaudos y Deudas"
    const canViewRecaudos = can(PERMS.Recaudos_Read);

    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [deudores, setDeudores] = useState<Deudor[]>([]);
    const [ejecutivos, setEjecutivos] = useState<UsuarioSistema[]>([]);
    const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
    const [loading, setLoading] = useState(true);
    const [ultimoContrato, setUltimoContrato] = useState<Contrato | null>(null);
    const { roles, loading: userLoading } = useUsuarioActual();
    const isCliente = roles?.includes("cliente");
    const canViewWhatsappMasivo = can(PERMS.Whatsapp_Write);
    const canViewContratos = can(PERMS.Contratos_Read);

    // Obtener nombre del cliente desde usuarios
    const nombreCliente = useMemo(() => {
        if (cliente?.nombre) return cliente.nombre;
        if (!clienteId) return "Cliente";

        const usuario = usuarios.find(u => u.uid === clienteId);
        return usuario?.nombre ?? usuario?.email ?? "Cliente";
    }, [cliente, clienteId, usuarios]);

    const EXCLUIR_EN_ACTIVOS = new Set<TipificacionDeuda>([
        TipificacionDeuda.INACTIVO,
        TipificacionDeuda.TERMINADO,
        TipificacionDeuda.DEMANDA_TERMINADO,
        TipificacionDeuda.DEVUELTO,
    ]);

    const deudoresActivos = useMemo(() => {
        return deudores.filter((d) => {
            const tip = (d.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO;
            return !EXCLUIR_EN_ACTIVOS.has(tip);
        });
    }, [deudores]);

    useEffect(() => {
        const cargarDatos = async () => {
            if (!clienteId) return;

            try {
                const ref = doc(db, "clientes", clienteId);
                const snap = await getDoc(ref);

                if (snap.exists()) {
                    setCliente({ id: snap.id, ...snap.data() } as Cliente);
                }

                // Cargar deudores
                const deudoresData = await obtenerDeudorPorCliente(clienteId);
                setDeudores(deudoresData);

                // Cargar último contrato
                obtenerUltimoContrato(clienteId).then(setUltimoContrato).catch(() => {});

                const todosUsuarios = await obtenerUsuarios();
                setUsuarios(todosUsuarios);

                const ejecutivosFiltrados = todosUsuarios.filter(
                    (u) => Array.isArray(u.roles) && u.roles.includes("ejecutivo")
                );
                setEjecutivos(ejecutivosFiltrados);

                setLoading(false);
            } catch (error) {
                console.error("Error al cargar datos:", error);
                setLoading(false);
            }
        };

        cargarDatos();
    }, [clienteId]);

    if (!clienteId || loading || aclLoading || userLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
                <div className="text-center">
                    <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-4" />
                    <Typography variant="body">
                        Cargando información del cliente...
                    </Typography>
                </div>
            </div>
        );
    }

    const isDeudor = roles?.includes("deudor");
    if (isDeudor || !can(PERMS.Clientes_Read)) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
                <div className="text-center">
                    <div className="p-4 rounded-full bg-red-100 mb-4 inline-block">
                        <User className="h-8 w-8 text-red-600" />
                    </div>
                    <Typography variant="h2" className="text-red-600 mb-2">
                        Acceso no permitido
                    </Typography>
                    <Typography variant="body" className="mb-4">
                        No tienes permiso para ver esta página.
                    </Typography>
                    <Button variant="outline" onClick={() => navigate(-1)} className="border-brand-secondary/30">
                        Volver
                    </Button>
                </div>
            </div>
        );
    }

    if (!cliente) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
                <div className="text-center">
                    <div className="p-4 rounded-full bg-red-100 mb-4 inline-block">
                        <User className="h-8 w-8 text-red-600" />
                    </div>
                    <Typography variant="h2" className="text-red-600 mb-2">
                        Cliente no encontrado
                    </Typography>
                    <Typography variant="body" className="mb-4">
                        No se pudo encontrar la información del cliente
                    </Typography>
                    <Button
                        variant="outline"
                        onClick={() => navigate(-1)}
                        className="border-brand-secondary/30"
                    >
                        Volver
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
            <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

                {/* HEADER */}
                <header className="space-y-4">
                    <div className="flex items-center gap-2">
                        {!isCliente && (<BackButton
                            variant="ghost"
                            size="sm"
                            to="/clientes-tables"
                            className="text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
                        />)}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-brand-primary/10">
                            <Building2 className="h-6 w-6 text-brand-primary" />
                        </div>
                        <div>
                            <Typography variant="h2" className="!text-brand-primary font-bold">
                                {nombreCliente}
                            </Typography>
                        </div>
                    </div>
                </header>

                {/* INFORMACIÓN DEL CLIENTE */}
                <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                        <Typography variant="h3" className="!text-brand-secondary font-semibold">
                            Información del cliente
                        </Typography>
                    </div>
                    <div className="p-4 md:p-5">
                        <ClienteInfoCard
                            cliente={cliente}
                            ejecutivos={ejecutivos}
                            usuarios={usuarios}
                            totalDeudores={deudoresActivos.length}
                        />

                        {canViewContratos && ultimoContrato && (
                            <>
                                <div className="border-t border-gray-200 mt-6 mb-4" />
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <ScrollText className="h-4 w-4 text-indigo-600 shrink-0" />
                                        <div className="min-w-0">
                                            <span className="text-sm text-gray-500">Último contrato · </span>
                                            <span className="text-sm font-semibold text-gray-800 truncate">
                                                {ultimoContrato.titulo}
                                            </span>
                                            <span className="text-sm text-gray-400"> · {formatFechaContrato(ultimoContrato.fecha)}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {ultimoContrato.archivos.length > 0 ? (
                                            ultimoContrato.archivos.map((a, i) => (
                                                <a
                                                    key={i}
                                                    href={a.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-100 transition-colors max-w-[180px]"
                                                >
                                                    <Download className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">{a.nombre}</span>
                                                </a>
                                            ))
                                        ) : (
                                            <button
                                                onClick={() => navigate(`/clientes/${cliente.id}/contratos`)}
                                                className="text-sm text-indigo-600 hover:underline"
                                            >
                                                Ver contrato
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </section>

                {/* DEUDORES ACTIVOS */}

                {/* ACCIONES RÁPIDAS */}
                <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                        <Typography variant="h3" className="!text-brand-secondary font-semibold">
                            Accesos rápidos
                        </Typography>
                    </div>

                    <div className="p-4 md:p-5">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {/* Tarjeta: Estado Mensual (solo para admin / ejecutivo / ejecutivoAdmin) */}
                            {canViewRecaudos && (
                                <button
                                    onClick={() => navigate("estado-mensual")}
                                    className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-6 text-left transition-all hover:border-brand-primary hover:shadow-lg hover:-translate-y-1"
                                >
                                    <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-brand-primary/5 transition-transform group-hover:scale-150" />
                                    <div className="relative">
                                        <div className="mb-4 inline-flex rounded-lg bg-brand-primary/10 p-3 transition-colors group-hover:bg-brand-primary/20">
                                            <DollarSign className="h-6 w-6 text-brand-primary" />
                                        </div>
                                        <Typography variant="h3" className="!text-brand-secondary mb-2">
                                            Recaudos y Deudas
                                        </Typography>
                                        <Typography variant="small" >
                                            Registra pagos y actualiza el estado mensual
                                        </Typography>
                                    </div>
                                </button>
                            )}

                            {/* Tarjeta: Ver Deudores */}
                            <button
                                onClick={() => navigate(`/deudores/${cliente.id}`)}
                                className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-6 text-left transition-all hover:border-blue-500 hover:shadow-lg hover:-translate-y-1"
                            >
                                <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-blue-500/5 transition-transform group-hover:scale-150" />
                                <div className="relative">
                                    <div className="mb-4 inline-flex rounded-lg bg-blue-500/10 p-3 transition-colors group-hover:bg-blue-500/20">
                                        <Users className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <Typography variant="h3" className="!text-brand-secondary mb-2">
                                        Ver Deudores
                                    </Typography>
                                    <Typography variant="small" >
                                        Gestiona la lista de deudores del cliente
                                    </Typography>
                                </div>
                            </button>

                            {/* Tarjeta: Valores Agregados */}
                            <button
                                onClick={() => navigate(`/valores-agregados/${cliente.id}`)}
                                className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-6 text-left transition-all hover:border-green-500 hover:shadow-lg hover:-translate-y-1"
                            >
                                <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-green-500/5 transition-transform group-hover:scale-150" />
                                <div className="relative">
                                    <div className="mb-4 inline-flex rounded-lg bg-green-500/10 p-3 transition-colors group-hover:bg-green-500/20">
                                        <TrendingUp className="h-6 w-6 text-green-600" />
                                    </div>
                                    <Typography variant="h3" className="!text-brand-secondary mb-2">
                                        Valores Agregados
                                    </Typography>
                                    <Typography variant="small" >
                                        Consulta valores adicionales y métricas
                                    </Typography>
                                </div>
                            </button>

                            {/* Tarjeta: Ver Reporte */}
                            <button
                                onClick={() => navigate(`/clientes/${cliente.id}/reporte`)}
                                className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-6 text-left transition-all hover:border-orange-500 hover:shadow-lg hover:-translate-y-1"
                            >
                                <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-orange-500/5 transition-transform group-hover:scale-150" />
                                <div className="relative">
                                    <div className="mb-4 inline-flex rounded-lg bg-orange-500/10 p-3 transition-colors group-hover:bg-orange-500/20">
                                        <FileText className="h-6 w-6 text-orange-600" />
                                    </div>
                                    <Typography variant="h3" className="!text-brand-secondary mb-2">
                                        Ver Reporte
                                    </Typography>
                                    <Typography variant="small" >
                                        Genera y descarga reportes detallados
                                    </Typography>
                                </div>
                            </button>
                            {/* Tarjeta: WhatsApp masivo (solo ejecutivo, ejecutivoadmin, admin) */}
                            {canViewWhatsappMasivo && (
                                <button
                                    onClick={() => navigate(`/clientes/${cliente.id}/enviar-whatsapp-masivo`)}
                                    className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-6 text-left transition-all hover:border-green-500 hover:shadow-lg hover:-translate-y-1"
                                >
                                    <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-green-500/5 transition-transform group-hover:scale-150" />
                                    <div className="relative">
                                        <div className="mb-4 inline-flex rounded-lg bg-green-500/10 p-3 transition-colors group-hover:bg-green-500/20">
                                            <MessageCircle className="h-6 w-6 text-green-600" />
                                        </div>
                                        <Typography variant="h3" className="!text-brand-secondary mb-2">
                                            WhatsApp Masivo
                                        </Typography>
                                        <Typography variant="small">
                                            Envía una plantilla a todos los deudores del cliente
                                        </Typography>
                                    </div>
                                </button>
                            )}

                            <button
                                onClick={() => navigate(`/clientes/${cliente.id}/seguimiento-conjunto`)}
                                className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-6 text-left transition-all hover:border-purple-500 hover:shadow-lg hover:-translate-y-1"
                            >
                                <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-purple-500/5 transition-transform group-hover:scale-150" />

                                <div className="relative">

                                    <div className="mb-4 inline-flex rounded-lg bg-purple-500/10 p-3 transition-colors group-hover:bg-purple-500/20">
                                        <MessageSquare className="h-6 w-6 text-purple-600" />
                                    </div>

                                    <Typography variant="h3" className="!text-brand-secondary mb-2">
                                        Seguimiento del Conjunto
                                    </Typography>

                                    <Typography variant="small">
                                        Observaciones generales del conjunto
                                    </Typography>

                                </div>
                            </button>

                            {/* Tarjeta: Contratos */}
                            {canViewContratos && (
                                <button
                                    onClick={() => navigate(`/clientes/${cliente.id}/contratos`)}
                                    className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-6 text-left transition-all hover:border-indigo-500 hover:shadow-lg hover:-translate-y-1"
                                >
                                    <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-indigo-500/5 transition-transform group-hover:scale-150" />
                                    <div className="relative">
                                        <div className="mb-4 inline-flex rounded-lg bg-indigo-500/10 p-3 transition-colors group-hover:bg-indigo-500/20">
                                            <ScrollText className="h-6 w-6 text-indigo-600" />
                                        </div>
                                        <Typography variant="h3" className="!text-brand-secondary mb-2">
                                            Contratos
                                        </Typography>
                                        <Typography variant="small">
                                            Consulta y gestiona los contratos del cliente
                                        </Typography>
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}