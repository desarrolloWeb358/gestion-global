import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Configuracion del modulo Tareas. Vive junto a los demas catalogos internos
 * (configuracion/eventos, configuracion/tiposCaso) pero en documento propio: el
 * recordatorio de tareas y la agenda del calendario se encienden, se apagan y
 * se configuran por separado.
 *
 * Se administra desde Ajustes > Tareas diarias y lo lee la Cloud Function
 * `tareasDiarias` (lunes a sabado, 8:00 a. m.).
 */
const RUTA_CONFIG = "configuracion/tareas";

/**
 * "conTareas": a cualquiera que tenga al menos una tarea abierta.
 * "seleccion": solo a los uids elegidos, y aun asi solo si tienen tareas.
 */
export type DestinatariosTareas = "conTareas" | "seleccion";

export interface ConfigTareasDiarias {
  /** Apaga o enciende el recordatorio completo. */
  activa: boolean;
  destinatarios: DestinatariosTareas;
  /** UIDs elegidos cuando `destinatarios` es "seleccion". */
  destinatariosUids: string[];
  canalEmail: boolean;
  canalWhatsapp: boolean;
}

export interface ConfigTareas {
  /** Interruptor maestro del canal WhatsApp de este modulo. */
  whatsappActivo: boolean;
  /** Documento de la coleccion `numbers` que se usa para enviar. */
  numberId: string | null;
  /** Plantilla de Meta. Parametros nombrados: nombre, descripcion. */
  plantillaTareas: string;
  tareasDiarias: ConfigTareasDiarias;
}

export const CONFIG_TAREAS_POR_DEFECTO: ConfigTareas = {
  whatsappActivo: false,
  numberId: null,
  plantillaTareas: "tareas_pendientes_diarias",
  tareasDiarias: {
    activa: false,
    destinatarios: "conTareas",
    destinatariosUids: [],
    canalEmail: true,
    canalWhatsapp: false,
  },
};

/** Rellena lo que falte: el documento puede no existir o venir a medias. */
function normalizar(data: any): ConfigTareas {
  const ajustes = data?.tareasDiarias ?? {};
  return {
    whatsappActivo: data?.whatsappActivo === true,
    numberId: data?.numberId ?? null,
    plantillaTareas: data?.plantillaTareas ?? CONFIG_TAREAS_POR_DEFECTO.plantillaTareas,
    tareasDiarias: {
      activa: ajustes.activa === true,
      destinatarios: ajustes.destinatarios === "seleccion" ? "seleccion" : "conTareas",
      destinatariosUids: Array.isArray(ajustes.destinatariosUids)
        ? ajustes.destinatariosUids
        : [],
      canalEmail: ajustes.canalEmail !== false,
      canalWhatsapp: ajustes.canalWhatsapp === true,
    },
  };
}

export async function obtenerConfigTareas(): Promise<ConfigTareas> {
  const snap = await getDoc(doc(db, RUTA_CONFIG));
  return normalizar(snap.exists() ? snap.data() : null);
}

export async function guardarConfigTareas(config: ConfigTareas): Promise<void> {
  await setDoc(doc(db, RUTA_CONFIG), config, { merge: true });
}
