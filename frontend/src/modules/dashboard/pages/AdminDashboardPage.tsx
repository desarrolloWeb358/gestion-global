// src/modules/admin/components/AdminDashboardPage.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SeguimientoDashboardAdmin from "@/modules/reportes/components/SeguimientoDashboardAdmin";
import RecaudoDashboardAdmin from "@/modules/reportes/components/RecaudoDashboardAdmin";
import { Typography } from "@/shared/design-system/components/Typography";
import {
  LayoutDashboard,
  Users,
  Activity,
  CalendarIcon,
} from "lucide-react";

// 🔥 Firebase
import { db } from "@/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const currentDate = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Solo manejamos clientes activos (contador)
  const [clientesActivos, setClientesActivos] = useState<number | null>(null);
  const [loadingClientes, setLoadingClientes] = useState<boolean>(true);

  useEffect(() => {
    const fetchClientesActivos = async () => {
      try {
        const ref = collection(db, "clientes");
        const qClientes = query(ref, where("activo", "==", true));
        const snap = await getDocs(qClientes);
        setClientesActivos(snap.size);
      } catch (error) {
        console.error("Error cargando clientes activos:", error);
        setClientesActivos(null);
      } finally {
        setLoadingClientes(false);
      }
    };

    fetchClientesActivos();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* HEADER */}
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow-lg">
              <LayoutDashboard className="h-7 w-7 text-white" />
            </div>
            <div>
              <Typography variant="h1" className="!text-brand-primary font-bold">
                Panel de Administración
              </Typography>
              <Typography variant="body" className="text-muted-foreground">
                {currentDate}
              </Typography>
            </div>
          </div>
        </header>

        {/* MÉTRICA RÁPIDA: CLIENTES ACTIVOS */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div
            className="rounded-xl border border-brand-secondary/20 bg-white p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => {
              // Ir a la tabla de clientes
              navigate("/clientes-tables");
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <Typography variant="small" className="text-muted-foreground">
                Total
              </Typography>
            </div>
            <Typography variant="h2" className="!text-brand-primary mb-1">
              {loadingClientes ? "..." : clientesActivos ?? 0}
            </Typography>
            <Typography variant="small" className="text-muted-foreground">
              Clientes activos
            </Typography>
          </div>
        </section>

        {/* DASHBOARD SEGUIMIENTOS */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Dashboard de Seguimientos
              </Typography>
            </div>
            <Typography variant="small" className="text-muted-foreground mt-1">
              Análisis detallado por ejecutivo y cliente
            </Typography>
          </div>

          <div className="p-4 md:p-5">
            <SeguimientoDashboardAdmin />
          </div>
        </section>

        {/* DASHBOARD RECAUDO */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-brand-primary" />
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Reporte de Recaudo Mensual
              </Typography>
            </div>
            <Typography variant="small" className="text-muted-foreground mt-1">
              Consolidado por mes de todos los conjuntos residenciales
            </Typography>
          </div>

          <div className="p-4 md:p-5">
            <RecaudoDashboardAdmin />
          </div>
        </section>
      </div>
    </div>
  );
}
