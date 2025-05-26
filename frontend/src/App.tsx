import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"; // ← Usa 'react-router-dom'
import SignIn from "./modules/auth/components/SignIn";
import SignUp from "./modules/auth/components/SignUp";
import NotFound from "./shared/components/otherPages/notFound";
import UserProfiles from "./modules/usuarios/components/UserProfile/userProfiles";
import Videos from "./shared/components/ui/videos/Videos";
import Images from "./shared/components/ui/images";
import Alerts from "./shared/components/ui/alert/alerts";
import Badges from "./shared/components/ui/Badges";
import Avatars from "./shared/components/ui/Avatars";
import Buttons from "./shared/components/ui/Buttons";
import LineChart from "./modules/dashboard/components/LineChart";
import BarChart from "./modules/dashboard/components/BarChartOne";
import Calendar from "./shared/components/calendar/calendar";
import FormElements from "./shared/components/form-elements/formElements";
import Blank from "./shared/components/otherPages/Blank";
import AppLayout from "./shared/components/layout/AppLayout";
import { ScrollToTop } from "./shared/components/ui/ScrollToTop";
import Home from "./modules/usuarios/components/home";
import ClientesTable from "./modules/cobranza/components/ClientesTable";
import UsuariosTable from "./modules/usuarios/components/UsuariosTable";
import RedirectByRol from "./modules/auth/pages/RedirectByRol";
import DashboardAdmin from "./modules/dashboard/pages/DashboardAdmin";
import DashboardEjecutivo from "./modules/dashboard/pages/DashboardEjecutivo";
import DashboardCliente from "./modules/dashboard/pages/DashboardCliente";
import DashboardInmueble from "./modules/dashboard/pages/DashboardInmueble";
import ResetPasswordForm from "./modules/auth/components/ResetPasswordForm";
import InmueblesPage from "./modules/cobranza/components/inmueblesTable";
import InmuebleDetail from "./modules/cobranza/components/InmuebleDetail";
import SeguimientoTable from './modules/cobranza/components/SeguimientoTable';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";


export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Redirección inicial a SignIn */}
        <Route path="/" element={<Navigate to="/signin" replace />} />

        {/* Auth Routes */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPasswordForm />} />
        <Route path="/home" element={<RedirectByRol />} />

        {/* Layout protegido */}
        <Route element={<AppLayout />}>
          <Route path="/admin/dashboard" element={<DashboardAdmin />} />
          <Route path="/inmuebles/:clienteId/:inmuebleId/acuerdo" element={<InmuebleDetail />} />
          <Route path="/inmuebles/:clienteId/:inmuebleId/seguimiento" element={<SeguimientoTable />} />
          <Route path="/inmuebles/:clienteId" element={<InmueblesPage />} />
          <Route path="/ejecutivo/dashboard" element={<DashboardEjecutivo />} />
          <Route path="/cliente/dashboard" element={<DashboardCliente />} />
          <Route path="/inmueble/dashboard" element={<DashboardInmueble />} />
          <Route path="/profile" element={<UserProfiles />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/blank" element={<Blank />} />
          <Route path="/form-elements" element={<FormElements />} />
          <Route path="/clientes-tables" element={<ClientesTable />} />
          <Route path="/usuarios-tables" element={<UsuariosTable />} />
          <Route path="/inmuebles/:clienteId" element={<InmueblesPage />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/avatars" element={<Avatars />} />
          <Route path="/badge" element={<Badges />} />
          <Route path="/buttons" element={<Buttons />} />
          <Route path="/images" element={<Images />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/line-chart" element={<LineChart />} />
          <Route path="/bar-chart" element={<BarChart />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
