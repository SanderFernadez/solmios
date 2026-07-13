# Proceso de creacion del cronograma — Manager Hotel (SOLMI OS)

## Fase 1: Analisis del proyecto

```
1. Leer CLAUDE.md -> stack, arquitectura, modulos, estado
2. Leer ARCHITECTURE.md -> estructura de carpetas
3. Explorar backend/src/modules/ -> 46 modulos identificados
4. Explorar backend/src/connectors/ -> 26 conectores entre modulos
5. Explorar backend/src/services/ -> 10 servicios compartidos
6. Explorar frontend/src/ -> 46 paginas, 46 services, 6 stores
7. Identificar:
   - 46 modulos backend (572 archivos, ~45K LOC)
   - 164 archivos frontend (~37K LOC)
   - ~87K LOC total
   - 101 tests backend
   - 6 integraciones externas
```

## Fase 2: Inventario de modulos

```
46 modulos agrupados en 8 areas:

NUCLEO (12): habitaciones, reservas, huespedes, facturas, folios,
             payments, cash, gastos, reembolsos, payment-requests,
             reports, pricing

OPERACION (10): housekeeping, mantenimiento, amenities, paquetes,
                grupos, dispositivos, ttlock, canales, bookingengine,
                anuncios

GESTION (13): hoteles, usuarios, roles, staff-auth, auditlog,
              tickets, notificaciones, messages, pushtokens,
              apikeys, dashboard, feedback, opiniones

RRHH (5): empleados, payroll, attendance, reclutamiento, capacitacion

CRM (2): crm, marketing

AI (2): ai-recepcionista, ai-gerente

ADMIN (2): admin, activos
```

## Fase 3: WBS

```
Por cada modulo:
  1. Analisis de codigo existente
  2. Diseno de mejora / refactor
  3. Implementacion backend
  4. Implementacion frontend
  5. Tests
  6. Documentacion
```

## Fase 4: Asignacion RACI

```
Roles:
  ARQ  -> Arquitecto
  BE1/2 -> Backend Developers
  FE1/2 -> Frontend Developers
  FS   -> Full Stack
  DBA  -> Database Admin
  QA   -> Quality Assurance
  DEV  -> DevOps
  UX   -> UX/UI Designer
```

## Fase 5: Cronograma

```
8 fases respetando dependencias entre modulos.
Sprints de 2 semanas.
Distribucion: max 8h por persona por dia.
```

## Fase 6: Estimacion

```
Total estimado: ~2,400 horas / ~300 dias-hombre
Equipo: 4-6 personas
Duracion: ~6 meses (~24 semanas)
```

## Herramientas usadas

| Herramienta | Proposito |
|-------------|-----------|
| task explore | Analisis profundo del proyecto |
| CLAUDE.md | Documentacion de referencia |
| ARCHITECTURE.md | Estructura y arquitectura |
| HTML + CSS | Documento visual del plan |
| Google Apps Script | Conectar Sheets con GitLab |
