import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Avatar,
  Box,
  Link,
  Checkbox,
  FormControlLabel,
  Stack
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CardContainer from "../../ui/CardContainer";
import SectionTitle from "../../ui/SectionTitle";
import InputField from "../../ui/InputField";
import ButtonPrimary from "../../ui/ButtonPrimary";
import { registroConCorreo } from "../services/authService";

const RegisterPage = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    receiveEmails: true
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registroConCorreo(form.email, form.password);
      navigate("/usuarios");
    } catch {
      alert("Error al registrar usuario");
    }
  };

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgcolor="#f5f5f5"
      p={2}
    >
      <CardContainer sx={{ maxWidth: 480, width: "100%" }}>
        <Box display="flex" flexDirection="column" alignItems="center" mb={3}>
          <Avatar sx={{ bgcolor: "secondary.main", width: 56, height: 56 }}>
            <LockOutlinedIcon fontSize="large" />
          </Avatar>
          <SectionTitle sx={{ mt: 1 }}>Registrarse</SectionTitle>
        </Box>

        <form onSubmit={handleSubmit} noValidate>
          <Stack spacing={2}>
            <Box display="flex" gap={2}>
              <InputField
                label="Nombre"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                fullWidth
              />
              <InputField
                label="Apellido"
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                fullWidth
              />
            </Box>

            <InputField
              label="Correo electrónico"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
            />

            <InputField
              label="Contraseña"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
            />

            <FormControlLabel
              control={
                <Checkbox
                  color="primary"
                  name="receiveEmails"
                  checked={form.receiveEmails}
                  onChange={handleChange}
                />
              }
              label="Quiero recibir noticias y promociones por correo electrónico."
            />

            <ButtonPrimary type="submit" fullWidth>
              Registrarse
            </ButtonPrimary>

            <Box textAlign="right">
              <Link href="/login" variant="body2">
                ¿Ya tienes una cuenta? Inicia sesión
              </Link>
            </Box>
          </Stack>
        </form>
      </CardContainer>
    </Box>
  );
};

export default RegisterPage;
