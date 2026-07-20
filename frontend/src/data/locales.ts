// locales.ts — Catálogos geográficos compartidos para formularios.
// Single source of truth: consumido por guests/index.vue, reservations/index.vue
// y auth/register.vue a través de SearchSelect (buscador dinámico).
//
// País y gentilicio viven juntos en COUNTRY_DATA y las listas se derivan de ahí:
// antes eran dos arrays paralelos que había que mantener alineados a mano, y
// agregar un país sin su nacionalidad corría todos los índices siguientes.
//
// Orden: primero los mercados frecuentes (Caribe/Latam/España/EEUU), después el
// resto alfabético. Con el buscador el orden pesa poco, pero acorta el camino al
// 90% de los casos. 'Otros' queda último a propósito.

interface CountryEntry {
  /** Nombre del país en español. Es lo que se guarda y lo que se busca. */
  name: string
  /** Gentilicio en femenino (concuerda con "nacionalidad"). */
  nationality: string
  /**
   * ISO 3166-1 alpha-2. Lo usa el input de teléfono para saber el prefijo y el
   * formato del país (libphonenumber). Vacío solo en 'Otros'.
   *
   * Los códigos NO se escribieron a mano: se derivaron con Intl.DisplayNames a
   * partir del nombre en español y se verifican en el test del catálogo.
   */
  code: string
}

const COUNTRY_DATA: CountryEntry[] = [
  // — Mercados frecuentes —
  { name: 'República Dominicana', nationality: 'Dominicana', code: 'DO' },
  { name: 'Estados Unidos', nationality: 'Estadounidense', code: 'US' },
  { name: 'España', nationality: 'Española', code: 'ES' },
  { name: 'Colombia', nationality: 'Colombiana', code: 'CO' },
  { name: 'México', nationality: 'Mexicana', code: 'MX' },
  { name: 'Argentina', nationality: 'Argentina', code: 'AR' },
  { name: 'Venezuela', nationality: 'Venezolana', code: 'VE' },
  { name: 'Puerto Rico', nationality: 'Puertorriqueña', code: 'PR' },
  { name: 'Cuba', nationality: 'Cubana', code: 'CU' },
  { name: 'Brasil', nationality: 'Brasileña', code: 'BR' },
  { name: 'Chile', nationality: 'Chilena', code: 'CL' },
  { name: 'Perú', nationality: 'Peruana', code: 'PE' },
  { name: 'Canadá', nationality: 'Canadiense', code: 'CA' },

  // — Resto del mundo, alfabético —
  { name: 'Afganistán', nationality: 'Afgana', code: 'AF' },
  { name: 'Albania', nationality: 'Albanesa', code: 'AL' },
  { name: 'Alemania', nationality: 'Alemana', code: 'DE' },
  { name: 'Andorra', nationality: 'Andorrana', code: 'AD' },
  { name: 'Angola', nationality: 'Angoleña', code: 'AO' },
  { name: 'Antigua y Barbuda', nationality: 'Antiguana', code: 'AG' },
  { name: 'Arabia Saudita', nationality: 'Saudí', code: 'SA' },
  { name: 'Argelia', nationality: 'Argelina', code: 'DZ' },
  { name: 'Armenia', nationality: 'Armenia', code: 'AM' },
  { name: 'Australia', nationality: 'Australiana', code: 'AU' },
  { name: 'Austria', nationality: 'Austriaca', code: 'AT' },
  { name: 'Azerbaiyán', nationality: 'Azerbaiyana', code: 'AZ' },
  { name: 'Bahamas', nationality: 'Bahameña', code: 'BS' },
  { name: 'Bangladés', nationality: 'Bangladesí', code: 'BD' },
  { name: 'Barbados', nationality: 'Barbadense', code: 'BB' },
  { name: 'Baréin', nationality: 'Bareiní', code: 'BH' },
  { name: 'Bélgica', nationality: 'Belga', code: 'BE' },
  { name: 'Belice', nationality: 'Beliceña', code: 'BZ' },
  { name: 'Benín', nationality: 'Beninesa', code: 'BJ' },
  { name: 'Bielorrusia', nationality: 'Bielorrusa', code: 'BY' },
  { name: 'Bolivia', nationality: 'Boliviana', code: 'BO' },
  { name: 'Bosnia y Herzegovina', nationality: 'Bosnia', code: 'BA' },
  { name: 'Botsuana', nationality: 'Botsuana', code: 'BW' },
  { name: 'Brunéi', nationality: 'Bruneana', code: 'BN' },
  { name: 'Bulgaria', nationality: 'Búlgara', code: 'BG' },
  { name: 'Burkina Faso', nationality: 'Burkinesa', code: 'BF' },
  { name: 'Burundi', nationality: 'Burundesa', code: 'BI' },
  { name: 'Bután', nationality: 'Butanesa', code: 'BT' },
  { name: 'Cabo Verde', nationality: 'Caboverdiana', code: 'CV' },
  { name: 'Camboya', nationality: 'Camboyana', code: 'KH' },
  { name: 'Camerún', nationality: 'Camerunesa', code: 'CM' },
  { name: 'Catar', nationality: 'Catarí', code: 'QA' },
  { name: 'Chad', nationality: 'Chadiana', code: 'TD' },
  { name: 'China', nationality: 'China', code: 'CN' },
  { name: 'Chipre', nationality: 'Chipriota', code: 'CY' },
  { name: 'Ciudad del Vaticano', nationality: 'Vaticana', code: 'VA' },
  { name: 'Comoras', nationality: 'Comorense', code: 'KM' },
  { name: 'Corea del Norte', nationality: 'Norcoreana', code: 'KP' },
  // 'Coreana' y no 'Surcoreana': es el valor que ya está guardado en huéspedes
  // existentes, y cambiarlo los dejaría con una nacionalidad fuera del catálogo.
  { name: 'Corea del Sur', nationality: 'Coreana', code: 'KR' },
  { name: 'Costa de Marfil', nationality: 'Marfileña', code: 'CI' },
  { name: 'Costa Rica', nationality: 'Costarricense', code: 'CR' },
  { name: 'Croacia', nationality: 'Croata', code: 'HR' },
  { name: 'Dinamarca', nationality: 'Danesa', code: 'DK' },
  { name: 'Dominica', nationality: 'Dominiquesa', code: 'DM' },
  { name: 'Ecuador', nationality: 'Ecuatoriana', code: 'EC' },
  { name: 'Egipto', nationality: 'Egipcia', code: 'EG' },
  { name: 'El Salvador', nationality: 'Salvadoreña', code: 'SV' },
  { name: 'Emiratos Árabes Unidos', nationality: 'Emiratí', code: 'AE' },
  { name: 'Eritrea', nationality: 'Eritrea', code: 'ER' },
  { name: 'Eslovaquia', nationality: 'Eslovaca', code: 'SK' },
  { name: 'Eslovenia', nationality: 'Eslovena', code: 'SI' },
  { name: 'Estonia', nationality: 'Estonia', code: 'EE' },
  { name: 'Esuatini', nationality: 'Suazi', code: 'SZ' },
  { name: 'Etiopía', nationality: 'Etíope', code: 'ET' },
  { name: 'Filipinas', nationality: 'Filipina', code: 'PH' },
  { name: 'Finlandia', nationality: 'Finlandesa', code: 'FI' },
  { name: 'Fiyi', nationality: 'Fiyiana', code: 'FJ' },
  { name: 'Francia', nationality: 'Francesa', code: 'FR' },
  { name: 'Gabón', nationality: 'Gabonesa', code: 'GA' },
  { name: 'Gambia', nationality: 'Gambiana', code: 'GM' },
  { name: 'Georgia', nationality: 'Georgiana', code: 'GE' },
  { name: 'Ghana', nationality: 'Ghanesa', code: 'GH' },
  { name: 'Granada', nationality: 'Granadina', code: 'GD' },
  { name: 'Grecia', nationality: 'Griega', code: 'GR' },
  { name: 'Guatemala', nationality: 'Guatemalteca', code: 'GT' },
  { name: 'Guinea', nationality: 'Guineana', code: 'GN' },
  { name: 'Guinea-Bisáu', nationality: 'Guineana', code: 'GW' },
  { name: 'Guinea Ecuatorial', nationality: 'Ecuatoguineana', code: 'GQ' },
  { name: 'Guyana', nationality: 'Guyanesa', code: 'GY' },
  { name: 'Haití', nationality: 'Haitiana', code: 'HT' },
  { name: 'Honduras', nationality: 'Hondureña', code: 'HN' },
  { name: 'Hungría', nationality: 'Húngara', code: 'HU' },
  { name: 'India', nationality: 'India', code: 'IN' },
  { name: 'Indonesia', nationality: 'Indonesia', code: 'ID' },
  { name: 'Irak', nationality: 'Iraquí', code: 'IQ' },
  { name: 'Irán', nationality: 'Iraní', code: 'IR' },
  { name: 'Irlanda', nationality: 'Irlandesa', code: 'IE' },
  { name: 'Islandia', nationality: 'Islandesa', code: 'IS' },
  { name: 'Islas Marshall', nationality: 'Marshalesa', code: 'MH' },
  { name: 'Islas Salomón', nationality: 'Salomonense', code: 'SB' },
  { name: 'Israel', nationality: 'Israelí', code: 'IL' },
  { name: 'Italia', nationality: 'Italiana', code: 'IT' },
  { name: 'Jamaica', nationality: 'Jamaicana', code: 'JM' },
  { name: 'Japón', nationality: 'Japonesa', code: 'JP' },
  { name: 'Jordania', nationality: 'Jordana', code: 'JO' },
  { name: 'Kazajistán', nationality: 'Kazaja', code: 'KZ' },
  { name: 'Kenia', nationality: 'Keniana', code: 'KE' },
  { name: 'Kirguistán', nationality: 'Kirguisa', code: 'KG' },
  { name: 'Kiribati', nationality: 'Kiribatiana', code: 'KI' },
  { name: 'Kuwait', nationality: 'Kuwaití', code: 'KW' },
  { name: 'Laos', nationality: 'Laosiana', code: 'LA' },
  { name: 'Lesoto', nationality: 'Lesotense', code: 'LS' },
  { name: 'Letonia', nationality: 'Letona', code: 'LV' },
  { name: 'Líbano', nationality: 'Libanesa', code: 'LB' },
  { name: 'Liberia', nationality: 'Liberiana', code: 'LR' },
  { name: 'Libia', nationality: 'Libia', code: 'LY' },
  { name: 'Liechtenstein', nationality: 'Liechtensteiniana', code: 'LI' },
  { name: 'Lituania', nationality: 'Lituana', code: 'LT' },
  { name: 'Luxemburgo', nationality: 'Luxemburguesa', code: 'LU' },
  { name: 'Macedonia del Norte', nationality: 'Macedonia', code: 'MK' },
  { name: 'Madagascar', nationality: 'Malgache', code: 'MG' },
  { name: 'Malasia', nationality: 'Malasia', code: 'MY' },
  { name: 'Malaui', nationality: 'Malauí', code: 'MW' },
  { name: 'Maldivas', nationality: 'Maldiva', code: 'MV' },
  { name: 'Malí', nationality: 'Malense', code: 'ML' },
  { name: 'Malta', nationality: 'Maltesa', code: 'MT' },
  { name: 'Marruecos', nationality: 'Marroquí', code: 'MA' },
  { name: 'Mauricio', nationality: 'Mauriciana', code: 'MU' },
  { name: 'Mauritania', nationality: 'Mauritana', code: 'MR' },
  { name: 'Micronesia', nationality: 'Micronesia', code: 'FM' },
  { name: 'Moldavia', nationality: 'Moldava', code: 'MD' },
  { name: 'Mónaco', nationality: 'Monegasca', code: 'MC' },
  { name: 'Mongolia', nationality: 'Mongola', code: 'MN' },
  { name: 'Montenegro', nationality: 'Montenegrina', code: 'ME' },
  { name: 'Mozambique', nationality: 'Mozambiqueña', code: 'MZ' },
  { name: 'Namibia', nationality: 'Namibia', code: 'NA' },
  { name: 'Nauru', nationality: 'Nauruana', code: 'NR' },
  { name: 'Nepal', nationality: 'Nepalí', code: 'NP' },
  { name: 'Nicaragua', nationality: 'Nicaragüense', code: 'NI' },
  { name: 'Níger', nationality: 'Nigerina', code: 'NE' },
  { name: 'Nigeria', nationality: 'Nigeriana', code: 'NG' },
  { name: 'Noruega', nationality: 'Noruega', code: 'NO' },
  { name: 'Nueva Zelanda', nationality: 'Neozelandesa', code: 'NZ' },
  { name: 'Omán', nationality: 'Omaní', code: 'OM' },
  { name: 'Países Bajos', nationality: 'Neerlandesa', code: 'NL' },
  { name: 'Pakistán', nationality: 'Pakistaní', code: 'PK' },
  { name: 'Palaos', nationality: 'Palauana', code: 'PW' },
  { name: 'Palestina', nationality: 'Palestina', code: 'PS' },
  { name: 'Panamá', nationality: 'Panameña', code: 'PA' },
  { name: 'Papúa Nueva Guinea', nationality: 'Papuana', code: 'PG' },
  { name: 'Paraguay', nationality: 'Paraguaya', code: 'PY' },
  { name: 'Polonia', nationality: 'Polaca', code: 'PL' },
  { name: 'Portugal', nationality: 'Portuguesa', code: 'PT' },
  { name: 'Reino Unido', nationality: 'Británica', code: 'GB' },
  { name: 'República Centroafricana', nationality: 'Centroafricana', code: 'CF' },
  { name: 'República Checa', nationality: 'Checa', code: 'CZ' },
  { name: 'República del Congo', nationality: 'Congoleña', code: 'CG' },
  { name: 'República Democrática del Congo', nationality: 'Congoleña', code: 'CD' },
  { name: 'Ruanda', nationality: 'Ruandesa', code: 'RW' },
  { name: 'Rumania', nationality: 'Rumana', code: 'RO' },
  { name: 'Rusia', nationality: 'Rusa', code: 'RU' },
  { name: 'Samoa', nationality: 'Samoana', code: 'WS' },
  { name: 'San Cristóbal y Nieves', nationality: 'Cristobaleña', code: 'KN' },
  { name: 'San Marino', nationality: 'Sanmarinense', code: 'SM' },
  { name: 'San Vicente y las Granadinas', nationality: 'Sanvicentina', code: 'VC' },
  { name: 'Santa Lucía', nationality: 'Santalucense', code: 'LC' },
  { name: 'Santo Tomé y Príncipe', nationality: 'Santotomense', code: 'ST' },
  { name: 'Senegal', nationality: 'Senegalesa', code: 'SN' },
  { name: 'Serbia', nationality: 'Serbia', code: 'RS' },
  { name: 'Seychelles', nationality: 'Seychelense', code: 'SC' },
  { name: 'Sierra Leona', nationality: 'Sierraleonesa', code: 'SL' },
  { name: 'Singapur', nationality: 'Singapurense', code: 'SG' },
  { name: 'Siria', nationality: 'Siria', code: 'SY' },
  { name: 'Somalia', nationality: 'Somalí', code: 'SO' },
  { name: 'Sri Lanka', nationality: 'Ceilanesa', code: 'LK' },
  { name: 'Sudáfrica', nationality: 'Sudafricana', code: 'ZA' },
  { name: 'Sudán', nationality: 'Sudanesa', code: 'SD' },
  { name: 'Sudán del Sur', nationality: 'Sursudanesa', code: 'SS' },
  { name: 'Suecia', nationality: 'Sueca', code: 'SE' },
  { name: 'Suiza', nationality: 'Suiza', code: 'CH' },
  { name: 'Surinam', nationality: 'Surinamesa', code: 'SR' },
  { name: 'Tailandia', nationality: 'Tailandesa', code: 'TH' },
  { name: 'Tanzania', nationality: 'Tanzana', code: 'TZ' },
  { name: 'Tayikistán', nationality: 'Tayika', code: 'TJ' },
  { name: 'Timor Oriental', nationality: 'Timorense', code: 'TL' },
  { name: 'Togo', nationality: 'Togolesa', code: 'TG' },
  { name: 'Tonga', nationality: 'Tongana', code: 'TO' },
  { name: 'Trinidad y Tobago', nationality: 'Trinitense', code: 'TT' },
  { name: 'Túnez', nationality: 'Tunecina', code: 'TN' },
  { name: 'Turkmenistán', nationality: 'Turkmena', code: 'TM' },
  { name: 'Turquía', nationality: 'Turca', code: 'TR' },
  { name: 'Tuvalu', nationality: 'Tuvaluana', code: 'TV' },
  { name: 'Ucrania', nationality: 'Ucraniana', code: 'UA' },
  { name: 'Uganda', nationality: 'Ugandesa', code: 'UG' },
  { name: 'Uruguay', nationality: 'Uruguaya', code: 'UY' },
  { name: 'Uzbekistán', nationality: 'Uzbeka', code: 'UZ' },
  { name: 'Vanuatu', nationality: 'Vanuatuense', code: 'VU' },
  { name: 'Vietnam', nationality: 'Vietnamita', code: 'VN' },
  { name: 'Yemen', nationality: 'Yemení', code: 'YE' },
  { name: 'Yibuti', nationality: 'Yibutiana', code: 'DJ' },
  { name: 'Zambia', nationality: 'Zambiana', code: 'ZM' },
  { name: 'Zimbabue', nationality: 'Zimbabuense', code: 'ZW' },

  { name: 'Otros', nationality: 'Otra', code: '' },
]

export const COUNTRIES: string[] = COUNTRY_DATA.map((c) => c.name)

export const NATIONALITIES: string[] = COUNTRY_DATA.map((c) => c.nationality)

/**
 * Código ISO del país, por nombre en español. `undefined` para 'Otros' o para
 * un valor que no esté en el catálogo (por ejemplo un país guardado antes de
 * que existiera esta lista).
 */
export function countryCode(name: string): string | undefined {
  const entry = COUNTRY_DATA.find((c) => c.name === name)
  return entry?.code || undefined
}

/**
 * Nombre canónico del país a partir de lo que haya guardado: el nombre mismo o un código ISO.
 *
 * Por qué hace falta: `hotels.country` quedó con DOS formatos conviviendo. El registro guarda el
 * nombre ('República Dominicana', vía SearchSelect sobre COUNTRIES) y la configuración del hotel
 * guardaba el ISO ('DO', de un <select> propio de 6 opciones). Todo lo que deriva del país
 * (bandera, prefijo telefónico vía countryCode) espera el NOMBRE, así que un hotel con 'DO'
 * guardado no resolvía nada.
 *
 * Devuelve '' si no se reconoce, para no inventar un país que el usuario no eligió.
 */
export function countryName(value: string | undefined | null): string {
  if (!value) return ''
  const raw = value.trim()
  if (!raw) return ''
  const byName = COUNTRY_DATA.find((c) => c.name === raw)
  if (byName) return byName.name
  const iso = raw.toUpperCase()
  return COUNTRY_DATA.find((c) => c.code && c.code === iso)?.name ?? ''
}

/** Entradas completas, para quien necesite nombre + código juntos. */
export const COUNTRY_ENTRIES: readonly CountryEntry[] = COUNTRY_DATA

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
