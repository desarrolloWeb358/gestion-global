// src/modules/auth/utils/authErrors.ts
type AuthErrorLike = { code?: string; message?: string };

/**
 * Si secure=true: no revela si existe o no el correo (mejor seguridad).
 * Si secure=false: mensajes diferenciados (mejor UX interna).
 */

 export function normalizeAuthError(code?: string): string {
  const map: Record<string, string> = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/user-not-found": "No existe una cuenta con este correo.",
    "auth/invalid-email": "Correo inválido.",
    "auth/user-disabled": "Usuario deshabilitado.",
    "auth/too-many-requests": "Demasiados intentos. Inténtalo más tarde.",
    "auth/network-request-failed": "Problema de conexión. Verifica tu internet.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/popup-closed-by-user": "Se cerró la ventana antes de terminar.",
    "auth/cancelled-popup-request": "Se canceló la ventana emergente.",
    "auth/popup-blocked": "El navegador bloqueó la ventana emergente.",
    default: "No se pudo completar la operación.",
  };
  return map[code ?? "default"] ?? map.default;
}

export function getAuthErrorMessage(
  error: AuthErrorLike,
  opts?: { secure?: boolean }
) {
  const code = error?.code ?? "";
  const secure = opts?.secure ?? false;

  // Modo seguro: unifica user-not-found y wrong-password
  if (secure && (code === "auth/user-not-found" || code === "auth/wrong-password")) {
    return "Correo o contraseña incorrectos.";
  }

  switch (code) {
    case "auth/user-not-found":
      return "No existe una cuenta registrada con este correo.";
    case "auth/wrong-password":
      return "La contraseña ingresada es incorrecta.";
    case "auth/invalid-email":
      return "El correo electrónico no tiene un formato válido.";
    case "auth/user-disabled":
      return "Este usuario está deshabilitado. Contacta al administrador.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Intenta de nuevo más tarde.";
    case "auth/network-request-failed":
      return "Error de conexión. Verifica tu internet e intenta de nuevo.";
    case "auth/invalid-credential":
      // Firebase (versiones nuevas) suele usar este en vez de wrong-password/user-not-found
      return secure ? "Correo o contraseña incorrectos." : "Credenciales inválidas. Verifica correo y contraseña.";
    case "auth/popup-closed-by-user":
      return "Cerraste la ventana de Google. Intenta nuevamente.";
    case "auth/cancelled-popup-request":
      return "Ya hay una ventana emergente abierta. Cierra e intenta otra vez.";
    case "auth/popup-blocked":
      return "El navegador bloqueó la ventana emergente. Habilita pop-ups e intenta de nuevo.";
    default:
      return "Error al iniciar sesión. Verifica tus datos e intenta nuevamente.";
  }
}
