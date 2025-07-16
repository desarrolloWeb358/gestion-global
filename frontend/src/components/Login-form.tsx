import { cn } from "../lib/utils"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Spinner } from "./ui/spinner"
import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { loginConCorreo, loginConGoogle } from "../services/authService";
export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true)
    try {
      await loginConCorreo(email.trim(), password);
      navigate("/home"); // Cambia por la ruta deseada
    } catch (error: any) {
      alert("Correo o contraseña incorrectos");
      console.error(error);
    } finally {
      setLoading(false)
    }
  };

  const handleLoginGoogle = async () => {
    setLoading(true);
    try {
      await loginConGoogle();
      navigate("/home");
    } catch (error) {
      alert("Error al iniciar sesión con Google");
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={handleLogin} className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Ingresar</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Ingresa tu correo y contraseña para iniciar sesión
        </p>
      </div>
      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="m@example.com" value={email}
            onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="grid gap-3">
          <div className="flex items-center">
            <Label htmlFor="password">Contraseña</Label>
            <Link to="/forgot-password" className="ml-auto text-sm underline underline-offset-4 hover:underline">
              Olvidaste tu contraseña?
            </Link>
          </div>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? <Spinner className="h-5 w-5" /> : "Ingresar"}
        </Button>
        <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
          <span className="bg-background text-muted-foreground relative z-10 px-2">
            Continuar con
          </span>
        </div>
        <Button onClick={handleLoginGoogle} disabled={loading} variant="outline" className="w-full">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_9914_10)">
              <path d="M19.805 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.5a4.72 4.72 0 01-2.05 3.1v2.57h3.32c1.95-1.8 3.04-4.45 3.04-7.48z" fill="#4285F4" />
              <path d="M10 20c2.7 0 4.97-.89 6.63-2.41l-3.32-2.57c-.92.62-2.1.98-3.31.98-2.55 0-4.7-1.72-5.47-4.05H1.08v2.6A9.994 9.994 0 0010 20z" fill="#34A853" />
              <path d="M4.53 11.95a5.99 5.99 0 010-3.9v-2.6H1.08a10.007 10.007 0 000 9.1l3.45-2.6z" fill="#FBBC05" />
              <path d="M10 3.96c1.47 0 2.79.51 3.82 1.52l2.86-2.86C15.05.98 12.78 0 10 0A9.994 9.994 0 001.08 5.45l3.45 2.6C5.3 5.68 7.45 3.96 10 3.96z" fill="#EA4335" />
            </g>
            <defs>
              <clipPath id="clip0_9914_10">
                <path fill="#fff" d="M0 0h20v20H0z" />
              </clipPath>
            </defs>
          </svg>
          Ingresar con Google
        </Button>
      </div>
      <div className="text-center text-sm">
        No tienes cuenta{" "}
        <Link to="/sign-up" className="underline underline-offset-4">
          Sign up
        </Link>
      </div>
    </form>
  )
}
