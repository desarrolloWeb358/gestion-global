import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./common/auth/pages/LoginPage";
import RegisterPage from "./common/auth/pages/RegisterPage";
import AuthGuard from "./common/auth/components/AuthGuard";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import ConsultaPersonasPage from "./common/pages/ConsultaPersonasPage";
import MainLayout from "./common/layouts/MainLayout";
import UsuarioSistemaCrudPage from "./cobranza/pages/UsuarioSistemaCrudPage";


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
                <UsuarioSistemaCrudPage />
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
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
