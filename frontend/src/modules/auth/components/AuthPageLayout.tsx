import React from "react";
import ThemeTogglerTwo from "../../../shared/components/ui/ThemeTogglerTwo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-white z-1 dark:bg-gray-900 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row dark:bg-gray-900 sm:p-0">
        {children}
       <div className="hidden lg:flex w-full h-full lg:w-1/2 bg-white items-center justify-center">
  <img
    src="/images/logo/gestion_global.svg"  // Reemplaza por tu imagen real
    alt="Logo Gestión Global"
    className="max-w-[900px] w-full px-6"
  />
</div>
        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
