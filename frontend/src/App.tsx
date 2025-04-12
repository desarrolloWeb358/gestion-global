import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"; // ← Usa 'react-router-dom'
import SignIn from "./modules/auth/components/SignIn";
import SignUp from "./modules/auth/components/SignUp";
import NotFound from "./components/pages/otherPages/notFound";
import UserProfiles from "./components/pages/UserProfile/userProfiles";
import Videos from "./components/ui/videos/Videos";
import Images from "./components/ui/images";
import Alerts from "./components/ui/alert/alerts";
import Badges from "./components/ui/Badges";
import Avatars from "./components/ui/Avatars";
import Buttons from "./components/ui/Buttons";
import LineChart from "./modules/dashboard/components/LineChart";
import BarChart from "./modules/dashboard/components/BarChartOne";
import Calendar from "./components/pages/calendar/calendar";
import FormElements from "./shared/components/form-elements/formElements";
import Blank from "./components/pages/otherPages/Blank";
import AppLayout from "./shared/components/layout/AppLayout";
import { ScrollToTop } from "./components/ui/ScrollToTop";
import Home from "./components/pages/home";
import ClientesCrud from "./modules/cobranza/components/clientesCrud";
import UsuariosCrud from "./modules/usuarios/components/usuarioCrud";

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

        {/* Layout protegido */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Home />} />
          <Route path="/profile" element={<UserProfiles />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/blank" element={<Blank />} />
          <Route path="/form-elements" element={<FormElements />} />
          <Route path="/clientes-tables" element={<ClientesCrud />} />
          <Route path="/usuarios-tables" element={<UsuariosCrud />} />
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
