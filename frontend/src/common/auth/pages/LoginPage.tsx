// src/common/auth/pages/LoginPage.tsx
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { loginConCorreo, loginConGoogle } from "../services/authService";
import ButtonPrimary from "../../ui/ButtonPrimary";
import InputField from "../../ui/InputField";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleCorreo = async () => {
    try {
      await loginConCorreo(email, password);
      navigate("/usuarios");
    } catch (error) {
      alert("Error al iniciar sesión");
    }
  };

  const handleGoogle = async () => {
    try {
      await loginConGoogle();
      navigate("/usuarios");
    } catch (error) {
      alert("Error al iniciar con Google");
    }
  };

  return (
    <div>
      <h2>Login</h2>
      
      <InputField
  label="Correo"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
      
      <InputField
  label="Contraseña"
  type="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>
      <ButtonPrimary onClick={handleCorreo}>Iniciar sesión</ButtonPrimary>
      <ButtonPrimary onClick={handleGoogle}>Iniciar con Google</ButtonPrimary>
      <p>¿No tienes cuenta? <a href="/register">Regístrate</a></p>
    </div>
  );
};

export default LoginPage;
