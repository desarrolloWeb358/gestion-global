import { BrowserRouter, Routes, Route } from "react-router-dom";
import UsuarioCrudPage from "./common/pages/UsuarioCrudPage";
import LoginPage from "./common/auth/pages/LoginPage";
import RegisterPage from "./common/auth/pages/RegisterPage";
import AuthGuard from "./common/auth/components/AuthGuard";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import ConsultaPersonasPage from "./common/pages/ConsultaPersonasPage";
import MainLayout from "./common/layouts/MainLayout";
import ClienteCrudPage from "./cobranza/pages/ClienteCrudPage";
import InmuebleCrudPage from "./cobranza/pages/InmuebleCrudPage";

const theme = createTheme({
  palette: {
    primary: { main: "#1976d2" },
    secondary: { main: "#dc004e" }
  }
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route

            path="/usuarios"
            element={
              <AuthGuard>
                <MainLayout>
                  <UsuarioCrudPage />
                </MainLayout>
              </AuthGuard>
            }
          />
          <Route
            path="/consultarPersonas"
            element={
              <AuthGuard>
                <MainLayout>
                  <ConsultaPersonasPage />
                </MainLayout>

              </AuthGuard>
            }
          />

          <Route
            path="/clientes"
            element={
              <AuthGuard>
                <MainLayout>
                  <ClienteCrudPage />
                </MainLayout>
              </AuthGuard>
            }
          />

          <Route
            path="/inmuebles/:clienteId"
            element={
              <AuthGuard>
                <MainLayout>
                  <InmuebleCrudPage />
                </MainLayout>
              </AuthGuard>
            }
          />

          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
