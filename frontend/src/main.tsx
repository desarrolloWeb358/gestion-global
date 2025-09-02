
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App";
import { LoadingProvider } from "@/app/providers/LoadingContext";
import { BrowserRouter } from "react-router-dom";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
      <LoadingProvider>
            <BrowserRouter>
            <App />
            </BrowserRouter>
      </LoadingProvider>
  </StrictMode>
);

