// src/pages/Home.tsx
import React, { useEffect, useState } from "react";
import { contarClientes, contarUsuarios, contarInmuebles, contarDeudores } from "../../models/dashboard.model";
import PageMeta from "../ui/PageMeta";
export default function Home() {
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [totalInmuebles, setTotalInmuebles] = useState(0);
  const [totalDeudores, setTotalDeudores] = useState(0);

  useEffect(() => {
    const obtenerTotales = async () => {
      const clientes = await contarClientes();
      const usuarios = await contarUsuarios();
      const inmuebles = await contarInmuebles();
      const deudores = await contarDeudores();
      setTotalClientes(clientes);
      setTotalUsuarios(usuarios);
      setTotalInmuebles(inmuebles);
      setTotalDeudores(deudores);
    };

    obtenerTotales();
  }, []);

  return (
    <>
      <PageMeta
        title="Dashboard | Gestión Global"
        description="Panel principal de estadísticas de Gestión Global"
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6 xl:col-span-7">

            totalClientes={totalClientes}
            totalUsuarios={totalUsuarios}
            totalInmuebles={totalInmuebles}
            totalDeudores={totalDeudores}
    
        </div>

        <div className="col-span-12 xl:col-span-5">
        </div>

        <div className="col-span-12">

        </div>

        <div className="col-span-12 xl:col-span-5">
          <DemographicCard />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <RecentOrders />
        </div>
      </div>
    </>
  );
}
