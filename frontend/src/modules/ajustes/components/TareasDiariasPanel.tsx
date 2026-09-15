// modules/ajustes/components/TareasDiariasPanel.tsx
// Panel de configuración del recordatorio de tareas (configuracion/tareas).
// Hermano de AgendaDiariaPanel, con una diferencia de fondo: la agenda manda el
// mismo texto a todos, y aquí cada persona recibe SU propio conteo. Por eso la
// lista de destinatarios funciona como filtro y no como lista de envío.
import * as React from "react";
import { toast } from "sonner";
import { Check, Clock, ListChecks, Mail, Phone, Save, Search, Users } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/lib/cn";
import { normalizeToE164 } from "@/shared/phoneUtils";
import { suscribirUsuariosAsignablesTareas } from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { listenNumbers } from "@/modules/whatsapp/services/numbersService";
import type { WaNumber } from "@/modules/whatsapp/models/waNumber.model";
import { suscribirTareas } from "@/modules/tareas/services/tareaService";
import {
  CONFIG_TAREAS_POR_DEFECTO,
  guardarConfigTareas,
  obtenerConfigTareas,
  type ConfigTareas,
} from "@/modules/tareas/services/configuracionTareasService";

const SIN_NUMERO = "__SIN_NUMERO__";

/** Lo que cada persona tiene abierto ahora mismo. */
interface Carga {
  porEmpezar: number;
  enCurso: number;
}

function cuenta(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Copia de `frasePendientes` de la Cloud Function, solo para la vista previa.
 * La versión que manda es la del backend (functions/src/tareas/tareasDiarias.ts):
 * si cambias el texto allá, actualiza esta para que la previa no mienta.
 */
function frasePendientes(porEmpezar: number, enCurso: number): string {
  const total = porEmpezar + enCurso;
  const cierre = `Recuerda ${total === 1 ? "terminarla" : "terminarlas"} para no atrasarte.`;

  if (porEmpezar > 0 && enCurso > 0) {
    return (
      `tienes ${cuenta(total, "tarea", "tareas")} por gestionar: ` +
      `${cuenta(porEmpezar, "pendiente", "pendientes")} y ${enCurso} en curso. ${cierre}`
    );
  }
  if (enCurso > 0) {
    return `tienes ${cuenta(enCurso, "tarea", "tareas")} en curso. ${cierre}`;
  }
  return `tienes ${cuenta(porEmpezar, "tarea pendiente", "tareas pendientes")}. ${cierre}`;
}

function primerNombre(nombre?: string): string {
  return String(nombre ?? "").trim().split(/\s+/)[0] ?? "";
}

export default function TareasDiariasPanel() {
  const [config, setConfig] = React.useState<ConfigTareas>(CONFIG_TAREAS_POR_DEFECTO);
  const [usuarios, setUsuarios] = React.useState<UsuarioSistema[]>([]);
  const [numeros, setNumeros] = React.useState<WaNumber[]>([]);
  const [cargaPorUid, setCargaPorUid] = React.useState<Map<string, Carga>>(new Map());
  const [busqueda, setBusqueda] = React.useState("");
  const [cargando, setCargando] = React.useState(true);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    obtenerConfigTareas()
      .then(setConfig)
      .catch(() => toast.error("⚠️ No se pudo cargar la configuración"))
      .finally(() => setCargando(false));
  }, []);

  React.useEffect(
    () =>
      suscribirUsuariosAsignablesTareas(setUsuarios, () =>
        toast.error("⚠️ No se pudieron cargar los usuarios")
      ),
    []
  );

  React.useEffect(() => listenNumbers(setNumeros), []);

  // Las tareas abiertas de verdad, para que se vea el efecto antes de encender.
  React.useEffect(
    () =>
      suscribirTareas(
        (tareas) => {
          const mapa = new Map<string, Carga>();
          for (const tarea of tareas) {
            if (tarea.estado === "finalizada") continue;
            if (!tarea.asignadoA) continue;
            const actual = mapa.get(tarea.asignadoA) ?? { porEmpezar: 0, enCurso: 0 };
            if (tarea.estado === "en_curso") actual.enCurso++;
            else actual.porEmpezar++;
            mapa.set(tarea.asignadoA, actual);
          }
          setCargaPorUid(mapa);
        },
        () => toast.error("⚠️ No se pudieron contar las tareas abiertas")
      ),
    []
  );

  const ajustes = config.tareasDiarias;

  function actualizarAjustes(patch: Partial<ConfigTareas["tareasDiarias"]>) {
    setConfig((c) => ({ ...c, tareasDiarias: { ...c.tareasDiarias, ...patch } }));
  }

  function alternarUsuario(uid: string) {
    const seleccionados = ajustes.destinatariosUids;
    actualizarAjustes({
      destinatariosUids: seleccionados.includes(uid)
        ? seleccionados.filter((u) => u !== uid)
        : [...seleccionados, uid],
    });
  }

  const filtrados = React.useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return usuarios;
    return usuarios.filter(
      (u) =>
        (u.nombre ?? "").toLowerCase().includes(t) ||
        (u.email ?? "").toLowerCase().includes(t)
    );
  }, [usuarios, busqueda]);

  /**
   * A quién le llegaría realmente: tener tareas abiertas es condición en los dos
   * modos. Nadie recibe un "tienes 0 tareas".
   */
  const destinatariosEfectivos = React.useMemo(() => {
    const conTareas = usuarios.filter((u) => cargaPorUid.has(u.uid));
    if (ajustes.destinatarios === "conTareas") return conTareas;
    return conTareas.filter((u) => ajustes.destinatariosUids.includes(u.uid));
  }, [usuarios, cargaPorUid, ajustes.destinatarios, ajustes.destinatariosUids]);

  /**
   * Alguien puede tener tareas y haber perdido el rol asignable (o ser un uid
   * viejo). El backend le escribe igual, porque el criterio es tener tareas.
   */
  const fueraDeLista = React.useMemo(() => {
    const conocidos = new Set(usuarios.map((u) => u.uid));
    return [...cargaPorUid.keys()].filter((uid) => !conocidos.has(uid));
  }, [usuarios, cargaPorUid]);

  const sinCorreo = destinatariosEfectivos.filter((u) => !u.email);
  const sinTelefono = destinatariosEfectivos.filter(
    (u) => !normalizeToE164(u.telefonoUsuario, { defaultCountry: "CO" })
  );

  const totalAbiertas = React.useMemo(
    () =>
      [...cargaPorUid.values()].reduce((acc, c) => acc + c.porEmpezar + c.enCurso, 0),
    [cargaPorUid]
  );

  /** La previa se arma con la carga real de la primera persona que recibiría. */
  const ejemplo = React.useMemo(() => {
    const persona = destinatariosEfectivos[0];
    const carga = persona ? cargaPorUid.get(persona.uid) : undefined;
    if (!persona || !carga) return null;
    return {
      nombre: primerNombre(persona.nombre) || persona.email,
      frase: frasePendientes(carga.porEmpezar, carga.enCurso),
    };
  }, [destinatariosEfectivos, cargaPorUid]);

  async function guardar() {
    if (ajustes.activa && !ajustes.canalEmail && !ajustes.canalWhatsapp) {
      toast.error("Elige al menos un canal de envío.");
      return;
    }
    if (
      ajustes.activa &&
      ajustes.destinatarios === "seleccion" &&
      ajustes.destinatariosUids.length === 0
    ) {
      toast.error("Selecciona al menos una persona.");
      return;
    }
    try {
      setGuardando(true);
      await guardarConfigTareas(config);
      toast.success("✓ Configuración guardada");
    } catch {
      toast.error("⚠️ No se pudo guardar la configuración");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return <p className="text-sm text-muted-foreground">Cargando configuración...</p>;
  }

  const whatsappListo = config.whatsappActivo && !!config.numberId;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Tareas diarias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          De lunes a sábado a las 8:00 a. m. cada persona recibe el conteo de{" "}
          <strong>sus propias</strong> tareas abiertas: las pendientes y las que están
          en curso. El domingo no se envía nada, y quien no tenga tareas abiertas
          tampoco recibe mensaje.
        </p>
      </div>

      {/* ── Encendido ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">Enviar el recordatorio cada mañana</Label>
          <p className="text-sm text-muted-foreground">
            Apágalo para suspender el envío sin perder la configuración.
          </p>
        </div>
        <Switch
          checked={ajustes.activa}
          onCheckedChange={(v) => actualizarAjustes({ activa: v })}
        />
      </div>

      <div className={cn("space-y-8", !ajustes.activa && "pointer-events-none opacity-50")}>
        {/* ── Destinatarios ───────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              ¿A quién se le recuerda?
            </h2>
            <p className="text-sm text-muted-foreground">
              Cada uno recibe <strong>solo sus</strong> tareas, no las del equipo.
              Ahora mismo hay {totalAbiertas} tarea(s) abierta(s) repartidas entre{" "}
              {cargaPorUid.size} persona(s).
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => actualizarAjustes({ destinatarios: "conTareas" })}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors",
                ajustes.destinatarios === "conTareas"
                  ? "border-brand-primary bg-brand-primary/5"
                  : "hover:bg-muted/50"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {ajustes.destinatarios === "conTareas" && (
                  <Check className="h-4 w-4 text-brand-primary" />
                )}
                Todos los que tengan tareas
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Quien tenga al menos una tarea abierta. Si entra alguien nuevo y se
                le asignan tareas, lo recibe automáticamente.
              </span>
            </button>

            <button
              type="button"
              onClick={() => actualizarAjustes({ destinatarios: "seleccion" })}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors",
                ajustes.destinatarios === "seleccion"
                  ? "border-brand-primary bg-brand-primary/5"
                  : "hover:bg-muted/50"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {ajustes.destinatarios === "seleccion" && (
                  <Check className="h-4 w-4 text-brand-primary" />
                )}
                Solo estas personas
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Eliges tú la lista. Hoy: {ajustes.destinatariosUids.length}{" "}
                seleccionada(s).
              </span>
            </button>
          </div>

          {ajustes.destinatarios === "seleccion" && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o correo..."
                  className="pl-8"
                />
              </div>

              <ScrollArea className="h-64 rounded-md border">
                <div className="p-1">
                  {filtrados.length === 0 && (
                    <p className="p-3 text-sm text-muted-foreground">
                      No hay usuarios que coincidan.
                    </p>
                  )}
                  {filtrados.map((u) => {
                    const marcado = ajustes.destinatariosUids.includes(u.uid);
                    const telefono = normalizeToE164(u.telefonoUsuario, {
                      defaultCountry: "CO",
                    });
                    const carga = cargaPorUid.get(u.uid);
                    const abiertas = carga ? carga.porEmpezar + carga.enCurso : 0;
                    return (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() => alternarUsuario(u.uid)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                          marcado && "bg-accent/50"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            marcado
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input"
                          )}
                        >
                          {marcado && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {u.nombre || u.email}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {u.email || "sin correo"}
                            {telefono ? ` · ${telefono}` : " · sin teléfono"}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2 py-0.5 text-xs",
                            abiertas > 0
                              ? "border-brand-primary/30 bg-brand-primary/5 text-brand-primary"
                              : "border-transparent text-muted-foreground"
                          )}
                        >
                          {abiertas > 0 ? `${abiertas} abierta(s)` : "sin tareas"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </section>

        {/* ── Canales ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">¿Por dónde se envía?</h2>

          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={ajustes.canalEmail}
              onCheckedChange={(v) => actualizarAjustes({ canalEmail: v === true })}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Mail className="h-4 w-4" />
                Correo
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                Además del conteo lleva la lista completa: título, prioridad y fecha
                límite de cada tarea, con las vencidas de primeras.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={ajustes.canalWhatsapp}
              onCheckedChange={(v) => actualizarAjustes({ canalWhatsapp: v === true })}
              disabled={!whatsappListo}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Phone className="h-4 w-4" />
                WhatsApp
                {!whatsappListo && (
                  <span className="text-xs font-normal text-amber-600">
                    (falta configurar abajo)
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                Solo el conteo en una frase: las plantillas de Meta no aceptan saltos
                de línea, así que el detalle va por correo.
              </span>
            </span>
          </label>
        </section>

        {/* ── Vista previa ────────────────────────────────────────── */}
        {ejemplo && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Así le llegaría hoy a {ejemplo.nombre}</h2>
            <div className="rounded-lg border bg-[#e7ffdb] p-3 text-sm leading-relaxed text-[#111b21]">
              Hola {ejemplo.nombre}, {ejemplo.frase} Entra al tablero de Gestión
              Global para ponerte al día.
              <span className="mt-2 block border-t border-black/10 pt-2 text-center text-xs font-medium text-[#027eb5]">
                Ver mis tareas
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              El texto lo arma el sistema con las tareas reales de cada persona. La
              plantilla aprobada en Meta solo recibe dos variables:{" "}
              <code className="rounded bg-muted px-1">nombre</code> y{" "}
              <code className="rounded bg-muted px-1">descripcion</code>.
            </p>
          </section>
        )}

        {/* ── Avisos ──────────────────────────────────────────────── */}
        {(sinCorreo.length > 0 || sinTelefono.length > 0 || fueraDeLista.length > 0) && (
          <section className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {ajustes.canalEmail && sinCorreo.length > 0 && (
              <p>
                <strong>Sin correo registrado</strong> (no recibirán el recordatorio):{" "}
                {sinCorreo.map((u) => u.nombre || u.uid).join(", ")}.
              </p>
            )}
            {ajustes.canalWhatsapp && sinTelefono.length > 0 && (
              <p>
                <strong>Sin teléfono válido</strong> (no recibirán el WhatsApp):{" "}
                {sinTelefono.map((u) => u.nombre || u.uid).join(", ")}.
              </p>
            )}
            {fueraDeLista.length > 0 && (
              <p>
                <strong>{fueraDeLista.length} persona(s) con tareas</strong> ya no
                aparecen en la lista de asignables (rol cambiado o usuario inactivo).
                El recordatorio se decide por tener tareas, así que igual se les
                escribe si su usuario sigue activo.
              </p>
            )}
          </section>
        )}
      </div>

      {/* ── Canal WhatsApp del módulo ─────────────────────────────── */}
      <section className="space-y-3 border-t pt-6">
        <div>
          <h2 className="text-base font-semibold">Canal WhatsApp de tareas</h2>
          <p className="text-sm text-muted-foreground">
            Es independiente del canal del calendario: puedes usar la misma línea o
            una distinta. Requiere una plantilla aprobada en Meta Business Suite.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <Label className="text-sm">Habilitar envíos por WhatsApp</Label>
          <Switch
            checked={config.whatsappActivo}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, whatsappActivo: v }))}
          />
        </div>

        <div
          className={cn(
            "space-y-3",
            !config.whatsappActivo && "pointer-events-none opacity-50"
          )}
        >
          <div className="space-y-1.5">
            <Label>Línea de WhatsApp</Label>
            <Select
              value={config.numberId ?? SIN_NUMERO}
              onValueChange={(v) =>
                setConfig((c) => ({ ...c, numberId: v === SIN_NUMERO ? null : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una línea" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_NUMERO}>Sin definir</SelectItem>
                {numeros.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plantilla-tareas">Plantilla de tareas pendientes</Label>
            <Input
              id="plantilla-tareas"
              value={config.plantillaTareas}
              onChange={(e) =>
                setConfig((c) => ({ ...c, plantillaTareas: e.target.value }))
              }
              placeholder="tareas_pendientes_diarias"
            />
            <p className="text-xs text-muted-foreground">
              Variables: nombre, descripcion. El cuerpo aprobado debe ser{" "}
              <em>“Hola {"{{nombre}}"}, {"{{descripcion}}"} Entra al tablero de
              Gestión Global para ponerte al día.”</em> — Meta no acepta que el
              cuerpo empiece ni termine en variable.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button onClick={guardar} disabled={guardando} variant="brand" className="gap-2">
          <Save className="h-4 w-4" />
          {guardando ? "Guardando..." : "Guardar configuración"}
        </Button>
        {ajustes.activa && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {destinatariosEfectivos.length > 0 ? (
              <>
                <Clock className="h-4 w-4" />
                Con las tareas de hoy recibirían {destinatariosEfectivos.length}{" "}
                persona(s) a las 8:00 a. m.
              </>
            ) : (
              <>
                <ListChecks className="h-4 w-4" />
                Con las tareas de hoy no se enviaría nada.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
