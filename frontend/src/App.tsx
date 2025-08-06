import { Routes, Route, Navigate } from "react-router-dom";// ← Usa 'react-router-dom'
import SignIn from "./modules/auth/components/SignIn"; // Ya esta con shadcn
import SignUp from "./modules/auth/components/SignUp"; // Ya esta con shadcn
import ClientesTable from "./modules/cobranza/components/ClientesTable";
import UsuariosTable from "./modules/usuarios/components/UsuariosTable";
import RedirectByRol from "./modules/auth/pages/RedirectByRol";
import DashboardAdmin from "../src/components/dashboard/dashboardPage"; // Ya esta con shadcn
import ResetPasswordForm from "./components/forgot-password";
import InmueblesTable from "./modules/cobranza/components/DeudoresTable";
import InmuebleDetailTabsWrapper from "./modules/cobranza/components/DeudoresDetail";
import SeguimientoTable from './modules/cobranza/components/SeguimientoTable';
import ConsultaPersonasPage from './modules/cobranza/components/ConsultarPersonasPage';
import ProbarNotificacionesPage from './modules/cobranza/components/ProbarNotificacionesPage';
import AppLayout from "./components/layout/AppLayout";
import ScrollToTop from "./components/layout/ScrollToTop";
import DeudorDetailPage from "./modules/cobranza/components/DeudorDetailPage";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import EstadosMensualesTable from "./modules/cobranza/components/EstadosMensualesTable";



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
          <Route path="/admin/dashboard" element={<DashboardAdmin />} />
          <Route path="/deudores/:clienteId/:deudorId/acuerdo" element={<InmuebleDetailTabsWrapper />} />
          <Route path="/deudores/:clienteId/:deudorId/seguimiento" element={<SeguimientoTable />} />
          <Route path="/clientes/:clienteId/deudores/:deudorId" element={<DeudorDetailPage />} />
          <Route
            path="/deudores/:clienteId/:deudorId/estadosMensuales"
            element={<EstadosMensualesTable />}
          />
          <Route path="/clientes-tables" element={<ClientesTable />} />
          <Route path="/usuarios-tables" element={<UsuariosTable />} />
          <Route path="/deudores/:clienteId" element={<InmueblesTable />} />
          <Route path="/consulta-personas" element={<ConsultaPersonasPage />} />
          <Route path="/probar-notificaciones" element={<ProbarNotificacionesPage />} />
        </Route>
        {/* 404 */}

      </Routes>
    </>
  );
}
