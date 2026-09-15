// modules/ajustes/components/RecordatorioCuotasPanel.tsx
// Panel de configuración del recordatorio de cuotas (configuracion/acuerdos).
// Primo de TareasDiariasPanel, con dos diferencias de fondo: los destinatarios
// no son el equipo sino los DEUDORES (y no hay lista que elegir — recibe quien
// tenga un acuerdo EN FIRME con una cuota a punto de vencerse), y el alcance se
// limita por conjunto, para poder estrenarlo contra una sola cartera.
import * as React from "react";
import { toast } from "sonner";
import { Building2, CalendarClock, Mail, Phone, Plus, Save, Search, X } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { cn } from "@/shared/lib/cn";
import EnviosRecordatorioTab from "./EnviosRecordatorioTab";
import { listenNumbers } from "@/modules/whatsapp/services/numbersService";
import type { WaNumber } from "@/modules/whatsapp/models/waNumber.model";
import {
  listarClientesBasico,
  type ClienteOption,
} from "@/modules/clientes/services/clienteService";
import {
  CONFIG_ACUERDOS_POR_DEFECTO,
  MAX_AVISOS,
  MAX_DIAS_ANTES,
  guardarConfigAcuerdos,
  normalizarDiasAviso,
  obtenerConfigAcuerdos,
  type ConfigAcuerdos,
} from "@/modules/cobranza/services/configuracionAcuerdosService";

const SIN_NUMERO = "__SIN_NUMERO__";

/** Datos de mentira, solo para que la vista previa se parezca a un caso real. */
const EJEMPLO = {
  nombre: "Juan",
  cuota: 2,
  total: 6,
  valor: 200000,
  fecha: new Date(2026, 7, 1),
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Copias de los formateadores de la Cloud Function, solo para la vista previa.
 * La versión que manda es la del backend
 * (functions/src/acuerdos/recordatorioCuotas.ts): si cambias el texto allá,
 * actualiza estas para que la previa no mienta.
 */
function fechaLarga(fecha: Date): string {
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

function moneda(valor: number): string {
  return `$${Math.round(valor).toLocaleString("es-CO")}`;
}

/** "5 días antes" / "1 día antes" / "el mismo día". */
function etiquetaHito(dias: number): string {
  if (dias === 0) return "El mismo día";
  return `${dias} día${dias === 1 ? "" : "s"} antes`;
}

export default function RecordatorioCuotasPanel() {
  const [config, setConfig] = React.useState<ConfigAcuerdos>(CONFIG_ACUERDOS_POR_DEFECTO);
  const [numeros, setNumeros] = React.useState<WaNumber[]>([]);
  const [clientes, setClientes] = React.useState<ClienteOption[]>([]);
  const [busqueda, setBusqueda] = React.useState("");
  const [nuevoHito, setNuevoHito] = React.useState("");
  const [cargando, setCargando] = React.useState(true);
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    obtenerConfigAcuerdos()
      .then(setConfig)
      .catch(() => toast.error("⚠️ No se pudo cargar la configuración"))
      .finally(() => setCargando(false));
  }, []);

  React.useEffect(() => listenNumbers(setNumeros), []);

  React.useEffect(() => {
    listarClientesBasico()
      .then(setClientes)
      .catch(() => toast.error("⚠️ No se pudieron cargar los conjuntos"));
  }, []);

  function actualizar(patch: Partial<ConfigAcuerdos>) {
    setConfig((c) => ({ ...c, ...patch }));
  }

  function agregarHito() {
    const dias = Number(nuevoHito);
    if (!Number.isFinite(dias) || dias < 0 || dias > MAX_DIAS_ANTES) {
      toast.error(`Escribe un número entre 0 y ${MAX_DIAS_ANTES}.`);
      return;
    }
    if (config.diasAviso.includes(Math.round(dias))) {
      toast.error("Ese aviso ya está en la lista.");
      return;
    }
    if (config.diasAviso.length >= MAX_AVISOS) {
      toast.error(`Máximo ${MAX_AVISOS} avisos por cuota.`);
      return;
    }
    actualizar({ diasAviso: normalizarDiasAviso([...config.diasAviso, dias]) });
    setNuevoHito("");
  }

  function quitarHito(dias: number) {
    actualizar({ diasAviso: config.diasAviso.filter((d) => d !== dias) });
  }

  function alternarCliente(id: string) {
    const actuales = config.clientesPermitidos;
    actualizar({
      clientesPermitidos: actuales.includes(id)
        ? actuales.filter((c) => c !== id)
        : [...actuales, id],
    });
  }

  const filtrados = React.useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return clientes;
    return clientes.filter(
      (c) => c.nombre.toLowerCase().includes(t) || c.id.toLowerCase().includes(t)
    );
  }, [clientes, busqueda]);

  /**
   * Un id guardado puede no estar en la lista (conjunto borrado, o pegado a
   * mano). El backend lo respeta igual, así que hay que verlo.
   */
  const desconocidos = React.useMemo(() => {
    const conocidos = new Set(clientes.map((c) => c.id));
    return config.clientesPermitidos.filter((id) => !conocidos.has(id));
  }, [clientes, config.clientesPermitidos]);

  async function guardar() {
    if (config.activa && !config.canalEmail && !config.canalWhatsapp) {
      toast.error("Elige al menos un canal de envío.");
      return;
    }
    if (config.activa && config.diasAviso.length === 0) {
      toast.error("Deja al menos un aviso configurado.");
      return;
    }
    if (config.canalWhatsapp && (!config.whatsappActivo || !config.numberId)) {
      toast.error("Configura la línea de WhatsApp antes de activar ese canal.");
      return;
    }
    try {
      setGuardando(true);
      await guardarConfigAcuerdos(config);
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
  const alcanceTotal = config.clientesPermitidos.length === 0;

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-brand-primary">Recordatorio de cuotas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todos los días a las 10:00 a. m. el sistema revisa los acuerdos de pago{" "}
          <strong>en firme</strong> y le escribe al deudor cuya cuota vence en alguno de los
          plazos configurados. Cada envío queda registrado como una gestión en el
          seguimiento del deudor — y si al deudor le falta el correo o el WhatsApp, también
          queda la constancia de que no se le pudo escribir por ese canal.
        </p>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuración</TabsTrigger>
          <TabsTrigger value="envios">Envíos realizados</TabsTrigger>
        </TabsList>

        <TabsContent value="envios" className="max-w-5xl pt-4">
          <EnviosRecordatorioTab />
        </TabsContent>

        <TabsContent value="config" className="max-w-3xl space-y-8 pt-4">
      {/* ── Encendido ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">Enviar el recordatorio automáticamente</Label>
          <p className="text-sm text-muted-foreground">
            Apágalo para suspender el envío sin perder la configuración.
          </p>
        </div>
        <Switch
          checked={config.activa}
          onCheckedChange={(v) => actualizar({ activa: v })}
        />
      </div>

      <div className={cn("space-y-8", !config.activa && "pointer-events-none opacity-50")}>
        {/* ── Alcance ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              ¿A qué conjuntos se les envía?
            </h2>
            <p className="text-sm text-muted-foreground">
              Sin ningún conjunto marcado se le escribe a{" "}
              <strong>todos los deudores de toda la plataforma</strong>. Marca uno o varios
              para probar contra una sola cartera antes de abrirlo.
            </p>
          </div>

          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              alcanceTotal
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-brand-primary/30 bg-brand-primary/5"
            )}
          >
            {alcanceTotal ? (
              <>
                <strong>Alcance: toda la plataforma.</strong> Se le escribirá a cualquier
                deudor con acuerdo en firme, de cualquier conjunto.
              </>
            ) : (
              <>
                <strong>
                  Alcance limitado a {config.clientesPermitidos.length} conjunto(s).
                </strong>{" "}
                Los demás conjuntos no reciben nada, aunque tengan cuotas por vencer.
              </>
            )}
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar conjunto por nombre o ID..."
                className="pl-8"
              />
            </div>

            <ScrollArea className="h-56 rounded-md border">
              <div className="p-1">
                {filtrados.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">
                    No hay conjuntos que coincidan.
                  </p>
                )}
                {filtrados.map((c) => {
                  const marcado = config.clientesPermitidos.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => alternarCliente(c.id)}
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
                        {marcado && <span className="text-[10px] leading-none">✓</span>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.nombre}</span>
                        <span className="block truncate font-mono text-[11px] text-muted-foreground">
                          {c.id}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            {desconocidos.length > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                <strong>{desconocidos.length} ID(s) guardados</strong> no aparecen en la
                lista de conjuntos: {desconocidos.join(", ")}. Siguen contando para el
                envío.
              </p>
            )}
          </div>
        </section>

        {/* ── Avisos ──────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              ¿Cuántos avisos y con cuánta anticipación?
            </h2>
            <p className="text-sm text-muted-foreground">
              Cada cuota recibe un mensaje en cada uno de estos plazos. Todos salen en la
              misma revisión de las 10:00 a. m., así que una cuota que vence el día 20
              genera su aviso el 15 y otro el 19.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {config.diasAviso.map((dias) => (
              <span
                key={dias}
                className="flex items-center gap-1.5 rounded-full border border-brand-primary/30 bg-brand-primary/5 py-1 pl-3 pr-1.5 text-sm font-medium text-brand-primary"
              >
                {etiquetaHito(dias)}
                <button
                  type="button"
                  onClick={() => quitarHito(dias)}
                  className="rounded-full p-0.5 hover:bg-brand-primary/15"
                  aria-label={`Quitar el aviso de ${etiquetaHito(dias)}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {config.diasAviso.length === 0 && (
              <span className="text-sm text-muted-foreground">
                Sin avisos configurados: no se enviaría nada.
              </span>
            )}
          </div>

          {config.diasAviso.length < MAX_AVISOS && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={MAX_DIAS_ANTES}
                value={nuevoHito}
                onChange={(e) => setNuevoHito(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregarHito();
                  }
                }}
                placeholder="días"
                className="w-24"
              />
              <Button type="button" variant="outline" onClick={agregarHito} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Agregar aviso
              </Button>
              <span className="text-xs text-muted-foreground">
                días antes de la fecha de pago (máximo {MAX_AVISOS} avisos)
              </span>
            </div>
          )}
        </section>

        {/* ── Canales ─────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">¿Por dónde se envía?</h2>

          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={config.canalEmail}
              onCheckedChange={(v) => actualizar({ canalEmail: v === true })}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Mail className="h-4 w-4" />
                Correo
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                Al primer correo registrado del deudor, desde{" "}
                <code className="rounded bg-muted px-1">carterazona1@gestionglobalacg.com</code>.
                Lleva el desglose completo: número de cuota, valor y fecha.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              checked={config.canalWhatsapp}
              onCheckedChange={(v) => actualizar({ canalWhatsapp: v === true })}
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
                Al primer teléfono registrado del deudor, con la plantilla aprobada en
                Meta. Un teléfono que no tenga 10 dígitos se descarta.
              </span>
            </span>
          </label>
        </section>

        {/* ── Vista previa ────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Así le llegaría al deudor</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">WhatsApp</p>
              <div className="rounded-lg border bg-[#e7ffdb] p-3 text-sm leading-relaxed text-[#111b21]">
                Hola {EJEMPLO.nombre}, te recordamos el pago de la cuota {EJEMPLO.cuota} de
                tu acuerdo de pago por valor de {moneda(EJEMPLO.valor)}. La fecha de pago es{" "}
                {fechaLarga(EJEMPLO.fecha)}.
                <span className="mt-2 block">
                  Si ya realizaste el pago, por favor envíanos el soporte de pago y haz caso
                  omiso a este mensaje.
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Correo</p>
              <div className="rounded-lg border bg-white p-3 text-sm leading-relaxed">
                <p className="mb-2 border-b pb-2 text-xs text-muted-foreground">
                  Asunto: Recordatorio de pago - cuota {EJEMPLO.cuota} de tu acuerdo de pago
                </p>
                Hola <strong>{EJEMPLO.nombre}</strong>, te recordamos que se aproxima el pago
                de tu acuerdo de pago.
                <span className="mt-2 block text-xs">
                  Cuota: <strong>{EJEMPLO.cuota} de {EJEMPLO.total}</strong>
                  <br />
                  Valor a pagar: <strong>{moneda(EJEMPLO.valor)}</strong>
                  <br />
                  Fecha de pago: <strong>{fechaLarga(EJEMPLO.fecha)}</strong>
                </span>
                <span className="mt-2 block rounded bg-blue-50 p-2 text-xs text-blue-800">
                  Si ya realizaste el pago, por favor envíanos el soporte de pago y haz caso
                  omiso a este mensaje.
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            El mismo texto en los dos avisos: lo que cambia es cuándo sale. El sistema lo
            arma con los datos reales de cada cuota, y la plantilla aprobada en Meta recibe
            cuatro variables: <code className="rounded bg-muted px-1">nombre</code>,{" "}
            <code className="rounded bg-muted px-1">cuota</code>,{" "}
            <code className="rounded bg-muted px-1">valor</code> y{" "}
            <code className="rounded bg-muted px-1">fecha</code>.
          </p>
        </section>
      </div>

      {/* ── Canal WhatsApp del módulo ─────────────────────────────── */}
      <section className="space-y-3 border-t pt-6">
        <div>
          <h2 className="text-base font-semibold">Canal WhatsApp de acuerdos</h2>
          <p className="text-sm text-muted-foreground">
            Es independiente del canal del calendario y del de tareas: puedes usar la misma
            línea o una distinta. Requiere una plantilla aprobada en Meta Business Suite.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <Label className="text-sm">Habilitar envíos por WhatsApp</Label>
          <Switch
            checked={config.whatsappActivo}
            onCheckedChange={(v) => actualizar({ whatsappActivo: v })}
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
              onValueChange={(v) => actualizar({ numberId: v === SIN_NUMERO ? null : v })}
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
            <Label htmlFor="plantilla-cuota">Plantilla de recordatorio de cuota</Label>
            <Input
              id="plantilla-cuota"
              value={config.plantillaCuota}
              onChange={(e) => actualizar({ plantillaCuota: e.target.value })}
              placeholder="recordatorio_cuota_acuerdo"
            />
            <p className="text-xs text-muted-foreground">
              Variables: nombre, cuota, valor, fecha. El cuerpo aprobado debe ser{" "}
              <em>
                “Hola {"{{nombre}}"}, te recordamos el pago de la cuota {"{{cuota}}"} de tu
                acuerdo de pago por valor de {"{{valor}}"}. La fecha de pago es{" "}
                {"{{fecha}}"}. Si ya realizaste el pago, por favor envíanos el soporte de
                pago y haz caso omiso a este mensaje.”
              </em>{" "}
              — Meta no acepta que el cuerpo empiece ni termine en variable.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 border-t pt-4">
        <Button onClick={guardar} disabled={guardando} variant="brand" className="gap-2">
          <Save className="h-4 w-4" />
          {guardando ? "Guardando..." : "Guardar configuración"}
        </Button>
        {config.activa && (
          <p className="text-sm text-muted-foreground">
            Próxima revisión: mañana a las 10:00 a. m.
          </p>
        )}
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
