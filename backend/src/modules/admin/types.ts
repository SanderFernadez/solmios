export interface PlanDTO { id: string; name: string; slug: string; price: number; currency: string; description: string; features: any[]; limits: any; isActive: number; sortOrder: number; }
export interface AmenityCatalogDTO { id: string; key: string; label: string; category: string; icon: string; isActive: number; sortOrder: number; }

export interface HotelBreakdownDTO {
  id: string; name: string; plan: string; status: string; mrr: number;
  rooms: number; reservations: number; occupancy: number; adr: number; revenue: number;
}
export interface AdminAnalyticsDTO {
  mrr: number; totalHoteles: number; totalUsuarios: number; totalReservas: number;
  activeHotels: number; byPlan: Record<string, number>; byPlanRevenue: Record<string, number>;
  avgOccupancy: number; avgADR: number;
  hotelsBreakdown: HotelBreakdownDTO[]; topByRevenue: HotelBreakdownDTO[]; topByOccupancy: HotelBreakdownDTO[];
  npsScore: number; ticketPromedio: number;
  monthlyRevenue: { label: string; value: number }[];
  trends: { hoteles: number; usuarios: number; reservas: number; mrr: number };
}
export interface MonitoringDTO {
  hoteles: number; usuarios: number; reservas: number;
  ticketsAbiertos: number; ticketsEnProgreso: number; ticketsUrgentes: number;
  ticketsResueltos: number; uptime: number; memoria: number;
}
