import { Globe } from "lucide-react";
import { LoginForm } from "@/modules/auth/components/Login-form";
import logo from "@/assets/brand/logo.png";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* LEFT SIDE - Login Form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Logo */}
        <div className="flex justify-center gap-2 md:justify-start">
          <a className="flex items-center gap-3">
            <img
              src={logo}
              alt="Gestión Global ACG"
              className="h-10 w-10 object-contain rounded-lg"
            />
            <span className="text-brand-secondary font-semibold text-lg">
              Gestión Global ACG SAS
            </span>
          </a>
        </div>

        {/* Form Container */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm space-y-6">
            <LoginForm />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - Image */}
      <div className="relative hidden lg:block bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <img
            src={logo}
            alt="Gestión Global"
            className="w-96 h-96 object-contain drop-shadow-2xl"
          />
        </div>
      </div>
    </div>
  );
}