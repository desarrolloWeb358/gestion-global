import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@/firebase";

import { Cliente } from "../models/cliente.model";
import { ClienteInfoCard } from "../components/ClienteInfoCard";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";

import { Button } from "@/components/ui/button";

export default function ClienteDashboardPage() {
    const { clienteId } = useParams();
    const navigate = useNavigate();

    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [ejecutivos, setEjecutivos] = useState<UsuarioSistema[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const cargarDatos = async () => {
            if (!clienteId) return;

            const ref = doc(db, "clientes", clienteId);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                setCliente({ id: snap.id, ...snap.data() } as Cliente);
            }

            const usuarios = await obtenerUsuarios();
            const ejecutivosFiltrados = usuarios.filter(
                (u) => Array.isArray(u.roles) && u.roles.includes("ejecutivo")
            );
            setEjecutivos(ejecutivosFiltrados);

            setLoading(false);
        };

        cargarDatos();
    }, [clienteId]);

    if (!clienteId || loading) return <p className="p-4">Cargando información del cliente...</p>;
    if (!cliente) return <p className="p-4 text-red-600">Cliente no encontrado</p>;

    return (

        <div className="space-y-6 p-6">
            <Button variant="outline" onClick={() => navigate(-1)}>
                ← Volver
            </Button>

            <ClienteInfoCard cliente={cliente} ejecutivos={ejecutivos} usuarios={[]} />


            <div className="space-x-4 mt-4">
                <Button onClick={() => navigate("estado-mensual")}>
                    Ingresar Recaudos y Deudas
                </Button>
                <Button onClick={() => navigate(`/deudores/${cliente.id}`)}>
                    Ver Deudores
                </Button>
                <Button onClick={() => navigate(`/valores-agregados/${cliente.id}`)}>
                    Valores Agregados
                </Button>
                <Button onClick={() => navigate("envio-masivo")}>Enviar Mensaje Masivo</Button>

                <Button                    
                    onClick={() =>
                        navigate(`/clientes/${cliente.id}/reporte`)
                    }
                >
                    📊 Ver Reporte
                </Button>
            </div>
        </div>
    );
}
