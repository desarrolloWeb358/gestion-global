# Modelo de Datos — Casos de Clientes Particulares

> **Fecha:** Agosto 2026
> **Estado:** Implementado (typecheck en verde). Pendiente desplegar reglas de Storage e índices.
> **Relación con el resto:** módulo **aditivo**. No modifica ni migra nada del negocio de cartera
> (`clientes` → `deudores` → `demandas`). Ver [MODELO-DATOS-GESTIONGLOBAL.md](MODELO-DATOS-GESTIONGLOBAL.md).

---

## 1. Qué resuelve

Segunda línea de negocio: clientes que **no** son conjuntos residenciales sino **personas naturales o jurídicas** a las que Gestión Global les lleva **casos** (procesos judiciales y trámites), sin cartera, sin deudores, sin acuerdos de pago ni estados mensuales.

Los **dependientes y abogados** registran el avance; el cliente entra con su usuario y ve ese avance, descarga documentos, aporta los suyos y deja observaciones.

**Decisión de diseño clave:** colección raíz nueva. Ninguna consulta existente (`clientes`, `deudores`, `demandas`, dashboards, reportes, WhatsApp, correos) la ve. Cero migración y cero riesgo sobre producción.

---

## 2. Árbol de colecciones

```
clientesParticulares/{uid}                 → ClienteParticular   (id = uid del usuario)
  └─ casos/{casoId}                        → Caso   (documentos[] embebido)
       ├─ seguimiento/{id}                 → SeguimientoCaso     (todo visible al cliente)
       └─ observaciones/{id}               → ObservacionCaso     (hilo cliente ↔ equipo)

configuracion/tiposCaso                    → { items: TipoCaso[] }        (catálogo nuevo)
configuracion/etiquetasDemanda             → REUTILIZADO tal cual por los casos
```

> El **id del documento es el uid del usuario**, misma convención que `clientes/{uid}`. El cliente siempre se crea desde **Usuarios** asignando el rol `clienteCaso`; por eso no hace falta ningún campo de vínculo entre `usuarios` y `clientesParticulares`.

---

## 3. Entidades

### 3.1 `clientesParticulares/{uid}` → `ClienteParticular`

[clienteParticular.model.ts](../frontend/src/modules/casos/models/clienteParticular.model.ts)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | = id del doc = uid del usuario |
| `tipoPersona` | `"natural" \| "juridica"` | |
| `nombre` | string | Nombre o razón social |
| `tipoDocumento` / `numeroDocumento` | string | CC/CE/TI/NIT |
| `representanteLegal` | string? | Solo persona jurídica |
| `correos` / `telefonos` | string[] | |
| `direccion` | string? | |
| `franquiciaId` / `ciudad` | string? | Misma dimensión organizacional que `clientes` |
| `abogadoId` / `dependienteId` | string\|null | **Responsables a nivel de cliente**; los casos los heredan |
| `activo` | boolean | |
| `fechaCreacion` / `fechaActualizacion` | Timestamp | |

### 3.2 `casos/{casoId}` → `Caso`

[caso.model.ts](../frontend/src/modules/casos/models/caso.model.ts). Reutiliza a propósito piezas ya probadas de `Demanda`: `FechaFirestore`, `EtiquetaEnDemanda` (mismo catálogo) y `ProcesoJudicialDemanda`.

| Campo | Tipo | Notas |
|---|---|---|
| `titulo` | string | Identificador legible del caso |
| `tipoCaso` | string | Nombre tomado de `configuracion/tiposCaso` |
| `descripcion` | string? | |
| `rolCliente` | `"demandante" \| "demandado" \| "otro"` | Posición del cliente en el proceso |
| `contraparte` | `{ nombre, numeroDocumento }[]` | Equivalente a `demandados` |
| `numeroRadicado`, `juzgado`, `localidad` | string? | **Opcionales**: hay casos sin radicar o no judiciales |
| `estado` | `"activo" \| "terminado"` | |
| `etiquetas` | `{ etiquetaId?, nombre, detalle, fecha }[]` | Catálogo compartido con demandas |
| `proximaAccionFecha` | Timestamp\|null | min de `etiquetas[].fecha` ≥ hoy; denormalizada para ordenar |
| `documentos` | `DocumentoCaso[]` | Embebido en el caso (poder, demanda, anexos) |
| `procesoJudicial` | mapa | Monitoreo CPNU, misma forma que en `Demanda` |
| `fechaInicio`, `fechaUltimaRevision` | Timestamp\|null | `fechaUltimaRevision` la actualiza cada seguimiento |
| `clienteParticularId`, `clienteNombre` | string | **Denormalizados** para `collectionGroup("casos")` |

`DocumentoCaso`: `{ id, nombre, url, path, mime?, size?, subidoPor, subidoPorNombre, subidoPorRol: "cliente"|"equipo", subidoEn }`. Se guarda con `Timestamp.now()` (dentro de un array no se puede usar `serverTimestamp()`).

### 3.3 `casos/{casoId}/seguimiento/{id}` → `SeguimientoCaso`

`{ fecha, descripcion, tipoSeguimiento?, archivoPath?, archivoUrl?, archivoNombre?, creadoPor, creadoPorNombre, actualizadoEn }`

> **No existe `esInterno`.** A diferencia del seguimiento de demandas, aquí todo registro es visible para el cliente; por eso cada uno dispara **alerta en la campanita + correo**.

### 3.4 `casos/{casoId}/observaciones/{id}` → `ObservacionCaso`

`{ texto, fecha, autorUid, autorNombre, autorRol: "cliente"|"equipo", archivoUrl?, archivoPath?, archivoNombre? }`

Notificación cruzada: si escribe el cliente se avisa al abogado y al dependiente del cliente; si escribe el equipo se avisa al cliente. Solo alerta interna (el correo se reserva para el avance real del caso).

---

## 4. Roles y permisos

**Rol nuevo `clienteCaso`** (`ROLE_HOME` → `/mis-casos`). Los roles existentes conservan **todos** sus permisos; solo se les **agregan** los de casos.

| Rol | Alcance sobre casos |
|---|---|
| `clienteCaso` `NUEVO` | Ve sus casos, escribe observaciones, sube y descarga documentos |
| `admin`, `supervisor`, `ejecutivoAdmin` | Todo |
| `dependiente`, `abogado` | Todo (son quienes gestionan) |
| `adminFranquicia` | Solo lectura, limitado a `franquiciasAsignadas` |
| `ejecutivo`, `cliente`, `deudor` | Sin acceso (no se les tocó nada) |

Permisos nuevos en [acl.ts](../frontend/src/shared/constants/acl.ts): `clientesParticulares.read/edit`, `casos.read/edit`, `casos.seguimiento.edit`, `casos.documentos.edit`, `casos.observaciones.create`.

---

## 5. Pantallas y rutas (todas nuevas)

| Ruta | Componente | Para |
|---|---|---|
| `/clientes-particulares` | ClientesParticularesTable | Equipo: lista + filtro por franquicia |
| `/clientes-particulares/:clienteParticularId` | ClienteParticularPage | Ficha, equipo asignado y casos |
| `/clientes-particulares/:clienteParticularId/casos/:casoId` | CasoDetailPage | Detalle completo, edición |
| `/mis-casos` | MisCasosPage | Home del cliente |
| `/mis-casos/:casoId` | CasoDetailPage | Mismo detalle en modo lectura + aportes |
| `/reporte-casos` | ReporteCasosPage | Vista global filtrable |

`CasoDetailPage` es **una sola pantalla para las dos audiencias**: si la ruta no trae `clienteParticularId`, se asume el uid del usuario logueado y se aplican los permisos de cliente.

El catálogo de tipos de caso se administra en **Ajustes → Tipos de caso**.

---

## 6. Cambios sobre archivos existentes (todos aditivos)

| Archivo | Cambio |
|---|---|
| [acl.ts](../frontend/src/shared/constants/acl.ts) | +rol `clienteCaso`, +7 permisos, +entradas en `ROL_PRIORITY` y `ROLE_HOME` |
| [nav.config.ts](../frontend/src/app/layout/nav.config.ts) | +3 ítems de menú; `clienteCaso` agregado a Notificaciones |
| [App.tsx](../frontend/src/App.tsx) | +6 rutas |
| [UsuariosTable.tsx](../frontend/src/modules/usuarios/components/UsuariosTable.tsx) | Al crear rol `clienteCaso`: pide tipo de persona + franquicia/ciudad, crea `clientesParticulares/{uid}` y envía correo de bienvenida propio |
| [AjustesPage.tsx](../frontend/src/modules/ajustes/components/AjustesPage.tsx) | +sección "Tipos de caso" |
| [auditLogModel.ts](../frontend/src/shared/services/auditLog/auditLogModel.ts) + RegistrosEliminadosPage | +6 módulos de auditoría |
| [firestore.indexes.json](../firestore.indexes.json) | +índice `casos (estado, proximaAccionFecha)` y overrides de `clienteParticularId` / `estado` |
| [storage.rules](../storage.rules) | +bloque `clientesParticulares/**` |

**No se tocó** ninguna Function: `crearUsuarioDesdeAdmin` acepta roles arbitrarios y solo crea el doc en `clientes` cuando el rol es exactamente `"cliente"`, así que el rol nuevo funciona sin redespliegue.

---

## 7. Despliegue

```bash
firebase deploy --only firestore:indexes
firebase deploy --only storage        # necesario para subir/descargar documentos
```

Sin scripts de migración: no hay datos previos que transformar.

---

## 8. Pendientes conocidos

- Las reglas de Firestore siguen abiertas a cualquier autenticado (estado previo del proyecto): el alcance de un `clienteCaso` a **sus** casos es visual, no forzado en backend. Blindarlo exige endurecer reglas para todo el sistema, no solo este módulo.
- El monitoreo CPNU está modelado en el caso (`procesoJudicial`) pero aún no tiene botón de consulta en la pantalla; se puede reutilizar el flujo de demandas cuando se necesite.
- No hay honorarios ni cobro por caso: fuera de alcance por decisión de negocio en esta versión.
