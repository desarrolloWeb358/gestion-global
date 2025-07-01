import { FcGoogle } from "react-icons/fc";
import { registroConCorreo, loginConGoogle } from "../services/authService";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface Signup {
  heading?: string;
  signupText?: string;
  googleText?: string;
  loginText?: string;
  loginUrl?: string;
}

const SignUp = ({
  googleText = "Crear cuenta con Google",
  signupText = "Crear cuenta",
  loginText = "¿Ya tienes cuenta?",
}: Signup) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registroConCorreo(email, password);
      navigate("/home");
    } catch (error: any) {
      alert("Error al registrarse: " + error.message);
    }
  };

  const handleGoogle = async () => {
    try {
      await loginConGoogle();
      navigate("/home");
    } catch (error) {
      alert("Error con Google: " + error);
    }
  };

  return (
    <section className="h-screen bg-muted">
      <div className="flex h-full items-center justify-center">
        <div className="flex w-full max-w-sm flex-col items-center gap-y-8 rounded-md border border-muted bg-white px-6 py-12 shadow-md">
          <div className="flex flex-col items-center gap-y-2">
            {/* Logo */}
            <div className="flex items-center justify-center lg:justify-start">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Crear cuenta
              </h1>
            </div>
          </div>
          <div className="flex w-full flex-col gap-8">
            <div className="flex flex-col gap-4">
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Input
                    type="email"
                    placeholder="Email"
                    required
                    className="bg-white"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <div className="flex flex-col gap-2">
                    <Input
                      type="password"
                      placeholder="Password"
                      required
                      className="bg-white"
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-4">
                    <Button type="submit" className="mt-2 w-full">
                      {signupText}
                    </Button>
                    <Button variant="outline" className="w-full" onClick={handleGoogle}>
                      <FcGoogle className="mr-2 size-5" />
                      {googleText}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
            <div className="flex justify-center gap-1 text-sm text-black">
              <p>{loginText}</p>
              <Link to="/signIn" className="underline underline-offset-4">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export { SignUp};
