export interface PlanDTO { id: string; name: string; slug: string; price: number; currency: string; description: string; features: any[]; limits: any; isActive: number; sortOrder: number; }
export interface AmenityCatalogDTO { id: string; key: string; label: string; category: string; icon: string; isActive: number; sortOrder: number; }

export interface AdminAnalyticsDTO {
  mrr: number; totalHoteles: number; totalUsuarios: number; totalReservas: number;
  activeHotels: number; byPlan: Record<string, number>; avgOccupancy: number;
  npsScore: number; ticketPromedio: number; monthlyRevenue: number[];
}
export interface MonitoringDTO {
  hoteles: number; usuarios: number; reservas: number;
  ticketsAbiertos: number; ticketsEnProgreso: number; ticketsUrgentes: number;
  ticketsResueltos: number; uptime: number; memoria: number;
}
