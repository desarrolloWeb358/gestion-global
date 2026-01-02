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
    Building2
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
    const { roles, loading: userLoading } = useUsuarioActual();
    const isCliente = roles?.includes("cliente");

    // Obtener nombre del cliente desde usuarios
    const nombreCliente = useMemo(() => {
        if (cliente?.nombre) return cliente.nombre;
        if (!clienteId) return "Cliente";

        const usuario = usuarios.find(u => u.uid === clienteId);
        return usuario?.nombre ?? usuario?.email ?? "Cliente";
    }, [cliente, clienteId, usuarios]);

    // Filtrar deudores activos (no INACTIVO)
    const deudoresActivos = useMemo(() => {
        return deudores.filter(d => d.tipificacion !== TipificacionDeuda.INACTIVO);
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
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}