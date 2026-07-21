// pricing/usecases/defaults.ts — Datos semilla del módulo pricing.

/** Temporadas por defecto (rangos del año en curso) — se siembran la 1ª vez que un hotel abre la sección. */
export function defaultSeasons(): any[] {
  const y = new Date().getFullYear()
  return [
    { name: 'baja', label: 'Temporada Baja', startDate: `${y}-01-01`, endDate: `${y}-05-31`, color: '#3b82f6', sortOrder: 0, active: 1 },
    { name: 'media', label: 'Temporada Media', startDate: `${y}-06-01`, endDate: `${y}-11-30`, color: '#14b8a6', sortOrder: 1, active: 0 },
    { name: 'alta', label: 'Temporada Alta', startDate: `${y}-12-01`, endDate: `${y}-12-31`, color: '#84cc16', sortOrder: 2, active: 0 },
    { name: 'especial', label: 'Temporada Especial', startDate: '', endDate: '', color: '#f59e0b', sortOrder: 3, active: 0 },
  ]
}
