import { getAuth } from "firebase/auth";

export async function crearUsuarioDesdeAdmin(payload: any) {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();

  if (!token) throw new Error("No hay usuario autenticado.");

  const resp = await fetch(
    "https://us-central1-gestionglobal-9eac8.cloudfunctions.net/crearUsuarioDesdeAdmin",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error ?? "Error creando usuario");
  }

  return resp.json() as Promise<{ uid: string }>;
}