// folios/sockets.ts — Contrato de eventos del módulo (para conectores).
export interface FoliosSockets {
  onFolioOpened?: (folio: any) => Promise<void> | void
  onFolioCharged?: (folio: any, charge: any) => Promise<void> | void
  onFolioPaid?: (folio: any, payment: any) => Promise<void> | void
  onFolioClosed?: (folio: any) => Promise<void> | void
}
