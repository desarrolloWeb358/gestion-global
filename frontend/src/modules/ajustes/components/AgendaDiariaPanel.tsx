// modules/ajustes/components/AgendaDiariaPanel.tsx
// Panel de configuración del módulo Calendario (configuracion/eventos).
// Controla el resumen nocturno de la agenda y el canal WhatsApp del módulo.
import * as React from "react";
import { toast } from "sonner";
import { CalendarClock, Check, Mail, Phone, Save, Search, Users } from "lucide-react";

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
import { suscribirUsuariosEquipoInterno } from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { listenNumbers } from "@/modules/whatsapp/services/numbersService";
import type { WaNumber } from "@/modules/whatsapp/models/waNumber.model";
import {
  CONFIG_EVENTOS_POR_DEFECTO,
  guardarConfigEventos,
  obtenerConfigEventos,
  type ConfigEventos,
} from "@/modules/eventos/services/configuracionEventosService";

const SIN_NUMERO = "__SIN_NUMERO__";

export default function AgendaDiariaPanel() {
  const [config, setConfig] = React.useState<ConfigEventos>(CONFIG_EVENTOS_POR_DEFECTO);
  const [usuarios, setUsuarios] = React.useState<UsuarioSistema[]>([]);
  const [numeros, setNumeros] = React.useState<WaNumber[]>([]);
  const [busqueda, setBusqueda] = React.useState("");
  const [cargando, setCargando] = React.useState(true);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    obtenerConfigEventos()
      .then(setConfig)
      .catch(() => toast.error("⚠️ No se pudo cargar la configuración"))
      .finally(() => setCargando(false));
  }, []);

  React.useEffect(
    () =>
      suscribirUsuariosEquipoInterno(setUsuarios, () =>
        toast.error("⚠️ No se pudieron cargar los usuarios")
      ),
    []
  );

  React.useEffect(() => listenNumbers(setNumeros), []);

  const agenda = config.agendaDiaria;

  function actualizarAgenda(patch: Partial<ConfigEventos["agendaDiaria"]>) {
    setConfig((c) => ({ ...c, agendaDiaria: { ...c.agendaDiaria, ...patch } }));
  }

  function alternarUsuario(uid: string) {
    const seleccionados = agenda.destinatariosUids;
    actualizarAgenda({
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

  /** A quién le llegaría realmente con la configuración actual. */
  const destinatariosEfectivos = React.useMemo(() => {
    if (agenda.destinatarios === "equipo") return usuarios;
    return usuarios.filter((u) => agenda.destinatariosUids.includes(u.uid));
  }, [usuarios, agenda.destinatarios, agenda.destinatariosUids]);

  const sinCorreo = destinatariosEfectivos.filter((u) => !u.email);
  const sinTelefono = destinatariosEfectivos.filter(
    (u) => !normalizeToE164(u.telefonoUsuario, { defaultCountry: "CO" })
  );

  async function guardar() {
    if (agenda.activa && !agenda.canalEmail && !agenda.canalWhatsapp) {
      toast.error("Elige al menos un canal de envío.");
      return;
    }
    if (agenda.activa && agenda.destinatarios === "seleccion" && agenda.destinatariosUids.length === 0) {
      toast.error("Selecciona al menos una persona.");
      return;
    }
    try {
      setGuardando(true);
      await guardarConfigEventos(config);
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
        <h1 className="text-2xl font-bold text-brand-primary">Agenda diaria</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas las noches a las 8:00 p. m. se envía el resumen de los eventos del
          día siguiente. Si no hay eventos programados, no se envía nada.
        </p>
      </div>

      {/* ── Encendido ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">Enviar el resumen cada noche</Label>
          <p className="text-sm text-muted-foreground">
            Apágalo para suspender el envío sin perder la configuración.
          </p>
        </div>
        <Switch
          checked={agenda.activa}
          onCheckedChange={(v) => actualizarAgenda({ activa: v })}
        />
      </div>

      <div className={cn("space-y-8", !agenda.activa && "pointer-events-none opacity-50")}>
        {/* ── Destinatarios ───────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-muted-foreground" />
              ¿Quién recibe la agenda?
            </h2>
            <p className="text-sm text-muted-foreground">
              Todos reciben la agenda <strong>completa</strong> del día, no solo sus
              propios eventos.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => actualizarAgenda({ destinatarios: "equipo" })}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors",
                agenda.destinatarios === "equipo"
                  ? "border-brand-primary bg-brand-primary/5"
                  : "hover:bg-muted/50"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {agenda.destinatarios === "equipo" && (
                  <Check className="h-4 w-4 text-brand-primary" />
                )}
                Todo el equipo
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Los {usuarios.length} usuarios internos activos. Si entra alguien
                nuevo, lo recibe automáticamente.
              </span>
            </button>

            <button
              type="button"
              onClick={() => actualizarAgenda({ destinatarios: "seleccion" })}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors",
                agenda.destinatarios === "seleccion"
                  ? "border-brand-primary bg-brand-primary/5"
                  : "hover:bg-muted/50"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {agenda.destinatarios === "seleccion" && (
                  <Check className="h-4 w-4 text-brand-primary" />
                )}
                Solo estas personas
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Eliges tú la lista. Hoy: {agenda.destinatariosUids.length}{" "}
                seleccionada(s).
              </span>
            </button>
          </div>

          {agenda.destinatarios === "seleccion" && (
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
                    const marcado = agenda.destinatariosUids.includes(u.uid);
                    const telefono = normalizeToE164(u.telefonoUsuario, {
                      defaultCountry: "CO",
                    });
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
              checked={agenda.canalEmail}
              onCheckedChange={(v) => actualizarAgenda({ canalEmail: v === true })}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Mail className="h-4 w-4" />
                Correo
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                La agenda sale con el formato completo, un evento por línea. Es el
                canal recomendado.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={agenda.canalWhatsapp}
              onCheckedChange={(v) => actualizarAgenda({ canalWhatsapp: v === true })}
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
                Llega a cada persona por separado: WhatsApp no permite enviar a
                grupos.
              </span>
            </span>
          </label>

          {agenda.canalWhatsapp && (
            <div className="ml-7 space-y-2 rounded-lg border p-3">
              <Label className="text-sm">Cómo se ve la agenda en WhatsApp</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => actualizarAgenda({ formatoWhatsapp: "imagen" })}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm transition-colors",
                    agenda.formatoWhatsapp === "imagen"
                      ? "border-brand-primary bg-brand-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {agenda.formatoWhatsapp === "imagen" && (
                      <Check className="h-4 w-4 text-brand-primary" />
                    )}
                    Imagen
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Se dibuja la agenda con el logo, un color por categoría y una
                    tarjeta por evento. Requiere la plantilla con encabezado de
                    imagen.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => actualizarAgenda({ formatoWhatsapp: "texto" })}
                  className={cn(
                    "rounded-lg border p-3 text-left text-sm transition-colors",
                    agenda.formatoWhatsapp === "texto"
                      ? "border-brand-primary bg-brand-primary/5"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    {agenda.formatoWhatsapp === "texto" && (
                      <Check className="h-4 w-4 text-brand-primary" />
                    )}
                    Texto
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Todos los eventos en un solo renglón separados por barras: las
                    plantillas de Meta no aceptan saltos de línea.
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Avisos de datos faltantes ───────────────────────────── */}
        {(sinCorreo.length > 0 || sinTelefono.length > 0) && (
          <section className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {agenda.canalEmail && sinCorreo.length > 0 && (
              <p>
                <strong>Sin correo registrado</strong> (no recibirán la agenda):{" "}
                {sinCorreo.map((u) => u.nombre || u.uid).join(", ")}.
              </p>
            )}
            {agenda.canalWhatsapp && sinTelefono.length > 0 && (
              <p>
                <strong>Sin teléfono válido</strong> (no recibirán el WhatsApp):{" "}
                {sinTelefono.map((u) => u.nombre || u.uid).join(", ")}.
              </p>
            )}
          </section>
        )}
      </div>

      {/* ── Canal WhatsApp del módulo ─────────────────────────────── */}
      <section className="space-y-3 border-t pt-6">
        <div>
          <h2 className="text-base font-semibold">Canal WhatsApp del calendario</h2>
          <p className="text-sm text-muted-foreground">
            Aplica tanto a la agenda diaria como a los recordatorios de cada evento.
            Requiere plantillas aprobadas en Meta Business Suite.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <Label className="text-sm">Habilitar envíos por WhatsApp</Label>
          <Switch
            checked={config.whatsappActivo}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, whatsappActivo: v }))}
          />
        </div>

        <div className={cn("space-y-3", !config.whatsappActivo && "pointer-events-none opacity-50")}>
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plantilla-recordatorio">Plantilla de recordatorio</Label>
              <Input
                id="plantilla-recordatorio"
                value={config.plantillaRecordatorio}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, plantillaRecordatorio: e.target.value }))
                }
                placeholder="recordatorio_reunion"
              />
              <p className="text-xs text-muted-foreground">
                Variables: nombre, evento, fecha, hora, lugar.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plantilla-agenda">Plantilla de agenda (texto)</Label>
              <Input
                id="plantilla-agenda"
                value={config.plantillaAgenda}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, plantillaAgenda: e.target.value }))
                }
                placeholder="agenda_diaria"
              />
              <p className="text-xs text-muted-foreground">
                Variables: fecha, agenda.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plantilla-agenda-imagen">Plantilla de agenda (imagen)</Label>
              <Input
                id="plantilla-agenda-imagen"
                value={config.plantillaAgendaImagen}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, plantillaAgendaImagen: e.target.value }))
                }
                placeholder="agenda_diaria_imagen"
              />
              <p className="text-xs text-muted-foreground">
                Encabezado de tipo imagen. Variable del cuerpo: fecha.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button onClick={guardar} disabled={guardando} variant="brand" className="gap-2">
          <Save className="h-4 w-4" />
          {guardando ? "Guardando..." : "Guardar configuración"}
        </Button>
        {agenda.activa && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            Próximo envío: hoy a las 8:00 p. m. a {destinatariosEfectivos.length}{" "}
            persona(s).
          </p>
        )}
      </div>
    </div>
  );
}
