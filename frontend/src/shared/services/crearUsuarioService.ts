import { getAuth } from "firebase/auth";

export async function crearUsuarioDesdeAdmin(payload: any) {
  console.log("PAYLOAD crearUsuarioDesdeAdmin:", payload);
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("No hay usuario autenticado.");

  const token = await user.getIdToken(true);

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

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    throw new Error(json?.error ?? `Error creando usuario (${resp.status})`);
  }

  return json as { uid: string };
}