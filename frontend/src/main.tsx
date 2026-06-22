import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { LoadingProvider } from "@/app/providers/LoadingContext";
import { AuthProvider } from "@/app/providers/AuthContext";
import { UsuarioActualProvider } from "@/app/providers/UsuarioActualContext";
import { WaNumbersProvider } from "@/app/providers/WaNumbersContext";


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <UsuarioActualProvider>
        <WaNumbersProvider>
          <LoadingProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </LoadingProvider>
        </WaNumbersProvider>
      </UsuarioActualProvider>
    </AuthProvider>
  </StrictMode>
);
