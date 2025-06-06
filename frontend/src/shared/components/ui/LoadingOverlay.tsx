// src/shared/components/ui/LoadingOverlay.tsx
import { CircularProgress, Box, Backdrop } from "@mui/material";
import { useLoading } from "../../../context/LoadingContext";

export default function LoadingOverlay() {
  const { isLoading } = useLoading();

  return (
    <Backdrop open={isLoading} sx={{ zIndex: 2000 }}>
      <Box display="flex" flexDirection="column" alignItems="center">
        <CircularProgress color="inherit" />
        <span style={{ marginTop: 16, color: "#fff" }}>Cargando...</span>
      </Box>
    </Backdrop>
  );
}
