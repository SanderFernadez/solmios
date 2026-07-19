import { http } from './http'

/** Un paso de la guía de configuración inicial. */
export interface OnboardingStep {
  key: string
  title: string
  description: string
  route: string
  done: boolean
  required: boolean
  count?: number
}

export interface OnboardingStatus {
  /** `true` cuando lo obligatorio está hecho: la guía se esconde. */
  completed: boolean
  doneCount: number
  totalCount: number
  steps: OnboardingStep[]
}

export const OnboardingService = {
  async status(): Promise<OnboardingStatus> {
    const res = await http.get<any>('/onboarding/status')
    return (res?.data ?? res) as OnboardingStatus
  },
}
