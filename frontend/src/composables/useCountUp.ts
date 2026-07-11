import { ref, watch, type Ref } from 'vue'

/**
 * Anima un número hacia su valor objetivo (efecto odómetro).
 * Cada vez que `target` cambia, el valor visible interpola con easing.
 */
export function useCountUp(target: Ref<number>, durationMs = 900): Ref<number> {
  const display = ref(target.value)
  let raf = 0

  function animate(from: number, to: number) {
    cancelAnimationFrame(raf)
    if (from === to) { display.value = to; return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      display.value = from + (to - from) * eased
      if (t < 1) raf = requestAnimationFrame(tick)
      else display.value = to
    }
    raf = requestAnimationFrame(tick)
  }

  watch(target, (to, from) => animate(from ?? 0, to), { immediate: false })

  return display
}
