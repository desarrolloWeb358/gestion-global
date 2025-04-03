import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Stack,
  Avatar
} from "@mui/material";
import { Google } from "@mui/icons-material";
import { loginConCorreo, loginConGoogle } from "../services/authService";


const BRANDING = {
  logo: (
    <img
      src="https://mui.com/static/logo.svg"
      alt="MUI logo"
      style={{ height: 40 }}
    />
  ),
  title: 'Gestión Global',
};

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleCorreo = async () => {
    try {
      await loginConCorreo(email, password);
      navigate("/usuarios");
    } catch {
      alert("Error al iniciar sesión");
    }
  };

  const handleGoogle = async () => {
    try {
      await loginConGoogle();
      navigate("/usuarios");
    } catch {
      alert("Error al iniciar con Google");
    }
  };

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="#f4f6f8">
      <Paper elevation={3} sx={{ p: 4, width: 400 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>{BRANDING.logo}</Avatar>
          <Typography variant="h5" fontWeight={600}>
            {BRANDING.title}
          </Typography>
        </Stack>

        <Typography variant="h6" gutterBottom>Iniciar sesión</Typography>

        <TextField
          label="Correo"
          value={email}
          fullWidth
          margin="normal"
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Contraseña"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button variant="contained" fullWidth sx={{ mt: 2 }} onClick={handleCorreo}>
          Iniciar sesión
        </Button>

        <Button
          variant="outlined"
          startIcon={<Google />}
          fullWidth
          sx={{ mt: 2 }}
          onClick={handleGoogle}
        >
          Iniciar con Google
        </Button>

        <Typography variant="body2" align="center" sx={{ mt: 2 }}>
          ¿No tienes cuenta? <a href="/register">Regístrate</a>
        </Typography>
      </Paper>
    </Box>
  );
};

export default LoginPage;
