import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";

export default function AuthLayout() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <Outlet />
    </>
  );
}
