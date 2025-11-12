import { Globe } from "lucide-react";
import { LoginForm } from "@/modules/auth/components/Login-form";
import portadaImage from "@/assets/icons/images/GestionGlobalPortada.png";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* LEFT SIDE - Login Form */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        {/* Logo */}
        <div className="flex justify-center gap-2 md:justify-start">
          <a className="flex items-center gap-2 font-medium">
            <div className="bg-brand-primary text-white flex size-8 items-center justify-center rounded-lg">
              <Globe className="size-5" />
            </div>
            <span className="text-brand-secondary font-semibold">
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
      <div className="relative hidden lg:block bg-muted">
        <img
          src={portadaImage}
          alt="Gestión Global"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}