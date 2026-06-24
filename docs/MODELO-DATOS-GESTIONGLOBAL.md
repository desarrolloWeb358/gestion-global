# Modelo de Datos — GestionGlobal

> **Fecha:** Junio 2026
> **Base de datos:** Cloud Firestore (Firebase)
> **Stack:** React 19 + TypeScript (PWA) · Firebase Functions v2 · Firestore · Storage · Auth
> **Estado:** Documenta el modelo **actual** + la **extensión de Franquicias** acordada (marcada como `NUEVO`).

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Árbol de Colecciones](#2-árbol-de-colecciones)
3. [Entidades del Dominio](#3-entidades-del-dominio)
   - 3.1 [Usuarios](#31-usuarios)
   - 3.2 [Clientes (conjuntos)](#32-clientes-conjuntos)
   - 3.3 [Deudores](#33-deudores)
   - 3.4 [Subcolecciones del Deudor](#34-subcolecciones-del-deudor)
   - 3.5 [Valores Agregados, Contratos y Notas](#35-valores-agregados-contratos-y-notas)
   - 3.6 [Notificaciones](#36-notificaciones)
   - 3.7 [WhatsApp](#37-whatsapp)
   - 3.8 [Colecciones de Soporte](#38-colecciones-de-soporte)
4. [Relaciones entre Entidades](#4-relaciones-entre-entidades)
5. [Roles y Permisos (RBAC)](#5-roles-y-permisos-rbac)
6. [Extensión: Franquicias / Sucursales `NUEVO`](#6-extensión-franquicias--sucursales-nuevo)
7. [Plan de Migración](#7-plan-de-migración)
8. [Índices y Reglas](#8-índices-y-reglas)
9. [Convenciones, Legados y Pendientes](#9-convenciones-legados-y-pendientes)

---

## 1. Resumen Ejecutivo

GestionGlobal es una plataforma de **gestión de cartera** para conjuntos residenciales. El negocio:

- Cada **cliente** es un conjunto residencial al que se le administra la cartera.
- Cada cliente tiene **deudores**, y dentro de cada deudor se concentra toda la operación: deuda mensual, recaudos, acuerdos de pago, seguimientos (pre-jurídico / jurídico / demanda), tipificación y observaciones.
- Los **usuarios** son todas las personas del sistema (empleados, clientes, deudores, abogados), diferenciadas por `roles[]`.

A partir de junio de 2026 la empresa se expande con **franquicias/sucursales** (la primera nueva: *Eje Cafetero* — Pereira, Armenia, Manizales). Toda la operación de la franquicia funciona igual que hoy; lo que se agrega es una **dimensión organizacional** que permite separar y consolidar carteras por franquicia (ver [§6](#6-extensión-franquicias--sucursales-nuevo)).

---

## 2. Árbol de Colecciones

```
usuarios/{uid}                          → UsuarioSistema
  └─ notificaciones/{id}                → NotificacionAlerta

franquicias/{franquiciaId}              → Franquicia                      ← NUEVO

clientes/{clienteId}                    → Cliente   (+ franquiciaId, ciudad ← NUEVO)
  ├─ deudores/{deudorId}                → Deudor
  │    ├─ acuerdos/{acuerdoId}          → AcuerdoPago
  │    │    └─ cuotas/{cuotaId}         → CuotaAcuerdo
  │    ├─ estadosMensuales/{YYYY-MM}    → EstadoMensual   (id del doc = mes)
  │    ├─ seguimiento/{id}              → Seguimiento (pre-jurídico)
  │    ├─ seguimientoJuridico/{id}      → SeguimientoJuridico
  │    ├─ seguimientoDemanda/{id}       → SeguimientoDemanda
  │    ├─ historialTipificaciones/{id}  → HistorialTipificacion
  │    ├─ observacionesCliente/{id}     → ObservacionCliente (scope "deudor")
  │    └─ cuotas_acuerdo/{id}           → (LEGADO, amortización visual)
  ├─ valoresAgregados/{valorId}         → ValorAgregado
  │    └─ observacionesCliente/{id}     → ObservacionCliente (scope "valor")
  ├─ contratos/{contratoId}             → Contrato
  ├─ observacionesCliente/{id}          → ObservacionClienteGlobal (nivel cliente)
  └─ notasInternasEjecutivo/{id}        → Nota interna del ejecutivo

numbers/{numberId}                      → WaNumber (línea WhatsApp Meta)
  └─ conversations/{convId}             → WaConversation  (convId = número del contacto)
       └─ messages/{id}                 → WaMessage

bulkSendJobs/{id}                       → Trabajos de envío masivo WhatsApp
registrosEliminados/{id}               → Auditoría de borrados
auditLogs/{id}                          → Auditoría (p. ej. cambio de correo)
```

> **Clave de diseño:** el deudor es **subcolección** del cliente, por lo que `clienteId` **no se guarda como campo** en el deudor: vive en la ruta (`clientes/{clienteId}/deudores/{deudorId}`). Las vistas globales recorren todos los deudores con `collectionGroup("deudores")` y recuperan el cliente con `ref.parent.parent.id`.

---

## 3. Entidades del Dominio

### 3.1 Usuarios

Colección raíz `usuarios/{uid}` (el id del doc = `uid` de Firebase Auth). Modelo: [usuarioSistema.model.ts](../frontend/src/modules/usuarios/models/usuarioSistema.model.ts).

| Campo | Tipo | Notas |
|---|---|---|
| `uid` | string | = id del documento |
| `email` | string | |
| `nombre` | string? | |
| `telefonoUsuario` | string? | |
| `roles` | `Rol[]` | Ver [§5](#5-roles-y-permisos-rbac) |
| `tipoDocumento` | `"CC"\|"CE"\|"TI"\|"NIT"` | |
| `numeroDocumento` | string | |
| `fecha_registro` | Timestamp? | |
| `activo` | boolean? | Sincronizado con `disabled` en Auth |
| `clienteIdAsociado` | string? | Si el usuario es rol `cliente`, apunta a su `clientes/{id}` |
| `deudorIdAsociado` | string? | Si el usuario es rol `deudor` |
| `canConsultarPersonas` | boolean? | Permiso puntual de consulta |
| `franquiciaId` | string? | `NUEVO` — franquicia de pertenencia del empleado |
| `franquiciasAsignadas` | string[]? | `NUEVO` — alcance de visibilidad del rol `adminFranquicia` |

Subcolección `usuarios/{uid}/notificaciones/{id}` → ver [§3.6](#36-notificaciones).

> Al crear un usuario con rol `cliente`, la Function `crearUsuarioDesdeAdmin` ([functions/src/index.ts](../functions/src/index.ts)) crea **también** el documento `clientes/{uid}` con el mismo id.

### 3.2 Clientes (conjuntos)

Colección raíz `clientes/{clienteId}`. Modelo: [cliente.model.ts](../frontend/src/modules/clientes/models/cliente.model.ts).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string? | = id del documento |
| `nombre` | string? | Nombre del conjunto |
| `direccion` | string? | |
| `administrador` | string? | |
| `formaPago` | string? | |
| `ejecutivoPrejuridicoId` | string\|null | UID del ejecutivo de cartera pre-jurídica |
| `ejecutivoJuridicoId` | string\|null | UID del ejecutivo jurídico |
| `ejecutivoDependienteId` | string\|null | UID del dependiente (cartera de demandas) |
| `abogadoId` | string\|null | UID del abogado |
| `dependienteAbogadoId` | string\|null | UID del dependiente del abogado |
| `activo` | boolean? | |
| `reportesHabilitados` | `Record<string,boolean>` | Meses (`"YYYY-MM"`) en que el rol `cliente` puede ver su reporte |
| `franquiciaId` | string | `NUEVO` — franquicia dueña del cliente (1:1) |
| `ciudad` | string | `NUEVO` — ciudad del conjunto; debe pertenecer a `franquicia.ciudades` |

> Los vínculos con el equipo (`ejecutivoXId`, `abogadoId`) son **referencias por UID** a `usuarios`. Esta relación es **independiente de la franquicia**: por eso un ejecutivo de una franquicia puede atender clientes de otra sin ningún cambio de modelo.

### 3.3 Deudores

Subcolección `clientes/{clienteId}/deudores/{deudorId}`. Modelo: [deudores.model.ts](../frontend/src/modules/cobranza/models/deudores.model.ts).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string? | = id del documento |
| `uidUsuario` | string? | UID del usuario rol `deudor` vinculado (si existe) |
| `ubicacion` | string? | Identificador del inmueble dentro del conjunto (normalizado en minúsculas; **único por cliente**) |
| `nombre` | string | |
| `cedula` | string? | |
| `correos` | string[] | |
| `telefonos` | string[] | Indexado para búsqueda por `collectionGroup` |
| `direccion` | string? | |
| `tipificacion` | `TipificacionDeuda` | Estado de la cartera (ver enum abajo) |
| `porcentajeHonorarios` | number? | Default 15 |
| `acuerdoActivoId` | string? | Id del acuerdo vigente (subcolección `acuerdos`) |
| `fechaCreacion` | Timestamp? | |
| `fechaUltimaRevision` | Timestamp? | |
| `fechaUltimoSeguimiento` | Timestamp? | Fecha del último seguimiento en cualquier subcolección |
| **Datos del proceso judicial** | | |
| `demandados` | `DemandadoItem[]` \| string | `{ nombre, numeroDocumento }[]`; soporta string legado |
| `juzgado`, `juzgadoId` | string? | |
| `numeroRadicado`, `numeroProceso` | string? | |
| `anoProceso` | number? | |
| `localidad` | string? | |
| `demandaSustituto` | boolean? | |
| `observacionesDemanda`, `observacionesDemandaCliente` | string? | |

```ts
enum TipificacionDeuda {
  DEVUELTO="Devuelto", TERMINADO="Terminado", ACUERDO="Acuerdo",
  GESTIONANDO="Gestionando", DEMANDA="Demanda", DEMANDA_ACUERDO="Demanda/Acuerdo",
  DEMANDA_TERMINADO="Demanda/Terminado", INACTIVO="Inactivo",
  PREJURIDICO_INSOLVENCIA="Prejurídico/Insolvencia", DEMANDA_INSOLVENCIA="Demanda/Insolvencia",
}
```

> **El deudor NO almacena `franquiciaId` ni `ciudad`.** Ambos se derivan de su cliente padre. Las vistas globales (`collectionGroup`) resuelven el cliente con `ref.parent.parent.id` y consultan un mapa `clienteId → { franquiciaId, ciudad }`. Solo se denormalizaría `franquiciaId` (no `ciudad`) al deudor a futuro si: (a) la escala hace costoso escanear todos los deudores, o (b) se blindan las reglas de Firestore por franquicia. Ver [§6](#6-extensión-franquicias--sucursales-nuevo).

### 3.4 Subcolecciones del Deudor

**`acuerdos/{acuerdoId}`** → `AcuerdoPago` ([acuerdoPago.model.ts](../frontend/src/modules/cobranza/models/acuerdoPago.model.ts)): capital inicial, % honorarios, total acordado, fecha primera cuota, `estado` (`BORRADOR | EN_FIRME | INCUMPLIDO | CERRADO`), `esActivo`, `archivoFirmado`, auditoría. El acuerdo vigente se referencia desde `deudor.acuerdoActivoId`.
- **`acuerdos/{id}/cuotas/{cuotaId}`** → `CuotaAcuerdo`: número, fecha, valor/ honorarios/ capital de la cuota, saldos antes/después, `pagado`, `valorPagado`.

**`estadosMensuales/{YYYY-MM}`** → `EstadoMensual` ([estadoMensual.model.ts](../frontend/src/modules/cobranza/models/estadoMensual.model.ts)). **El id del documento es el mes** (`"AAAA-MM"`). Campos: `mes`, `clienteUID`, `deuda`, `recaudo?`, `porcentajeHonorarios?`, `honorariosDeuda?`, `honorariosRecaudo?`, `recibo?`, `observaciones?`. Es la base de los reportes de cartera/recaudo.

**`seguimiento/{id}`** → `Seguimiento` (pre-jurídico) · **`seguimientoJuridico/{id}`** → `SeguimientoJuridico` · **`seguimientoDemanda/{id}`** → `SeguimientoDemanda`. Registran la gestión: `fecha`, `tipoSeguimiento` (`llamada | visita_notificacion | correo | whatsapp | correo_certificado | sms | otro`), `descripcion`, `archivoUrl?`. `seguimientoDemanda` agrega `consecutivo` y `esInterno`.

**`historialTipificaciones/{id}`** → `HistorialTipificacion`: `{ fecha, tipificacion }`. Se crea un registro inicial al crear el deudor y en cada cambio de tipificación.

**`observacionesCliente/{id}`** (scope `"deudor"`) → `ObservacionCliente`: observaciones que el cliente registra sobre el deudor; dispara notificación al ejecutivo pre-jurídico.

**`cuotas_acuerdo/{id}`** → **LEGADO** (tabla de amortización visual). El flujo vigente usa `acuerdos/{id}/cuotas`.

### 3.5 Valores Agregados, Contratos y Notas

**`clientes/{id}/valoresAgregados/{valorId}`** → `ValorAgregado` ([valorAgregado.model.ts](../frontend/src/modules/valoresAgregados/models/valorAgregado.model.ts)): servicios jurídicos adicionales (`derecho de peticion | tutela | desacato | estudios contratos`), con `titulo`, `descripcion`, `archivos[]`, `completado`, `fechaLimite`, `fechaCompletado`.
- Subcolección `observacionesCliente/{id}` (scope `"valor"`): hilo de mensajes cliente ↔ abogado.

**`clientes/{id}/contratos/{contratoId}`** → `Contrato`: `titulo`, `descripcion`, `archivos[]`, `creadoPor`.

**`clientes/{id}/observacionesCliente/{id}`** → `ObservacionClienteGlobal`: observaciones a nivel del cliente (no del deudor); soporta `archivos[]`, `usuarioId`, `rol` (`cliente | ejecutivo`).

**`clientes/{id}/notasInternasEjecutivo/{id}`** → nota interna (`texto`, `fecha`).

### 3.6 Notificaciones

`usuarios/{uid}/notificaciones/{id}` → `NotificacionAlerta` ([notificacion.model.ts](../frontend/src/modules/notificaciones/models/notificacion.model.ts)): `fecha`, `descripcion`, `ruta` (deep-link interno), `modulo`, `visto`, `resuelta?`. Se generan, por ejemplo, cuando un cliente deja una observación sobre un deudor o un valor agregado.

### 3.7 WhatsApp

Documentado en detalle en [DOCUMENTACION-WHATSAPP-GESTIONGLOBAL.md](DOCUMENTACION-WHATSAPP-GESTIONGLOBAL.md).

- `numbers/{numberId}` → `WaNumber` (línea de Meta).
- `numbers/{id}/conversations/{convId}` → `WaConversation` (`convId` = número del contacto). Puede vincularse opcionalmente a un deudor vía `clienteId` / `deudorId` / `deudorNombre`.
- `.../conversations/{id}/messages/{id}` → `WaMessage`.
- `bulkSendJobs/{id}` → trabajos de envío masivo.

### 3.8 Colecciones de Soporte

- `registrosEliminados/{id}` → auditoría de borrados (`modulo`, `descripcion`, `coleccionPath`, `fechaEliminacion`, `uid`).
- `auditLogs/{id}` → auditoría de acciones sensibles (p. ej. cambio de correo).

---

## 4. Relaciones entre Entidades

```
franquicias 1 ──< clientes 1 ──< deudores 1 ──< { acuerdos, estadosMensuales,    NUEVO: franquicias
                                                  seguimientos*, historial,
                                                  observaciones }
                                              acuerdos 1 ──< cuotas

usuarios ──(roles)── permisos                 (RBAC, §5)
usuarios ◄──(ejecutivoXId / abogadoId)── clientes   (equipo asignado al conjunto)
usuarios (rol cliente)  ──(clienteIdAsociado / mismo id)── clientes
usuarios (rol deudor)   ──(deudorIdAsociado)── deudores  ; deudor.uidUsuario ── usuarios
```

- **Cliente → equipo:** por UID (`ejecutivoPrejuridicoId`, `ejecutivoJuridicoId`, `ejecutivoDependienteId`, `abogadoId`, `dependienteAbogadoId`). **Independiente de la franquicia.**
- **Cliente → franquicia:** `cliente.franquiciaId` (1:1) `NUEVO`.
- **Deudor → cliente:** por **ruta** (subcolección), no por campo.

---

## 5. Roles y Permisos (RBAC)

Definido en [acl.ts](../frontend/src/shared/constants/acl.ts). Dos ejes **independientes**:

1. **Permisos por rol** — *qué* puede hacer (`ROLE_PERMISSIONS`).
2. **Alcance por franquicia** — *qué datos* puede ver (`NUEVO`, ver [§6](#6-extensión-franquicias--sucursales-nuevo)).

| Rol | Descripción | Alcance de datos |
|---|---|---|
| `admin` | **Superadmin técnico** (gestión de usuarios, sistema, registros eliminados) | Global |
| `adminGeneral` `NUEVO` | Dirección de negocio: operación completa + reportes consolidados | **Todas** las franquicias |
| `adminFranquicia` `NUEVO` | Supervisión de franquicia: **solo consulta y reportes** | `franquiciasAsignadas[]` |
| `supervisor` | Operación + reportes | Global (hoy) |
| `ejecutivoAdmin` | Ejecutivo con permisos ampliados (incl. edición de fechas) | Sus clientes asignados |
| `ejecutivo` | Cartera pre-jurídica | Sus clientes asignados |
| `dependiente` | Cartera de demandas | Sus clientes asignados |
| `abogado` | Valores agregados / jurídico | Sus clientes asignados |
| `cliente` | Conjunto: ve su cartera, crea observaciones | Su propio cliente |
| `deudor` | Ve su propia deuda | Su propio deudor |

> Los roles operativos (`ejecutivo`, `dependiente`, `abogado`) **no se filtran por franquicia**: su alcance real son los clientes donde figuran como responsables. Por eso atienden clientes de cualquier franquicia sin cambios.

Permisos relevantes (`PERMS`): `clientes.*`, `deudores.*`, `seguimientos.*`, `abonos.*`, `recaudos.read`, `valoresAgregados.*`, `contratos.*`, `whatsapp.*`, `reporteCliente.download.*`, `registrosEliminados.read`, `usuarios.*`.

---

## 6. Extensión: Franquicias / Sucursales `NUEVO`

### 6.1 Objetivo

Introducir la **franquicia** como dimensión organizacional por encima de los clientes, sin alterar la operación existente (que pasa a ser la franquicia **Bogotá**). Permite separar y consolidar carteras por franquicia y ciudad, y reportes por franquicia y de toda la empresa.

### 6.2 Nueva entidad

`franquicias/{franquiciaId}`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | = id del documento (p. ej. `bogota`, `eje-cafetero`) |
| `nombre` | string | "Bogotá", "Eje Cafetero" |
| `ciudades` | string[] | `["Pereira","Armenia","Manizales"]` — la franquicia **no** está atada a una sola ciudad |
| `activo` | boolean | |
| `fechaCreacion` | Timestamp | |

### 6.3 Cambios en entidades existentes

- `clientes`: **+ `franquiciaId: string`** (1:1) y **+ `ciudad: string`** (∈ `franquicia.ciudades`).
- `usuarios`: **+ `franquiciaId?`** (pertenencia del empleado) y **+ `franquiciasAsignadas?: string[]`** (alcance del `adminFranquicia`).
- `deudores`: **sin cambios** (franquicia y ciudad se derivan del cliente padre).

### 6.4 Alcance por franquicia (segundo eje de seguridad)

Helper en `acl.ts` (a implementar), p. ej. `franquiciasVisibles(usuario)`:

- `admin`, `adminGeneral`, `supervisor` → `"ALL"`.
- `adminFranquicia` → `usuario.franquiciasAsignadas`.
- Roles operativos → no aplica (su filtro real son sus clientes asignados).

Las vistas globales (dashboards, monitoreo, reportes) aplican el filtro así: cargan el mapa `clienteId → { franquiciaId, ciudad }` (la colección `clientes` es pequeña frente a `deudores`), recorren los deudores con `collectionGroup` y filtran/agrupan en memoria por el cliente de cada deudor. Reportes por ciudad agrupan por `cliente.ciudad`.

> **Nota de seguridad:** hoy [firestore.rules](../firestore.rules) permite leer/escribir todo a cualquier usuario autenticado; la autorización vive en el frontend. Mientras eso no cambie, el alcance por franquicia es **visual**, no forzado en backend. Si se requiere blindaje real, hay que endurecer reglas / validar en Functions; en ese escenario sí conviene denormalizar `franquiciaId` en el deudor.

---

## 7. Plan de Migración

Objetivo: que lo existente (Bogotá) siga operando mientras se incorpora la nueva franquicia. Scripts siguiendo el patrón de [migracion/](../migracion/) (Admin SDK + `collectionGroup` + batch).

1. **Crear franquicias:** `franquicias/bogota` (`ciudades: ["Bogotá"]`) y `franquicias/eje-cafetero` (`["Pereira","Armenia","Manizales"]`).
2. **Backfill `clientes`:** a todos los existentes → `franquiciaId = "bogota"`, `ciudad = "Bogotá"`.
3. **Backfill `usuarios` (empleados):** `franquiciaId = "bogota"`.
4. **Roles nuevos:** asignar `adminGeneral` a la dirección; crear `adminFranquicia` con `franquiciasAsignadas = ["eje-cafetero"]`.
5. **Fallback defensivo en código:** tratar `franquiciaId` ausente como `"bogota"` durante la transición.

> Los **deudores no se tocan** en la migración (no llevan franquicia ni ciudad).

---

## 8. Índices y Reglas

**Índices actuales** ([firestore.indexes.json](../firestore.indexes.json)): `collectionGroup deudores (tipificacion, fechaUltimoSeguimiento)` y `array deudores.telefonos`; `acuerdos (estado, fechaActualizacion)`; `collectionGroup estadosMensuales (clienteUID, mes)`; `notificaciones (visto, fecha)`; `collectionGroup valoresAgregados (completado, fechaLimite)`; overrides de fecha en las subcolecciones de seguimiento.

**Índices a agregar `NUEVO`:** `clientes (franquiciaId)` y `clientes (franquiciaId, ciudad)` para listar/filtrar clientes por franquicia.

**Reglas** ([firestore.rules](../firestore.rules)): actualmente abiertas a cualquier usuario autenticado (ver nota de seguridad en [§6.4](#64-alcance-por-franquicia-segundo-eje-de-seguridad)).

---

## 9. Convenciones, Legados y Pendientes

- **`clienteId` implícito:** el deudor y sus subcolecciones identifican al cliente por la ruta, no por campo. Para vistas globales se usa `collectionGroup` + `ref.parent.parent.id`.
- **Ids con significado:** `estadosMensuales` usa el mes (`"YYYY-MM"`) como id del documento; los `usuarios` con rol cliente comparten id con su `clientes/{id}`.
- **Campos legado conviviendo con nuevos:** `demandados` (string ↔ array, normalizado por `normalizeDemandados`), archivos planos (`archivoUrl`) vs `archivos[]`, `cuotas_acuerdo` (legado) vs `acuerdos/cuotas`, y una colección `deudores` de nivel raíz usada solo en conteos del dashboard.
- **Estados de acuerdo legados** se normalizan en `normalizarEstadoAcuerdo` (`activo→EN_FIRME`, `cumplido/cancelado→CERRADO`).
- **Pendientes a futuro:** blindar reglas de Firestore por franquicia; reportes consolidados por franquicia/ciudad/empresa; decidir denormalización de `franquiciaId` en deudor solo si la escala o las reglas lo exigen.
