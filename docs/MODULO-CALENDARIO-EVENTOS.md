# Módulo Calendario / Eventos — GestionGlobal

Agenda interna del equipo: reuniones presenciales y virtuales, capacitaciones,
audiencias y visitas, con aviso automático a los asistentes, recordatorios por
plataforma, correo y WhatsApp, y un resumen de la agenda del día siguiente cada
noche a las 8:00 p. m.

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Por qué un módulo aparte de Tareas](#2-por-qué-un-módulo-aparte-de-tareas)
3. [Arquitectura](#3-arquitectura)
4. [Modelo de Datos](#4-modelo-de-datos)
5. [Backend — Cloud Functions](#5-backend--cloud-functions)
6. [Frontend — Módulo React](#6-frontend--módulo-react)
7. [Permisos (RBAC)](#7-permisos-rbac)
8. [Índices de Firestore](#8-índices-de-firestore)
9. [Costo real de la infraestructura](#9-costo-real-de-la-infraestructura)
10. [Puesta en marcha](#10-puesta-en-marcha)
11. [Pendientes y decisiones tomadas](#11-pendientes-y-decisiones-tomadas)

---

## 1. Resumen Ejecutivo

### Qué hace

- Calendario con vistas **Mes / Semana / Día**, arrastrar para mover y estirar
  para cambiar la duración. Todo se maneja en **bloques de media hora**.
- Eventos **presenciales, virtuales o híbridos**, con lugar y/o enlace de reunión.
  El **enlace es opcional**: se agenda primero y se pega el link después, editando.
- **Hora final opcional**: un evento puede tener solo hora de inicio. Al activarla
  se propone media hora después, que es el bloque mínimo.
- **Cruce de horario bloqueante**: si alguno de los asistentes ya tiene otro
  compromiso a esa hora, el evento **no se guarda**. Se avisa en vivo mientras se
  edita y se vuelve a verificar contra Firestore al pulsar Guardar.
- **Conjunto opcional**: un evento se puede asociar a un cliente buscándolo por
  parte del nombre, para poder contar después cuántas reuniones o jornadas se
  hicieron con cada uno.
- **Aviso automático** al agendar a alguien, por los canales que elija quien
  agenda (plataforma / correo / WhatsApp, o ninguno). No hay que aceptar nada:
  estar en la lista significa asistir.
- **Excusa**: quien no pueda ir lo marca (con motivo opcional) y se avisa a quien
  agendó y al resto de asistentes.
- **Agenda diaria**: cada noche a las 8:00 p. m. sale el resumen del día
  siguiente por correo y WhatsApp.
- **Recordatorios configurables**: hasta 4 por evento, cada uno con su antelación
  (10 min a 1 semana) y sus canales (plataforma / correo / WhatsApp).
  **Un evento nuevo no trae ninguno**: se agregan a mano cuando hacen falta.
- **Notificar es opt-in**: los canales del aviso al guardar vienen sin marcar.
  Agendar a alguien no le manda nada salvo que se pida explícitamente.
- Avisos automáticos de **reprogramación** y **cancelación**.
- **Visibilidad**: hoy todo evento es público para el equipo. El campo existe en
  el modelo pero no tiene UI (ver §11).

### Qué NO hace (por decisión de alcance)

- **Recurrencia.** Fase 1 sin eventos repetidos — ver §11.
- **Sincronización con Google Calendar / Outlook.** No se integró ningún
  calendario externo.
- **Adjuntos** en el evento.
- **Notificación push.** El proyecto no tiene FCM configurado.

---

## 2. Por qué un módulo aparte de Tareas

Se evaluó extender `tareas` con un campo `tipo: "evento"`. Se descartó:

| | Tarea | Evento |
|---|---|---|
| Unidad | trabajo con un dueño | bloque de tiempo con asistentes |
| Ciclo de vida | avanza por estados (kanban) | ocurre o se cancela |
| Personas | 1 responsable (`asignadoA`) | N asistentes |
| Fecha | 1 límite, solo día | inicio + fin con hora |

Meter eventos en `tareas` habría roto el tablero kanban (una reunión no es
"pendiente / en curso / finalizada"), habría exigido un documento por asistente
—como ya ocurre hoy al asignar una tarea a varias personas— y habría obligado a
sumarle hora, lugar, enlace y recurrencia a un modelo de 12 campos.

**Con Notificaciones no hay solapamiento: hay reutilización.** El módulo de
notificaciones es un *transporte*, no un dominio. El calendario lo usa igual que
lo usa Tareas, escribiendo en `usuarios/{uid}/notificaciones` con
`modulo: "evento"`. No se modificó nada de ese módulo.

---

## 3. Arquitectura

```
┌──────────────┐   escribe solo el evento    ┌───────────────┐
│  Navegador   │ ──────────────────────────► │  eventos/{id} │
│ CalendarioPage│                             └───────┬───────┘
└──────────────┘                                     │ onDocumentWritten
                                                     ▼
                                         ┌────────────────────────┐
                                         │  sincronizarEvento     │
                                         │  · regenera la cola    │
                                         │  · avisa invitación /  │
                                         │    reprogramación /    │
                                         │    cancelación         │
                                         └───────┬────────────────┘
                                                 │ escribe
                                                 ▼
                                   ┌─────────────────────────────┐
                                   │ recordatoriosEventos/{id}   │
                                   │ (cola: 1 doc = 1 aviso)     │
                                   └─────────────┬───────────────┘
                                                 │ cada 5 min
                                                 ▼
                                   ┌─────────────────────────────┐
                                   │ barrerRecordatoriosEventos  │
                                   └─────────────┬───────────────┘
                                                 ▼
                              ┌──────────────────────────────────┐
                              │ avisos.ts (transporte compartido)│
                              │  app  →  usuarios/{uid}/notific. │
                              │  email → Gmail OAuth2            │
                              │  whatsapp → Meta Cloud API       │
                              └──────────────────────────────────┘
```

### Decisiones de diseño clave

**El navegador nunca dispara avisos.** Solo escribe el documento del evento; todo
lo demás lo hace el backend. Es el mismo criterio que se adoptó en
[valoresAgregados/notificaciones.ts](../functions/src/valoresAgregados/notificaciones.ts)
tras el incidente en que la alerta se creaba pero el correo nunca salía porque el
navegador no completaba el `fetch`.

**Cola separada, no barrido de eventos.** El scheduler consulta
`recordatoriosEventos` con un índice sobre `(enviado, enviarEn)`. Cuando no hay
nada pendiente eso cuesta **1 lectura**. Si barriera la colección `eventos`
filtrando en memoria, el costo crecería con el número de eventos — es la
diferencia entre gratis y caro.

**Un solo dueño de la cola.** `sincronizarEvento` es el único que la escribe. Al
mover, cancelar o cambiar invitados, borra los pendientes y los regenera. Así no
existe el estado inconsistente de "el evento se movió pero el recordatorio sigue
apuntando a la hora vieja".

**Una sola plantilla de WhatsApp para todos los tipos de aviso.** Su texto está
redactado como recordatorio, así que el tipo se antepone al título dentro del
parámetro (`CANCELADO - Reunión…`, `REPROGRAMADO - …`). Evita tener que aprobar
una plantilla en Meta por cada situación, a costa de un encabezado en mayúsculas.

**Los avisos internos no entran a la bandeja de WhatsApp.** A diferencia de
`sendMetaTemplate`, el canal de WhatsApp del calendario **no llama a
`appendMessage`**: son mensajes al equipo y ensuciarían el inbox de cobranza.

---

## 4. Modelo de Datos

```
eventos/{eventoId}                 → Evento
recordatoriosEventos/{id}          → RecordatorioProgramado (cola del scheduler)
configuracion/eventos              → configuración del canal WhatsApp
```

### `eventos/{eventoId}`

Definido en [evento.model.ts](../frontend/src/modules/eventos/models/evento.model.ts).

| Campo | Tipo | Nota |
|---|---|---|
| `titulo` | string | |
| `descripcion` | string | agenda / temas |
| `categoria` | `reunion \| capacitacion \| audiencia \| visita \| normalizacion \| notificacion \| juzgado \| permiso \| otro` | define el color |
| `modalidad` | `presencial \| virtual \| hibrida` | |
| `ubicacion` | string | obligatorio si no es virtual |
| `enlaceReunion` | string | **opcional** aunque sea virtual: puede agregarse después |
| `inicio` | Timestamp | |
| `fin` | Timestamp | **siempre poblado**; sin hora final vale `inicio + 30 min` |
| `tieneHoraFin` | boolean | `false` = la hora final es implícita y no se muestra. Ausente = `true` |
| `todoElDia` | boolean | |
| `estado` | `programado \| cancelado \| realizado` | |
| `visibilidad` | `publica \| privada` | hoy siempre `publica`; sin UI |
| `organizadorId` / `organizadorNombre` | string | |
| `participantes` | `ParticipanteEvento[]` | `{uid, nombre, email, telefono, respuesta, respondidoEn, motivoRechazo}`. `respuesta` es `asiste \| rechazo`: no existe "pendiente" |
| `participantesUids` | string[] | **denormalizado** para `array-contains` |
| `canalesAviso` | `CanalAviso[]` | canales del aviso **inmediato** (agendar / reprogramar / cancelar). Vacío = no avisar. Ausente = `["app","email"]` |
| `recordatorios` | `RecordatorioEvento[]` | `{minutosAntes, canales[]}` — avisos **previos** |
| `clienteId` / `clienteNombre` | string \| null | conjunto asociado, **opcional**. `clienteNombre` va denormalizado para listar sin resolver el documento |
| `tareaId` | string \| null | vínculo opcional, hoy sin UI |
| `creadoPor` / `creadoPorNombre` | string | **trazabilidad**: quién creó el evento. Se escribe al crear y las ediciones no lo tocan. Es quien puede editarlo y borrarlo |

> **Por qué `participantesUids` existe aparte:** Firestore no puede consultar
> dentro de objetos de un arreglo. Sin ese campo plano no hay forma de preguntar
> "¿a qué eventos estoy invitado?".

### `recordatoriosEventos/{id}` — la cola

Un documento = **un aviso concreto**: un participante, un canal, un instante.

| Campo | Nota |
|---|---|
| `eventoId`, `eventoTitulo` | |
| `participanteUid`, `canal`, `minutosAntes` | |
| `enviarEn` | Timestamp = `inicio − minutosAntes` |
| `enviado` | `false` hasta que el barrido lo consume |
| `intentos` | tope de 3 reintentos |
| `error` | motivo del descarte o del último fallo |

La expansión es `recordatorios × participantes × canales`, saltando las
combinaciones no entregables (correo sin email, WhatsApp sin teléfono) y las que
caerían en el pasado.

### `configuracion/eventos`

**No se edita a mano.** Se administra desde **Ajustes → Agenda diaria**
([AgendaDiariaPanel.tsx](../frontend/src/modules/ajustes/components/AgendaDiariaPanel.tsx)),
igual que los catálogos de `tiposCaso` y `etiquetasDemanda` que viven en la misma
colección.

```json
{
  "whatsappActivo": false,
  "numberId": null,
  "plantillaRecordatorio": "recordatorio_reunion",
  "plantillaAgenda": "agenda_diaria",
  "plantillaAgendaImagen": "agenda_diaria_imagen",
  "agendaDiaria": {
    "activa": true,
    "destinatarios": "equipo",
    "destinatariosUids": [],
    "canalEmail": true,
    "canalWhatsapp": false,
    "formatoWhatsapp": "imagen"
  }
}
```

| Campo | Qué hace |
|---|---|
| `agendaDiaria.activa` | enciende/apaga el envío nocturno |
| `agendaDiaria.destinatarios` | `"equipo"` = todo el personal interno activo · `"seleccion"` = solo los uids listados |
| `agendaDiaria.destinatariosUids` | UIDs elegidos en la pantalla cuando es `"seleccion"` |
| `agendaDiaria.canalEmail` / `canalWhatsapp` | por dónde sale |
| `agendaDiaria.formatoWhatsapp` | `"imagen"` (recomendado) o `"texto"` |
| `whatsappActivo`, `numberId`, `plantilla*` | canal WhatsApp de todo el módulo |

> **Se eligen usuarios, no correos.** El backend resuelve el correo y el teléfono
> leyendo `usuarios/{uid}` en el momento del envío, así que si alguien cambia de
> correo no hay que tocar la configuración. Si falta o `whatsappActivo` es
> `false`, el canal WhatsApp se omite sin error y el correo sigue funcionando.

---

## 5. Backend — Cloud Functions

| Archivo | Qué es |
|---|---|
| [eventos/avisos.ts](../functions/src/eventos/avisos.ts) | transporte compartido: formato de fechas en `America/Bogota`, plantilla HTML del correo, y los tres canales |
| [eventos/sincronizarEvento.ts](../functions/src/eventos/sincronizarEvento.ts) | `onDocumentWritten("eventos/{eventoId}")` |
| [eventos/barrerRecordatorios.ts](../functions/src/eventos/barrerRecordatorios.ts) | `onSchedule("*/5 * * * *")` |
| [eventos/agendaDiaria.ts](../functions/src/eventos/agendaDiaria.ts) | `onSchedule("0 20 * * *")` — resumen del día siguiente |
| [whatsapp/metaApi.ts](../functions/src/whatsapp/metaApi.ts) | **refactor**: `callMetaTemplateApi` extraído de `sendTemplateHandler` |

### El refactor de `metaApi.ts`

`sendMetaTemplate` es un `onCall` que exige `request.auth`. El scheduler no tiene
sesión de usuario, así que la llamada cruda a Meta se movió a `metaApi.ts` y
ambos la importan. `sendTemplateHandler.ts` conserva exactamente su
comportamiento anterior.

### Qué hace `sincronizarEvento` en cada caso

| Situación | Cola | Aviso |
|---|---|---|
| Evento creado | genera | invitación a todos |
| Cambió inicio/fin | regenera | reprogramación a todos |
| Cambió lugar o enlace | — | reprogramación a todos |
| Se agregaron participantes | regenera | invitación **solo a los nuevos** |
| Cambiaron los recordatorios | regenera | — |
| Se canceló | borra todo | cancelación a todos |
| Se reactivó | regenera | reprogramación a todos |
| Alguien avisó que **no podrá asistir** | no toca | **inasistencia** a quien agendó y al resto |
| Alguien volvió a marcar que **sí asiste** | no toca | ninguno |

> Las dos últimas filas son la guarda que evita el spam: marcar asistencia
> escribe en `eventos/{id}` y dispara el trigger. Sin comparar qué cambió
> realmente, cada clic reenviaría el aviso a todo el mundo. Solo el paso a
> `rechazo` genera notificación, y solo la primera vez.

### Robustez del barrido

- **Reclamo transaccional** antes de enviar: si dos ejecuciones se solapan, solo
  una gana el documento. Sin esto llegarían WhatsApps duplicados.
- **Ventana máxima de 2 horas**: un aviso más vencido que eso se descarta. Enviar
  "tu reunión empieza en 30 minutos" cuando ya terminó es peor que no enviarlo.
- **Reverificación del evento**: si fue cancelado o el participante ya no está
  invitado, se descarta aunque el documento siga en la cola.
- **3 intentos** para errores transitorios; los permanentes (sin correo, canal
  apagado) se marcan `omitido` y no se reintentan.
- **Purga a 30 días**, montada sobre el barrido de las 3:00 a. m. para no gastar
  un cuarto job de Cloud Scheduler.


### La agenda diaria (`agendaDiaria`)

Todas las noches a las **8:00 p. m. hora Colombia** arma el resumen del día
siguiente y lo envía. Formato acordado con el equipo:

```
AGENDA LUNES 24 AGOSTO

* Reunión en Casa Blanca 32 a las 9:30 a. m. - Jeimmy
* Audiencia de Insolvencia Barichara 5-204 a las 10:30 a. m. - Don Javier
* Cita con la administradora de Marbella a las 12:00 p. m. - Don Javier
* Reunión en Santa María de Alsacia a las 6:30 p. m. - Don Javier (pendiente
  confirmar quién lo acompaña)
```

- Ordenado por hora; los eventos **cancelados** no salen.
- Quien avisó que **no asiste** no aparece en su línea.
- La **descripción** del evento, si la hay, va entre paréntesis al final.
- **Si no hay eventos, no se envía nada.** Un mensaje diario vacío se vuelve
  ruido y la gente deja de leerlo.

#### ⚠️ Dos límites de la plataforma WhatsApp

**1. Meta no permite enviar a grupos.** La API de WhatsApp Cloud solo entrega a
números individuales (Twilio tampoco soporta grupos). Por eso la agenda sale a
una **lista de números configurada**, no al grupo del equipo. El resultado
práctico es el mismo —todos la reciben— pero llega como mensaje individual.

**2. Los parámetros de una plantilla de Meta no admiten saltos de línea.**
Confirmado en producción: se intentó enviar con `
` y Meta lo rechazó. El
cuerpo de la plantilla sí los admite, pero el *valor de un parámetro* no.

Por eso la agenda en WhatsApp se manda como **imagen** (ver abajo). El modo texto
sigue disponible como respaldo, con todo en un renglón separado por ` | `.

### La agenda como imagen

[imagenAgenda.ts](../functions/src/eventos/imagenAgenda.ts) dibuja un PNG con
`@napi-rs/canvas`: cabecera azul con el logo sobre teja blanca, una tarjeta por
evento con franja y distintivo del color de su categoría, hora destacada a la
derecha, y asistentes y lugar debajo del título.

- **Sin tipografía empaquetada.** Se resuelve la primera familia disponible del
  contenedor (`Arial`, `Liberation Sans`, `DejaVu Sans`, `Noto Sans`,
  `Helvetica`, `sans-serif`) y se registra en el log cuál se usó. Si no hubiera
  ninguna, `hayTipografia()` lo detecta y **no se envía una imagen ilegible**.
- **Los distintivos se dibujan con formas, no con emoji**: los contenedores de
  Functions no traen tipografía de color y saldrían como cuadros vacíos.
- La imagen se sube a Storage en `agendaDiaria/` con un **token de descarga de
  Firebase**, no con URL firmada: firmar exigiría el permiso
  `iam.serviceAccounts.signBlob` en la cuenta de servicio, y el token no necesita
  nada extra y tampoco es adivinable. Se genera **una sola vez** por noche y
  todos reciben el mismo enlace.
- Se purgan las imágenes de más de 30 días al final de cada ejecución.
- El logo vive en `functions/assets/logo_icono.png`, copiado del frontend.

---

## 6. Frontend — Módulo React

```
modules/eventos/
├── models/evento.model.ts
├── constants/eventoConstants.ts      categorías, colores, antelaciones
├── lib/fechaEvento.ts                formato y combinación fecha+hora
├── services/eventoService.ts         CRUD, RSVP, suscripciones
├── hooks/useEventos.ts               suscripción por rango visible
└── components/
    ├── CalendarioPage.tsx            FullCalendar + filtros
    ├── EventoFormModal.tsx           crear / editar
    ├── EventoDetalleModal.tsx        ver, RSVP, cancelar
    ├── ParticipantesSelector.tsx     multiselección con avisos de contacto
    └── RecordatoriosEditor.tsx       antelación × canales

modules/ajustes/components/
└── AgendaDiariaPanel.tsx             pantalla de configuración (Ajustes)
```

### Librería de calendario

`@fullcalendar/react` v6 con los plugins **daygrid, timegrid, list e
interaction** — todos **MIT**, verificado contra npm. Los únicos paquetes
comerciales de FullCalendar son `resource-timeline`, `resource-timegrid` y
`timeline` (vistas de recursos, una fila por persona o sala); **no se usan**.

El tema TailAdmin traía estilos `.fc-*` en `index.css`, pero solo servían para la
vista Mes: en Semana y Día FullCalendar deja su texto blanco por defecto y sobre
los fondos claros del tema los bloques salían ilegibles. Ahora cada categoría
define tres variables CSS —`--ev-acento`, `--ev-fondo` y `--ev-texto`— sobre
`.event-fc-color.fc-cat-*`, y **las tres vistas se pintan a partir de ellas**
(claro y oscuro). En Semana/Día el bloque además va compacto, con barra lateral
del color de la categoría, y los eventos que coinciden se reparten el ancho
(`slotEventOverlap={false}`) en vez de montarse uno sobre otro.

Las horas se muestran en **am/pm** en toda la vista (`slotLabelFormat` y
`eventTimeFormat` en [eventoConstants.ts](../frontend/src/modules/eventos/constants/eventoConstants.ts)):
el locale `es` de FullCalendar trae reloj de 24 h y la operación se habla en 12.

### Estrategia de consulta

Firestore no sabe hacer `OR` entre "es pública" y "estoy invitado", así que
`suscribirEventos` abre **dos suscripciones y las fusiona por id**. Quien tiene
`Eventos_Manage` usa una sola consulta por rango porque lo ve todo.

El hook se suscribe al rango visible **con un colchón de un mes a cada lado**,
para no reabrir la suscripción al navegar mes a mes.

### Hora final opcional

`fin` **siempre** se guarda: sin hora final vale `inicio + 30 min`. La bandera
`tieneHoraFin` solo controla si se muestra. Se hizo así para no volver `fin`
nullable en todo el módulo — el calendario necesita un bloque con altura, los
avisos un rango que imprimir y la detección de cruces un intervalo que comparar.

Estirar un evento en la vista Semana **fija la hora final** (pone
`tieneHoraFin: true`); moverlo de sitio no la toca.

### Detección de cruces de horario

`buscarConflictos` ([eventoService.ts](../frontend/src/modules/eventos/services/eventoService.ts))
responde a quién de los asistentes ya se le cruza otro evento.

La regla es un solapamiento clásico: hay cruce cuando
`nuevoInicio < existenteFin && existenteInicio < nuevoFin`. Como los eventos sin
hora final igual ocupan su bloque implícito de 30 minutos, **la misma comparación
cubre los dos casos** que se pidieron: contra la hora de inicio cuando no hay
rango, y contra todo el período cuando sí lo hay. El fin es exclusivo, así que
8:00–9:00 y 9:00–10:00 **no** se consideran cruce.

No cuentan como ocupado ni los eventos cancelados ni quien ya avisó que no
asistirá. Los eventos de día completo no disparan la validación.

**El cruce bloquea el guardado.** Antes era una advertencia con un "Agendar de
todos modos"; hoy simplemente no se guarda. La consulta que decide se relanza en
el momento de pulsar Guardar —no se confía en la del efecto, que va con 400 ms de
retardo— para que no se cuele un evento por la ventana entre el último tecleo y
la respuesta.

La consulta trae la franja por rango de `inicio` (índice de un solo campo,
automático) y cruza los participantes en memoria: Firestore no permite un rango
sobre `inicio` y a la vez `array-contains-any` sobre `participantesUids`.

**Es un bloqueo con salida:** el aviso aparece mientras se arma el evento y al
guardar sale una confirmación con quién está ocupado y en qué. Se puede agendar
igual de forma consciente.

### Quién puede ser invitado

Se añadió `suscribirUsuariosEquipoInterno` en
[usuarioService.ts](../frontend/src/modules/usuarios/services/usuarioService.ts).
No se reutilizó `suscribirUsuariosAsignablesTareas` porque esa lista excluye a
`supervisor` y `adminFranquicia`: no se les asignan tareas del tablero, pero sí
se les convoca a una reunión. Quedan fuera `cliente`, `clienteCaso` y `deudor`.

El organizador se autoañade con **sus propios datos de contacto**, no buscándose
en esa lista — si no, un supervisor creando un evento no quedaría dentro de su
propia reunión.

### Deep-link

Las notificaciones apuntan a `/calendario?evento=<id>`. La página carga ese
evento **por id** —puede caer fuera del rango visible— abre su modal y consume el
parámetro para que cerrarlo no lo reabra.

---

## 7. Permisos (RBAC)

Tres scopes nuevos en [acl.ts](../frontend/src/shared/constants/acl.ts):

| Permiso | Qué habilita |
|---|---|
| `eventos.read` | ver el calendario |
| `eventos.create` | crear eventos y editar los propios |
| `eventos.manage` | ver los privados (cuando se habiliten) |

> **Editar, mover, cancelar y eliminar es solo de quien creó el evento.**
> `eventos.manage` ya **no** habilita tocar la agenda ajena: lo tienen admin,
> supervisor y ejecutivoAdmin, que era demasiada gente para una agenda
> compartida. La regla vive en
> [permisosEvento.ts](../frontend/src/modules/eventos/lib/permisosEvento.ts) y la
> aplican el calendario, el detalle y el formulario. Los asistentes que no
> crearon el evento solo pueden avisar que no asistirán.

| Rol | read | create | manage |
|---|:--:|:--:|:--:|
| admin | ✅ | ✅ | ✅ |
| supervisor | ✅ | ✅ | ✅ |
| ejecutivoAdmin | ✅ | ✅ | ✅ |
| ejecutivo | ✅ | ✅ | — |
| dependiente | ✅ | ✅ | — |
| abogado | ✅ | ✅ | — |
| adminFranquicia | ✅ | — | — |
| cliente / clienteCaso / deudor | — | — | — |

Es una **agenda interna**: los roles externos no tienen ningún acceso.

> ⚠️ **Esto se aplica solo en la UI.** Ver §11.

---

## 8. Índices de Firestore

Cuatro índices nuevos en `firestore.indexes.json`:

| Colección | Campos | Para qué |
|---|---|---|
| `eventos` | `visibilidad` ASC, `inicio` ASC | eventos públicos del rango |
| `eventos` | `participantesUids` CONTAINS, `inicio` ASC | eventos a los que estoy invitado |
| `recordatoriosEventos` | `enviado` ASC, `enviarEn` ASC | barrido del scheduler |
| `recordatoriosEventos` | `eventoId` ASC, `enviado` ASC | limpiar pendientes de un evento |

---

## 9. Costo real de la infraestructura

Barrido **cada 5 minutos** = 8.640 ejecuciones/mes:

| Recurso | Consumo/mes | Capa gratuita | % |
|---|---|---|---|
| Functions — invocaciones | 8.640 | 2.000.000 | 0,4 % |
| Functions — cómputo | ~650 GB-seg | 400.000 GB-seg | 0,16 % |
| Firestore — lecturas | 288/día | 50.000/día | 0,6 % |
| Cloud Scheduler | 4.º job | 3 gratis | **USD 0,10/mes** |

**Costo de infraestructura: USD 0,10 al mes** (USD 1,20 al año), por el cuarto
job de Cloud Scheduler que agregó la agenda diaria. Todo lo demás sigue dentro de
la capa gratuita. Bajar el barrido a 30 minutos ahorraría
7.200 invocaciones de un cupo de 2 millones —nada— y volvería inútil cualquier
recordatorio de menos de una hora: uno pedido a 30 minutos saldría entre 30 y 60
minutos antes, y uno de 15 minutos podría llegar después de empezada la reunión.

**Lo único que sí cuesta dinero son las plantillas de WhatsApp de Meta**, que se
cobran por mensaje enviado fuera de la ventana de 24 horas. El correo por Gmail
OAuth2 es gratis dentro de los límites de envío de la cuenta.

---

## 10. Puesta en marcha

### Paso 1 — Desplegar índices y funciones

```bash
firebase deploy --only firestore:indexes
firebase deploy --only functions:sincronizarEvento,functions:barrerRecordatoriosEventos,functions:agendaDiaria
```

Los índices tardan unos minutos en construirse; hasta que terminen el calendario
mostrará error en consola.

### Paso 2 — Publicar el frontend

```bash
cd frontend && npm run build
firebase deploy --only hosting:app
```

Con esto ya funcionan **calendario, avisos de agendamiento y recordatorios por
plataforma y por correo**.

**2.1** Entrar a **Ajustes → Agenda diaria** y encender el resumen nocturno:
elegir si va a todo el equipo o a personas puntuales, y marcar *Correo*. Con eso
la agenda empieza a salir esa misma noche a las 8:00 p. m. **No hace falta nada
de Meta para el canal de correo.**

WhatsApp queda pendiente del paso 3.

### Paso 3 — Activar el canal WhatsApp (opcional)

**3.1** Crear en Meta Business Suite una plantilla de categoría **Utilidad**,
idioma **es_CO**, con parámetros con nombre:

```
Nombre: recordatorio_reunion

Hola {{nombre}}, te recordamos tu proximo evento:

*{{evento}}*
Fecha: {{fecha}}
Hora: {{hora}}
Lugar: {{lugar}}
```

Los cinco nombres —`nombre`, `evento`, `fecha`, `hora`, `lugar`— deben coincidir
exactamente con los que envía `avisoWhatsapp`.

**3.1-bis** Crear la **segunda** plantilla, para la agenda diaria. Igual:
categoría **Utilidad**, idioma **es_CO**, dos parámetros con nombre:

```
Nombre: agenda_diaria

AGENDA {{fecha}}

{{agenda}}
```

Recuerda que `{{agenda}}` llega **en una sola línea** con separadores: Meta no
acepta saltos de línea dentro de un parámetro.

**3.2** Esperar la aprobación de Meta (suele tardar minutos a horas).

**3.3** Entrar a **Ajustes → Agenda diaria**, encender *Habilitar envíos por WhatsApp*, elegir la línea y confirmar los nombres de las plantillas.

**3.4** Verificar que los usuarios del equipo tengan `telefonoUsuario` cargado en
`usuarios/{uid}`. El selector de participantes avisa en el formulario cuando
alguien no lo tiene.

---

## 11. Pendientes y decisiones tomadas

### ⚠️ Seguridad: las reglas de Firestore no protegen este módulo

`firestore.rules` es hoy:

```
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

Cualquier usuario autenticado —incluido un `cliente` o un `deudor`— puede leer y
escribir toda la base, `eventos` incluido. **Los permisos de §7 solo esconden la
UI; no impiden el acceso directo por SDK.**

Y no se puede arreglar con una regla puntual para `eventos`: **en Firestore las
reglas se combinan con OR**, así que mientras exista el catch-all permisivo,
añadir un `match /eventos/{id}` restrictivo no restringe nada. Arreglarlo exige
acotar la regla global, lo cual afecta a **todos** los módulos y merece su propio
trabajo con pruebas.

Relacionado: `enviarNotificacion` sigue siendo un `onRequest` sin autenticación y
con CORS `*` — cualquiera en internet puede enviar correos desde la cuenta
corporativa. El calendario **no** usa ese endpoint (envía desde el backend), pero
el hueco sigue abierto.

### Recurrencia — deliberadamente fuera de fase 1

No hay eventos repetidos. La razón es que el costo está en **editarlos**, no en
crearlos: "esta semana la reunión es a las 10", "cancela solo la del 15", "de aquí
en adelante los martes" exigen un sistema de excepciones y de partición de reglas
que es el grueso del trabajo de un calendario.

Si el equipo termina creando la misma reunión cada semana a mano, el siguiente
paso recomendado es **materializar instancias**: generar N documentos
independientes (p. ej. 13 lunes) más un job mensual que extienda el horizonte.
Editar o borrar uno queda trivial porque cada instancia es un documento normal.
Guardar la regla al estilo `RRULE` es la opción elegante y la cara; no se
recomienda.

### Otros pendientes menores

- `tareaId` existe en el modelo pero no tiene UI. Está listo para vincular una
  reunión con la tarea que salió de ella.
- `clienteId` ya se puede elegir desde el formulario, pero todavía no hay un
  reporte que agrupe eventos por conjunto. La consulta sería un
  `where("clienteId", "==", ...)` sobre `eventos`.
- Sin adjuntos en el evento.
- Sin vista de recursos (una fila por persona). Requeriría el FullCalendar
  comercial o una grilla propia.
