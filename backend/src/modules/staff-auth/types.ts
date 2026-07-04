// types.ts — StaffAuth DTOs
export interface PinLoginDTO {
  phone: string
  pin: string
}

export interface StaffUser {
  id: string
  name: string
  phone: string
  role: string
  hotelId: string
  pin?: string
}

export interface PinLoginResponse {
  token: string
  refreshToken: string
  user: {
    id: string
    name: string
    phone: string
    role: string
    hotelId: string
  }
}
