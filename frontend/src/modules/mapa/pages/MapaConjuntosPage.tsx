// Mapa de Impacto (antes "Mapa de conjuntos"): dónde queda cada cliente, quién lo atiende, cuánta cartera
// tiene y cómo recorrer varios en una ruta.
//
// Las coordenadas ya vienen en `cliente.geo` (las calcula la Cloud Function
// `geocodificarCliente`), así que abrir esta página solo cuesta la carga del
// mapa: nada de geocodificar en el navegador. La ruta la calcula la Cloud
// Function `calcularRutaVisitas` con la key de servidor.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer, type Renderer } from "@googlemaps/markerclusterer";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  MapPin,
  MapPinOff,
  Move,
  Navigation,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";

import type { Cliente } from "@/modules/clientes/models/cliente.model";
import { obtenerClientesPorUsuario } from "@/modules/clientes/services/clienteService";
import type { Franquicia } from "@/modules/franquicias/models/franquicia.model";
import { getFranquiciaById } from "@/modules/franquicias/services/franquiciaService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { guardarUbicacionManual, tieneUbicacion, urlComoLlegar } from "../services/mapaService";
import {
  MAX_PARADAS,
  OFICINA,
  calcularRuta,
  miUbicacion,
  urlNavegacion,
  type PuntoRuta,
  type ResultadoRuta,
} from "../services/rutaService";
import {
  MESES_VENTANA,
  NIVELES_CARTERA,
  cargarCarteraReciente,
  cortesCuartiles,
  nivelDe,
  nombreMes,
  pesosCortos,
  type CarteraConjunto,
  type NivelCartera,
} from "../services/carteraMapaService";
import { PanelRuta, type OrigenRuta } from "../components/PanelRuta";
import { RutaEnMapa } from "../components/RutaEnMapa";
import { FRANQUICIA_MAPA_ID, ROLES_MAPA_CONJUNTOS } from "../constants";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
// DEMO_MAP_ID sirve para desarrollo; en producción va el Map ID propio.
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || "DEMO_MAP_ID";
const BOGOTA = { lat: 4.65, lng: -74.1 };

const TODAS = "__ALL__";
const SIN_ASIGNAR = "__NONE__";

type CampoResponsable = "ejecutivoPrejuridicoId" | "ejecutivoJuridicoId" | "abogadoId" | "ejecutivoDependienteId";
/** Qué pinta el color del pin: una persona responsable o el tamaño de la cartera. */
type Modo = CampoResponsable | "cartera";
const RESPONSABLES: { campo: CampoResponsable; label: string }[] = [
  { campo: "ejecutivoPrejuridicoId", label: "Ejecutivo prejurídico" },
  { campo: "ejecutivoJuridicoId", label: "Ejecutivo jurídico" },
  { campo: "abogadoId", label: "Abogado" },
  { campo: "ejecutivoDependienteId", label: "Dependiente" },
];

// Colores bien distinguibles entre sí sobre el mapa; gris = sin asignar.
const PALETA = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#65a30d", "#7c3aed", "#ca8a04", "#0f766e", "#b91c1c"];
const GRIS = "#6b7280";
const COLOR_RUTA = "#0d5f7a";

type Pestana = "ubicados" | "revisar" | "sin";

export default function MapaConjuntosPage() {
  const { roles, loading } = useUsuarioActual();
  if (loading) return null;
  // Mismo control que el menú: quien llegue por URL sin el rol no ve nada.
  if (!roles.some((r) => ROLES_MAPA_CONJUNTOS.includes(r))) return <Navigate to="/home" replace />;

  if (!API_KEY) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
          <p className="font-semibold">Falta configurar Google Maps</p>
          <p className="mt-1 text-sm">
            Agrega <code>VITE_GOOGLE_MAPS_API_KEY</code> (y <code>VITE_GOOGLE_MAPS_MAP_ID</code>) al archivo
            <code> frontend/.env</code> y vuelve a compilar.
          </p>
        </div>
      </div>
    );
  }
  return (
    <APIProvider apiKey={API_KEY} language="es" region="CO">
      <MapaConjuntos />
    </APIProvider>
  );
}

function MapaConjuntos() {
  const navigate = useNavigate();
  const { usuario, usuarioSistema, roles, loading: userLoading } = useUsuarioActual();
  const { can } = useAcl();
  const puedeCorregir = can(PERMS.Clientes_Edit);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [franquicia, setFranquicia] = useState<Franquicia | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [cargando, setCargando] = useState(true);

  const [q, setQ] = useState("");
  const [ciudadFiltro, setCiudadFiltro] = useState(TODAS);
  const [modo, setModo] = useState<Modo>("ejecutivoPrejuridicoId");
  // Filtro de los chips de la leyenda: un responsable o un nivel de cartera.
  const [chipFiltro, setChipFiltro] = useState(TODAS);
  const [verInactivos, setVerInactivos] = useState(false);
  const [pestana, setPestana] = useState<Pestana>("ubicados");

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  // Pin en corrección: posición provisional hasta que se guarde.
  const [moviendo, setMoviendo] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [centroMapa, setCentroMapa] = useState<google.maps.LatLngLiteral>(BOGOTA);

  // Cartera: se carga la primera vez que alguien elige "Cartera".
  const [cartera, setCartera] = useState<globalThis.Map<string, CarteraConjunto> | null>(null);
  const [cargandoCartera, setCargandoCartera] = useState(false);

  // Ruta de visitas.
  const [ruta, setRuta] = useState<string[]>([]);
  const [origenRuta, setOrigenRuta] = useState<OrigenRuta>("oficina");
  const [resultado, setResultado] = useState<ResultadoRuta | null>(null);
  const [origenUsado, setOrigenUsado] = useState<PuntoRuta | null>(null);
  const [calculando, setCalculando] = useState(false);
  // Mientras hay ruta, el mapa muestra solo sus conjuntos (y la oficina) para no saturarlo.
  const [soloRuta, setSoloRuta] = useState(true);

  useEffect(() => {
    if (userLoading) return;
    (async () => {
      try {
        const [cs, fs, us] = await Promise.all([
          obtenerClientesPorUsuario({
            uid: usuario?.uid ?? "",
            roles,
            franquiciasAsignadas: usuarioSistema?.franquiciasAsignadas ?? [],
          }),
          getFranquiciaById(FRANQUICIA_MAPA_ID),
          obtenerUsuarios(),
        ]);
        setClientes(cs.filter((c) => c.franquiciaId === FRANQUICIA_MAPA_ID));
        setFranquicia(fs);
        setUsuarios(us);
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar los conjuntos");
      } finally {
        setCargando(false);
      }
    })();
  }, [userLoading, usuario?.uid, roles, usuarioSistema?.franquiciasAsignadas]);

  useEffect(() => {
    if (modo !== "cartera" || cartera || cargandoCartera) return;
    setCargandoCartera(true);
    cargarCarteraReciente()
      .then(setCartera)
      .catch((e) => {
        console.error(e);
        toast.error("No se pudo cargar la cartera");
      })
      .finally(() => setCargandoCartera(false));
  }, [modo, cartera, cargandoCartera]);

  const nombreUsuario = useMemo(() => {
    const m: Record<string, string> = {};
    usuarios.forEach((u) => { m[u.uid] = u.nombre || u.email || u.uid; });
    return m;
  }, [usuarios]);

  // Estado y texto: de aquí salen los conteos del selector de ciudad.
  const sinCiudad = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return clientes.filter((c) => {
      if (!verInactivos && c.activo === false) return false;
      if (texto && !`${c.nombre ?? ""} ${c.direccion ?? ""} ${c.geo?.localidad ?? ""}`.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [clientes, verInactivos, q]);

  // Ciudades de la franquicia en el orden en que las definió el admin, más
  // cualquiera que traiga un cliente y no esté en la lista (para no perderlo).
  const ciudades = useMemo(() => {
    const nombres = [...(franquicia?.ciudades ?? [])];
    sinCiudad.forEach((c) => { if (c.ciudad && !nombres.includes(c.ciudad)) nombres.push(c.ciudad); });
    return nombres.map((n) => ({ nombre: n, cantidad: sinCiudad.filter((c) => c.ciudad === n).length }));
  }, [franquicia, sinCiudad]);

  // Base para la leyenda (responsables o niveles).
  const base = useMemo(
    () => (ciudadFiltro === TODAS ? sinCiudad : sinCiudad.filter((c) => c.ciudad === ciudadFiltro)),
    [sinCiudad, ciudadFiltro]
  );

  const campo: CampoResponsable | null = modo === "cartera" ? null : modo;

  // Personas que aparecen en el rol elegido, con su color fijo.
  const responsables = useMemo(() => {
    if (!campo) return [];
    const ids = Array.from(new Set(base.map((c) => c[campo]).filter(Boolean) as string[]));
    ids.sort((a, b) => (nombreUsuario[a] ?? a).localeCompare(nombreUsuario[b] ?? b));
    return ids.map((id, i) => ({ id, nombre: nombreUsuario[id] ?? "Usuario desconocido", color: PALETA[i % PALETA.length] }));
  }, [base, campo, nombreUsuario]);

  // Cartera: cortes por cuartiles sobre los conjuntos visibles y el máximo para el tamaño del pin.
  const carteraDe = useCallback((c: Cliente) => (c.id ? cartera?.get(c.id) : undefined), [cartera]);
  const cortes = useMemo(() => cortesCuartiles(base.map((c) => carteraDe(c)?.deuda ?? 0)), [base, carteraDe]);
  const maxDeuda = useMemo(() => Math.max(0, ...base.map((c) => carteraDe(c)?.deuda ?? 0)), [base, carteraDe]);
  const nivelDeCliente = useCallback((c: Cliente): NivelCartera => nivelDe(carteraDe(c)?.deuda ?? 0, cortes), [carteraDe, cortes]);

  const colorDe = useCallback(
    (c: Cliente) => {
      if (modo === "cartera") return NIVELES_CARTERA.find((n) => n.id === nivelDeCliente(c))!.color;
      return responsables.find((r) => r.id === c[modo])?.color ?? GRIS;
    },
    [modo, responsables, nivelDeCliente]
  );

  // En modo cartera el pin crece con la deuda (raíz: que los grandes no tapen todo).
  const escalaDe = useCallback(
    (c: Cliente) => {
      if (modo !== "cartera" || !maxDeuda) return 1;
      return 0.85 + 0.6 * Math.sqrt((carteraDe(c)?.deuda ?? 0) / maxDeuda);
    },
    [modo, maxDeuda, carteraDe]
  );

  const filtrados = useMemo(() => {
    if (chipFiltro === TODAS) return base;
    if (modo === "cartera") return base.filter((c) => nivelDeCliente(c) === chipFiltro);
    return base.filter((c) => (chipFiltro === SIN_ASIGNAR ? !c[modo] : c[modo] === chipFiltro));
  }, [base, chipFiltro, modo, nivelDeCliente]);

  const ubicados = useMemo(() => filtrados.filter(tieneUbicacion), [filtrados]);
  const porRevisar = useMemo(() => ubicados.filter((c) => c.geo?.estado === "revisar"), [ubicados]);
  const sinUbicar = useMemo(() => filtrados.filter((c) => !tieneUbicacion(c)), [filtrados]);

  const lista = useMemo(() => {
    const l = pestana === "ubicados" ? ubicados : pestana === "revisar" ? porRevisar : sinUbicar;
    // En cartera, primero donde está la plata.
    return modo === "cartera" ? [...l].sort((a, b) => (carteraDe(b)?.deuda ?? 0) - (carteraDe(a)?.deuda ?? 0)) : l;
  }, [pestana, ubicados, porRevisar, sinUbicar, modo, carteraDe]);

  const seleccionado = clientes.find((c) => c.id === seleccionadoId) ?? null;

  // Cambiar qué se colorea deja sin sentido el chip elegido.
  useEffect(() => { setChipFiltro(TODAS); }, [modo]);

  // ---------------------------------------------------------------- Ruta
  const paradas = useMemo(
    () => ruta.map((id) => clientes.find((c) => c.id === id)).filter((c): c is Cliente => !!c && tieneUbicacion(c)),
    [ruta, clientes]
  );

  const posicionEnRuta = useCallback(
    (id: string): number | undefined => {
      if (resultado) {
        const i = resultado.orden.indexOf(id);
        return i >= 0 ? i + 1 : undefined;
      }
      return ruta.includes(id) ? 0 : undefined;
    },
    [resultado, ruta]
  );

  const alternarRuta = useCallback(
    (c: Cliente) => {
      if (!c.id || !tieneUbicacion(c)) return;
      setResultado(null);
      setRuta((prev) => {
        if (prev.includes(c.id!)) return prev.filter((x) => x !== c.id);
        if (prev.length === 0) setSoloRuta(true);
        if (prev.length >= MAX_PARADAS) {
          toast.error(`La ruta admite hasta ${MAX_PARADAS} conjuntos`);
          return prev;
        }
        return [...prev, c.id!];
      });
    },
    []
  );

  const calcular = async () => {
    if (paradas.length === 0) return;
    setCalculando(true);
    try {
      const origen = origenRuta === "oficina" ? { lat: OFICINA.lat, lng: OFICINA.lng } : await miUbicacion();
      const r = await calcularRuta(
        origen,
        paradas.map((c) => ({ id: c.id!, lat: c.geo!.lat!, lng: c.geo!.lng! }))
      );
      setOrigenUsado(origen);
      setResultado(r);
      setSeleccionadoId(null);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error && e.message ? e.message : "No se pudo calcular la ruta");
    } finally {
      setCalculando(false);
    }
  };

  // Para el buscador de la ruta: todos los conjuntos con ubicación, sin importar los filtros de arriba.
  const candidatosRuta = useMemo(
    () => clientes.filter((c) => tieneUbicacion(c) && (verInactivos || c.activo !== false)),
    [clientes, verInactivos]
  );

  const mostrarSoloRuta = soloRuta && paradas.length > 0;
  const enMapa = mostrarSoloRuta ? paradas : ubicados;

  const urlNavegar = useMemo(() => {
    if (!resultado) return null;
    const puntos = resultado.orden
      .map((id) => clientes.find((c) => c.id === id))
      .filter((c): c is Cliente => !!c && tieneUbicacion(c))
      .map((c) => ({ lat: c.geo!.lat!, lng: c.geo!.lng! }));
    // Desde "Mi ubicación" no se fija origen: Google Maps sale de donde esté el celular.
    return urlNavegacion(origenRuta === "oficina" ? origenUsado : null, puntos);
  }, [resultado, clientes, origenRuta, origenUsado]);

  // ---------------------------------------------------------------- Corrección de pin
  const iniciarCorreccion = (c: Cliente) => {
    const pos = tieneUbicacion(c) ? { lat: c.geo!.lat!, lng: c.geo!.lng! } : centroMapa;
    setMoviendo({ id: c.id!, ...pos });
    setSeleccionadoId(c.id!);
  };

  const guardarCorreccion = async () => {
    if (!moviendo || !usuario?.uid) return;
    const cliente = clientes.find((c) => c.id === moviendo.id);
    if (!cliente) return;
    setGuardando(true);
    try {
      await guardarUbicacionManual(cliente, moviendo, usuario.uid);
      setClientes((prev) =>
        prev.map((c) =>
          c.id === cliente.id
            ? {
                ...c,
                geo: {
                  ...(c.geo ?? { direccionFormateada: null, placeId: null, municipio: null, localidad: null, consulta: null }),
                  estado: "ok",
                  fuente: "manual",
                  lat: moviendo.lat,
                  lng: moviendo.lng,
                  precision: "exacta",
                  direccionOrigen: String(c.direccion ?? "").trim(),
                  motivoRevision: null,
                } as Cliente["geo"],
              }
            : c
        )
      );
      setResultado(null);
      toast.success("Ubicación guardada");
      setMoviendo(null);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo guardar la ubicación");
    } finally {
      setGuardando(false);
    }
  };

  const clienteMoviendo = moviendo ? clientes.find((c) => c.id === moviendo.id) : null;

  const conteoNivel = (n: NivelCartera) => base.filter((c) => nivelDeCliente(c) === n).length;
  const rangoNivel = (n: NivelCartera) => {
    const [q1, q2, q3] = cortes;
    return { muy_alta: `${pesosCortos(q3)} o más`, alta: `${pesosCortos(q2)} a ${pesosCortos(q3)}`, media: `${pesosCortos(q1)} a ${pesosCortos(q2)}`, baja: `menos de ${pesosCortos(q1)}`, sin: `sin estado mensual en ${MESES_VENTANA} meses` }[n];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-4">
        <header className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-primary/10">
            <MapPin className="h-6 w-6 text-brand-primary" />
          </div>
          <div>
            <Typography variant="h2" className="!text-brand-primary font-bold">
              Mapa de Impacto
            </Typography>
            <p className="text-sm text-gray-600 mt-0.5">
              Dónde está la cartera, quién la gestiona y la mejor ruta para llegar a ella.
            </p>
            <Typography variant="small" className="mt-0.5 text-gray-500">
              {cargando
                ? "Cargando…"
                : `${ubicados.length} en el mapa · ${porRevisar.length} por revisar · ${sinUbicar.length} sin ubicar`}
            </Typography>
          </div>
        </header>

        {/* Filtros */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="lg:col-span-2">
            <Label className="mb-1.5 block text-brand-secondary font-medium">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-secondary/60" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, dirección o localidad…" className="pl-9" />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-brand-secondary font-medium">Ciudad / Municipio</Label>
            <Select value={ciudadFiltro} onValueChange={setCiudadFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas ({sinCiudad.length})</SelectItem>
                {ciudades.map((c) => (
                  <SelectItem key={c.nombre} value={c.nombre}>{c.nombre} ({c.cantidad})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block text-brand-secondary font-medium">Resaltar por</Label>
            <Select value={modo} onValueChange={(v) => setModo(v as Modo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cartera">Cartera en mora</SelectItem>
                {RESPONSABLES.map((r) => (
                  <SelectItem key={r.campo} value={r.campo}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 h-10">
            <Switch id="ver-inactivos" checked={verInactivos} onCheckedChange={setVerInactivos} />
            <Label htmlFor="ver-inactivos">Incluir inactivos</Label>
          </div>
        </section>

        {/* Leyenda = filtro */}
        {modo === "cartera" ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Chip activo={chipFiltro === TODAS} onClick={() => setChipFiltro(TODAS)} etiqueta="Todos" />
              {NIVELES_CARTERA.map((n) => (
                <Chip
                  key={n.id}
                  activo={chipFiltro === n.id}
                  onClick={() => setChipFiltro(chipFiltro === n.id ? TODAS : n.id)}
                  etiqueta={n.label}
                  detalle={cartera ? rangoNivel(n.id) : undefined}
                  color={n.color}
                  cantidad={cartera ? conteoNivel(n.id) : undefined}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {cargandoCartera
                ? "Cargando cartera…"
                : "Saldo en mora del último mes cargado de cada conjunto. El pin crece con la cartera."}
            </p>
          </div>
        ) : (
          responsables.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Chip activo={chipFiltro === TODAS} onClick={() => setChipFiltro(TODAS)} etiqueta="Todos" />
              {responsables.map((r) => (
                <Chip
                  key={r.id}
                  activo={chipFiltro === r.id}
                  onClick={() => setChipFiltro(chipFiltro === r.id ? TODAS : r.id)}
                  etiqueta={r.nombre}
                  color={r.color}
                  cantidad={base.filter((c) => c[modo as CampoResponsable] === r.id).length}
                />
              ))}
              <Chip
                activo={chipFiltro === SIN_ASIGNAR}
                onClick={() => setChipFiltro(chipFiltro === SIN_ASIGNAR ? TODAS : SIN_ASIGNAR)}
                etiqueta="Sin asignar"
                color={GRIS}
                cantidad={base.filter((c) => !c[modo as CampoResponsable]).length}
              />
            </div>
          )
        )}

        {moviendo && (
          <div className="rounded-xl border border-brand-primary/40 bg-brand-primary/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <Move className="h-5 w-5 text-brand-primary shrink-0" />
            <p className="text-sm flex-1">
              Arrastra el pin de <b>{clienteMoviendo?.nombre}</b> hasta la entrada del conjunto y guarda.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMoviendo(null)} disabled={guardando}>Cancelar</Button>
              <Button variant="brand" size="sm" onClick={guardarCorreccion} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar ubicación"}
              </Button>
            </div>
          </div>
        )}

        <PanelRuta
          paradas={paradas}
          candidatos={candidatosRuta}
          onAgregar={alternarRuta}
          soloRuta={soloRuta}
          onSoloRuta={setSoloRuta}
          origen={origenRuta}
          onOrigen={(o) => { setOrigenRuta(o); setResultado(null); }}
          resultado={resultado}
          urlNavegar={urlNavegar}
          calculando={calculando}
          onCalcular={calcular}
          onQuitar={(id) => { const c = clientes.find((x) => x.id === id); if (c) alternarRuta(c); }}
          onLimpiar={() => { setRuta([]); setResultado(null); }}
          onVer={setSeleccionadoId}
        />

        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          {/* Lista */}
          <aside className="order-2 lg:order-1 rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden flex flex-col lg:h-[70vh]">
            <div className="grid grid-cols-3 border-b text-xs font-medium">
              {([
                ["ubicados", `En mapa (${ubicados.length})`],
                ["revisar", `Revisar (${porRevisar.length})`],
                ["sin", `Sin ubicar (${sinUbicar.length})`],
              ] as [Pestana, string][]).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPestana(id)}
                  className={cn(
                    "px-2 py-2.5 border-b-2 transition-colors",
                    pestana === id ? "border-brand-primary text-brand-primary" : "border-transparent text-gray-500 hover:text-gray-800"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="overflow-y-auto divide-y max-h-[50vh] lg:max-h-none lg:flex-1">
              {lista.length === 0 && (
                <li className="p-4 text-sm text-gray-500">{cargando ? "Cargando…" : "Nada por aquí."}</li>
              )}
              {lista.map((c) => {
                const k = carteraDe(c);
                const enRuta = ruta.includes(c.id!);
                return (
                  <li key={c.id} className={cn("flex flex-wrap items-start", seleccionadoId === c.id && "bg-brand-primary/5")}>
                    <button
                      type="button"
                      onClick={() => setSeleccionadoId(c.id!)}
                      className="min-w-0 flex-1 text-left p-3 hover:bg-gray-50 flex gap-2.5"
                    >
                      <span className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ background: colorDe(c) }} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{c.nombre}</span>
                        {modo === "cartera" ? (
                          <span className="block text-xs text-gray-600 truncate">
                            {k ? `${pesosCortos(k.deuda)} · ${k.deudoresConDeuda} deudores · ${nombreMes(k.mes)}` : cargandoCartera ? "…" : "Sin estado mensual reciente"}
                          </span>
                        ) : (
                          <span className="block text-xs text-gray-500 truncate">
                            {c.direccion || "Sin dirección"}
                            {c.geo?.localidad ? ` · ${c.geo.localidad}` : c.geo?.municipio && c.geo.municipio !== "Bogotá" ? ` · ${c.geo.municipio}` : ""}
                          </span>
                        )}
                        {pestana !== "ubicados" && c.geo?.motivoRevision && (
                          <span className="block text-xs text-amber-700 mt-0.5">{c.geo.motivoRevision}</span>
                        )}
                      </span>
                    </button>
                    {tieneUbicacion(c) && (
                      <button
                        type="button"
                        onClick={() => alternarRuta(c)}
                        aria-label={enRuta ? `Quitar ${c.nombre} de la ruta` : `Agregar ${c.nombre} a la ruta`}
                        title={enRuta ? "Quitar de la ruta" : "Agregar a la ruta"}
                        className={cn(
                          "m-2.5 shrink-0 rounded-full border p-1.5 transition-colors",
                          enRuta ? "border-transparent bg-[#0d5f7a] text-white" : "border-gray-200 text-gray-500 hover:border-[#0d5f7a] hover:text-[#0d5f7a]"
                        )}
                      >
                        {enRuta ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {pestana === "sin" && puedeCorregir && seleccionadoId === c.id && !moviendo && (
                      <div className="px-3 pb-3 w-full">
                        <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => iniciarCorreccion(c)}>
                          <MapPin className="h-4 w-4" /> Ubicarlo en el mapa
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Mapa */}
          <div className="order-1 lg:order-2 rounded-2xl overflow-hidden border border-brand-secondary/20 shadow-sm h-[60vh] lg:h-[70vh]">
            <Map
              mapId={MAP_ID}
              defaultCenter={BOGOTA}
              defaultZoom={11}
              gestureHandling="greedy"
              disableDefaultUI={false}
              streetViewControl={false}
              mapTypeControl={false}
              clickableIcons={false}
              onCameraChanged={(e) => setCentroMapa(e.detail.center)}
              onClick={() => { if (!moviendo) setSeleccionadoId(null); }}
            >
              <AjustarVista clientes={enMapa} extra={mostrarSoloRuta && origenRuta === "oficina" ? [{ lat: OFICINA.lat, lng: OFICINA.lng }] : []} />
              <IrASeleccionado cliente={seleccionado} />
              <MarcadoresAgrupados
                clientes={enMapa.filter((c) => c.id !== moviendo?.id)}
                colorDe={colorDe}
                escalaDe={escalaDe}
                posicionEnRuta={posicionEnRuta}
                seleccionadoId={seleccionadoId}
                onSeleccionar={setSeleccionadoId}
                puedeCorregir={puedeCorregir && !moviendo}
                onCorregir={iniciarCorreccion}
                onAbrir={(id) => navigate(`/clientes/${id}`)}
                onAlternarRuta={alternarRuta}
                carteraDe={carteraDe}
                nombreUsuario={nombreUsuario}
              />
              <RutaEnMapa
                polyline={resultado?.polyline ?? null}
                origen={paradas.length > 0 ? (origenRuta === "oficina" ? { lat: OFICINA.lat, lng: OFICINA.lng } : origenUsado) : null}
                esOficina={origenRuta === "oficina"}
              />
              {moviendo && (
                <AdvancedMarker
                  position={{ lat: moviendo.lat, lng: moviendo.lng }}
                  draggable
                  zIndex={3000}
                  onDragEnd={(e) => {
                    const p = e.latLng;
                    if (p) setMoviendo((m) => (m ? { ...m, lat: p.lat(), lng: p.lng() } : m));
                  }}
                >
                  <Pin background="#111827" borderColor="#111827" glyphColor="#ffffff" scale={1.3} />
                </AdvancedMarker>
              )}
            </Map>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip(props: { activo: boolean; onClick: () => void; etiqueta: string; detalle?: string; color?: string; cantidad?: number }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.detalle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        props.activo ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-gray-200 bg-white hover:bg-gray-50"
      )}
    >
      {props.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: props.color }} />}
      {props.etiqueta}
      {props.detalle && <span className="text-gray-400">· {props.detalle}</span>}
      {props.cantidad != null && <span className="text-gray-500">{props.cantidad}</span>}
    </button>
  );
}

/** Encuadra el mapa en los conjuntos visibles cada vez que cambia el filtro. */
function AjustarVista({ clientes, extra = [] }: { clientes: Cliente[]; extra?: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  const clave = clientes.map((c) => c.id).join(",") + "|" + extra.map((p) => `${p.lat},${p.lng}`).join(",");
  useEffect(() => {
    if (!map || clientes.length === 0) return;
    if (clientes.length === 1 && extra.length === 0) {
      map.setCenter({ lat: clientes[0].geo!.lat!, lng: clientes[0].geo!.lng! });
      map.setZoom(15);
      return;
    }
    const b = new google.maps.LatLngBounds();
    clientes.forEach((c) => b.extend({ lat: c.geo!.lat!, lng: c.geo!.lng! }));
    extra.forEach((p) => b.extend(p));
    map.fitBounds(b, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, clave]);
  return null;
}

function IrASeleccionado({ cliente }: { cliente: Cliente | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !cliente || !tieneUbicacion(cliente)) return;
    map.panTo({ lat: cliente.geo!.lat!, lng: cliente.geo!.lng! });
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15);
  }, [map, cliente?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

type Registro = { marcador: google.maps.marker.AdvancedMarkerElement; agrupar: boolean };

function MarcadoresAgrupados(props: {
  clientes: Cliente[];
  colorDe: (c: Cliente) => string;
  escalaDe: (c: Cliente) => number;
  posicionEnRuta: (id: string) => number | undefined;
  seleccionadoId: string | null;
  onSeleccionar: (id: string | null) => void;
  puedeCorregir: boolean;
  onCorregir: (c: Cliente) => void;
  onAbrir: (id: string) => void;
  onAlternarRuta: (c: Cliente) => void;
  carteraDe: (c: Cliente) => CarteraConjunto | undefined;
  nombreUsuario: Record<string, string>;
}) {
  const { clientes, colorDe, seleccionadoId, onSeleccionar } = props;
  const map = useMap();
  const [marcadores, setMarcadores] = useState<Record<string, Registro>>({});

  const agrupador = useMemo(() => (map ? new MarkerClusterer({ map, renderer: grupoNeutro }) : null), [map]);

  // Los conjuntos de la ruta quedan fuera del agrupador: su número tiene que verse siempre.
  useEffect(() => {
    if (!agrupador) return;
    agrupador.clearMarkers();
    agrupador.addMarkers(Object.values(marcadores).filter((r) => r.agrupar).map((r) => r.marcador));
  }, [agrupador, marcadores]);

  useEffect(() => () => { agrupador?.clearMarkers(); }, [agrupador]);

  const registrar = useCallback((marcador: google.maps.marker.AdvancedMarkerElement | null, id: string, agrupar: boolean) => {
    setMarcadores((prev) => {
      const actual = prev[id];
      if (marcador && actual?.marcador === marcador && actual.agrupar === agrupar) return prev;
      if (!marcador && !actual) return prev;
      if (marcador) return { ...prev, [id]: { marcador, agrupar } };
      const resto = { ...prev };
      delete resto[id];
      return resto;
    });
  }, []);

  const seleccionado = clientes.find((c) => c.id === seleccionadoId);

  return (
    <>
      {clientes.map((c) => (
        <MarcadorConjunto
          key={c.id}
          cliente={c}
          color={colorDe(c)}
          escala={props.escalaDe(c)}
          enRuta={props.posicionEnRuta(c.id!)}
          seleccionado={c.id === seleccionadoId}
          registrar={registrar}
          onSeleccionar={onSeleccionar}
        />
      ))}

      {seleccionado && marcadores[seleccionado.id!] && (
        <InfoWindow anchor={marcadores[seleccionado.id!].marcador} onCloseClick={() => onSeleccionar(null)} maxWidth={300}>
          <FichaConjunto
            cliente={seleccionado}
            cartera={props.carteraDe(seleccionado)}
            enRuta={props.posicionEnRuta(seleccionado.id!) !== undefined}
            nombreUsuario={props.nombreUsuario}
            puedeCorregir={props.puedeCorregir}
            onCorregir={() => props.onCorregir(seleccionado)}
            onAbrir={() => props.onAbrir(seleccionado.id!)}
            onAlternarRuta={() => props.onAlternarRuta(seleccionado)}
          />
        </InfoWindow>
      )}
    </>
  );
}

// Grupo de pines en gris neutro: el color es de las personas, y un grupo mezcla
// conjuntos de varias (el azul por defecto se confundía con un ejecutivo).
const grupoNeutro: Renderer = {
  render: ({ count, position }) => {
    const tamano = count < 10 ? 34 : count < 50 ? 40 : 46;
    const div = document.createElement("div");
    div.textContent = String(count);
    Object.assign(div.style, {
      width: `${tamano}px`,
      height: `${tamano}px`,
      borderRadius: "50%",
      background: "#374151",
      border: "3px solid rgba(255,255,255,0.9)",
      boxShadow: "0 0 0 4px rgba(55,65,81,0.25), 0 1px 4px rgba(0,0,0,0.3)",
      color: "#fff",
      font: "600 13px system-ui, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    });
    return new google.maps.marker.AdvancedMarkerElement({
      position,
      content: div,
      title: `${count} conjuntos: acerca el mapa para verlos`,
      zIndex: 1000 + count,
    });
  },
};

// Componente aparte para que el `ref` sea estable: con un callback en línea
// React lo desmonta y remonta en cada render y el agrupador entra en bucle.
function MarcadorConjunto(props: {
  cliente: Cliente;
  color: string;
  escala: number;
  enRuta: number | undefined; // undefined = no está; 0 = elegido sin calcular; n = orden de visita
  seleccionado: boolean;
  registrar: (m: google.maps.marker.AdvancedMarkerElement | null, id: string, agrupar: boolean) => void;
  onSeleccionar: (id: string) => void;
}) {
  const { cliente: c, color, registrar, onSeleccionar, enRuta } = props;
  const id = c.id!;
  const agrupar = enRuta === undefined;
  const ref = useCallback(
    (m: google.maps.marker.AdvancedMarkerElement | null) => registrar(m, id, agrupar),
    [registrar, id, agrupar]
  );
  const revisar = c.geo?.estado === "revisar";
  const glyph = enRuta ? String(enRuta) : enRuta === 0 ? "✓" : revisar ? "?" : undefined;
  return (
    <AdvancedMarker
      ref={ref}
      position={{ lat: c.geo!.lat!, lng: c.geo!.lng! }}
      title={c.nombre}
      onClick={() => onSeleccionar(id)}
      zIndex={enRuta !== undefined ? 1500 : undefined}
    >
      <Pin
        background={enRuta !== undefined ? COLOR_RUTA : color}
        borderColor={enRuta !== undefined ? "#ffffff" : revisar ? "#f59e0b" : color}
        glyphColor="#ffffff"
        glyph={glyph}
        scale={(props.seleccionado || enRuta !== undefined ? 1.3 : 1) * props.escala}
      />
    </AdvancedMarker>
  );
}

function FichaConjunto(props: {
  cliente: Cliente;
  cartera: CarteraConjunto | undefined;
  enRuta: boolean;
  nombreUsuario: Record<string, string>;
  puedeCorregir: boolean;
  onCorregir: () => void;
  onAbrir: () => void;
  onAlternarRuta: () => void;
}) {
  const { cliente: c, nombreUsuario, cartera: k } = props;
  const g = c.geo;
  const filas = RESPONSABLES.map((r) => [r.label, c[r.campo] ? nombreUsuario[c[r.campo]!] ?? "—" : null] as const).filter(
    ([, v]) => v
  );

  return (
    <div className="text-gray-800 space-y-2 min-w-[220px]">
      <div>
        <p className="font-semibold text-sm leading-snug">{c.nombre}</p>
        <p className="text-xs text-gray-600">{c.direccion || "Sin dirección"}</p>
        {(g?.localidad || (g?.municipio && g.municipio !== "Bogotá")) && (
          <p className="text-xs text-gray-500">{[g?.localidad, g?.municipio].filter(Boolean).join(", ")}</p>
        )}
      </div>

      {k && (
        <div className="rounded-md bg-gray-50 p-2 text-xs space-y-0.5">
          <p className="flex justify-between gap-3"><span className="text-gray-500">Cartera en mora</span><b className="tabular-nums">{pesosCortos(k.deuda)}</b></p>
          <p className="flex justify-between gap-3"><span className="text-gray-500">Deudores con saldo</span><span className="tabular-nums">{k.deudoresConDeuda}</span></p>
          <p className="flex justify-between gap-3"><span className="text-gray-500">Recaudo del mes</span><span className="tabular-nums">{pesosCortos(k.recaudo)}{k.deuda > 0 ? ` (${((k.recaudo / k.deuda) * 100).toLocaleString("es-CO", { maximumFractionDigits: 1 })}%)` : ""}</span></p>
          <p className="text-gray-400">Datos de {nombreMes(k.mes)}</p>
        </div>
      )}

      {g?.estado === "revisar" && (
        <p className="flex gap-1.5 text-xs text-amber-800 bg-amber-50 rounded p-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {g.motivoRevision}
        </p>
      )}
      {c.activo === false && (
        <p className="flex gap-1.5 text-xs text-gray-600"><MapPinOff className="h-3.5 w-3.5" /> Cliente inactivo</p>
      )}

      {filas.length > 0 && (
        <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          {filas.map(([k2, v]) => (
            <div key={k2} className="contents">
              <dt className="text-gray-500">{k2}</dt>
              <dd className="truncate">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <button
          type="button"
          onClick={props.onAlternarRuta}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium",
            props.enRuta ? "bg-[#0d5f7a] text-white" : "border border-[#0d5f7a] text-[#0d5f7a] hover:bg-[#0d5f7a]/5"
          )}
        >
          {props.enRuta ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {props.enRuta ? "En la ruta" : "Agregar a la ruta"}
        </button>
        <a
          href={urlComoLlegar(c)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-brand-primary px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
        >
          <Navigation className="h-3.5 w-3.5" /> Cómo llegar
        </a>
        <button type="button" onClick={props.onAbrir} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-gray-50">
          <ExternalLink className="h-3.5 w-3.5" /> Ver cliente
        </button>
        {props.puedeCorregir && (
          <button type="button" onClick={props.onCorregir} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs hover:bg-gray-50">
            <Move className="h-3.5 w-3.5" /> Corregir pin
          </button>
        )}
      </div>
    </div>
  );
}
