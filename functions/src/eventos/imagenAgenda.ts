// Dibuja la agenda del dia como PNG.
//
// Existe porque las plantillas de Meta no aceptan saltos de linea dentro de un
// parametro: por WhatsApp el listado quedaba todo en un renglon. Una plantilla
// con encabezado de tipo IMAGEN si permite mandar el diseno armado por nosotros,
// y ademas funciona fuera de la ventana de 24 horas.
//
// No se empaqueta ninguna tipografia: se usa la generica del contenedor. Si no
// hubiera ninguna disponible, `hayTipografia()` avisa y quien llama vuelve al
// mensaje de texto en vez de mandar una imagen ilegible.

import * as path from "path";
import * as fs from "fs";
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import * as logger from "firebase-functions/logger";
import type { EventoAgenda } from "./agendaDiaria";

// ── Lienzo ────────────────────────────────────────────────────────────
const ANCHO = 1080;
const MARGEN = 56;
const ALTO_CABECERA = 200;
const ALTO_TARJETA = 132;
const ESPACIO_TARJETA = 16;
const ALTO_PIE = 72;

// ── Paleta (misma que el calendario en la app) ────────────────────────
const COLOR_CATEGORIA: Record<string, string> = {
  reunion: "#2563eb",
  capacitacion: "#7c3aed",
  audiencia: "#dc2626",
  visita: "#059669",
  normalizacion: "#0891b2",
  notificacion: "#d97706",
  juzgado: "#4f46e5",
  permiso: "#db2777",
  otro: "#64748b",
};

const ETIQUETA_CATEGORIA: Record<string, string> = {
  reunion: "REUNION",
  capacitacion: "CAPACITACION",
  audiencia: "AUDIENCIA",
  visita: "VISITA",
  normalizacion: "NORMALIZACION",
  notificacion: "NOTIFICACION",
  juzgado: "JUZGADOS",
  permiso: "PERMISO",
  otro: "EVENTO",
};

/**
 * Marca de cada categoria. Se dibuja con formas, no con emoji: la mayoria de
 * contenedores de Cloud Functions no traen tipografia de color y saldrian como
 * cuadros vacios.
 */
type Marca = "personas" | "birrete" | "balanza" | "pin" | "punto";

const MARCA_CATEGORIA: Record<string, Marca> = {
  reunion: "personas",
  capacitacion: "birrete",
  audiencia: "balanza",
  visita: "pin",
  // Las categorias nuevas reutilizan las marcas mas cercanas: normalizacion y
  // notificacion son salidas a terreno, y juzgados es una diligencia judicial.
  normalizacion: "pin",
  notificacion: "pin",
  juzgado: "balanza",
  permiso: "punto",
  otro: "punto",
};

const TINTA = "#0f172a";
const TINTA_SUAVE = "#64748b";
const FONDO = "#f1f5f9";
const AZUL_MARCA = "#0b3d6b";

// Se prueban en orden; la ultima es la generica de Skia.
const FUENTES = [
  "Arial",
  "Liberation Sans",
  "DejaVu Sans",
  "Noto Sans",
  "Helvetica",
  "sans-serif",
];

let fuenteResuelta: string | null = null;

/**
 * Devuelve la primera familia disponible en el contenedor. Se resuelve una sola
 * vez por instancia.
 */
function familia(): string {
  if (fuenteResuelta) return fuenteResuelta;

  const disponibles = new Set(GlobalFonts.families.map((f) => f.family));
  fuenteResuelta = FUENTES.find((f) => disponibles.has(f)) ?? "sans-serif";

  logger.info("[imagenAgenda] Tipografia resuelta", {
    usando: fuenteResuelta,
    familiasEnElSistema: disponibles.size,
  });
  return fuenteResuelta;
}

/** Sin ninguna familia registrada el texto saldria en blanco. */
export function hayTipografia(): boolean {
  return GlobalFonts.families.length > 0;
}

function fuente(peso: "normal" | "bold", tamano: number): string {
  return `${peso} ${tamano}px "${familia()}"`;
}

// ── Utilidades de dibujo ──────────────────────────────────────────────

function rectRedondo(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Recorta con puntos suspensivos si no cabe en `ancho`. */
function recortar(ctx: SKRSContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let recortado = texto;
  while (recortado.length > 1 && ctx.measureText(`${recortado}...`).width > ancho) {
    recortado = recortado.slice(0, -1);
  }
  return `${recortado.trim()}...`;
}

/** Dibuja el distintivo de la categoria dentro de un circulo de color. */
function dibujarMarca(ctx: SKRSContext2D, marca: Marca, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";

  switch (marca) {
    case "personas": {
      // Dos siluetas (cabeza + hombros). La de atras se dibuja primero y se
      // recorta con el color del circulo para que se vean separadas.
      const silueta = (dx: number, r: number) => {
        ctx.beginPath();
        ctx.arc(cx + dx, cy - 8, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + dx, cy + 12, r * 1.75, Math.PI, 0);
        ctx.fill();
      };

      silueta(8, 4.2);
      // Separador del color de fondo para que no se fundan.
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      silueta(-4, 6.4);
      ctx.restore();
      ctx.fillStyle = "#ffffff";
      silueta(-5, 5.6);
      break;
    }
    case "birrete": {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + 14, cy - 3);
      ctx.lineTo(cx, cy + 4);
      ctx.lineTo(cx - 14, cy - 3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 9, cy - 1);
      ctx.lineTo(cx + 9, cy + 9);
      ctx.stroke();
      break;
    }
    case "balanza": {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx, cy + 12);
      ctx.moveTo(cx - 13, cy - 7);
      ctx.lineTo(cx + 13, cy - 7);
      ctx.moveTo(cx - 9, cy + 12);
      ctx.lineTo(cx + 9, cy + 12);
      ctx.stroke();
      // Platillos
      ctx.beginPath();
      ctx.arc(cx - 13, cy - 7, 6, 0, Math.PI);
      ctx.arc(cx + 13, cy - 7, 6, 0, Math.PI);
      ctx.stroke();
      break;
    }
    case "pin": {
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 8, Math.PI, 0);
      ctx.lineTo(cx, cy + 13);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy - 4, 3.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── Composicion ───────────────────────────────────────────────────────

let logoCache: Awaited<ReturnType<typeof loadImage>> | null | undefined;

async function cargarLogo() {
  if (logoCache !== undefined) return logoCache;
  try {
    // En el paquete desplegado el codigo vive en lib/, y assets/ queda al lado
    // de package.json: por eso se sube dos niveles.
    const rutas = [
      path.join(__dirname, "../../assets/logo_icono.png"),
      path.join(__dirname, "../assets/logo_icono.png"),
    ];
    const ruta = rutas.find((r) => fs.existsSync(r));
    logoCache = ruta ? await loadImage(ruta) : null;
    if (!ruta) logger.warn("[imagenAgenda] No se encontro el logo, se omite");
  } catch (err) {
    logger.warn("[imagenAgenda] No se pudo cargar el logo", { err: String(err) });
    logoCache = null;
  }
  return logoCache;
}

export async function generarImagenAgenda(
  encabezado: string,
  eventos: EventoAgenda[]
): Promise<Buffer> {
  const alto =
    ALTO_CABECERA +
    eventos.length * (ALTO_TARJETA + ESPACIO_TARJETA) +
    ALTO_PIE +
    MARGEN;

  const canvas = createCanvas(ANCHO, alto);
  const ctx = canvas.getContext("2d");

  // Fondo
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ANCHO, alto);

  // Cabecera
  ctx.fillStyle = AZUL_MARCA;
  ctx.fillRect(0, 0, ANCHO, ALTO_CABECERA);

  const logo = await cargarLogo();
  let xTexto = MARGEN;
  if (logo) {
    // El logo es oscuro: sobre el azul de la cabecera se perderia. Va sobre una
    // teja blanca redondeada, que ademas lo hace ver intencional.
    const ladoTeja = 108;
    const ladoLogo = 76;
    ctx.fillStyle = "#ffffff";
    rectRedondo(ctx, MARGEN, 46, ladoTeja, ladoTeja, 24);
    ctx.fill();
    ctx.drawImage(
      logo,
      MARGEN + (ladoTeja - ladoLogo) / 2,
      46 + (ladoTeja - ladoLogo) / 2,
      ladoLogo,
      ladoLogo
    );
    xTexto = MARGEN + ladoTeja + 30;
  }

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = fuente("bold", 26);
  ctx.fillText("GESTION GLOBAL", xTexto, 74);

  ctx.fillStyle = "#ffffff";
  ctx.font = fuente("bold", 46);
  ctx.fillText(recortar(ctx, `AGENDA ${encabezado}`, ANCHO - xTexto - MARGEN), xTexto, 128);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = fuente("normal", 24);
  ctx.fillText(
    `${eventos.length} compromiso${eventos.length === 1 ? "" : "s"} programado${
      eventos.length === 1 ? "" : "s"
    }`,
    xTexto,
    166
  );

  // Tarjetas
  let y = ALTO_CABECERA + 28;
  for (const evento of eventos) {
    const color = COLOR_CATEGORIA[evento.categoria] ?? COLOR_CATEGORIA.otro;
    const x = MARGEN;
    const ancho = ANCHO - MARGEN * 2;

    // Tarjeta blanca
    ctx.fillStyle = "#ffffff";
    rectRedondo(ctx, x, y, ancho, ALTO_TARJETA, 18);
    ctx.fill();

    // Franja de color a la izquierda
    ctx.save();
    rectRedondo(ctx, x, y, ancho, ALTO_TARJETA, 18);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 8, ALTO_TARJETA);
    ctx.restore();

    // Distintivo de categoria
    dibujarMarca(ctx, MARCA_CATEGORIA[evento.categoria] ?? "punto", x + 62, y + 66, color);

    const xContenido = x + 110;
    // Se reserva la franja derecha para la hora y la etiqueta de categoria.
    const anchoContenido = ancho - 110 - 268;

    // Titulo
    ctx.fillStyle = TINTA;
    ctx.font = fuente("bold", 32);
    ctx.fillText(recortar(ctx, evento.titulo, anchoContenido), xContenido, y + 50);

    // Asistentes
    ctx.fillStyle = TINTA_SUAVE;
    ctx.font = fuente("normal", 24);
    ctx.fillText(recortar(ctx, evento.quienes, anchoContenido), xContenido, y + 86);

    // Lugar
    if (evento.lugar) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = fuente("normal", 21);
      ctx.fillText(recortar(ctx, evento.lugar, anchoContenido), xContenido, y + 115);
    }

    // Hora, alineada a la derecha
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.font = fuente("bold", 34);
    ctx.fillText(evento.hora, x + ancho - 30, y + 56);

    ctx.fillStyle = "#94a3b8";
    ctx.font = fuente("bold", 17);
    ctx.fillText(
      ETIQUETA_CATEGORIA[evento.categoria] ?? ETIQUETA_CATEGORIA.otro,
      x + ancho - 30,
      y + 88
    );
    ctx.textAlign = "left";

    y += ALTO_TARJETA + ESPACIO_TARJETA;
  }

  // Pie
  ctx.fillStyle = TINTA_SUAVE;
  ctx.font = fuente("normal", 22);
  ctx.fillText("Consulta el detalle en la plataforma de Gestion Global.", MARGEN, y + 34);

  return canvas.toBuffer("image/png");
}
