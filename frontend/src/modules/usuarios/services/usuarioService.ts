// src/modules/usuarios/services/usuarioService.ts
import { db, auth } from "../../../firebase";
import { registrarEliminacion } from "@/shared/services/auditLog/auditLogService";
import {
  collection,
  doc,
  getDoc,          // ⬅️ añadido
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,           // ⬅️ opcional (para búsqueda por documento)
  where,           // ⬅️ opcional (para búsqueda por documento)
} from "firebase/firestore";
import { UsuarioSistema } from "../models/usuarioSistema.model";
import { Cliente } from "@/modules/clientes/models/cliente.model";
import { crearUsuarioDesdeAdmin } from "@/shared/services/crearUsuarioService";
import { enviarEmail } from "@/modules/notificaciones/services/notificacionService";
/* ============================================
   Utilidad: elimina claves con undefined
   ============================================ */
const sanitize = <T extends Record<string, any>>(obj: T) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;


// 👇 helper interno
const mapDocToUsuario = (d: any): UsuarioSistema =>
({
  uid: d.id,
  ...d.data(),
} as UsuarioSistema);

/* ============================================
   Obtener TODOS los usuarios
   ============================================ */
export const obtenerUsuarios = async (): Promise<UsuarioSistema[]> => {
  const snapshot = await getDocs(collection(db, "usuarios"));
  return snapshot.docs.map(mapDocToUsuario);
};

/* ============================================
   Obtener usuarios por rol (ejecutivo, abogado, etc.)
   ============================================ */
export const obtenerUsuariosPorRol = async (rol: string): Promise<UsuarioSistema[]> => {
  const q = query(
    collection(db, "usuarios"),
    where("roles", "array-contains", rol)
  );
  const snap = await getDocs(q);
  return snap.docs.map(mapDocToUsuario);
};

/* Helpers específicos (azúcar sintáctico) */
export const obtenerEjecutivos = () => obtenerUsuariosPorRol("ejecutivo");
export const obtenerAbogados = () => obtenerUsuariosPorRol("abogado");
export const obtenerDependientes = () => obtenerUsuariosPorRol("dependiente");



export const getUsuarioByUid = async (uid: string): Promise<UsuarioSistema | null> => {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<UsuarioSistema, "uid">) };
};

export const getUsuarioByDocumento = async (
  tipoDocumento: UsuarioSistema["tipoDocumento"],
  numeroDocumento: string
): Promise<UsuarioSistema | null> => {
  const q = query(
    collection(db, "usuarios"),
    where("tipoDocumento", "==", tipoDocumento),
    where("numeroDocumento", "==", numeroDocumento)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...(d.data() as Omit<UsuarioSistema, "uid">) };
};

/* ============================================
   Crear usuario (Auth + Firestore) y, si aplica, crear cliente
   ============================================ */
/* ============================================
   Crear usuario (Auth por Admin + Firestore) y, si aplica, crear cliente
   ============================================ */
export const crearUsuario = async (
  usuario: UsuarioSistema & { password: string }
): Promise<string> => {
  // 1) Crear en Auth desde Admin (NO cambia sesión)
  const { uid } = await crearUsuarioDesdeAdmin({
    email: usuario.email,
    password: usuario.password,
    nombre: usuario.nombre ?? "",
    roles: Array.isArray(usuario.roles) ? usuario.roles : [],
    activo: usuario.activo ?? true,
    telefonoUsuario: usuario.telefonoUsuario ?? "",
    tipoDocumento: usuario.tipoDocumento ?? null,
    numeroDocumento: usuario.numeroDocumento ?? "",
    // opcional:
    // fecha_registro: new Date().toISOString(),
  });

  const roles = Array.isArray(usuario.roles) ? usuario.roles : [];

  // 2) Guardar perfil en Firestore (si tu function NO lo guarda)
  const usuarioFirestore: UsuarioSistema = {
    uid,
    email: usuario.email,
    nombre: usuario.nombre ?? "",
    telefonoUsuario: usuario.telefonoUsuario,
    tipoDocumento: usuario.tipoDocumento,
    numeroDocumento: usuario.numeroDocumento,
    roles,
    activo: usuario.activo ?? true,
    fecha_registro: serverTimestamp(),
  };

  await setDoc(doc(db, "usuarios", uid), usuarioFirestore, { merge: true });

  // 3) Si también es cliente, creamos el doc en "clientes" y enviamos bienvenida
  if (roles.includes("cliente" as any)) {
    const clienteData: Cliente = {
      id: uid,
      direccion: "",
      formaPago: "",
      nombre: usuario.nombre ?? "",
      ejecutivoPrejuridicoId: null as any,
      ejecutivoJuridicoId: null as any,
      ejecutivoDependienteId: null as any,
      abogadoId: null as any,
      activo: true as any,
    };

    await setDoc(doc(db, "clientes", uid), clienteData, { merge: true });

    // Correo de bienvenida con credenciales (no bloquea si falla)
    enviarEmail({
      nombreDestino: usuario.nombre ?? "Cliente",
      correoDestino: usuario.email,
      subject: "Bienvenido a GESGLO – Tus datos de acceso",
      titulo: "¡Bienvenido a GESGLO!",
      cuerpoHtml: `
        <p>Nos complace contarte que tu cuenta en <strong>GESGLO</strong>, la plataforma de gestión de cartera de <strong>Gestión Global ACG SAS</strong>, ya está lista.</p>

        <h3 style="margin-top:20px;margin-bottom:8px;font-size:15px;color:#111827;">🚀 ¿Qué puedes hacer en GESGLO?</h3>
        <ul style="margin:0 0 16px;padding-left:18px;color:#374151;">
          <li>Consultar el estado de tu cartera en tiempo real</li>
          <li>Revisar acuerdos de pago y recaudos</li>
          <li>Ver el seguimiento de las gestiones realizadas (llamadas, correos, visitas, procesos jurídicos)</li>
          <li>Acceder a informes actualizados de tu conjunto</li>
        </ul>

        <h3 style="margin-top:20px;margin-bottom:8px;font-size:15px;color:#111827;">🔑 Tus datos de acceso</h3>
        <p>Ingresa desde el siguiente enlace:</p>
        <p>👉 <a href="https://www.gestionglobalacg.com" style="color:#2563eb;text-decoration:none;font-weight:600;" target="_blank">https://www.gestionglobalacg.com</a></p>

        <table cellpadding="0" cellspacing="0" style="margin-top:8px;margin-bottom:16px;background:#f9fafb;padding:12px;border-radius:6px;width:100%;font-size:14px;color:#374151;">
          <tr><td style="padding:4px 0;"><strong>Usuario:</strong></td><td style="padding:4px 0;">${usuario.email}</td></tr>
          <tr><td style="padding:4px 0;"><strong>Contraseña:</strong></td><td style="padding:4px 0;">${usuario.password}</td></tr>
        </table>

        <p>Si tienes alguna duda o necesitas ayuda para ingresar, no dudes en contactarnos.</p>
        <p style="margin-top:20px;">
          Cordialmente,<br/>
          <strong>Equipo Gestión Global A.C.G.</strong><br/>
          Área de Tecnología y Transformación Digital<br/>
          📧 gestionglobalacg@gestionglobalacg.com<br/>
          📞 (601) 4631148 · 57 316 6936088
        </p>
      `,
    }).catch((err) => console.error("[bienvenida cliente] Error enviando correo:", err));
  }

  return uid;
};



/* ============================================
   Actualizar usuario
   ============================================ */
export const actualizarUsuario = async (usuario: UsuarioSistema): Promise<void> => {
  if (!usuario.uid) throw new Error("El UID del usuario es obligatorio");

  const usuarioRef = doc(db, "usuarios", usuario.uid);

  const updateUsuario = sanitize({
    nombre: usuario.nombre,
    // email: NO aquí (se cambia solo por flujo especial)
    telefonoUsuario: usuario.telefonoUsuario,
    tipoDocumento: usuario.tipoDocumento,
    numeroDocumento: usuario.numeroDocumento,
    roles: usuario.roles,
    activo: usuario.activo ?? true,
    fecha_actualizacion: serverTimestamp(),
  });

  // 1) actualiza usuarios/{uid}
  await updateDoc(usuarioRef, updateUsuario as any);

  // 2) si es cliente, sincroniza clientes/{uid}.nombre y activo
  const roles = (usuario.roles ?? []) as string[];
  if (roles.includes("cliente")) {
    const clienteRef = doc(db, "clientes", usuario.uid);
    await setDoc(
      clienteRef,
      {
        nombre: usuario.nombre ?? "",
        activo: usuario.activo ?? true,
      },
      { merge: true }
    );
  }
};


/* ============================================
   Toggle activo: sincroniza usuarios + clientes (si aplica)
   ============================================ */
export const toggleActivoUsuario = async (
  uid: string,
  roles: string[],
  activo: boolean
): Promise<void> => {
  await updateDoc(doc(db, "usuarios", uid), { activo });

  if (roles.includes("cliente")) {
    await setDoc(doc(db, "clientes", uid), { activo }, { merge: true });
  }
};

/* ============================================
   Eliminar usuario
   ============================================ */
export const eliminarUsuario = async (uid: string): Promise<void> => {
  const ref = doc(db, "usuarios", uid);
  await deleteDoc(ref);
  await registrarEliminacion({
    modulo: "usuario",
    descripcion: `Usuario eliminado - UID: ${uid}`,
    coleccionPath: "usuarios",
  });
};
