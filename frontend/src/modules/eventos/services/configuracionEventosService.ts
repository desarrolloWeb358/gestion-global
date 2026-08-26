import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";

/**
 * Configuracion del modulo Calendario. Vive en el mismo sitio que los demas
 * catalogos internos (configuracion/tiposCaso, configuracion/etiquetasDemanda).
 * Se administra desde Ajustes > Agenda diaria.
 */
const RUTA_CONFIG = "configuracion/eventos";

/** A quien le llega el resumen diario. */
export type DestinatariosAgenda = "equipo" | "seleccion";

/** Cómo se ve la agenda en WhatsApp. */
export type FormatoWhatsapp = "texto" | "imagen";

export interface ConfigAgendaDiaria {
  /** Apaga o enciende el envio nocturno completo. */
  activa: boolean;
  /**
   * "equipo": a todo el personal interno activo.
   * "seleccion": solo a los usuarios de `destinatariosUids`.
   */
  destinatarios: DestinatariosAgenda;
  /** UIDs elegidos cuando `destinatarios` es "seleccion". */
  destinatariosUids: string[];
  canalEmail: boolean;
  canalWhatsapp: boolean;
  /**
   * "imagen" manda la agenda dibujada como PNG. Existe porque las plantillas de
   * Meta no aceptan saltos de línea y en texto todo queda en un solo renglón.
   */
  formatoWhatsapp: FormatoWhatsapp;
}

export interface ConfigEventos {
  /** Canal WhatsApp de los recordatorios de cada evento. */
  whatsappActivo: boolean;
  /** Documento de la coleccion `numbers` que se usa para enviar. */
  numberId: string | null;
  /** Plantilla de Meta para el recordatorio de un evento. */
  plantillaRecordatorio: string;
  /** Plantilla de Meta para el resumen diario en texto. */
  plantillaAgenda: string;
  /** Plantilla de Meta con encabezado de imagen. */
  plantillaAgendaImagen: string;
  agendaDiaria: ConfigAgendaDiaria;
}

export const CONFIG_EVENTOS_POR_DEFECTO: ConfigEventos = {
  whatsappActivo: false,
  numberId: null,
  plantillaRecordatorio: "recordatorio_reunion",
  plantillaAgenda: "agenda_diaria",
  plantillaAgendaImagen: "agenda_diaria_imagen",
  agendaDiaria: {
    activa: false,
    destinatarios: "equipo",
    destinatariosUids: [],
    canalEmail: true,
    canalWhatsapp: false,
    formatoWhatsapp: "imagen",
  },
};

/** Rellena lo que falte: el documento puede no existir o venir a medias. */
function normalizar(data: any): ConfigEventos {
  const agenda = data?.agendaDiaria ?? {};
  return {
    whatsappActivo: data?.whatsappActivo === true,
    numberId: data?.numberId ?? null,
    plantillaRecordatorio:
      data?.plantillaRecordatorio ?? CONFIG_EVENTOS_POR_DEFECTO.plantillaRecordatorio,
    plantillaAgenda: data?.plantillaAgenda ?? CONFIG_EVENTOS_POR_DEFECTO.plantillaAgenda,
    plantillaAgendaImagen:
      data?.plantillaAgendaImagen ?? CONFIG_EVENTOS_POR_DEFECTO.plantillaAgendaImagen,
    agendaDiaria: {
      activa: agenda.activa === true,
      destinatarios: agenda.destinatarios === "seleccion" ? "seleccion" : "equipo",
      destinatariosUids: Array.isArray(agenda.destinatariosUids)
        ? agenda.destinatariosUids
        : [],
      canalEmail: agenda.canalEmail !== false,
      canalWhatsapp: agenda.canalWhatsapp === true,
      formatoWhatsapp: agenda.formatoWhatsapp === "texto" ? "texto" : "imagen",
    },
  };
}

export async function obtenerConfigEventos(): Promise<ConfigEventos> {
  const snap = await getDoc(doc(db, RUTA_CONFIG));
  return normalizar(snap.exists() ? snap.data() : null);
}

export async function guardarConfigEventos(config: ConfigEventos): Promise<void> {
  await setDoc(doc(db, RUTA_CONFIG), config, { merge: true });
}
