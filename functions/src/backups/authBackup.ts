import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

export const backupUsuariosAuth = onSchedule(
  {
    schedule: "0 2 * * 1", // Lunes a las 2 AM hora Bogotá
    timeZone: "America/Bogota",
    region: "us-central1",
  },
  async () => {
    const bucket = admin.storage().bucket("backup-gestionglobal");
    const fecha = new Date().toISOString().split("T")[0];

    const usuarios: admin.auth.UserRecord[] = [];
    let pageToken: string | undefined;

    do {
      const resultado = await admin.auth().listUsers(1000, pageToken);
      usuarios.push(...resultado.users);
      pageToken = resultado.pageToken;
    } while (pageToken);

    const datos = usuarios.map((u) => ({
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      phoneNumber: u.phoneNumber ?? null,
      disabled: u.disabled,
      customClaims: u.customClaims ?? null,
      creationTime: u.metadata.creationTime,
      lastSignInTime: u.metadata.lastSignInTime,
    }));

    await bucket.file(`auth/usuarios-${fecha}.json`).save(
      JSON.stringify(datos, null, 2),
      { contentType: "application/json" }
    );

    console.log(`Backup Auth completado: ${datos.length} usuarios → auth/usuarios-${fecha}.json`);
  }
);
