// Convierte la direccion de un conjunto (texto libre) en coordenadas para el mapa.
//
// Modulo PURO: no importa firebase-admin ni firebase-functions para que lo usen
// igual el trigger `geocodificarCliente` y el script de backfill
// (migracion/geocodificar-clientes.js, que lo carga desde functions/lib).
//
// Lo que aprendimos del diagnostico (sep-2026) y explica cada paso:
// - `cliente.ciudad` dice "Bogota" en TODOS, pero hay conjuntos en Soacha,
//   Madrid, Funza, Zipaquira y hasta Carmen de Apicala (Tolima). El municipio
//   real viene escrito en la direccion, asi que se detecta ahi primero.
// - Muchas direcciones traen prefijos ("la Carrera", "En la Calle") y cola
//   ("Interior 1 Sector Urapanes", "barrio gratamira") que confunden a Google.
// - Algunas estan vacias o no son direcciones ("CADA CASA TIENE SU DIRECCION");
//   para esas se busca el conjunto por su NOMBRE en Google Places, y el
//   resultado queda marcado para revision humana.

export type EstadoGeo = "ok" | "revisar" | "sin_resultado";
export type FuenteGeo = "direccion" | "nombre" | "manual";
export type PrecisionGeo = "exacta" | "aproximada" | "baja";

/** Lo que se guarda en `clientes/{id}.geo` (sin la marca de tiempo, que pone quien escribe). */
export interface GeoCalculado {
  estado: EstadoGeo;
  fuente: FuenteGeo | null;
  lat: number | null;
  lng: number | null;
  precision: PrecisionGeo | null;
  direccionFormateada: string | null;
  placeId: string | null;
  municipio: string | null;
  localidad: string | null;
  /** Texto exacto que se le mando a Google (para entender un mal resultado). */
  consulta: string | null;
  /** `cliente.direccion` tal como estaba al calcular. Si cambia, se recalcula. */
  direccionOrigen: string;
  motivoRevision: string | null;
}

interface Municipio {
  nombre: string;
  departamento: string;
}

// Se comparan SIN tildes (ver sinTildes): con tilde final, "\bzipaquirá\b" no
// casa porque para \b la "á" no es letra.
// Orden: los nombres compuestos antes que los simples que contienen.
const MUNICIPIOS: Array<[RegExp, Municipio]> = [
  [/\bciudad\s+verde\b/i, { nombre: "Soacha", departamento: "Cundinamarca" }],
  [/\bcarmen\s+de\s+apicala\b/i, { nombre: "Carmen de Apicalá", departamento: "Tolima" }],
  [/\bmelgar\b/i, { nombre: "Melgar", departamento: "Tolima" }],
  [/\bsoacha\b/i, { nombre: "Soacha", departamento: "Cundinamarca" }],
  [/\bmadrid\b/i, { nombre: "Madrid", departamento: "Cundinamarca" }],
  [/\bmosquera\b/i, { nombre: "Mosquera", departamento: "Cundinamarca" }],
  [/\bfunza\b/i, { nombre: "Funza", departamento: "Cundinamarca" }],
  [/\bchia\b/i, { nombre: "Chía", departamento: "Cundinamarca" }],
  [/\bcajica\b/i, { nombre: "Cajicá", departamento: "Cundinamarca" }],
  [/\bzipaquira\b/i, { nombre: "Zipaquirá", departamento: "Cundinamarca" }],
  [/\bfacatativa\b/i, { nombre: "Facatativá", departamento: "Cundinamarca" }],
  [/\bcota\b/i, { nombre: "Cota", departamento: "Cundinamarca" }],
  [/\bsibate\b/i, { nombre: "Sibaté", departamento: "Cundinamarca" }],
  [/\bfusagasuga\b/i, { nombre: "Fusagasugá", departamento: "Cundinamarca" }],
  [/\bla\s+calera\b/i, { nombre: "La Calera", departamento: "Cundinamarca" }],
  [/\btocancipa\b/i, { nombre: "Tocancipá", departamento: "Cundinamarca" }],
  [/\bsopo\b/i, { nombre: "Sopó", departamento: "Cundinamarca" }],
  [/\btenjo\b/i, { nombre: "Tenjo", departamento: "Cundinamarca" }],
  [/\btabio\b/i, { nombre: "Tabio", departamento: "Cundinamarca" }],
  [/\bgirardot\b/i, { nombre: "Girardot", departamento: "Cundinamarca" }],
  [/\bricaurte\b/i, { nombre: "Ricaurte", departamento: "Cundinamarca" }],
  [/\bla\s+mesa\b/i, { nombre: "La Mesa", departamento: "Cundinamarca" }],
  [/\banapoima\b/i, { nombre: "Anapoima", departamento: "Cundinamarca" }],
  [/\bbogota\b/i, { nombre: "Bogotá", departamento: "Bogotá D.C." }],
];

function sinTildes(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// "D.C." solo con puntos: "Calle 7 D C" puede ser una placa de verdad.
const DEPARTAMENTOS = /,?\s*(\b(cundinamarca|tolima|colombia)\b|\bd\.\s*c\.)/gi;

// "Calle", "Cra", "Av. Cra", "Diagonal", "Tv"... seguido de un numero.
const VIA_CON_NUMERO =
  /\b(calle|cll?|carrera|cra|kra|kr|cr|avenida|av|ave|ak|ac|diagonal|dg|transversal|tv|autopista)\b\.?\s*\d/i;

export function detectarMunicipio(texto: string, ciudadCliente?: string | null): Municipio {
  const t = sinTildes(texto);
  for (const [re, m] of MUNICIPIOS) if (re.test(t)) return m;
  const ciudad = (ciudadCliente || "").trim();
  for (const [re, m] of MUNICIPIOS) if (ciudad && re.test(sinTildes(ciudad))) return m;
  return { nombre: ciudad || "Bogotá", departamento: ciudad ? "" : "Bogotá D.C." };
}

/** Deja solo "via numero # placa [sur|este]" en la forma que Google entiende mejor. */
export function limpiarDireccion(direccion: string): string {
  let d = ` ${sinTildes(direccion)} `;

  // Dos direcciones en una ("TV 60 No. 106-25 / CR 65 No. 103-87/81"): la primera.
  d = d.split(/\s\/\s/)[0];
  d = d.replace(/\([^)]*\)/g, " ");

  // Municipio y departamento se mandan aparte, en su propio campo de la consulta.
  for (const [re] of MUNICIPIOS) d = d.replace(new RegExp(re.source, "gi"), " ");
  d = d.replace(DEPARTAMENTOS, " ");

  d = d
    .replace(/^\s*(en\s+)?(la|el)\s+/i, " ")
    .replace(/[ªº°]/g, "")
    .replace(/\btrasversal\b/gi, "Transversal")
    .replace(/\bcarrear\b/gi, "Carrera")
    .replace(/\bave\b\.?/gi, "Avenida")
    .replace(/\b(calle|carrera|cra|cl|kr|cr|dg|tv)(\d)/gi, "$1 $2") // "CALLE12" → "CALLE 12"
    .replace(/\b(no|n)\s*\.\s*/gi, "# ") // "No." / "N." → "#"
    .replace(/\bno\s+(?=\d)/gi, "# ")
    .replace(/[–—]/g, "-")
    // Cola que no es direccion: interior, sector, barrio, etapa, torre, apto...
    .replace(/\s\S*\s*\b(etapa)\b.*$/i, " ")
    .replace(/\b(interior|int|sector|barrio|torre|apto|apartamento|conjunto|urbanizacion)\b.*$/i, " ")
    .replace(/(\d)\s*\/\s*\d+/g, "$1") // "5-39/47" → "5-39"
    .replace(/[,.;]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return d;
}

export function esDireccionUtil(limpia: string): boolean {
  return VIA_CON_NUMERO.test(limpia);
}

/** "CONJUNTO RESIDENCIAL EL PINAR - P.H." → "Conjunto Residencial El Pinar" */
export function limpiarNombre(nombre: string): string {
  return (nombre || "")
    .replace(/[-–—]?\s*p\.?\s*h\.?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Palabras que casi todos los nombres traen y no distinguen un conjunto de otro.
const PALABRAS_GENERICAS = new Set([
  "conjunto", "residencial", "cerrado", "campestre", "edificio", "agrupacion", "vivienda",
  "urbanizacion", "condominio", "multifamiliar", "multifamiliares", "unidad", "inmobiliaria",
  "uso", "etapa", "ph", "p", "h", "el", "la", "los", "las", "de", "del", "y",
]);
// "Unidad Siete" = "Unidad 7" = "Unidad VII"; "Primera etapa" = "Etapa 1".
const NUMEROS: Record<string, string> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
  uno: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9", diez: "10",
  primer: "1", primera: "1", primero: "1", segunda: "2", segundo: "2", tercer: "3", tercera: "3", tercero: "3",
  cuarta: "4", cuarto: "4", quinta: "5", quinto: "5",
};

function palabrasClave(nombre: string): string[] {
  return sinTildes(nombre)
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !PALABRAS_GENERICAS.has(p))
    .map((p) => NUMEROS[p] ?? p);
}

/**
 * Places devuelve SIEMPRE su mejor candidato, aunque sea otro conjunto
 * ("Torres Alto Horizonte" → "Torres del Chico Alto"). Solo se acepta si el
 * nombre de Google contiene todas las palabras que distinguen al nuestro.
 * Tambien pegadas, para "Santamaria" = "Santa Maria" y "SL" = "S.L.".
 */
export function nombreCoincide(nuestro: string, deGoogle: string): boolean {
  const clave = palabrasClave(nuestro);
  // Solo numeros ("uno", "2") no identifica nada: casaria con "Diagonal 1".
  if (clave.length === 0 || clave.every((p) => /^\d+$/.test(p))) return false;
  const google = palabrasClave(deGoogle);
  const set = new Set(google);
  const pegado = google.join("");
  return clave.every((p) => set.has(p) || pegado.includes(p));
}

/**
 * Numeros de la via y del cruce: "Cra 8A # 90A-67" → [8, 90]. Google a veces
 * antepone el nombre del edificio ("Condominio Plaza del Sol, Cl. 22b #58-60"),
 * asi que se toma el primer tramo que sea via + numero.
 */
function viaYCruce(direccion: string): number[] {
  const tramo = direccion.split(",").find((t) => VIA_CON_NUMERO.test(sinTildes(t))) ?? "";
  return (tramo.match(/\d+/g) ?? []).slice(0, 2).map(Number);
}

/**
 * Google a veces "corrige" la placa sin decir nada ("Cra 8A 90A-67" →
 * "Cra. 8a # 163B-90") y el pin cae a kilometros. Si la via o el cruce no
 * coinciden, el resultado no es nuestra direccion.
 */
export function mismaPlaca(nuestra: string, deGoogle: string): boolean {
  const a = viaYCruce(nuestra);
  const b = viaYCruce(deGoogle);
  return a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1];
}

/**
 * Google llama al municipio "Bogotá, D.C." y a veces devuelve basura como
 * "sur" o "barrio". Solo cuenta si es un municipio que conocemos.
 */
function municipioConocido(nombreGoogle: string | null): string | null {
  if (!nombreGoogle) return null;
  const t = sinTildes(nombreGoogle);
  for (const [re, m] of MUNICIPIOS) if (re.test(t)) return m.nombre;
  return null;
}

/**
 * La unica regla para decidir si hay que (re)calcular: cuando la direccion ya
 * no es la que se uso la ultima vez. Cubre cliente nuevo, direccion editada y
 * evita el bucle del trigger (escribir `geo` no cambia la direccion). Un pin
 * corregido a mano guarda la direccion vigente, asi que tambien se respeta
 * hasta que alguien cambie la direccion.
 */
export function necesitaGeocodificar(data: any): boolean {
  const direccion = String(data?.direccion ?? "").trim();
  const nombre = String(data?.nombre ?? "").trim();
  if (!direccion && !nombre) return false;
  return data?.geo?.direccionOrigen !== direccion;
}

// ---------------------------------------------------------------------------

type Componente = { long_name: string; types: string[] };

function componente(comps: Componente[], tipo: string): string | null {
  return comps.find((c) => c.types.includes(tipo))?.long_name ?? null;
}


const PRECISION: Record<string, PrecisionGeo> = {
  ROOFTOP: "exacta",
  RANGE_INTERPOLATED: "exacta",
  GEOMETRIC_CENTER: "aproximada",
  APPROXIMATE: "baja",
};

async function porDireccion(consulta: string, key: string) {
  const url =
    "https://maps.googleapis.com/maps/api/geocode/json" +
    `?address=${encodeURIComponent(consulta)}` +
    "&components=country:CO&region=co&language=es" +
    `&key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const json: any = await res.json();
  if (json.status === "ZERO_RESULTS") return null;
  if (json.status !== "OK") {
    throw new Error(`Geocoding API: ${json.status} ${json.error_message ?? ""}`.trim());
  }
  const r = json.results[0];
  const comps: Componente[] = r.address_components ?? [];
  return {
    lat: r.geometry.location.lat as number,
    lng: r.geometry.location.lng as number,
    precision: PRECISION[r.geometry.location_type] ?? "baja",
    parcial: !!r.partial_match,
    direccionFormateada: r.formatted_address as string,
    placeId: r.place_id as string,
    municipio: componente(comps, "locality") ?? componente(comps, "administrative_area_level_2"),
    localidad: componente(comps, "sublocality_level_1") ?? componente(comps, "sublocality"),
    tipos: (r.types ?? []) as string[],
  };
}

async function porNombre(consulta: string, key: string) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({ textQuery: consulta, regionCode: "CO", languageCode: "es", pageSize: 1 }),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`Places API: ${json?.error?.status ?? res.status} ${json?.error?.message ?? ""}`.trim());
  const p = json.places?.[0];
  if (!p?.location) return null;
  return {
    lat: p.location.latitude as number,
    lng: p.location.longitude as number,
    direccionFormateada: (p.formattedAddress as string) ?? null,
    placeId: p.id as string,
    nombreGoogle: (p.displayName?.text as string) ?? "",
  };
}

export async function geocodificarCliente(
  cliente: { nombre?: string | null; direccion?: string | null; ciudad?: string | null },
  key: string
): Promise<GeoCalculado> {
  const direccionOrigen = String(cliente.direccion ?? "").trim();
  const municipio = detectarMunicipio(direccionOrigen, cliente.ciudad);
  const lugar = [municipio.nombre, municipio.departamento, "Colombia"].filter(Boolean).join(", ");
  const limpia = limpiarDireccion(direccionOrigen);

  const base: GeoCalculado = {
    estado: "sin_resultado",
    fuente: null,
    lat: null,
    lng: null,
    precision: null,
    direccionFormateada: null,
    placeId: null,
    municipio: municipio.nombre,
    localidad: null,
    consulta: null,
    direccionOrigen,
    motivoRevision: null,
  };

  // 1) Por direccion, si parece una direccion de verdad.
  let candidatoDireccion: GeoCalculado | null = null;
  let placaDistinta = false;
  if (esDireccionUtil(limpia)) {
    const consulta = `${limpia}, ${lugar}`;
    const r = await porDireccion(consulta, key);
    if (r) {
      const motivos: string[] = [];
      const municipioGoogle = municipioConocido(r.municipio);
      placaDistinta = !mismaPlaca(limpia, r.direccionFormateada);
      if (placaDistinta) motivos.push(`Google la cambio por "${r.direccionFormateada.split(",")[0]}"`);
      else if (r.precision === "baja") motivos.push("Google solo ubico la zona, no la placa");
      if (r.parcial && !placaDistinta) motivos.push("Google no reconocio toda la direccion");
      if (municipioGoogle && municipioGoogle !== municipio.nombre) {
        motivos.push(`Quedo en ${municipioGoogle}, se esperaba ${municipio.nombre}`);
      }
      candidatoDireccion = {
        ...base,
        estado: motivos.length ? "revisar" : "ok",
        fuente: "direccion",
        lat: r.lat,
        lng: r.lng,
        precision: r.precision,
        direccionFormateada: r.direccionFormateada,
        placeId: r.placeId,
        municipio: municipioGoogle ?? municipio.nombre,
        localidad: r.localidad,
        consulta,
        motivoRevision: motivos.join(". ") || null,
      };
      if (candidatoDireccion.estado === "ok") return candidatoDireccion;
    } else {
      base.consulta = consulta;
    }
  }

  // 2) Por nombre del conjunto: direccion vacia, inservible o dudosa.
  const nombre = limpiarNombre(String(cliente.nombre ?? ""));
  if (nombre && (!candidatoDireccion || candidatoDireccion.precision === "baja" || placaDistinta)) {
    const consulta = `${nombre}, ${lugar}`;
    const p = await porNombre(consulta, key);
    if (p && !nombreCoincide(nombre, p.nombreGoogle)) {
      base.consulta = consulta;
      base.motivoRevision = `Google solo encontro "${p.nombreGoogle}", que parece otro conjunto`;
    } else if (p) {
      return {
        ...base,
        estado: "revisar",
        fuente: "nombre",
        lat: p.lat,
        lng: p.lng,
        precision: "aproximada",
        direccionFormateada: p.direccionFormateada,
        placeId: p.placeId,
        consulta,
        motivoRevision: direccionOrigen
          ? `La direccion no sirvio; se ubico buscando el nombre (Google: "${p.nombreGoogle}")`
          : `Sin direccion; se ubico buscando el nombre (Google: "${p.nombreGoogle}")`,
      };
    }
    if (!candidatoDireccion) base.consulta = consulta;
  }

  // Un pin en otra placa es peor que ningun pin: queda sin ubicar, con lo que
  // propuso Google en el motivo para que alguien lo ponga a mano.
  if (candidatoDireccion && placaDistinta) {
    return { ...base, consulta: candidatoDireccion.consulta, motivoRevision: candidatoDireccion.motivoRevision };
  }
  if (candidatoDireccion) return candidatoDireccion;
  return {
    ...base,
    motivoRevision:
      base.motivoRevision ?? (direccionOrigen ? "Google no encontro la direccion ni el nombre" : "Sin direccion"),
  };
}
