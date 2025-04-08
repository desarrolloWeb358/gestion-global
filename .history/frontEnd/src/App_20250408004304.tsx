import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./components/auth/AuthPages/SignIn";
import SignUp from "./components/auth/AuthPages/SignUp";
import NotFound from "./components/pages/otherPages/notFound";
import UserProfiles from "./components/pages/UserProfile/userProfiles";
import Videos from "./components/ui/videos/Videos";
import Images from "./components/ui/images";
import Alerts from "./components/ui/alert/Alert";
import Badges from "./components/ui/badge/Badge";
import Avatars from "./components/ui/avatar/Avatar";
import Buttons from "./components/ui/button/Button";
import LineChart from "./components/charts/Charts/LineChart";
import BarChart from "./components/charts/Charts/BarChart";
import Calendar from "./components/pages/calendar/calendar";
import FormElements from "./components/features/form-elements/formElements";
import Blank from "./components/pages/otherPages/Blank";
import AppLayout from "./components/layout/AppLayout";
import { ScrollToTop } from "./components/ui/ScrollToTop";
import Home from "./components/pages/home";
import ResetPasswordForm from "./components/auth/AuthPages/ResetPasswordForm";
import ClientesCrud from "./components/pages/crud/clientesCrud";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout */}
          <Route element={<AppLayout />}>
            <Route index path="/dashboard" element={<Home />} />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/blank" element={<Blank />} />

            {/* Forms */}
            <Route path="/form-elements" element={<FormElements />} />

            {/* Tables */}
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/clientes-tables" element={<ClientesCrud />} />

            {/* Ui Elements */}
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/avatars" element={<Avatars />} />
            <Route path="/badge" element={<Badges />} />
            <Route path="/buttons" element={<Buttons />} />
            <Route path="/images" element={<Images />} />
            <Route path="/videos" element={<Videos />} />

            {/* Charts */}
            <Route path="/line-chart" element={<LineChart />} />
            <Route path="/bar-chart" element={<BarChart />} />
          </Route>

          {/* Auth Layout */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/register" element={<SignUp />} />
          <Route path="/login" element={<SignIn />} />
          <Route path="/reset-password" element={<ResetPasswordForm />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
