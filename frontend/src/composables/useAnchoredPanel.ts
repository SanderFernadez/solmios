// composables/useAnchoredPanel.ts — Panel flotante anclado a un trigger (fechas / huéspedes del
// buscador de la landing).
//
// POR QUÉ TELEPORT + position:fixed y no un `absolute` adentro del form:
// el buscador vive dentro del `<section>` del hero, que es `overflow-hidden` + `min-h-[78vh]`
// con el contenido pegado abajo (HeroBlock.vue:17). Un dropdown `absolute` se recorta contra
// ese borde y queda medio calendario invisible. Es el mismo problema (y la misma solución) que
// ya documenta `components/ui/SearchSelect.vue:24-27`.
//
// Este NO es un modal — es un popover anclado a su trigger, así que no usa `AppModal`
// (que centra, oscurece el fondo y atrapa el foco).

import { ref, onMounted, onUnmounted, nextTick, type Ref } from 'vue'

export interface AnchoredPanel {
  open: Ref<boolean>
  /** Ref al elemento que ancla el panel (el trigger). */
  anchor: Ref<HTMLElement | null>
  /** Ref al panel teletransportado — necesario para no cerrarlo al clickear adentro. */
  panel: Ref<HTMLElement | null>
  panelStyle: Ref<Record<string, string>>
  toggle: () => void
  show: () => void
  close: () => void
}

/**
 * @param width  Ancho deseado del panel en px. Se recorta al viewport (mobile) y el panel se
 *               empuja hacia adentro si se saldría por izquierda o derecha.
 */
export function useAnchoredPanel(width: number): AnchoredPanel {
  const open = ref(false)
  const anchor = ref<HTMLElement | null>(null)
  const panel = ref<HTMLElement | null>(null)
  const panelStyle = ref<Record<string, string>>({ top: '0px', left: '0px', width: `${width}px` })

  const GAP = 8
  const MARGIN = 12

  function updatePosition(): void {
    if (!anchor.value) return
    const rect = anchor.value.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.min(width, vw - MARGIN * 2)

    // Alineado a la izquierda del trigger, empujado hacia adentro si se sale por algún lado.
    let left = rect.left
    if (left + w > vw - MARGIN) left = vw - MARGIN - w
    if (left < MARGIN) left = MARGIN

    // Flip arriba/abajo: el buscador está al PIE del hero, así que abajo casi nunca entra el
    // calendario entero. Se mide el panel real (ya montado) en vez de asumir una altura fija.
    const panelHeight = panel.value?.offsetHeight ?? 0
    const spaceBelow = vh - rect.bottom - GAP - MARGIN
    const spaceAbove = rect.top - GAP - MARGIN
    const flipUp = panelHeight > 0 && spaceBelow < panelHeight && spaceAbove > spaceBelow
    const top = flipUp
      ? Math.max(MARGIN, rect.top - GAP - panelHeight)
      : rect.bottom + GAP

    panelStyle.value = {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(w)}px`,
      // Techo de alto para que en pantallas bajas el panel scrollee en vez de salirse.
      maxHeight: `${Math.round(vh - MARGIN * 2)}px`,
    }
  }

  async function show(): Promise<void> {
    open.value = true
    // Dos ticks: el primero monta el panel, el segundo ya tiene `offsetHeight` real para el flip.
    await nextTick()
    updatePosition()
    await nextTick()
    updatePosition()
  }

  function close(): void {
    open.value = false
  }

  function toggle(): void {
    if (open.value) close()
    else void show()
  }

  function onDocClick(e: MouseEvent): void {
    if (!open.value) return
    const target = e.target as Node
    // El panel vive fuera del componente en el DOM (Teleport): sin este chequeo aparte, cualquier
    // clic adentro del calendario se leería como "afuera" y lo cerraría.
    if (anchor.value?.contains(target) || panel.value?.contains(target)) return
    close()
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && open.value) {
      close()
      // El foco vuelve al trigger (el anchor suele SER el botón; si no, al primer botón adentro).
      const el = anchor.value
      const focusable = el && el.tagName === 'BUTTON' ? el : el?.querySelector('button')
      focusable?.focus()
    }
  }

  function onViewportChange(): void {
    if (open.value) updatePosition()
  }

  onMounted(() => {
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeydown)
    // capture:true para ver también el scroll de contenedores internos, no solo el de window.
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
  })
  onUnmounted(() => {
    document.removeEventListener('click', onDocClick)
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
  })

  return { open, anchor, panel, panelStyle, toggle, show: () => void show(), close }
}
