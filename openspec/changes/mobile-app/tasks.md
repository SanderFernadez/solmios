# Tasks: mobile-app

## Phase 1: Infraestructura Base

### 1.1 Proyecto Flutter
- [x] 1.1.1 Crear pubspec.yaml con dependencias (riverpod, go_router, dio, firebase_messaging, flutter_secure_storage, image_picker, etc.)
- [x] 1.1.2 Crear main.dart con ProviderScope
- [x] 1.1.3 Crear app.dart con MaterialApp.router

**Acceptance:** `flutter pub get` funciona sin errores.

### 1.2 Core — Config
- [x] 1.2.1 Crear core/config/colors.dart (colores del brand Manager Hotel)
- [x] 1.2.2 Crear core/config/theme.dart (ThemeData light)
- [x] 1.2.3 Crear core/config/constants.dart (ApiEndpoints, StorageKeys, ApiConfig)
- [x] 1.2.4 Crear core/config/routes.dart (GoRouter provider, placeholder)

**Acceptance:** Archivos importados sin errores de compilación.

### 1.3 Core — Network
- [x] 1.3.1 Crear core/network/api_client.dart (Dio + AuthInterceptor + dioProvider)
- [x] 1.3.2 Crear core/network/api_exceptions.dart (jerarquía de excepciones: ApiException, Unauthorized, NotFound, Validation, Server)

**Acceptance:** Dio instancia correctamente, interceptor agrega Bearer token.

### 1.4 Core — Storage
- [x] 1.4.1 Crear core/storage/secure_storage.dart (flutter_secure_storage wrapper + secureStorageProvider)

**Acceptance:** save/get/clearAll/hasToken funcionan.

### 1.5 Core — Utils
- [x] 1.5.1 Crear core/utils/validators.dart (isValidPin, isValidPhone)

**Acceptance:** Validaciones retornan true/false correctamente.

### 1.6 Core — Widgets
- [x] 1.6.1 Crear core/widgets/loading_button.dart
- [x] 1.6.2 Crear core/widgets/empty_state.dart
- [x] 1.6.3 Crear core/widgets/error_retry.dart
- [x] 1.6.4 Crear core/widgets/status_badge.dart
- [x] 1.6.5 Crear core/widgets/skeleton.dart
- [x] 1.6.6 Crear core/widgets/widgets.dart (barrel export)

**Acceptance:** Widgets compilables y reutilizables.

---

## Phase 2: Auth (PIN Login)

### 2.1 Domain
- [x] 2.1.1 Crear features/auth/domain/entities/user.dart (User entity con role, phone, pin)
- [x] 2.1.2 Crear features/auth/domain/repositories/auth_repository.dart (abstract: loginByPin, getProfile, hasToken, logout)

**Acceptance:** Entities y abstract interface compilan.

### 2.2 Data
- [x] 2.2.1 Crear features/auth/data/models/auth_models.dart (PinLoginRequest, LoginResponse, UserDto)
- [x] 2.2.2 Crear features/auth/data/repositories/auth_repository_impl.dart (Dio HTTP, manejo de errores)

**Acceptance:** Repository impl implementa toda la interface abstract.

### 2.3 Presentation
- [x] 2.3.1 Crear features/auth/presentation/providers/auth_provider.dart (AuthState + AuthNotifier + authProvider)
- [x] 2.3.2 Crear features/auth/presentation/screens/user_selection_screen.dart (lista de usuarios activos con nombre, teléfono, rol)
- [x] 2.3.3 Crear features/auth/presentation/screens/pin_login_screen.dart (teclado numérico, 4 dígitos, indicadores, animación error)

**Acceptance:** Flujo completo: seleccionar usuario → ingresar PIN → autenticado.

---

## Phase 3: Housekeeping — Core

### 3.1 Domain
- [x] 3.1.1 Crear features/housekeeping/domain/entities/cleaning_task.dart (CleaningTask entity con estados, timers, fotos)
- [x] 3.1.2 Crear features/housekeeping/domain/repositories/housekeeping_repository.dart (abstract: list, getById, start, complete, approve, report, uploadPhoto, removePhoto, getStats)

**Acceptance:** Entity con comportamiento (canStart, canComplete, canApprove, durationMinutes).

### 3.2 Data
- [x] 3.2.1 Crear features/housekeeping/data/models/housekeeping_models.dart (CleaningTaskDto, PhotoEvidence, StatsResponse)
- [x] 3.2.2 Crear features/housekeeping/data/repositories/housekeeping_repository_impl.dart

**Acceptance:** Repository impl con todas las operaciones.

### 3.3 Presentation
- [x] 3.3.1 Crear features/housekeeping/presentation/providers/housekeeping_provider.dart (HousekeepingState + HousekeepingNotifier)

**Acceptance:** State con loading/error/tasks/selectedTask, acciones: load, start, complete, approve, uploadPhoto.

---

## Phase 4: Housekeeping — Camarera

- [x] 4.1 Crear features/housekeeping/presentation/screens/camarera/camarera_home_screen.dart (lista mis habitaciones, Pull-to-refresh)
- [x] 4.2 Crear features/housekeeping/presentation/screens/camarera/camarera_detail_screen.dart (mensaje motivacional + suministros + timer + fotos + reportar)
- [x] 4.3 Crear features/housekeeping/presentation/widgets/timer_widget.dart (cronómetro con pulso, start/stop)
- [x] 4.4 Crear features/housekeeping/presentation/widgets/photo_grid.dart (grid de áreas, cámara, feedback visual)
- [x] 4.5 Crear features/housekeeping/presentation/widgets/supply_list.dart (lista suministros por tipo habitación)

**Acceptance:** Flujo camarera completo: ver habitación → iniciar limpieza → subir fotos → finalizar.

---

## Phase 5: Housekeeping — Supervisor

- [x] 5.1 Crear features/housekeeping/presentation/screens/supervisor/supervisor_home_screen.dart (lista habitaciones para supervisar)
- [x] 5.2 Crear features/housekeeping/presentation/screens/supervisor/approve_screen.dart (fotos camarera + checklist + marcar presencia + aprobar)
- [x] 5.3 Crear features/housekeeping/presentation/widgets/supervisor_checklist.dart (checklist interactivo con checkboxes)

**Acceptance:** Flujo supervisor: ver fotos → marcar presencia → checklist → aprobar.

---

## Phase 6: Housekeeping — Mantenimiento

- [x] 6.1 Crear features/housekeeping/presentation/screens/mantenimiento/mantenimiento_home_screen.dart (solo mis tickets)
- [x] 6.2 Crear features/housekeeping/presentation/screens/mantenimiento/ticket_detail_screen.dart (detalle + resolver + nota)

**Acceptance:** Flujo mantenimiento: ver ticket → resolver → marcar resuelto.

---

## Phase 7: Dashboard Admin

- [x] 7.1 Crear features/dashboard/domain/entities/dashboard_entities.dart (KPIs, room status summary)
- [x] 7.2 Crear features/dashboard/domain/repositories/dashboard_repository.dart (abstract)
- [x] 7.3 Crear features/dashboard/data/repositories/dashboard_repository_impl.dart
- [x] 7.4 Crear features/dashboard/presentation/providers/dashboard_provider.dart
- [x] 7.5 Crear features/dashboard/presentation/screens/dashboard_screen.dart (KPIs cards + room status grid)
- [x] 7.6 Crear features/dashboard/presentation/widgets/stats_card.dart
- [x] 7.7 Crear features/dashboard/presentation/widgets/room_status_grid.dart

**Acceptance:** Dashboard muestra: checkout/limpiando/listas/supervisadas + estado habitaciones.

---

## Phase 8: Rooms

- [x] 8.1 Crear features/rooms/domain/entities/room.dart
- [x] 8.2 Crear features/rooms/domain/repositories/rooms_repository.dart (abstract)
- [x] 8.3 Crear features/rooms/data/repositories/rooms_repository_impl.dart
- [x] 8.4 Crear features/rooms/presentation/providers/rooms_provider.dart
- [x] 8.5 Crear features/rooms/presentation/screens/rooms_screen.dart

**Acceptance:** Lista de habitaciones con estado, filtro, búsqueda.

---

## Phase 9: Reservations

- [x] 9.1 Crear features/reservations/domain/entities/reservation.dart
- [x] 9.2 Crear features/reservations/domain/repositories/reservations_repository.dart (abstract)
- [x] 9.3 Crear features/reservations/data/repositories/reservations_repository_impl.dart
- [x] 9.4 Crear features/reservations/presentation/providers/reservations_provider.dart
- [x] 9.5 Crear features/reservations/presentation/screens/reservations_screen.dart

**Acceptance:** Lista de reservas con estado, filtro por fecha.

---

## Phase 10: Maintenance

- [x] 10.1 Crear features/maintenance/domain/entities/maintenance_ticket.dart
- [x] 10.2 Crear features/maintenance/domain/repositories/maintenance_repository.dart (abstract)
- [x] 10.3 Crear features/maintenance/data/repositories/maintenance_repository_impl.dart
- [x] 10.4 Crear features/maintenance/presentation/providers/maintenance_provider.dart
- [x] 10.5 Crear features/maintenance/presentation/screens/maintenance_screen.dart

**Acceptance:** Lista de tickets con estado, filtro.

---

## Phase 11: Routing + Shell

- [x] 11.1 Completar core/config/routes.dart (GoRouter con rutas por rol)
- [x] 11.2 Crear features/auth/presentation/widgets/scaffold_with_nav.dart (bottom nav + drawer)

**Acceptance:** Navegación funciona con bottom nav, rutas protegidas por rol.

---

## Phase 12: Verificación

- [x] 12.1 Ejecutar `flutter analyze` → 0 errores
- [x] 12.2 Ejecutar `flutter build apk --debug` → compila
- [x] 12.3 Verificar auth flow: selección → PIN → home
- [x] 12.4 Verificar navegación por rol: camarera/supervisor/mantenimiento/admin
