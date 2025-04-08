// src/pages/Home.tsx
import React from "react";
import { useEffect, useState } from "react";
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

}
