// locales.ts — Catálogos geográficos compartidos para formularios.
// Single source of truth: consumido por guests/index.vue y reservations/index.vue
// a través de SearchSelect (buscador dinámico). Editar acá se refleja en ambos.

export const COUNTRIES: string[] = [
  'República Dominicana', 'Estados Unidos', 'España', 'Colombia', 'México',
  'Argentina', 'Venezuela', 'Puerto Rico', 'Cuba', 'Brasil', 'Chile',
  'Perú', 'Ecuador', 'Honduras', 'Guatemala', 'El Salvador', 'Nicaragua',
  'Costa Rica', 'Panamá', 'Uruguay', 'Paraguay', 'Bolivia', 'Canadá',
  'Francia', 'Alemania', 'Italia', 'Reino Unido', 'China', 'Japón',
  'Corea del Sur', 'Australia', 'Otros',
]

export const NATIONALITIES: string[] = [
  'Dominicana', 'Estadounidense', 'Española', 'Colombiana', 'Mexicana',
  'Argentina', 'Venezolana', 'Puertorriqueña', 'Cubana', 'Brasileña', 'Chilena',
  'Peruana', 'Ecuatoriana', 'Hondureña', 'Guatemalteca', 'Salvadoreña', 'Nicaragüense',
  'Costarricense', 'Panameña', 'Uruguaya', 'Paraguaya', 'Boliviana', 'Canadiense',
  'Francesa', 'Alemana', 'Italiana', 'Británica', 'China', 'Japonesa',
  'Coreana', 'Australiana', 'Otra',
]

// Formato { v: value, l: label } — mismo formato que usa reservations/index.vue en sus <option>.
export const LANGUAGES: { v: string; l: string }[] = [
  { v: 'Español', l: 'Español' }, { v: 'English', l: 'English' },
  { v: 'Français', l: 'Français' }, { v: 'Português', l: 'Português' },
  { v: 'Deutsch', l: 'Deutsch' }, { v: 'Italiano', l: 'Italiano' },
  { v: '中文', l: '中文' }, { v: '日本語', l: '日本語' },
]

export const DOC_TYPES: { v: string; l: string }[] = [
  { v: 'dni', l: 'DNI / NIF' }, { v: 'passport', l: 'Pasaporte' },
  { v: 'cedula', l: 'Cédula' }, { v: 'rif', l: 'RIF' },
  { v: 'driver_license', l: 'Licencia de conducir' }, { v: 'other', l: 'Otro' },
]
