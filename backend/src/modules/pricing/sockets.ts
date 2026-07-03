export interface PricingSockets {
  onSeasonsUpdated?: (hotelId: string, count: number) => Promise<void>
  onRatesUpdated?: (hotelId: string, count: number) => Promise<void>
  onRatesCopied?: (hotelId: string, copied: number) => Promise<void>
  onBlockCreated?: (data: any) => Promise<void>
  onBlockDeleted?: (id: string) => Promise<void>
  onRateRestrictionsUpdated?: (hotelId: string, count: number) => Promise<void>
}
