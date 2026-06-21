# FRD · M19 — Comunidad SOLMI (Red de Hoteleros)

> **Módulo no implementado.** Este documento define el comportamiento TARGET para la comunidad de hoteleros SOLMI de SOLMI OS. Sigue el molde de `M01-PMS-Central.md`.
>
> Todo lo documentado acá es **comportamiento esperado** basado en estándares de comunidades B2B (Hotelogix Community, Cloudbeds Partner Network, SiteMinder Academy Community). Las columnas "Gap" marcan que TODO está pendiente de implementación.

**Módulo:** M19 — Comunidad SOLMI
**Estado:** 🔴 No implementado
**Fecha:** 2026-06-19
**Pantallas cubiertas:** Feed · Hilos · Grupos · Directorio · Eventos · Recursos · Perfil
**Servicios frontend target:** `Community.service.ts`, `Post.service.ts`, `Group.service.ts`
**Servicios backend target:** módulos `community`, `posts`, `groups`, `events`, `resources`

---

## 1. Propósito

M19 crea una red profesional donde gerentes y empleados de hoteles que usan SOLMI OS pueden conectar, compartir mejores prácticas, resolver dudas, acceder a recursos educativos, y participar en eventos. Funciona como un foro/B2B social network vertical para la industria hotelera, con grupos por especialidad (front desk, housekeeping, revenue), directorio de profesionales, y sección de recursos compartidos. Se integra con M18 (Academy) para contenido educativo y con M14 (CRM) para perfil de usuarios.

---

## 2. Modelo de datos (target)

### 2.1 Posts / Hilos (`community_posts`)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `author_id` | UUID | FK → users |
| `hotel_id` | UUID | FK → hotels |
| `group_id` | UUID | FK → community_groups (NULL = feed general) |
| `type` | ENUM | `discussion` · `question` · `tip` · `case_study` · `announcement` · `resource_share` |
| `title` | VARCHAR(300) | Título del post |
| `body` | TEXT | Contenido (markdown/HTML) |
| `tags` | JSONB | `["housekeeping", "optimization", "tips"]` |
| `is_pinned` | BOOLEAN | — |
| `is_closed` | BOOLEAN | No admite nuevas respuestas |
| `views_count` | INTEGER | — |
| `likes_count` | INTEGER | — |
| `replies_count` | INTEGER | — |
| `created_at` | TIMESTAMP | — |
| `updated_at` | TIMESTAMP | — |

### 2.2 Respuestas (`community_replies`)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `post_id` | UUID | FK → community_posts |
| `author_id` | UUID | FK → users |
| `body` | TEXT | Contenido |
| `likes_count` | INTEGER | — |
| `is_solution` | BOOLEAN | Marcada como solución por el autor del post |
| `created_at` | TIMESTAMP | — |
| `updated_at` | TIMESTAMP | — |

### 2.3 Grupos (`community_groups`)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `name` | VARCHAR(200) | Nombre del grupo |
| `slug` | VARCHAR(200) | URL-friendly |
| `description` | TEXT | — |
| `category` | ENUM | `front_desk` · `housekeeping` · `maintenance` · `revenue` · `marketing` · `technology` · `leadership` · `general` |
| `visibility` | ENUM | `public` · `private` · `invite_only` |
| `cover_image_url` | VARCHAR(500) | — |
| `owner_id` | UUID | FK → users |
| `members_count` | INTEGER | — |
| `posts_count` | INTEGER | — |
| `is_featured` | BOOLEAN | Grupo destacado en el directorio |
| `created_at` | TIMESTAMP | — |

### 2.4 Membresía de Grupo (`community_group_members`)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `group_id` | UUID | FK → community_groups |
| `user_id` | UUID | FK → users |
| `role` | ENUM | `member` · `moderator` · `admin` |
| `status` | ENUM | `pending` · `approved` · `banned` |
| `joined_at` | TIMESTAMP | — |

### 2.5 Eventos (`community_events`)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `title` | VARCHAR(300) | Nombre del evento |
| `description` | TEXT | — |
| `type` | ENUM | `webinar` · `meetup` · `workshop` · `conference` · `ama` |
| `format` | ENUM | `online` · `in_person` · `hybrid` |
| `date` | TIMESTAMP | Fecha/hora del evento |
| `duration_minutes` | INTEGER | — |
| `location` | VARCHAR(500) | URL (online) o dirección (presencial) |
| `speaker_id` | UUID | FK → users (opcional) |
| `max_attendees` | INTEGER | NULL = sin límite |
| `is_free` | BOOLEAN | — |
| `price` | DECIMAL(10,2) | Solo si is_free = false |
| `cover_image_url` | VARCHAR(500) | — |
| `status` | ENUM | `draft` · `published` · `cancelled` · `completed` |
| `created_at` | TIMESTAMP | — |

### 2.6 Asistencia a Eventos (`community_event_attendees`)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `event_id` | UUID | FK → community_events |
| `user_id` | UUID | FK → users |
| `status` | ENUM | `registered` · `attended` · `no_show` · `cancelled` |
| `registered_at` | TIMESTAMP | — |

### 2.7 Recursos Compartidos (`community_resources`)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `author_id` | UUID | FK → users |
| `title` | VARCHAR(300) | Nombre del recurso |
| `description` | TEXT | — |
| `type` | ENUM | `template` · `checklist` · `guide` · `spreadsheet` · `pdf` · `video` · `link` |
| `file_url` | VARCHAR(500) | URL del archivo |
| `category` | ENUM | `operations` · `marketing` · `finance` · `hr` · `technology` · `legal` |
| `downloads_count` | INTEGER | — |
| `likes_count` | INTEGER | — |
| `tags` | JSONB | — |
| `created_at` | TIMESTAMP | — |

### 2.8 Likes (`community_likes`)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `target_type` | ENUM | `post` · `reply` · `resource` |
| `target_id` | UUID | ID del recurso liked |
| `created_at` | TIMESTAMP | — |

---

## 3. Pantalla — Feed Principal (`/panel/community`)

### 3.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| Clic en **"Comunidad"** | — | Muestra feed: posts recientes, trending topics, eventos próximos | — | — | — |
| Filtro **"Todos" / "Preguntas" / "Tips" / "Casos de Estudio"** | — | Filtra feed por tipo de post | — | — | — |
| Filtro **"Mis Grupos"** | — | Solo posts de grupos del usuario | — | — | — |
| **"🔥 Trending"** | — | Ordena por likes + replies (últimas 48h) | — | — | — |
| **"+ Nuevo Post"** | — | Abre modal form: tipo, título, cuerpo, grupo (opcional), tags | Modal `form` lg: "Nuevo Post" | — | — |
| Seleccionar tipo "Pregunta" | — | Muestra campo adicional: "¿Marcada como solución?" (default: no) | — | — | — |
| Seleccionar tipo "Recurso Compartido" | — | Muestra: upload de archivo o URL externa, categoría | — | — | — |
| **"Publicar"** | título + cuerpo no vacío | POST community_posts | **Toast success:** "Post publicado." | E6 | — |
| Clic en post | — | Abre hilo: post original + respuestas, like, share, marcar solución | — | — | — |
| **"Me Gusta"** (❤️) | — | toggle like, actualiza contador | — | — | — |
| **"Responder"** | — | Abre editor inline | — | — | — |
| **"Enviar Respuesta"** | cuerpo no vacío | POST community_replies | **Toast success:** "Respuesta publicada." | E6 | — |
| **"Marcar como Solución"** (autor del post) | — | is_solution = true, cierra hilo | **Toast success:** "Respuesta marcada como solución." | — | — |
| **"Compartir"** | — | Copia link al portapapeles | **Toast info:** "Link copiado al portapapeles." | — | — |
| **"Reportar"** | — | Abre modal: motivo del reporte | Modal `form`: "Reportar Post" | — | — |
| **"Cerrar Hilo"** (autor/moderator) | — | is_closed = true | **Toast success:** "Hilo cerrado. No se admiten nuevas respuestas." | — | — |
| **"Fijar Post"** (moderator) | — | is_pinned = true | **Toast success:** "Post fijado en el grupo." | — | — |

### 3.2 Flow — Publicar Pregunta

```mermaid
flowchart TD
    A([+ Nuevo Post]) --> B[Modal form: tipo=Pregunta]
    B --> C[/Título + cuerpo + tags/]
    C --> D{Seleccionar grupo?}
    D -- sí --> E[Grupo seleccionado]
    D -- no --> F[Feed general]
    E --> G[Publicar]
    F --> G
    G --> H{HTTP 201?}
    H -- sí --> I["Toast success: Post publicado"]
    I --> J[F5 Notif: "Nueva pregunta en {grupo}"]
    J --> K([Fin])
    H -- 5xx --> L[E6 Toast: Sin conexión]
```

---

## 4. Pantalla — Grupos (`/panel/community/groups`)

### 4.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| Clic en **"Grupos"** | — | Grid de grupos: públicos + mis grupos, con búsqueda | — | — | — |
| Filtro por categoría | — | Filtra por `front_desk`, `housekeeping`, etc. | — | — | — |
| Clic en grupo público | — | Abre grupo: descripción, posts recientes, miembros, botón "Unirse" | — | — | — |
| **"Unirse al Grupo"** | grupo público o invite_only | Si public: unión directa. Si invite_only: envía solicitud | **Toast success:** "Te uniste a {grupo}." / "Solicitud enviada. Esperando aprobación." | E2 "Ya eres miembro de este grupo" · E6 | — |
| **"Abandonar Grupo"** | — | **Modal confirm:** "¿Abandonar {grupo}?" | Modal confirm | E6 | — |
| **"+ Nuevo Grupo"** | admin | Abre modal form: nombre, categoría, visibilidad, descripción, cover image | Modal `form` lg: "Nuevo Grupo" | — | — |
| **"Crear Grupo"** | nombre + descripción | POST community_groups | **Toast success:** "Grupo '{nombre}' creado." | E6 | — |
| **"Editar Grupo"** (owner/admin) | — | Abre form precargado | Modal `form`: "Editar Grupo" | — | — |
| **"Gestionar Miembros"** (moderator) | — | Lista de miembros con rol, botón promover/expulsar | Modal `detail`: "Miembros de {grupo}" | — | — |
| **"Promover a Moderator"** | — | role → moderator | **Toast success:** "{usuario} es ahora moderator de {grupo}." | — | — |
| **"Expulsar"** (moderator) | — | **Modal danger:** "¿Expulsar a {usuario} de {grupo}?" | Modal danger | E6 | — |
| **"Cerrar Grupo"** (owner) | — | **Modal danger:** "¿Cerrar grupo '{nombre}'? Se archivarán todos los posts." | Modal danger | E6 | — |

---

## 5. Pantalla — Directorio (`/panel/community/directory`)

### 5.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| Clic en **"Directorio"** | — | Lista de profesionales: nombre, hotel, rol, badges, especialidad | — | — | — |
| Búsqueda por nombre/hotel/especialidad | — | Filtra en tiempo real | — | — | — |
| Filtro por especialidad | — | Dropdown: `front_desk`, `revenue`, `housekeeping`, etc. | — | — | — |
| Filtro por hotel | — | Solo profesionales del mismo hotel o de hoteles públicos | — | — | — |
| Clic en perfil de profesional | — | Abre perfil: foto, bio,ホテル, rol, cursos completados, posts, certificaciones | — | — | — |
| **"Enviar Mensaje"** | — | Abre chat/mensaje directo (target: integración con M24 Staff App) | — | — | — |
| **"Solicitar Conexión"** | — | Envía solicitud de conexión | **Toast success:** "Solicitud enviada a {usuario}." | E2 "Ya están conectados" · E6 | — |

---

## 6. Pantalla — Eventos (`/panel/community/events`)

### 6.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| Clic en **"Eventos"** | — | Lista de eventos: próximos + pasados, con filtros | — | — | — |
| Filtro **"Próximos" / "Pasados" / "Mis registros"** | — | Filtra eventos | — | — | — |
| Filtro por tipo (webinar/meetup/workshop) | — | Filtra eventos | — | — | — |
| Clic en evento | — | Detalle: descripción, fecha, duración, speaker, asistentes, registro | — | — | — |
| **"Registrarse"** | cupos disponibles, usuario no registrado | POST community_event_attendees | **Toast success:** "Registrado en '{evento}'. Recibirás un recordatorio." | E2 "No hay cupos disponibles" · E2 "Ya estás registrado" · E6 | — |
| **"Cancelar Registro"** | registrado | **Modal confirm:** "¿Cancelar registro en '{evento}'?" | Modal confirm | E6 | — |
| **"+ Nuevo Evento"** (admin/moderator) | — | Abre modal form: título, tipo, formato, fecha, duración, location, precio | Modal `form` xl: "Nuevo Evento" | — | — |
| **"Crear Evento"** | datos válidos | POST community_events | **Toast success:** "Evento '{título}' creado." | E1 "La fecha debe ser futura" · E6 | — |
| **"Cancelar Evento"** (organizador) | — | **Modal danger:** "¿Cancelar evento '{título}'? Se notificará a los asistentes." | Modal danger | E6 | F5 "Evento '{título}' cancelado" a todos los registrados |
| **"Marcar Asistencia"** (organizador) | — | Lista de registrados con toggle asistió/no_show | — | — | — |
| **"Exportar Asistentes"** | — | Descarga CSV | — | E6 | — |

---

## 7. Pantalla — Recursos (`/panel/community/resources`)

### 7.1 Decision Table

| Trigger | Condición | Resultado | Modal/Toast (texto) | Errores | Notif F5 |
|---------|-----------|-----------|----------------------|---------|----------|
| Clic en **"Recursos"** | — | Grid/lista de recursos compartidos con búsqueda y filtros | — | — | — |
| Filtro por tipo (template/checklist/guide) | — | Filtra recursos | — | — | — |
| Filtro por categoría (ops/marketing/finance) | — | Filtra recursos | — | — | — |
| **"+ Compartir Recurso"** | — | Abre modal form: título, descripción, tipo, categoría, archivo/URL, tags | Modal `form`: "Compartir Recurso" | — | — |
| **"Compartir"** | título + archivo/URL | POST community_resources | **Toast success:** "Recurso '{título}' compartido." | E6 | — |
| Clic en recurso | — | Detalle: descripción, archivo, descargas, likes | — | — | — |
| **"Descargar"** | — | Descarga el archivo, incrementa downloads_count | — | E6 | — |
| **"Me Gusta"** | — | toggle like | — | — | — |
| **"Eliminar Recurso"** (autor) | — | **Modal danger:** "¿Eliminar recurso '{título}'?" | Modal danger | E6 | — |

---

## 8. Consecuencias cross-módulo (eventos que dispara M19)

| Acción en M19 | Módulo afectado | Efecto | Notificación F5 |
|---------------|-----------------|--------|-----------------|
| Pregunta marcada como resuelta | Academy (M18) | Posible link a curso relevante | — |
| Nuevo evento publicado | Marketing (M15) | Email a usuarios de la comunidad | "Nuevo evento: {título}" |
| Recurso compartido | Academy (M18) | Posible importar como recurso de curso | — |
| Usuario completa curso + post activo | Academy (M18) | Badge "Colaborador Activo" | — |
| Evento completado | Academy (M18) | Certificado de asistencia | "Certificado disponible para {evento}" |
| Nuevo miembro en grupo privado | CRM (M14) | Actualizar engagement del usuario | — |

---

## 9. Gap analysis

| # | Gap | Severidad | Descripción |
|---|-----|-----------|-------------|
| G1 | Módulo completo no existe | 🔴 BLOCKER | No hay backend, frontend, ni servicios |
| G2 | Sin foro/discusiones | 🔴 BLOCKER | No hay estructura de posts, respuestas, o hilos |
| G3 | Sin grupos | 🔴 CRÍTICO | No hay comunidades por especialidad |
| G4 | Sin directorio | 🟡 ALTO | No hay red de profesionales |
| G5 | Sin eventos | 🟡 ALTO | No hay webinars, meetups, o workshops |
| G6 | Sin recursos compartidos | 🟡 ALTO | No hay templates, checklists, o guías |
| G7 | Sin moderación | 🟠 MEDIO | No hay reportes, ban, o roles de moderador |
| G8 | Sin gamificación | 🟠 MEDIO | No hay badges por actividad (posts, respuestas, likes) |
| G9 | Sin notificaciones push | 🟠 MEDIO | No hay alertas de respuestas en hilos seguidos |
| G10 | Sin integración chat | 🟠 MEDIO | No hay mensajes directos entre profesionales |

---

## 10. Checklist de verificación M19

### Feed
- [ ] Feed de posts con filtros por tipo
- [ ] Crear post (discusión, pregunta, tip, caso de estudio)
- [ ] Responder a posts
- [ ] Like/Unlike
- [ ] Marcar respuesta como solución
- [ ] Compartir (copiar link)
- [ ] Reportar post
- [ ] Cerrar hilo (autor/moderator)
- [ ] Fijar post (moderator)
- [ ] Trending topics (últimas 48h)

### Grupos
- [ ] Grid de grupos con búsqueda
- [ ] Unirse a grupo público
- [ ] Solicitar acceso a grupo privado
- [ ] Crear grupo nuevo
- [ ] Gestionar miembros (promover/expulsar)
- [ ] Abandonar grupo
- [ ] Cerrar grupo (owner)

### Directorio
- [ ] Búsqueda por nombre/hotel/especialidad
- [ ] Perfil profesional con bio, rol, certificaciones
- [ ] Enviar solicitud de conexión
- [ ] Mensaje directo (target)

### Eventos
- [ ] Lista de eventos con filtros
- [ ] Registrarse a evento
- [ ] Cancelar registro
- [ ] Crear evento (admin)
- [ ] Cancelar evento (con notificación)
- [ ] Marcar asistencia
- [ ] Exportar asistentes

### Recursos
- [ ] Grid de recursos con búsqueda/filtros
- [ ] Compartir recurso (upload o URL)
- [ ] Descargar recurso
- [ ] Like recurso
- [ ] Eliminar recurso propio

### Cross-módulo
- [ ] Link a cursos de Academy (M18) desde posts
- [ ] Email de nuevos eventos (M15)
- [ ] Actualiza engagement en CRM (M14)
- [ ] Notificaciones F5 en eventos clave

---

*Documento generado como target. Todo está pendiente de implementación. Copiar molde de `M01-PMS-Central.md`.*
