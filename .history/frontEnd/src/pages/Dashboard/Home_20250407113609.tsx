// src/pages/Home.tsx
import { useEffect, useState } from "react";
import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import MonthlySalesChart from "../../components/ecommerce/MonthlySalesChart";
import PageMeta from "../../components/common/PageMeta";
import { contarClientes, contarUsuarios, contarInmuebles, contarDeudores } from "./models/dashboard.model";
import React from "react";

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
      <div className="grid grid-cols-6 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6 xl:col-span-7">
          <EcommerceMetrics totalClientes={totalClientes} totalUsuarios={totalUsuarios}   totalInmuebles={totalInmuebles} totalDeudores={totalDeudores} />
          <MonthlySalesChart />
        </div>
      </div>
    </>
  );
}
