# SPEC: Advanced Reports

## Requirements

### REQ-1: Reports Page Structure

Route: `/panel/reports` with 6 tabs:
1. Facturación
2. Ocupación
3. Pernoctaciones
4. Rendimiento
5. Procedencia
6. Reservas por Canal

### REQ-2: Common Filters

All reports MUST support:
| Filter | Type |
|--------|------|
| Mes | select (last 24 months) |
| Rango de fechas | date range picker |
| Tipo de habitación | multi-select (optional) |
| Generar button | triggers report |

### REQ-3: Tab 1 — Facturación

#### Data shown:
| Metric | Description |
|--------|-------------|
| Ingresos por tipo de habitación | Revenue broken down by room type |
| Servicios extra | Revenue from add-on services |
| Impuestos recaudados | Tax collected (ITBIS 18%) |
| Comisiones OTA | Commission paid to channels |
| Ingreso neto | Total - commissions |

#### Table format:
```
Tipo Habitación | Reservas | Noches | Precio Medio | Ingreso Total | % del Total
Simple          |    15    |   45   |    $48.33    |   $2,175.00   |   35%
Doble           |    12    |   36   |    $57.50    |   $2,070.00   |   33%
Suite           |     8    |   24   |    $68.75    |   $1,650.00   |   27%
Familiar        |     3    |    9   |    $71.11    |     $640.00   |    5%
TOTAL           |    38    |  114   |    $57.28    |   $6,535.00   |  100%
```

#### Scenario: Generate facturación report
- **Given** admin selects June 2026
- **When** clicks "Generar"
- **Then** table MUST populate with all reservations in that month
- **And** totals row MUST show aggregated data

### REQ-4: Tab 2 — Ocupación

#### Data shown:
| Metric | Description |
|--------|-------------|
| Ocupación total | Including blocked rooms in denominator |
| Ocupación real | Excluding blocked rooms |
| Ocupación diaria | Day-by-day percentage for the month |
| Habitaciones libres | Count per day |
| Habitaciones ocupadas | Count per day |

#### Scenario: Calculate occupancy
- **Given** hotel has 14 rooms, 10 occupied on June 20
- **When** occupancy report generates
- **Then** June 20 occupancy MUST = 71.4% (10/14)
- **And** if 2 rooms are blocked, real occupancy = 83.3% (10/12)

#### Daily table format:
```
Día | Total | Ocupadas | Bloqueadas | Libres | Ocupación % | Ocupación Real %
 1  |  14   |    8     |     2      |    4   |   57.1%     |     66.7%
 2  |  14   |   10     |     1      |    3   |   71.4%     |     76.9%
...
```

### REQ-5: Tab 3 — Pernoctaciones

#### Data shown:
- Number of people who slept each night
- Breakdown by room type
- Total overnight stays for the period

#### Scenario: Calculate pernoctaciones
- **Given** June 20: 8 rooms occupied with 2 guests each = 16 overnight stays
- **When** pernoctaciones report generates
- **Then** June 20 column MUST show 16

### REQ-6: Tab 4 — Rendimiento

#### Metrics:
| Metric | Formula |
|--------|---------|
| ADR (Average Daily Rate) | Revenue / Nights sold |
| RevPAR (Revenue Per Available Room) | ADR × Occupancy % |
| Estancia media | Total nights / Total reservations |
| Revenue por tipo | Sum of revenue per room type |

#### Table format:
```
Tipo | Reservas | Noches | ADR    | RevPAR | Estancia Media | Revenue
Simple|   15    |   45   | $48.33 | $34.52 |     3.0 noches | $2,175
Doble |   12    |   36   | $57.50 | $43.08 |     3.0 noches | $2,070
...
```

#### Scenario: ADR calculation
- **Given** June revenue is $6,535, nights sold = 114
- **When** rendimiento report generates
- **Then** ADR MUST = $57.33 ($6,535 / 114)

### REQ-7: Tab 5 — Procedencia

#### Data: Guest origin by country and region.

#### Table format:
```
País            | Huéspedes | % | Pernoctaciones | Ingreso
Rep. Dominicana |    45     | 38%|      135       | $5,200
Estados Unidos  |    28     | 24%|       84       | $4,100
España          |    15     | 13%|       45       | $2,800
Colombia        |    10     |  8%|       30       | $1,500
Otros           |    20     | 17%|       60       | $3,200
```

#### Scenario: Procedencia from guest nationality
- **Given** 45 guests with nationality "Dominican Republic"
- **When** procedencia report generates
- **Then** "Rep. Dominicana" row MUST show 45 guests

### REQ-8: Tab 6 — Reservas por Canal

#### Data: Reservation breakdown by source channel.

#### Table format:
```
Canal     | Reservas | % | Noches | Ingreso | Comisión | Neto
Directo   |    15    | 39%|   45   | $2,700  |   $0    | $2,700
Booking   |    12    | 32%|   36   | $2,160  |  $216   | $1,944
Expedia   |     8    | 21%|   24   | $1,440  |  $144   | $1,296
Airbnb    |     3    |  8%|    9   |   $540  |   $27   |   $513
```

#### Scenario: Channel revenue
- **Given** 12 reservations from Booking.com with 10% commission
- **When** reservas-por-canal report generates
- **Then** Booking row MUST show commission $216 (10% of $2,160)

### REQ-9: Export

All reports MUST support:
- **PDF export**: `window.print()` with print-optimized CSS
- **CSV export**: downloadable CSV with raw data

#### Scenario: Export to CSV
- **Given** facturación report is displayed
- **When** admin clicks "Exportar CSV"
- **Then** browser MUST download `facturacion-2026-06.csv`
- **And** CSV MUST contain all table rows + totals

### REQ-10: Print

#### Scenario: Print report
- **Given** any report tab is open
- **When** admin clicks "Imprimir"
- **Then** print dialog MUST open
- **And** printed page MUST include: hotel name, report title, date range, table
- **And** layout MUST be print-optimized (no nav bars, proper page breaks)
