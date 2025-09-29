import { Routes, Route, Navigate } from "react-router-dom";// ← Usa 'react-router-dom'
import SignIn from "./modules/auth/components/SignIn"; // Ya esta con shadcn
import SignUp from "./modules/auth/components/SignUp"; // Ya esta con shadcn
import ClientesTable from "@/modules/clientes/components/ClientesTable";
import ClientePage from "@/modules/clientes/components/ClientePage";
import UsuariosTable from "./modules/usuarios/components/UsuariosTable";
import RedirectByRol from "./modules/auth/pages/RedirectByRol";
import ResetPasswordForm from "@/modules/auth/components/forgot-password";
import DeudoresTable from "./modules/cobranza/components/DeudoresTable";
import SeguimientoTable from './modules/cobranza/components/SeguimientoTable';
import ConsultaPersonasPage from './modules/cobranza/components/ConsultarPersonasPage';
import ProbarNotificacionesPage from './modules/cobranza/components/ProbarNotificacionesPage';
import AppLayout from "@/app/layout/AppLayout";
import ScrollToTop from "@/app/layout/ScrollToTop";
import DeudorDetailPage from "./modules/cobranza/components/DeudorDetailPage";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import EstadosMensualesTable from "./modules/cobranza/components/EstadosMensualesTable";
import EstadosMensualesInputMasivo from "./modules/cobranza/components/EstadosMensualesInputMasivo";
import ReporteClientePage from "./modules/cobranza/components/reportes/ReporteClientePage";

/// valores agregados
import ValorAgregadoDetailPage from "./modules/valoresAgregados/components/ValorAgregadoDetailPage";
import ValoresAgregadosTable from "./modules/valoresAgregados/components/ValoresAgregadosTable";

// Dashboards
import AdminDashboardPage from "@/modules/dashboard/pages/AdminDashboardPage";
import EjecutivoDashboardPage from "@/modules/dashboard/pages/EjecutivoDashboardPage";
import AbogadoDashboardPage from "@/modules/dashboard/pages/AbogadoDashboardPage";
import ClienteDashboardPage from "@/modules/dashboard/pages/ClienteDashboardPage";
import DeudorDashboardPage from "@/modules/dashboard/pages/DeudorDashboardPage";
import { DemandaInfoPage } from "./modules/cobranza/components/DemandaInfoPage";


export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Redirección inicial a SignIn */}
        <Route path="/" element={<Navigate to="/signin" replace />} />

        {/* Auth Routes */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/forgot-password" element={<ResetPasswordForm />} />
        <Route path="/home" element={<RedirectByRol />} />

        {/* Layout protegido */}
        <Route element={<AppLayout />}>
          <Route path="/deudores/:clienteId/:deudorId/seguimiento" element={<SeguimientoTable />} />
          <Route path="/clientes/:clienteId/deudores/:deudorId" element={<DeudorDetailPage />} />
          <Route path="/deudores/:clienteId/:deudorId/estadosMensuales" element={<EstadosMensualesTable />} />
          <Route path="/clientes/:clienteId" element={<ClientePage />} />
          <Route path="/clientes/:clienteId/estado-mensual" element={<EstadosMensualesInputMasivo />} />
          <Route path="/clientes-tables" element={<ClientesTable />} />
          <Route path="/usuarios-tables" element={<UsuariosTable />} />
          <Route path="/deudores/:clienteId" element={<DeudoresTable />} />
          <Route path="/consulta-personas" element={<ConsultaPersonasPage />} />
          <Route path="/probar-notificaciones" element={<ProbarNotificacionesPage />} />
          <Route path="/clientes/:clienteId/reporte" element={<ReporteClientePage />} />
          <Route path="/clientes/:clienteId/deudores/:deudorId/demanda" element={<DemandaInfoPage />} />
          {/* valores agregados */}
          <Route path="/valores-agregados/:clienteId" element={<ValoresAgregadosTable />} />
          <Route path="/clientes/:clienteId/valores-agregados/:valorId" element={<ValorAgregadoDetailPage />} />

          {/* Dashboards por rol */}
          <Route path="/dashboard/admin" element={<AdminDashboardPage />} />
          <Route path="/dashboard/ejecutivo" element={<EjecutivoDashboardPage />} />
          <Route path="/dashboard/abogado" element={<AbogadoDashboardPage />} />
          <Route path="/dashboard/cliente" element={<ClienteDashboardPage />} />
          <Route path="/dashboard/deudor" element={<DeudorDashboardPage />} />
            

        </Route>
        {/* 404 */}

      </Routes>
    </>
  );
}
