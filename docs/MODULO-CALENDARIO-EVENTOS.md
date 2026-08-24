# Módulo Calendario / Eventos — GestionGlobal

Agenda interna del equipo: reuniones presenciales y virtuales, capacitaciones,
audiencias y visitas, con invitación, confirmación de asistencia y recordatorios
automáticos por plataforma, correo y WhatsApp.

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

- Calendario con vistas **Mes / Semana / Día / Agenda**, arrastrar para mover y
  estirar para cambiar la duración.
- Eventos **presenciales, virtuales o híbridos**, con lugar y/o enlace de reunión.
- **Invitación automática** por plataforma y correo al crear el evento.
- **RSVP**: cada participante confirma o rechaza asistencia; el organizador ve el
  conteo.
- **Recordatorios configurables**: hasta 4 por evento, cada uno con su antelación
  (10 min a 1 semana) y sus canales (plataforma / correo / WhatsApp).
- Avisos automáticos de **reprogramación** y **cancelación**.
- **Visibilidad pública** (toda la empresa la ve) o **privada** (solo participantes).

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
| Personas | 1 responsable (`asignadoA`) | N participantes con RSVP |
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
| `categoria` | `reunion \| capacitacion \| audiencia \| visita \| otro` | define el color |
| `modalidad` | `presencial \| virtual \| hibrida` | |
| `ubicacion` | string | obligatorio si no es virtual |
| `enlaceReunion` | string | obligatorio si no es presencial |
| `inicio` / `fin` | Timestamp | |
| `todoElDia` | boolean | |
| `estado` | `programado \| cancelado \| realizado` | |
| `visibilidad` | `publica \| privada` | |
| `organizadorId` / `organizadorNombre` | string | |
| `participantes` | `ParticipanteEvento[]` | `{uid, nombre, email, telefono, respuesta, respondidoEn}` |
| `participantesUids` | string[] | **denormalizado** para `array-contains` |
| `recordatorios` | `RecordatorioEvento[]` | `{minutosAntes, canales[]}` |
| `clienteId` / `tareaId` | string \| null | vínculos opcionales, hoy sin UI |

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

```json
{
  "whatsappActivo": true,
  "numberId": "<id del doc en numbers/>",
  "plantillaRecordatorio": "recordatorio_reunion"
}
```

Si falta o `whatsappActivo` es `false`, el canal WhatsApp se omite sin error y
los demás canales siguen funcionando.

---

## 5. Backend — Cloud Functions

| Archivo | Qué es |
|---|---|
| [eventos/avisos.ts](../functions/src/eventos/avisos.ts) | transporte compartido: formato de fechas en `America/Bogota`, plantilla HTML del correo, y los tres canales |
| [eventos/sincronizarEvento.ts](../functions/src/eventos/sincronizarEvento.ts) | `onDocumentWritten("eventos/{eventoId}")` |
| [eventos/barrerRecordatorios.ts](../functions/src/eventos/barrerRecordatorios.ts) | `onSchedule("*/5 * * * *")` |
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
| **Alguien solo respondió el RSVP** | **no toca** | **ninguno** |

> La última fila es la guarda que evita el spam: cada confirmación de asistencia
> escribe en `eventos/{id}` y dispara el trigger. Sin esa comparación, cada "Sí
> asisto" reenviaría la invitación a todo el mundo.

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
```

### Librería de calendario

`@fullcalendar/react` v6 con los plugins **daygrid, timegrid, list e
interaction** — todos **MIT**, verificado contra npm. Los únicos paquetes
comerciales de FullCalendar son `resource-timeline`, `resource-timegrid` y
`timeline` (vistas de recursos, una fila por persona o sala); **no se usan**.

El tema TailAdmin ya traía los estilos `.fc-*` en `index.css` incluido modo
oscuro, así que el calendario se ve nativo sin CSS nuevo. Solo se añadió la clase
`fc-bg-neutral` (la paleta traía 4 colores y hay 5 categorías), el tachado de
cancelados y un ajuste de contraste en dark.

### Estrategia de consulta

Firestore no sabe hacer `OR` entre "es pública" y "estoy invitado", así que
`suscribirEventos` abre **dos suscripciones y las fusiona por id**. Quien tiene
`Eventos_Manage` usa una sola consulta por rango porque lo ve todo.

El hook se suscribe al rango visible **con un colchón de un mes a cada lado**,
para no reabrir la suscripción al navegar mes a mes.

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
| `eventos.manage` | editar/cancelar cualquier evento y ver los privados |

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
| Cloud Scheduler | 3.er job | 3 gratis | gratis |

**Costo de infraestructura: USD 0,00.** Bajar el barrido a 30 minutos ahorraría
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
firebase deploy --only functions:sincronizarEvento,functions:barrerRecordatoriosEventos
```

Los índices tardan unos minutos en construirse; hasta que terminen el calendario
mostrará error en consola.

### Paso 2 — Publicar el frontend

```bash
cd frontend && npm run build
firebase deploy --only hosting:app
```

Con esto ya funcionan **calendario, invitaciones, RSVP, recordatorios por
plataforma y por correo**. WhatsApp queda pendiente del paso 3.

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

**3.2** Esperar la aprobación de Meta (suele tardar minutos a horas).

**3.3** Crear el documento `configuracion/eventos` en Firestore:

```json
{
  "whatsappActivo": true,
  "numberId": "<id del documento en la colección numbers/>",
  "plantillaRecordatorio": "recordatorio_reunion"
}
```

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

- `clienteId` y `tareaId` existen en el modelo pero no tienen UI. Están listos
  para vincular una reunión con un conjunto o con la tarea que salió de ella.
- Sin adjuntos en el evento.
- Sin vista de recursos (una fila por persona). Requeriría el FullCalendar
  comercial o una grilla propia.
