# Módulo de Mensajería WhatsApp — GestionGlobal

> **Fecha de implementación:** Abril 2026
> **Proveedor:** Meta Cloud API v22.0
> **Stack:** Firebase Functions v2 · React 19 · Firestore · Meta Graph API

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura General](#2-arquitectura-general)
3. [Modelo de Datos — Firestore](#3-modelo-de-datos--firestore)
4. [Backend — Firebase Functions](#4-backend--firebase-functions)
5. [Frontend — Módulo React](#5-frontend--módulo-react)
6. [Flujos End-to-End](#6-flujos-end-to-end)
7. [Archivos Creados / Modificados](#7-archivos-creados--modificados)
8. [Pasos para Activar el Sistema](#8-pasos-para-activar-el-sistema)
9. [Lo que Falta a Futuro](#9-lo-que-falta-a-futuro)

---

## 1. Resumen Ejecutivo

Se implementó un módulo completo de mensajería WhatsApp en la plataforma GestionGlobal usando la **Meta Cloud API v22.0** (mismo proveedor que el proyecto Omnix, del cual se adaptó la arquitectura).

### Qué hace el módulo

- **Recibe mensajes** de WhatsApp de cualquier contacto a través de un webhook de Meta, los guarda en Firestore y los muestra en tiempo real en la UI.
- **Permite que los asesores respondan** directamente desde la plataforma — el mensaje llega al contacto por WhatsApp.
- **Interfaz de 3 paneles** similar a WhatsApp Web: lista de conversaciones | hilo de mensajes | datos del contacto.

### Qué NO hace (por alcance actual)

- No tiene bot con inteligencia artificial.
- No tiene campañas masivas.
- No tiene plantillas (templates) de Meta.
- El panel de datos del contacto está vacío (preparado para conectar a `usuarios/`).

---

## 2. Arquitectura General

```
[Contacto WhatsApp]
      │ envía mensaje
      ▼
[Meta Cloud API]
      │ POST JSON al webhook
      ▼
[Cloud Function: waWebhook]          ← Firebase Functions v2
      │ guarda en Firestore
      ▼
[Firestore: numbers/.../messages/]
      │ onSnapshot (tiempo real)
      ▼
[Frontend: ConversationThread]       ← React 19

[Asesor escribe respuesta en UI]
      │ httpsCallable("sendWhatsAppMessage")
      ▼
[Cloud Function: sendWhatsAppMessage]
      │ llama Meta Graph API
      ▼
[Meta Cloud API]
      │ entrega el mensaje
      ▼
[Contacto WhatsApp]
```

### Decisiones de diseño clave

| Decisión | Razón |
|---|---|
| **Sin colección `tenants/`** | GestionGlobal es single-tenant; los números viven directamente en `numbers/` |
| **ID de conversación = número del contacto** | Determinístico — no requiere query para buscar si ya existe la conversación |
| **`lastMessages[]` en el doc de conversación** | Los últimos 20 mensajes están en el propio doc, el LLM (a futuro) no necesita leer la subcolección |
| **Deduplicación por `wamid`** | Meta reenvía el mismo webhook varias veces si no responde rápido; la subcolección `processed/` evita duplicados |
| **`metaToken` solo en Firestore backend** | El token nunca sale al frontend — solo lo lee `firebase-admin` desde las Functions |
| **Siempre responder 200 a Meta** | Si el webhook responde != 200, Meta reintenta indefinidamente |

---

## 3. Modelo de Datos — Firestore

### Jerarquía de colecciones

```
numbers/{numberId}
  ├─ displayName:   string       ← nombre legible ("GestionGlobal WA")
  ├─ phoneNumberId: string       ← ID del número en Meta (numérico, ej: "123456789012345")
  ├─ metaToken:     string       ← token de acceso permanente de Meta (solo backend lo usa)
  └─ createdAt:     Timestamp

  └─ conversations/{userAddress}      ← ID del doc = número del contacto ("573001234567")
      ├─ conversationKey: string      ← igual a userAddress
      ├─ numberId:        string
      ├─ userAddress:     string      ← número del contacto sin prefijos
      ├─ status:          "OPEN" | "CLOSED"
      ├─ assigneeId:      string | null
      ├─ lastMessages:    Message[]   ← últimos 20 mensajes (contexto visual rápido)
      ├─ messageCount:    number
      ├─ lastMessageAt:   Timestamp   ← para ordenar el inbox
      ├─ lastInboundAt:   Timestamp   ← último mensaje recibido del contacto
      ├─ createdAt:       Timestamp
      └─ updatedAt:       Timestamp

      └─ messages/{messageId}         ← histórico completo
          ├─ role:              "user" | "assistant"
          ├─ text:              string
          ├─ ts:                Timestamp
          ├─ source:            "AGENT" | "PROVIDER"
          ├─ providerMessageId: string    ← wamid de Meta (usado para dedup)
          └─ createdAt:         Timestamp

      └─ processed/{wamid}            ← deduplicación
          └─ createdAt: Timestamp
```

### Tipos TypeScript de los mensajes

```typescript
type WaMessageRole   = "user" | "assistant";
type WaMessageSource = "AGENT" | "PROVIDER";

// role: "user"      = mensaje del contacto de WhatsApp
// role: "assistant" = mensaje del asesor desde la plataforma
// source: "PROVIDER" = llegó por el webhook de Meta
// source: "AGENT"    = lo envió un asesor desde la UI
```

### Índices de Firestore registrados

```json
// firestore.indexes.json
{ "collectionGroup": "conversations", "fields": [{ "fieldPath": "lastMessageAt", "order": "DESCENDING" }] }
{ "collectionGroup": "messages",      "fields": [{ "fieldPath": "ts",            "order": "DESCENDING" }] }
```

---

## 4. Backend — Firebase Functions

### Archivos creados

```
functions/src/
└── whatsapp/
    ├── conversationService.ts    ← lógica Firestore
    ├── webhookController.ts      ← endpoint Meta (GET verify + POST receive)
    └── sendMessageHandler.ts     ← onCall enviar mensaje
```

### 4.1 `conversationService.ts`

Encapsula toda la interacción con Firestore para conversaciones y mensajes.

**Funciones exportadas:**

```typescript
getOrCreateConversation(numberId, userAddress)
// Crea la conversación si no existe. El ID del doc ES el userAddress.
// Sin query — un simple doc().get() por ID determinístico.

getConversationById(numberId, conversationId)
// Carga una conversación por ID.

appendMessage({ numberId, conversationId, message })
// TRANSACCIÓN ATÓMICA:
//   1. Verifica dedup en processed/{wamid}
//   2. Escribe en messages/{wamid}
//   3. Actualiza lastMessages[] (ventana de 20) en el doc padre
//   4. Actualiza contadores y timestamps
// Lanza "DUPLICATE_MESSAGE" si el wamid ya fue procesado.
```

### 4.2 `webhookController.ts` — Cloud Function `waWebhook`

**Tipo:** `onRequest` (HTTP público)
**Secret:** `META_VERIFY_TOKEN`

```
GET  /waWebhook?hub.mode=subscribe&hub.verify_token=XXX&hub.challenge=YYY
     → Verifica el token y responde con hub.challenge (requerido por Meta)

POST /waWebhook  { "entry": [{ "changes": [{ "value": { "messages": [...] } }] }] }
     → Por cada mensaje en el batch:
         1. Extrae phoneNumberId de value.metadata
         2. Busca numbers/ donde phoneNumberId == ese ID
         3. getOrCreateConversation(numberId, msg.from)
         4. appendMessage(...)
     → Siempre responde 200 (Meta reintenta si no recibe 200)

Soporta tipos de mensaje: text.body, button.text, interactive.list_reply.title
```

### 4.3 `sendMessageHandler.ts` — Cloud Function `sendWhatsAppMessage`

**Tipo:** `onCall` (requiere usuario autenticado)

```
Input:  { numberId, conversationId, text }

Proceso:
  1. Verifica auth (lanza UNAUTHENTICATED si no hay sesión)
  2. Lee numbers/{numberId} → phoneNumberId + metaToken
  3. Lee conversations/{conversationId} → userAddress (destino)
  4. POST a https://graph.facebook.com/v22.0/{phoneNumberId}/messages
     con { messaging_product:"whatsapp", to: userAddress, text: { body: text } }
  5. appendMessage({ role:"assistant", source:"AGENT" })

Output: { ok: true }
```

### Secreto requerido

```
META_VERIFY_TOKEN  ← token para verificar el webhook en Meta
                     (se configura con: firebase functions:secrets:set META_VERIFY_TOKEN)
```

---

## 5. Frontend — Módulo React

### Estructura de archivos

```
frontend/src/modules/whatsapp/
├── models/
│   ├── waMessage.model.ts        ← tipos WaMessage, WaMessageRole, WaMessageSource
│   ├── waConversation.model.ts   ← tipo WaConversation
│   └── waNumber.model.ts         ← tipo WaNumber
├── services/
│   ├── numbersService.ts         ← listenNumbers()
│   ├── conversationsService.ts   ← listenInbox(), listenConversation()
│   └── messagesService.ts        ← listenLatestMessages(), fetchMessagesPage()
├── hooks/
│   ├── useWaNumbers.ts           ← carga los números disponibles
│   ├── useInboxConversations.ts  ← lista de conversaciones en tiempo real
│   └── useConversationMessages.ts← mensajes con estrategia dual
└── components/
    ├── NumberSelectPage.tsx       ← página de selección de número
    ├── WhatsAppLayout.tsx         ← layout de 3 paneles
    ├── InboxPanel.tsx             ← panel izquierdo: lista de conversaciones
    ├── ConversationThread.tsx     ← panel central: hilo de mensajes
    ├── ChatBubble.tsx             ← burbuja individual de mensaje
    ├── HumanReplyBox.tsx          ← caja de texto + botón enviar
    └── LeadPanel.tsx              ← panel derecho: datos del contacto (placeholder)
```

### 5.1 Estrategia de datos en tiempo real

**Inbox** (`useInboxConversations`):
```
onSnapshot(conversations, orderBy("lastMessageAt","desc"), limit(50))
→ se actualiza automáticamente cuando llega un mensaje nuevo
```

**Mensajes** (`useConversationMessages`) — estrategia dual:
```
1. Carga inicial: fetchMessagesPage(pageSize=30)  ← getDocs, paginado
2. Listener: listenLatestMessages(limit=30)       ← onSnapshot tiempo real
3. Ambos se fusionan en un Map<id, WaMessage>
   → dedupeados por ID de documento
   → ordenados por timestampMs
4. "Cargar anteriores": fetchMessagesPage(cursor=lastDoc) ← paginación hacia atrás
```

Esta estrategia garantiza que:
- Los mensajes históricos cargan rápido (una sola lectura)
- Los mensajes nuevos aparecen instantáneamente (listener)
- No hay duplicados aunque ambas fuentes traigan los mismos mensajes recientes

### 5.2 Componentes — Descripción

#### `WhatsAppLayout` — 3 paneles

```
┌──────────────────┬──────────────────────────────┬──────────────────┐
│   InboxPanel     │   ConversationThread          │   LeadPanel      │
│   (w-72)         │   (flex-1)                    │   (w-64)         │
│                  │                               │                  │
│ Lista de         │  Header: número del contacto  │  Placeholder     │
│ conversaciones   │                               │  "Información    │
│ ordenadas por    │  Mensajes (ChatBubble)         │  del contacto    │
│ última actividad │  ← scroll automático al       │  próximamente"   │
│                  │    último mensaje nuevo        │                  │
│ onSnapshot       │  ← botón "Cargar anteriores"  │  A futuro:       │
│ tiempo real      │    para paginación             │  conectar con    │
│                  │                               │  usuarios/       │
│                  │  HumanReplyBox                 │                  │
│                  │  ← Enter envía                │                  │
│                  │  ← Shift+Enter nueva línea    │                  │
└──────────────────┴──────────────────────────────┴──────────────────┘
         hidden en mobile →                        ← hidden en mobile
```

#### `ChatBubble` — Diferenciación visual

```
Mensaje del contacto (role:"user")      Mensaje del asesor (role:"assistant")
┌─────────────────────────┐             ┌─────────────────────────┐
│ Hola, necesito info...  │             │  Buenos días! Con gusto │
│                   12:34 │             │        Asesor · 12:35   │
└─────────────────────────┘             └─────────────────────────┘
bg-muted, alineado izquierda            bg-[#004B87], alineado derecha
```

#### `HumanReplyBox` — Envío seguro

```typescript
// Llama la Cloud Function (requiere sesión activa)
const fn = httpsCallable(functions, "sendWhatsAppMessage");
await fn({ numberId, conversationId: convId, text: text.trim() });
// La Function envía por Meta API y guarda en Firestore
// El listener onSnapshot muestra el mensaje automáticamente
```

### 5.3 Rutas agregadas

```typescript
// App.tsx
/whatsapp                      → NumberSelectPage  (lista de números)
/whatsapp/:numberId            → WhatsAppLayout    (inbox vacío)
/whatsapp/:numberId/:convId    → WhatsAppLayout    (conversación abierta)
```

### 5.4 Permisos ACL

```typescript
// shared/constants/acl.ts
PERMS.Whatsapp_Read:  "whatsapp.read"   // ver el módulo
PERMS.Whatsapp_Write: "whatsapp.write"  // enviar mensajes

// Roles con acceso:
admin, ejecutivoAdmin, ejecutivo
```

### 5.5 Item en el Sidebar

```typescript
// nav.config.ts
{
  to:    "/whatsapp",
  label: "WhatsApp",
  icon:  IconBrandWhatsapp,   // @tabler/icons-react
  roles: ["admin", "ejecutivoAdmin", "ejecutivo"],
}
```

---

## 6. Flujos End-to-End

### 6.1 Contacto envía mensaje → aparece en la UI

```
1. Contacto escribe en WhatsApp → llega a Meta
2. Meta hace POST a /waWebhook con el payload JSON
3. waWebhook extrae: phoneNumberId, from, text, wamid
4. Busca en Firestore: numbers/ where phoneNumberId == valor
5. getOrCreateConversation(numberId, from)
   → Si es nueva: crea doc en conversations/{from}
   → Si existe: no hace nada
6. appendMessage(transacción):
   → Verifica processed/{wamid} → si existe, lanza DUPLICATE_MESSAGE
   → Escribe processed/{wamid}
   → Escribe messages/{wamid} con role:"user", source:"PROVIDER"
   → Actualiza lastMessages[] y lastMessageAt en la conversación
7. waWebhook responde 200 a Meta
8. Frontend: onSnapshot detecta el nuevo doc en messages/
   → useConversationMessages actualiza el Map
   → React re-renderiza → aparece el ChatBubble del contacto
```

### 6.2 Asesor responde → llega al contacto

```
1. Asesor escribe en HumanReplyBox y presiona Enter o botón Enviar
2. httpsCallable("sendWhatsAppMessage")({ numberId, conversationId, text })
3. sendWhatsAppMessage (Cloud Function):
   → Lee numbers/{numberId}: phoneNumberId + metaToken
   → Lee conversations/{conversationId}: userAddress (destino)
   → POST a graph.facebook.com/v22.0/{phoneNumberId}/messages
      { messaging_product:"whatsapp", to: userAddress, text: { body: text } }
   → Meta entrega el mensaje al contacto
   → appendMessage({ role:"assistant", source:"AGENT" })
4. onSnapshot detecta el nuevo mensaje
   → ChatBubble aparece en azul (#004B87) con label "Asesor"
5. HumanReplyBox limpia el textarea
```

### 6.3 Primer mensaje de un contacto nuevo

```
1. Meta envía webhook
2. waWebhook: getOrCreateConversation("573001234567")
   → Crea conversations/573001234567 con status:"OPEN", lastMessages:[]
3. El nuevo item aparece en InboxPanel del asesor en tiempo real
4. Asesor hace clic → navega a /whatsapp/{numberId}/573001234567
5. ConversationThread carga el historial y activa el listener
```

---

## 7. Archivos Creados / Modificados

### Archivos nuevos (solo de este módulo)

| Archivo | Descripción |
|---|---|
| `functions/src/whatsapp/conversationService.ts` | Lógica Firestore: getOrCreate, appendMessage, dedup |
| `functions/src/whatsapp/webhookController.ts` | Webhook Meta: GET verify + POST receive |
| `functions/src/whatsapp/sendMessageHandler.ts` | onCall: asesor envía mensaje por Meta API |
| `frontend/src/modules/whatsapp/models/waMessage.model.ts` | Tipos de mensaje |
| `frontend/src/modules/whatsapp/models/waConversation.model.ts` | Tipo de conversación |
| `frontend/src/modules/whatsapp/models/waNumber.model.ts` | Tipo de número |
| `frontend/src/modules/whatsapp/services/numbersService.ts` | `listenNumbers()` |
| `frontend/src/modules/whatsapp/services/conversationsService.ts` | `listenInbox()`, `listenConversation()` |
| `frontend/src/modules/whatsapp/services/messagesService.ts` | `listenLatestMessages()`, `fetchMessagesPage()` |
| `frontend/src/modules/whatsapp/hooks/useWaNumbers.ts` | Hook para lista de números |
| `frontend/src/modules/whatsapp/hooks/useInboxConversations.ts` | Hook inbox en tiempo real |
| `frontend/src/modules/whatsapp/hooks/useConversationMessages.ts` | Hook mensajes con paginación |
| `frontend/src/modules/whatsapp/components/NumberSelectPage.tsx` | Página de selección de número |
| `frontend/src/modules/whatsapp/components/WhatsAppLayout.tsx` | Layout 3 paneles |
| `frontend/src/modules/whatsapp/components/InboxPanel.tsx` | Panel izquierdo |
| `frontend/src/modules/whatsapp/components/ConversationThread.tsx` | Panel central con mensajes |
| `frontend/src/modules/whatsapp/components/ChatBubble.tsx` | Burbuja individual |
| `frontend/src/modules/whatsapp/components/HumanReplyBox.tsx` | Caja de respuesta |
| `frontend/src/modules/whatsapp/components/LeadPanel.tsx` | Panel derecho (placeholder) |

### Archivos modificados

| Archivo | Qué se agregó |
|---|---|
| `functions/src/index.ts` | Exports: `waWebhook`, `sendWhatsAppMessage` |
| `frontend/src/App.tsx` | 3 rutas `/whatsapp`, imports de componentes |
| `frontend/src/app/layout/nav.config.ts` | Item "WhatsApp" con `IconBrandWhatsapp` |
| `frontend/src/shared/constants/acl.ts` | `PERMS.Whatsapp_Read/Write`, perms en admin/ejecutivoAdmin/ejecutivo |
| `firestore.indexes.json` | Índices para `conversations` (lastMessageAt) y `messages` (ts) |

---

## 8. Pasos para Activar el Sistema

> Estos pasos los hace el equipo de infraestructura/deploy. El código ya está listo.

### Paso 1 — Crear el secret del webhook
```bash
cd gestion-global
firebase functions:secrets:set META_VERIFY_TOKEN
# Escribe un token seguro (ej: "gg-webhook-2024-xyz")
# Guarda este token — lo necesitas en el Paso 4
```

### Paso 2 — Crear el documento del número en Firestore

En Firebase Console → Firestore, crear manualmente:
```
Colección: numbers
Documento: (cualquier ID, ej: "principal")
Campos:
  displayName:   "GestionGlobal WA"
  phoneNumberId: "XXXXXXXXXXXXXXXXX"   ← el ID del número aprobado en Meta
  metaToken:     "EAAxxxxxxxxxxxxxxx"  ← token de acceso permanente de Meta
```

### Paso 3 — Deploy
```bash
firebase deploy --only functions,firestore:rules,firestore:indexes
```

### Paso 4 — Configurar webhook en Meta Business

En Meta Business Suite → WhatsApp → Configuración → Webhooks:
```
URL del webhook: https://us-central1-gestionglobal-9eac8.cloudfunctions.net/waWebhook
Verify Token:    (el token del Paso 1)
Suscribir a:     ✅ messages
```

### Paso 5 — Verificar funcionamiento

1. Enviar un WhatsApp al número registrado desde un teléfono de prueba
2. Verificar en Firebase Console → Firestore que aparece el doc en `numbers/{id}/conversations/`
3. Abrir la plataforma → menú "WhatsApp" → seleccionar el número → ver la conversación
4. Responder desde la UI → verificar que llega al teléfono de prueba

---

## 9. Lo que Falta a Futuro

Las siguientes funcionalidades están **preparadas en la arquitectura** (el modelo de datos ya las soporta) pero no tienen implementación de código todavía.

### 9.1 Panel derecho — Datos del contacto (PRÓXIMA PRIORIDAD)

El `LeadPanel` está vacío. La idea es conectarlo a la colección `usuarios/` existente.

**Qué falta:**
- Buscar en `usuarios/` por el campo `telefonoUsuario` (ya normalizado a E.164 en la app)
- Mostrar: nombre, documento, rol, email, estado
- Botón "Ver perfil completo" que navega a la página del usuario

**Implementación estimada:** 1-2 días

```typescript
// El hook necesario sería algo así:
function useContactoFromPhone(userAddress: string) {
  // query: usuarios where telefonoUsuario == "+573001234567"
  // retorna el usuario o null si no está registrado
}
```

### 9.2 Cerrar y reabrir conversaciones

El campo `status: "OPEN" | "CLOSED"` ya existe en Firestore. Solo falta la UI.

**Qué falta:**
- Botón en el header de `ConversationThread` para cambiar el status
- Filtro en `InboxPanel` para ver solo abiertas o todas
- Función en `conversationsService.ts`: `updateConversationStatus(numberId, convId, status)`

### 9.3 Asignación de asesor a conversación

El campo `assigneeId` ya existe en Firestore.

**Qué falta:**
- Dropdown en el header de la conversación para asignar un asesor (lista de `usuarios/` con roles ejecutivo/dependiente)
- Filtro en inbox: "Mis conversaciones" vs "Todas"
- Badge visual del asesor asignado en `InboxPanel`

### 9.4 Notificación cuando llega un mensaje nuevo

GestionGlobal ya tiene el sistema de notificaciones en `usuarios/{uid}/notificaciones/`.

**Qué falta:**
- En `webhookController.ts`, después de guardar el mensaje, leer `assigneeId` de la conversación y escribir una notificación al asesor asignado:

```typescript
// En webhookController.ts (después de appendMessage)
if (conv.assigneeId) {
  await db.collection(`usuarios/${conv.assigneeId}/notificaciones`).add({
    descripcion: `Nuevo mensaje de +${from}`,
    ruta: `/whatsapp/${numberId}/${from}`,
    modulo: "whatsapp",
    visto: false,
    fecha: Timestamp.now(),
  });
}
```

### 9.5 Indicador de mensajes no leídos en InboxPanel

**Qué falta:**
- Campo `lastReadAt` o `unreadCount` en el doc de conversación
- Badge numérico en cada item del inbox
- Marcar como leído al abrir la conversación

### 9.6 Historial de búsqueda / filtro en inbox

**Qué falta:**
- Input de búsqueda en el header del `InboxPanel`
- Filtrar por número de teléfono o texto del último mensaje
- (Opcional) Búsqueda full-text en Firestore requiere Algolia o extensión de Firebase

### 9.7 Mensajes con archivos adjuntos (imágenes, documentos, audio)

Meta envía en el webhook el `type` del mensaje: `image`, `document`, `audio`, `video`.

**Qué falta en el backend:**
```typescript
// webhookController.ts — extender el parsing del mensaje
const mediaId   = msg?.image?.id || msg?.document?.id || msg?.audio?.id;
const mediaType = msg?.type; // "image" | "document" | "audio"

if (mediaId) {
  // GET https://graph.facebook.com/v22.0/{mediaId} → URL temporal del archivo
  // Descargar y subir a Firebase Storage
  // Guardar storageUrl en el mensaje
}
```

**Qué falta en el frontend:**
- `ChatBubble` que renderice imagen, audio player o link de descarga

### 9.8 Plantillas (Templates) de Meta

Para iniciar una conversación con un contacto (mensajes proactivos) Meta requiere usar plantillas aprobadas.

**Qué falta:**
- Colección `templates/` en Firestore con el nombre de la plantilla aprobada y sus variables
- Cloud Function para enviar template: `sendWhatsAppTemplate`
- UI: botón "Nueva conversación" → seleccionar plantilla → completar variables → enviar

### 9.9 Múltiples números de WhatsApp

La arquitectura ya soporta múltiples números (colección `numbers/` es una lista). Lo que falta en la UI:

- `NumberSelectPage` ya existe y muestra todos los números
- Si hay solo un número, redirigir automáticamente sin mostrar la pantalla de selección

### 9.10 Indicador "escribiendo..." (typing indicator)

Meta permite enviar indicadores de escritura:
```typescript
// POST graph.facebook.com/v22.0/{phoneNumberId}/messages
{ "messaging_product": "whatsapp", "to": userAddress, "type": "reaction",
  "status": "read", "message_id": wamid }
```

No es crítico pero mejora la experiencia del contacto.

### 9.11 Auditoría de mensajes enviados

**Qué falta:**
- Registrar en `auditLogs/` (ya existe en GestionGlobal) cada mensaje enviado por un asesor, con uid, timestamp y texto

### 9.12 Bot con IA (largo plazo)

El modelo de datos ya tiene los campos necesarios para soportar un bot (`lastMessages[]` como contexto, estructura de conversación compatible). Cuando se quiera activar:

- Agregar `mode: "BOT" | "HUMAN"` al modelo de conversación (actualmente siempre es HUMAN)
- Crear un `LlmProvider` (OpenAI Responses API como en Omnix)
- Crear catálogo de `actions` (tools) específicas de GestionGlobal (buscar deudor, enviar estado de cuenta, etc.)
- El webhook llama al LLM antes de responder al contacto cuando `mode === "BOT"`

---

## Resumen de Estado

```
✅ Implementado y funcional:
   Webhook recepción Meta → Firestore
   Envío de mensajes desde UI → Meta API
   UI 3 paneles (inbox / hilo / contacto)
   Tiempo real con onSnapshot
   Deduplicación de mensajes
   Paginación histórica de mensajes
   Permisos ACL por rol
   Item en sidebar

🔲 Preparado en modelo, sin UI/código:
   Panel de datos del contacto (usuarios/)
   Cerrar/reabrir conversaciones
   Asignación de asesor
   Filtro de conversaciones por estado

🔲 Pendiente de implementar desde cero:
   Notificaciones en-app al recibir mensaje
   Indicador de no leídos en inbox
   Búsqueda en conversaciones
   Archivos adjuntos (imágenes, documentos)
   Templates de Meta (mensajes proactivos)
   Auditoría de mensajes
   Bot con IA (largo plazo)
```

---

*Documentación generada tras la implementación del módulo WhatsApp en GestionGlobal — Abril 2026*
