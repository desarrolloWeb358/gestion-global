import { BrowserRouter, Routes, Route } from "react-router-dom";
import UsuarioCrudPage from "./common/pages/UsuarioCrudPage";
import LoginPage from "./common/auth/pages/LoginPage";
import RegisterPage from "./common/auth/pages/RegisterPage";
import AuthGuard from "./common/auth/components/AuthGuard";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import ConsultaPersonasPage from "./common/pages/ConsultaPersonasPage";

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
                <UsuarioCrudPage />
              </AuthGuard>
            }
          />
          <Route
            path="/consultarPersonas"
            element={
              <AuthGuard>
                <ConsultaPersonasPage />
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
