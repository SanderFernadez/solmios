# Sistema de Cronograma — Manager Hotel (SOLMI OS)

Sistema completo de planificación y seguimiento: HTML visual + Google Sheets + GitLab Issues sync.

## Que incluye

```
cronograma/
├── README.md                     ← esto
├── plantilla-plan.html           ← plan HTML con WBS, RACI, cronograma diario
├── cronograma-sync.gs            ← script Google Apps Script (Sheets ↔ GitLab)
└── proceso.md                    ← paso a paso de como se creo el plan
```

## Stack del proyecto

| Capa | Tecnologia |
|------|-----------|
| Runtime | Bun >= 1.3 |
| Backend | arckode-framework 1.6.2 (TypeScript) |
| Frontend | Vue 3.5 + Vite 8 + Pinia 3 + Vue Router 5 |
| CSS | Tailwind CSS 4.3 |
| DB | SQLite (dev) / PostgreSQL (prod) |
| ORM | RepositoryAdapter<T> (multi-motor) |
| Testing | bun test + vue-tsc |
| Integraciones | Stripe, Channex, TTLock, Resend, FCM |

## Como usar

### 1. Abrir el plan HTML

```
abrir plantilla-plan.html en navegador
```

### 2. Conectar Google Sheets

```
1. https://sheets.new
2. Pegar encabezados:
   ID | Modulo | Submodulo | Tarea | Responsable | Horas | Prioridad | Estado | Sprint | GitLab URL
3. Pegar tareas del plan
4. Extensiones > Apps Script > pegar cronograma-sync.gs
5. Configurar:
   - GITLAB_URL
   - PROJECT_ID (underworf1/solmios)
   - TOKEN (glpat-...)
6. Guardar -> aparece menu "Cronograma"
```

### 3. Ciclo semanal

```
Lunes:   Planificar en Sheets -> Push a GitLab (crea/actualiza issues)
Mar-Vie: Desarrollo en GitLab
Viernes: Pull desde GitLab -> Resumen equipo -> ajustar
```

## Archivos

| Archivo | Proposito |
|---------|-----------|
| `plantilla-plan.html` | Plan visual con WBS, RACI, estimaciones, cronograma diario |
| `cronograma-sync.gs` | Script Google Apps Script para sincronizar Sheets con GitLab |
| `proceso.md` | Documentacion de como se creo el plan |

## GitLab

- Proyecto: https://gitlab.com/underworf1/solmios
- Ciclo: EN PROCESO -> QA-DEV -> PREIMPLEMENTACION -> QA-UI -> IMPLEMENTACION
