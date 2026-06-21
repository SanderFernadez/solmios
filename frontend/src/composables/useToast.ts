// composables/useToast.ts — Sistema de toasts (F1 del modelo canónico 00-MASTER.md)
// Top-right · z-60 · 4 variantes (success/error/warning/info) · auto-close 3.5s
// Uso: const toast = useToast(); toast.success('Check-in confirmado')

import { ref } from 'vue'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  variant: ToastVariant
  title: string
  message?: string
}

const toasts = ref<Toast[]>([])
let seq = 0

function push(variant: ToastVariant, title: string, message?: string, duration = 3500) {
  const id = ++seq
  toasts.value.push({ id, variant, title, message })
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
  // Máximo 3 visibles (regla del master).
  if (toasts.value.length > 3) toasts.value.splice(0, toasts.value.length - 3)
}

function dismiss(id: number) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx >= 0) toasts.value.splice(idx, 1)
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (title: string, message?: string) => push('success', title, message),
    error: (title: string, message?: string) => push('error', title, message, 5000),
    warning: (title: string, message?: string) => push('warning', title, message),
    info: (title: string, message?: string) => push('info', title, message),
  }
}
