// src/modules/admin/components/AdminDashboardPage.tsx
"use client";

import React from "react";
import SeguimientoDashboardAdmin from "@/modules/reportes/components/SeguimientoDashboardAdmin";

export default function AdminDashboardPage() {
  return (
    <div className="p-4 space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-semibold">Hola, Administrador</h1>
        <p className="text-muted-foreground text-sm">
          Bienvenido al panel de administración.
        </p>
      </div>

      {/* Dashboard de seguimientos por ejecutivo / por cliente */}
      <SeguimientoDashboardAdmin />
    </div>
  );
}
