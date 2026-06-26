const SPANISH_WORDS = new Set([
  'hola', 'gracias', 'reservar', 'habitación', 'hotel', 'precio', 'pago', 'día', 'noche',
  'buenos', 'tardes', 'días', 'quiero', 'necesito', 'ayuda', 'favor', 'disponible',
  'cuánto', 'cuesta', 'check', 'in', 'out', 'cancelar', 'modificar', 'fecha', 'persona',
  'adulto', 'niño', 'desayuno', 'piscina', 'wifi', 'toalla', 'limpieza', 'problema',
  'no', 'sí', 'por', 'para', 'con', 'sin', 'una', 'un', 'el', 'la', 'los', 'las',
  'de', 'del', 'en', 'que', 'es', 'son', 'está', 'hay', 'tiene', 'tienen',
  'habitaciones', 'reservación', 'confirmar', 'número', 'teléfono', 'email', 'correo',
  'aeropuerto', 'traslado', 'transporte', 'taxi', 'llamar', 'hablar', 'persona',
  'gerente', 'recepcionista', 'emergencia', 'urgente', 'doctor', 'médico',
  'tarde', 'mañana', 'noche', 'hoy', 'ayer', 'semana', 'mes', 'año',
  'cama', 'baño', 'ducha', 'aire', 'acondicionado', 'calefacción', 'luz',
  'llave', 'tarjeta', 'puerta', 'ventana', 'vista', 'piso', 'ascensor',
  'restaurante', 'comida', 'cena', 'bar', 'menú', 'room', 'service',
  'equipaje', 'maleta', 'guardar', 'salir', 'entrar', 'llegada', 'salida',
  'tarifa', 'impuesto', 'factura', 'recibo', 'comprobante', 'deposito', 'depósito',
  'reservado', 'reserva', 'reservas',
])

const PORTUGUESE_WORDS = new Set([
  'olá', 'obrigado', 'reservar', 'quarto', 'hotel', 'preço', 'pagamento', 'dia', 'noite',
  'bom', 'tarde', 'dias', 'quero', 'preciso', 'ajuda', 'favor', 'disponível',
  'quanto', 'custa', 'cancelar', 'modificar', 'data', 'pessoa', 'adulto', 'criança',
  'pequeno', 'café', 'manhã', 'piscina', 'toalha', 'limpeza', 'problema',
  'não', 'sim', 'por', 'para', 'com', 'sem', 'uma', 'um', 'o', 'a', 'os', 'as',
  'de', 'do', 'da', 'em', 'no', 'na', 'que', 'é', 'são', 'está', 'tem', 'têm',
  'quartos', 'reserva', 'confirmar', 'número', 'telefone', 'correio',
  'aeroporto', 'transporte', 'táxi', 'chamar', 'falar', 'pessoa',
  'gerente', 'recepcionista', 'emergência', 'urgente', 'médico',
  'tarde', 'manhã', 'hoje', 'ontem', 'semana', 'mês', 'ano',
  'cama', 'banheiro', 'chuveiro', 'ar', 'condicionado', 'luz',
  'chave', 'cartão', 'porta', 'janela', 'vista', 'andar', 'elevador',
  'restaurante', 'comida', 'jantar', 'bar', 'cardápio',
  'bagagem', 'mala', 'guardar', 'sair', 'entrar', 'chegada', 'partida',
  'tarifa', 'imposto', 'fatura', 'recibo', 'comprovante', 'depósito',
])

export function detectLanguage(text: string): 'es' | 'en' | 'pt' {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1)

  let esScore = 0
  let ptScore = 0

  for (const word of words) {
    if (SPANISH_WORDS.has(word)) esScore++
    if (PORTUGUESE_WORDS.has(word)) ptScore++
  }

  if (esScore > ptScore && esScore > 0) return 'es'
  if (ptScore > esScore && ptScore > 0) return 'pt'
  if (esScore > 0) return 'es'
  return 'en'
}
