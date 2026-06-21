# SPEC — M23: Facturación Electrónica LATAM

**Suite**: Talento & Nómina
**Prioridad**: P0
**Complejidad**: Alta
**Integraciones**: DGII, DIAN, SAT, SUNAT, SII, AFIP/ARCA

---

## Descripción

Integración con autoridades fiscales de 6 países latinoamericanos. Emisión automática de facturas electrónicas, NCF, notas de crédito y anulaciones con cumplimiento legal completo.

---

## Países Soportados

| País | Autoridad | Sistema | Formato |
|------|-----------|---------|---------|
| Rep. Dominicana | DGII | e-NCF | XML + QR |
| Colombia | DIAN | Facturación Electrónica | XML UBL 2.1 |
| México | SAT | CFDI | XML CFDI 4.0 |
| Perú | SUNAT | Facturación Electrónica | XML UBL 2.1 |
| Chile | SII | DTE | XML |
| Argentina | AFIP/ARCA | Factura Electrónica | XML WSFE |

---

## Funcionalidades

### 1. Emisión de Facturas
- Generación automática al check-out
- Facturación por anticipado
- Facturación por separado (habitación + servicios)
- Notas de crédito
- Anulaciones con justificación

### 2. Secuencias
- NCF secuenciales automáticas (RD)
- Rangos de numeración por tipo
- Alertas de secuencia agotada
- Respaldo de secuencias

### 3. Validación
- Validación de datos antes de enviar
- Reintentos automáticos en caso de fallo
- Cola de facturación para alta demanda
- Logs completos de cada transacción

### 4. Reportes
- Libro de ventas diario/mensual
- Resumen de impuestos por período
- Exportación para contabilidad
- Dashboard de cumplimiento fiscal

---

## Modelo de Datos

```typescript
interface ElectronicInvoice {
  id: UUID
  hotelId: UUID
  invoiceId: UUID
  country: 'DO' | 'CO' | 'MX' | 'PE' | 'CL' | 'AR'
  status: 'pending' | 'sent' | 'accepted' | 'rejected' | 'voided'
  sequence: string           // NCF, CFE, etc.
  xmlBase64: string
  qrCode?: string
  externalId?: string        // ID en la autoridad fiscal
  errorMessage?: string
  sentAt?: Date
  acceptedAt?: Date
  createdAt: Date
}

interface TaxConfig {
  id: UUID
  hotelId: UUID
  country: string
  taxId: string              // RNC, RFC, RUT, etc.
  taxName: string
  resolution?: string        // Resolución de facturación
  sequenceType: string       // NCF, CFDI, etc.
  isActive: boolean
}
```

---

## Endpoints

```
POST   /invoicing/generate              # Generar factura electrónica
GET    /invoicing/:id/status            # Consultar estado
POST   /invoicing/:id/void              # Anular factura
POST   /invoicing/:id/credit-note       # Nota de crédito

GET    /invoicing/sequences             # Secuencias disponibles
POST   /invoicing/sequences/reserve     # Reservar rango

GET    /invoicing/daily-book            # Libro de ventas
GET    /invoicing/tax-summary           # Resumen de impuestos

POST   /invoicing/config                # Configurar datos fiscales
GET    /invoicing/config                # Obtener configuración

POST   /webhooks/dgii                   # DGII callbacks
POST   /webhooks/dian                   # DIAN callbacks
```

---

## Integraciones por País

### Rep. Dominicana — DGII
```typescript
// e-NCF system
// 1. Obtener NCF secuencial
// 2. Generar XML con datos del comprobante
// 3. Firmar digitalmente
// 4. Enviar a DGII
// 5. Recibir confirmación con NCF autorizado
// 6. Generar QR code
```

### Colombia — DIAN
```typescript
// UBL 2.1 format
// 1. Generar XML UBL
// 2. Firmar con certificado digital
// 3. Enviar a DIAN para validación
// 4. Recibir CUFE (Código Único de Factura Electrónica)
// 5. Generar representación gráfica (PDF)
```

### México — SAT
```typescript
// CFDI 4.0
// 1. Generar XML CFDI
// 2. Obtener Timbrado del PAC
// 3. Generar PDF con complemento de pago
// 4. Enviar al SAT (automático vía PAC)
```

---

## Reglas de Negocio

1. La factura electrónica se genera automáticamente al cerrar folio
2. No se puede anular una factura aceptada sin generar nota de crédito
3. Las secuencias nunca deben tener huecos
4. Si la autoridad fiscal falla, se encola y reintenta (máx 3 veces)
5. Los datos fiscales del huésped son obligatorios en algunos países
6. Las notas de crédito referencian siempre la factura original
7. Retención de IVA/ISR se calcula automáticamente según país
