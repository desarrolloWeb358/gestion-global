
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App.tsx";
import { AppWrapper } from "./shared/components/ui/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { LoadingProvider } from "./context/LoadingContext";
import LoadingOverlay from "./shared/components/ui/LoadingOverlay";


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <LoadingProvider>
        <AppWrapper>
          <App />
          <LoadingOverlay />
        </AppWrapper>
      </LoadingProvider>
    </ThemeProvider>
  </StrictMode>,
);
