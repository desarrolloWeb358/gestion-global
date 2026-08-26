import { ZONA_HORARIA } from "../constants/eventoConstants";

/** Timestamp de Firestore (o cualquier cosa con toDate) a Date. */
export function aFecha(valor: any): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor?.toDate === "function") return valor.toDate();
  return null;
}

/** "HH:mm" de una fecha, para los <input type="time">. */
export function aHoraInput(fecha: Date): string {
  const hh = String(fecha.getHours()).padStart(2, "0");
  const mm = String(fecha.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Pega la hora "HH:mm" sobre el dia de `fecha`, sin mutar el original. */
export function combinarFechaHora(fecha: Date, hora: string): Date {
  const [hh, mm] = hora.split(":").map((n) => Number.parseInt(n, 10));
  const resultado = new Date(fecha);
  resultado.setHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  return resultado;
}

/** Redondea hacia arriba al siguiente bloque de 30 minutos. */
export function proximaMediaHora(desde: Date = new Date()): Date {
  const d = new Date(desde);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30);
  return d;
}

export function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * 60_000);
}

export function formatoFechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString("es-CO", {
    timeZone: ZONA_HORARIA,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatoFechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString("es-CO", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatoHora(fecha: Date): string {
  return fecha.toLocaleTimeString("es-CO", {
    timeZone: ZONA_HORARIA,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * "lunes, 24 de agosto de 2026 · 9:00 a. m. - 10:00 a. m."
 * Con `tieneHoraFin` en false solo se muestra la hora de inicio: el `fin`
 * guardado es implícito y no se le prometió al usuario.
 */
export function formatoRangoEvento(
  inicio: Date,
  fin: Date,
  todoElDia: boolean,
  tieneHoraFin = true
): string {
  const mismoDia = inicio.toDateString() === fin.toDateString();

  if (todoElDia) {
    return mismoDia
      ? `${formatoFechaLarga(inicio)} · Todo el dia`
      : `${formatoFechaCorta(inicio)} - ${formatoFechaCorta(fin)} · Todo el dia`;
  }

  if (!tieneHoraFin) {
    return `${formatoFechaLarga(inicio)} · ${formatoHora(inicio)}`;
  }

  if (mismoDia) {
    return `${formatoFechaLarga(inicio)} · ${formatoHora(inicio)} - ${formatoHora(fin)}`;
  }

  return `${formatoFechaCorta(inicio)} ${formatoHora(inicio)} - ${formatoFechaCorta(fin)} ${formatoHora(fin)}`;
}

/** Texto corto de cuanto falta: "en 2 dias", "en 3 horas", "ya paso". */
export function tiempoRestante(inicio: Date): string {
  const diffMs = inicio.getTime() - Date.now();
  if (diffMs <= 0) return "Ya paso";

  const minutos = Math.round(diffMs / 60_000);
  if (minutos < 60) return `En ${minutos} minuto${minutos === 1 ? "" : "s"}`;

  const horas = Math.round(minutos / 60);
  if (horas < 24) return `En ${horas} hora${horas === 1 ? "" : "s"}`;

  const dias = Math.round(horas / 24);
  return `En ${dias} dia${dias === 1 ? "" : "s"}`;
}
