// Mapa de conjuntos: dónde queda cada cliente, quién lo atiende y cómo llegar.
//
// Las coordenadas ya vienen en `cliente.geo` (las calcula la Cloud Function
// `geocodificarCliente`), así que abrir esta página solo cuesta la carga del
// mapa: nada de geocodificar en el navegador.

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
  ExternalLink,
  MapPin,
  MapPinOff,
  Move,
  Navigation,
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
import { obtenerFranquicias } from "@/modules/franquicias/services/franquiciaService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";
import { guardarUbicacionManual, tieneUbicacion, urlComoLlegar } from "../services/mapaService";
import { ROLES_MAPA_CONJUNTOS } from "../constants";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
// DEMO_MAP_ID sirve para desarrollo; en producción va el Map ID propio.
const MAP_ID = (import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined) || "DEMO_MAP_ID";
const BOGOTA = { lat: 4.65, lng: -74.1 };

const TODAS = "__ALL__";
const SIN_ASIGNAR = "__NONE__";

type CampoResponsable = "ejecutivoPrejuridicoId" | "ejecutivoJuridicoId" | "abogadoId" | "ejecutivoDependienteId";
const RESPONSABLES: { campo: CampoResponsable; label: string }[] = [
  { campo: "ejecutivoPrejuridicoId", label: "Ejecutivo prejurídico" },
  { campo: "ejecutivoJuridicoId", label: "Ejecutivo jurídico" },
  { campo: "abogadoId", label: "Abogado" },
  { campo: "ejecutivoDependienteId", label: "Dependiente" },
];

// Colores bien distinguibles entre sí sobre el mapa; gris = sin asignar.
const PALETA = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#db2777", "#65a30d", "#7c3aed", "#ca8a04", "#0f766e", "#b91c1c"];
const GRIS = "#6b7280";

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
  const [franquicias, setFranquicias] = useState<Franquicia[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [cargando, setCargando] = useState(true);

  const [q, setQ] = useState("");
  const [franquiciaFiltro, setFranquiciaFiltro] = useState(TODAS);
  const [campo, setCampo] = useState<CampoResponsable>("ejecutivoPrejuridicoId");
  const [responsableFiltro, setResponsableFiltro] = useState(TODAS);
  const [verInactivos, setVerInactivos] = useState(false);
  const [pestana, setPestana] = useState<Pestana>("ubicados");

  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  // Pin en corrección: posición provisional hasta que se guarde.
  const [moviendo, setMoviendo] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [centroMapa, setCentroMapa] = useState<google.maps.LatLngLiteral>(BOGOTA);

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
          obtenerFranquicias(),
          obtenerUsuarios(),
        ]);
        setClientes(cs);
        setFranquicias(fs);
        setUsuarios(us);
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar los conjuntos");
      } finally {
        setCargando(false);
      }
    })();
  }, [userLoading, usuario?.uid, roles, usuarioSistema?.franquiciasAsignadas]);

  const nombreUsuario = useMemo(() => {
    const m: Record<string, string> = {};
    usuarios.forEach((u) => { m[u.uid] = u.nombre || u.email || u.uid; });
    return m;
  }, [usuarios]);

  // Filtro por franquicia, estado y texto: base para los responsables disponibles.
  const base = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return clientes.filter((c) => {
      if (!verInactivos && c.activo === false) return false;
      if (franquiciaFiltro !== TODAS && (c.franquiciaId ?? "") !== franquiciaFiltro) return false;
      if (texto && !`${c.nombre ?? ""} ${c.direccion ?? ""} ${c.geo?.localidad ?? ""}`.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [clientes, verInactivos, franquiciaFiltro, q]);

  // Personas que aparecen en el rol elegido, con su color fijo.
  const responsables = useMemo(() => {
    const ids = Array.from(new Set(base.map((c) => c[campo]).filter(Boolean) as string[]));
    ids.sort((a, b) => (nombreUsuario[a] ?? a).localeCompare(nombreUsuario[b] ?? b));
    return ids.map((id, i) => ({ id, nombre: nombreUsuario[id] ?? "Usuario desconocido", color: PALETA[i % PALETA.length] }));
  }, [base, campo, nombreUsuario]);

  const colorDe = useCallback(
    (c: Cliente) => responsables.find((r) => r.id === c[campo])?.color ?? GRIS,
    [responsables, campo]
  );

  const filtrados = useMemo(() => {
    if (responsableFiltro === TODAS) return base;
    return base.filter((c) => (responsableFiltro === SIN_ASIGNAR ? !c[campo] : c[campo] === responsableFiltro));
  }, [base, responsableFiltro, campo]);

  const ubicados = useMemo(() => filtrados.filter(tieneUbicacion), [filtrados]);
  const porRevisar = useMemo(() => ubicados.filter((c) => c.geo?.estado === "revisar"), [ubicados]);
  const sinUbicar = useMemo(() => filtrados.filter((c) => !tieneUbicacion(c)), [filtrados]);

  const lista = pestana === "ubicados" ? ubicados : pestana === "revisar" ? porRevisar : sinUbicar;
  const seleccionado = clientes.find((c) => c.id === seleccionadoId) ?? null;

  // Si el filtro cambia el rol, el responsable elegido deja de tener sentido.
  useEffect(() => { setResponsableFiltro(TODAS); }, [campo]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-4">
        <header className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-primary/10">
            <MapPin className="h-6 w-6 text-brand-primary" />
          </div>
          <div>
            <Typography variant="h2" className="!text-brand-primary font-bold">
              Mapa de conjuntos
            </Typography>
            <Typography variant="small" className="mt-0.5">
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

          {franquicias.length > 1 && (
            <div>
              <Label className="mb-1.5 block text-brand-secondary font-medium">Franquicia</Label>
              <Select value={franquiciaFiltro} onValueChange={setFranquiciaFiltro}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas</SelectItem>
                  {franquicias.map((f) => (
                    <SelectItem key={f.id} value={f.id!}>{f.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="mb-1.5 block text-brand-secondary font-medium">Colorear por</Label>
            <Select value={campo} onValueChange={(v) => setCampo(v as CampoResponsable)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
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

        {/* Leyenda = filtro por responsable */}
        {responsables.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <ChipResponsable activo={responsableFiltro === TODAS} onClick={() => setResponsableFiltro(TODAS)} etiqueta="Todos" />
            {responsables.map((r) => (
              <ChipResponsable
                key={r.id}
                activo={responsableFiltro === r.id}
                onClick={() => setResponsableFiltro(responsableFiltro === r.id ? TODAS : r.id)}
                etiqueta={r.nombre}
                color={r.color}
                cantidad={base.filter((c) => c[campo] === r.id).length}
              />
            ))}
            <ChipResponsable
              activo={responsableFiltro === SIN_ASIGNAR}
              onClick={() => setResponsableFiltro(responsableFiltro === SIN_ASIGNAR ? TODAS : SIN_ASIGNAR)}
              etiqueta="Sin asignar"
              color={GRIS}
              cantidad={base.filter((c) => !c[campo]).length}
            />
          </div>
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
              {lista.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSeleccionadoId(c.id!)}
                    className={cn("w-full text-left p-3 hover:bg-gray-50 flex gap-2.5", seleccionadoId === c.id && "bg-brand-primary/5")}
                  >
                    <span className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ background: colorDe(c) }} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{c.nombre}</span>
                      <span className="block text-xs text-gray-500 truncate">
                        {c.direccion || "Sin dirección"}
                        {c.geo?.localidad ? ` · ${c.geo.localidad}` : c.geo?.municipio && c.geo.municipio !== "Bogotá" ? ` · ${c.geo.municipio}` : ""}
                      </span>
                      {pestana !== "ubicados" && c.geo?.motivoRevision && (
                        <span className="block text-xs text-amber-700 mt-0.5">{c.geo.motivoRevision}</span>
                      )}
                    </span>
                  </button>
                  {pestana === "sin" && puedeCorregir && seleccionadoId === c.id && !moviendo && (
                    <div className="px-3 pb-3">
                      <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => iniciarCorreccion(c)}>
                        <MapPin className="h-4 w-4" /> Ubicarlo en el mapa
                      </Button>
                    </div>
                  )}
                </li>
              ))}
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
              <AjustarVista clientes={ubicados} />
              <IrASeleccionado cliente={seleccionado} />
              <MarcadoresAgrupados
                clientes={ubicados.filter((c) => c.id !== moviendo?.id)}
                colorDe={colorDe}
                seleccionadoId={seleccionadoId}
                onSeleccionar={setSeleccionadoId}
                puedeCorregir={puedeCorregir && !moviendo}
                onCorregir={iniciarCorreccion}
                onAbrir={(id) => navigate(`/clientes/${id}`)}
                nombreUsuario={nombreUsuario}
              />
              {moviendo && (
                <AdvancedMarker
                  position={{ lat: moviendo.lat, lng: moviendo.lng }}
                  draggable
                  zIndex={1000}
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

function ChipResponsable(props: { activo: boolean; onClick: () => void; etiqueta: string; color?: string; cantidad?: number }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        props.activo ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-gray-200 bg-white hover:bg-gray-50"
      )}
    >
      {props.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: props.color }} />}
      {props.etiqueta}
      {props.cantidad != null && <span className="text-gray-500">{props.cantidad}</span>}
    </button>
  );
}

/** Encuadra el mapa en los conjuntos visibles cada vez que cambia el filtro. */
function AjustarVista({ clientes }: { clientes: Cliente[] }) {
  const map = useMap();
  const clave = clientes.map((c) => c.id).join(",");
  useEffect(() => {
    if (!map || clientes.length === 0) return;
    if (clientes.length === 1) {
      map.setCenter({ lat: clientes[0].geo!.lat!, lng: clientes[0].geo!.lng! });
      map.setZoom(15);
      return;
    }
    const b = new google.maps.LatLngBounds();
    clientes.forEach((c) => b.extend({ lat: c.geo!.lat!, lng: c.geo!.lng! }));
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

function MarcadoresAgrupados(props: {
  clientes: Cliente[];
  colorDe: (c: Cliente) => string;
  seleccionadoId: string | null;
  onSeleccionar: (id: string | null) => void;
  puedeCorregir: boolean;
  onCorregir: (c: Cliente) => void;
  onAbrir: (id: string) => void;
  nombreUsuario: Record<string, string>;
}) {
  const { clientes, colorDe, seleccionadoId, onSeleccionar } = props;
  const map = useMap();
  const [marcadores, setMarcadores] = useState<Record<string, google.maps.marker.AdvancedMarkerElement>>({});

  const agrupador = useMemo(() => (map ? new MarkerClusterer({ map, renderer: grupoNeutro }) : null), [map]);

  useEffect(() => {
    if (!agrupador) return;
    agrupador.clearMarkers();
    agrupador.addMarkers(Object.values(marcadores));
  }, [agrupador, marcadores]);

  useEffect(() => () => { agrupador?.clearMarkers(); }, [agrupador]);

  const registrar = useCallback((marcador: google.maps.marker.AdvancedMarkerElement | null, id: string) => {
    setMarcadores((prev) => {
      if ((marcador && prev[id] === marcador) || (!marcador && !prev[id])) return prev;
      if (marcador) return { ...prev, [id]: marcador };
      const { [id]: _quitado, ...resto } = prev;
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
          seleccionado={c.id === seleccionadoId}
          registrar={registrar}
          onSeleccionar={onSeleccionar}
        />
      ))}

      {seleccionado && marcadores[seleccionado.id!] && (
        <InfoWindow anchor={marcadores[seleccionado.id!]} onCloseClick={() => onSeleccionar(null)} maxWidth={300}>
          <FichaConjunto
            cliente={seleccionado}
            nombreUsuario={props.nombreUsuario}
            puedeCorregir={props.puedeCorregir}
            onCorregir={() => props.onCorregir(seleccionado)}
            onAbrir={() => props.onAbrir(seleccionado.id!)}
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
  seleccionado: boolean;
  registrar: (m: google.maps.marker.AdvancedMarkerElement | null, id: string) => void;
  onSeleccionar: (id: string) => void;
}) {
  const { cliente: c, color, registrar, onSeleccionar } = props;
  const id = c.id!;
  const ref = useCallback((m: google.maps.marker.AdvancedMarkerElement | null) => registrar(m, id), [registrar, id]);
  const revisar = c.geo?.estado === "revisar";
  return (
    <AdvancedMarker ref={ref} position={{ lat: c.geo!.lat!, lng: c.geo!.lng! }} title={c.nombre} onClick={() => onSeleccionar(id)}>
      <Pin
        background={color}
        borderColor={revisar ? "#f59e0b" : color}
        glyphColor="#ffffff"
        glyph={revisar ? "?" : undefined}
        scale={props.seleccionado ? 1.3 : 1}
      />
    </AdvancedMarker>
  );
}

function FichaConjunto(props: {
  cliente: Cliente;
  nombreUsuario: Record<string, string>;
  puedeCorregir: boolean;
  onCorregir: () => void;
  onAbrir: () => void;
}) {
  const { cliente: c, nombreUsuario } = props;
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
          {filas.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-gray-500">{k}</dt>
              <dd className="truncate">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
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
