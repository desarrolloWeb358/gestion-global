import { useEffect, useState } from "react";
import PageMeta from "../../../shared/components/ui/PageMeta";

export default function DashboardEjecutivo() {
    const [totalClientes, setTotalClientes] = useState(0);
    const [totalInmuebles, setTotalInmuebles] = useState(0);
    const [totalRecaudos, setTotalRecaudos] = useState(0);

    useEffect(() => {
        const cargarDatos = async () => {
            // 🔽 Aquí puedes conectar servicios como contarClientesEjecutivo(usuario.uid), etc.
            setTotalClientes(3);
            setTotalInmuebles(12);
            setTotalRecaudos(5400000);
        };

        cargarDatos();
    }, []);

    return (
        <>
            <PageMeta
                title="Dashboard Administrador"
                description="Panel de control para ejecutivos: clientes, inmuebles y recaudos."
            />
            <div className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-800">Dashboard del Administrador</h1>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-white shadow rounded">
                        <p className="text-sm text-gray-500">Clientes asignados</p>
                        <p className="text-2xl font-bold text-blue-600">{totalClientes}</p>
                    </div>

                    <div className="p-4 bg-white shadow rounded">
                        <p className="text-sm text-gray-500">Inmuebles en cartera</p>
                        <p className="text-2xl font-bold text-green-600">{totalInmuebles}</p>
                    </div>

                    <div className="p-4 bg-white shadow rounded">
                        <p className="text-sm text-gray-500">Total recaudado</p>
                        <p className="text-2xl font-bold text-emerald-600">${totalRecaudos.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        </>
    );
}
