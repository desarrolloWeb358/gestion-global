import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Label from "../../../shared/components/form/Label";
import Input from "../../../shared/components/form/input/InputField";
import Button from "../../../components/ui/button/Button";
import { resetPassword } from "../../../services/authService";
import React from "react";

export default function ResetPasswordForm() {
  const [email, setEmail] = useState<string>("");
  const [sent, setSent] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const handleResetPassword = async () => {
    try {
      await resetPassword(email);
      setSent(true);
      setError(null);
    } catch (err) {
      setError("Hubo un error al enviar el correo. Verifica que el correo esté registrado.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white">
            Restablecer contraseña
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Ingresa tu correo y te enviaremos un enlace para restablecerla.
          </p>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          <div>
            <Label>
              Correo electrónico <span className="text-error-500">*</span>
            </Label>
            <Input
              placeholder="info@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}

          {sent ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              ¡Correo enviado! Revisa tu bandeja de entrada.
            </p>
          ) : (
            <Button className="w-full" size="sm" onClick={handleResetPassword}>
              Enviar enlace
            </Button>
          )}

          <div className="text-sm text-center text-gray-600 dark:text-gray-400">
            <a
              onClick={() => navigate("/signin")}
              className="cursor-pointer text-brand-500 hover:underline"
            >
              Volver al inicio de sesión
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
