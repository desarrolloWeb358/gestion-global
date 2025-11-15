// src/modules/admin/components/AdminDashboardPage.tsx
"use client";

import React from "react";
import SeguimientoDashboardAdmin from "@/modules/reportes/components/SeguimientoDashboardAdmin";
import RecaudoDashboardAdmin from "@/modules/reportes/components/RecaudoDashboardAdmin";
import { Typography } from "@/shared/design-system/components/Typography";
import { LayoutDashboard, TrendingUp, Users, Activity, CalendarIcon } from "lucide-react";

export default function AdminDashboardPage() {
  const currentDate = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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

        {/* SECCIÓN DE MÉTRICAS RÁPIDAS (Opcional - puedes agregar stats cards aquí) 
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          
          <div className="rounded-xl border border-brand-secondary/20 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <Typography variant="small" className="text-muted-foreground">
                Hoy
              </Typography>
            </div>
            <Typography variant="h2" className="!text-brand-primary mb-1">
              --
            </Typography>
            <Typography variant="small" className="text-muted-foreground">
              Seguimientos activos
            </Typography>
          </div>

          
          <div className="rounded-xl border border-brand-secondary/20 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-green-100">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <Typography variant="small" className="text-muted-foreground">
                Mes actual
              </Typography>
            </div>
            <Typography variant="h2" className="!text-brand-primary mb-1">
              --
            </Typography>
            <Typography variant="small" className="text-muted-foreground">
              Gestiones completadas
            </Typography>
          </div>

          
          <div className="rounded-xl border border-brand-secondary/20 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <Typography variant="small" className="text-muted-foreground">
                Total
              </Typography>
            </div>
            <Typography variant="h2" className="!text-brand-primary mb-1">
              --
            </Typography>
            <Typography variant="small" className="text-muted-foreground">
              Ejecutivos activos
            </Typography>
          </div>

          
          <div className="rounded-xl border border-brand-secondary/20 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <LayoutDashboard className="h-5 w-5 text-orange-600" />
              </div>
              <Typography variant="small" className="text-muted-foreground">
                Total
              </Typography>
            </div>
            <Typography variant="h2" className="!text-brand-primary mb-1">
              --
            </Typography>
            <Typography variant="small" className="text-muted-foreground">
              Clientes registrados
            </Typography>
          </div>
        </section>

        */}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          
          

          
          

          
          <div className="rounded-xl border border-brand-secondary/20 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <Typography variant="small" className="text-muted-foreground">
                Total
              </Typography>
            </div>
            <Typography variant="h2" className="!text-brand-primary mb-1">
              --
            </Typography>
            <Typography variant="small" className="text-muted-foreground">
              Ejecutivos activos
            </Typography>
          </div>

          
          
        </section>

        {/* DASHBOARD PRINCIPAL */}
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