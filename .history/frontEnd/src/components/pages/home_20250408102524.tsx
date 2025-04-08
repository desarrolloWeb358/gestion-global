// src/pages/Home.tsx
import React, { useEffect, useState } from "react";
import { contarClientes, contarUsuarios, contarInmuebles, contarDeudores } from "../../models/dashboard.model";

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
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <ul className="space-y-2">
        <li>Clientes: {totalClientes}</li>
        <li>Usuarios: {totalUsuarios}</li>
        <li>Inmuebles: {totalInmuebles}</li>
        <li>Deudores: {totalDeudores}</li>
      </ul>
    </div>
  );
}
