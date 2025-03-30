// src/common/auth/pages/RegisterPage.tsx
import { useState } from "react";
import { registroConCorreo } from "../services/authService";
import { useNavigate } from "react-router-dom";
import ButtonPrimary from "../../ui/ButtonPrimary";

const RegisterPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleRegister = async () => {
    try {
      await registroConCorreo(email, password);
      navigate("/usuarios");
    } catch (error) {
      alert("Error al registrar usuario");
    }
  };

  return (
    <div>
      <h2>Registro</h2>
      <input placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <ButtonPrimary onClick={handleRegister}>Registrarse</ButtonPrimary>
    </div>
  );
};

export default RegisterPage;
