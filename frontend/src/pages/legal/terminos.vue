<template>
  <div class="min-h-screen bg-surface">
    <!-- Header simple, consistente con las páginas públicas (login/registro/verificar-email) -->
    <header class="bg-navy px-4 sm:px-6 py-4">
      <div class="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <router-link to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-white text-sm shrink-0">S</div>
          <span class="font-black text-white leading-none">Solmi<span class="text-cyan">OS</span></span>
        </router-link>
        <router-link to="/legal/privacidad" class="text-xs font-bold text-white/70 hover:text-white transition-colors">
          Política de Privacidad →
        </router-link>
      </div>
    </header>

    <main class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <!-- Aviso legal obligatorio: borrador sin revisión de un abogado -->
      <div class="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3.5 mb-6">
        <span class="w-5 h-5 mt-0.5 text-warning shrink-0" v-html="ICON_WARN"></span>
        <p class="text-[13px] leading-relaxed text-navy">
          <strong>Este documento es una base generada automáticamente y AÚN NO fue revisado por un abogado.</strong>
          No debe considerarse definitivo ni vinculante hasta su revisión legal.
        </p>
      </div>

      <SectionCard title="Términos y Condiciones de Servicio" subtitle="SolmiOS — Última actualización: 22 de julio de 2026">
        <article class="legal-doc space-y-7 text-[13.5px] leading-relaxed text-text-secondary">
          <section id="objeto">
            <h2>1. Objeto del servicio</h2>
            <p>
              SolmiOS ("el Servicio", "la Plataforma") es un sistema de gestión hotelera (PMS —
              Property Management System) ofrecido como software como servicio (SaaS) a hoteles,
              hostales, apart-hoteles y alojamientos similares ("el Cliente" o "el Hotel"). El
              Servicio incluye, entre otros módulos: gestión de reservas, habitaciones y
              disponibilidad, ficha de huéspedes, check-in/check-out, limpieza y mantenimiento,
              facturación y cobros, caja, reportes, channel manager (conexión con canales de venta
              como Booking.com o Airbnb), mensajería automática y funciones asistidas por
              inteligencia artificial.
            </p>
            <p>
              Estos Términos y Condiciones ("los Términos") regulan el acceso y uso del Servicio
              por parte del Hotel y de las personas que este autorice a usarlo (administradores,
              recepcionistas, camareras, mantenimiento, y demás roles del sistema). Al registrarse
              o al usar la Plataforma, el Hotel acepta estos Términos en su totalidad.
            </p>
          </section>

          <section id="registro">
            <h2>2. Registro y cuenta</h2>
            <p>
              Para usar el Servicio, el Hotel debe crear una cuenta indicando datos reales y
              vigentes (nombre del hotel, email de contacto, y demás datos solicitados en el
              formulario de alta). Al registrarse, el Hotel accede a un período de prueba gratuito
              de <strong>7 (siete) días</strong>, sin necesidad de tarjeta de crédito, durante el
              cual puede usar el Servicio según el plan seleccionado.
            </p>
            <p>
              El Hotel es responsable de mantener la confidencialidad de las credenciales de acceso
              (usuario y contraseña) de su cuenta y de las cuentas de los usuarios que cree dentro
              de su organización (recepcionistas, personal de limpieza, mantenimiento, gerencia,
              etc.). Toda acción realizada con esas credenciales se considera realizada por el
              Hotel. El Hotel debe notificar sin demora cualquier uso no autorizado de su cuenta.
            </p>
            <p>
              El Hotel es responsable de la veracidad y exactitud de los datos que carga en el
              sistema, incluyendo los datos de sus huéspedes y empleados (ver Política de
              Privacidad).
            </p>
          </section>

          <section id="planes">
            <h2>3. Planes, precios y facturación</h2>
            <p>
              Finalizado el período de prueba, el uso continuado del Servicio requiere la
              contratación de un plan de suscripción paga, con cobro recurrente (mensual o el
              período que corresponda al plan contratado). El cobro se procesa a través de
              <strong>Stripe</strong>, un procesador de pagos externo; SolmiOS no almacena los
              datos completos de la tarjeta de crédito o débito del Hotel (ver Política de
              Privacidad, sección 3).
            </p>
            <p>
              Los precios vigentes de cada plan se muestran en la Plataforma o en el sitio público
              de SolmiOS. SolmiOS puede modificar los precios de los planes, notificando al Hotel
              con una antelación razonable antes de que el nuevo precio entre en vigencia para su
              próximo ciclo de facturación. El Hotel puede cambiar de plan (upgrade o downgrade) en
              cualquier momento desde el panel; el cambio de precio aplica según el prorrateo o el
              esquema vigente al momento del cambio.
            </p>
            <p>
              El Hotel puede cancelar su suscripción en cualquier momento. La cancelación detiene
              los cobros futuros pero no genera reembolsos de períodos ya facturados, salvo que la
              ley aplicable disponga lo contrario. Al cancelar, el acceso al Servicio se mantiene
              hasta el fin del período ya pagado.
            </p>
            <p>
              Ante la falta de pago, SolmiOS puede suspender el acceso al Servicio tras los avisos
              correspondientes. Los datos del Hotel (reservas, huéspedes, facturación, etc.) se
              conservan por un período razonable tras la cancelación o suspensión para permitir su
              exportación o reactivación; transcurrido ese período sin regularización, SolmiOS
              puede eliminarlos definitivamente. El plazo exacto de conservación
              <span class="placeholder">[completar — política de retención tras cancelación]</span>
              se informará al Hotel.
            </p>
          </section>

          <section id="uso-aceptable">
            <h2>4. Uso aceptable</h2>
            <p>El Hotel y sus usuarios se comprometen a NO:</p>
            <ul>
              <li>Usar el Servicio para fines ilegales, fraudulentos, o que violen derechos de terceros (incluyendo los derechos de los huéspedes cuyos datos se procesan).</li>
              <li>Realizar ingeniería inversa, descompilar, desensamblar, o intentar acceder al código fuente de la Plataforma, salvo permiso expreso por escrito.</li>
              <li>Revender, sublicenciar, o poner el Servicio a disposición de terceros no autorizados como si fuera propio (reventa no autorizada).</li>
              <li>Intentar vulnerar la seguridad del sistema, acceder a datos de otros hoteles, o sobrecargar la infraestructura deliberadamente.</li>
              <li>Cargar contenido o datos que infrinjan derechos de propiedad intelectual de terceros.</li>
            </ul>
            <p>El incumplimiento de esta sección puede resultar en la suspensión o terminación de la cuenta (ver sección 8).</p>
          </section>

          <section id="propiedad-intelectual">
            <h2>5. Propiedad intelectual</h2>
            <p>
              El software, el código, el diseño, las marcas ("SolmiOS" y sus logotipos) y demás
              elementos de la Plataforma son propiedad de
              <span class="placeholder">[razón social — completar]</span> o de sus licenciantes.
              Estos Términos no transfieren ninguna propiedad intelectual del Servicio al Hotel;
              solo se otorga una licencia de uso, no exclusiva e intransferible, mientras la
              suscripción esté vigente.
            </p>
            <p>
              Los datos que el Hotel carga en el sistema (reservas, huéspedes, empleados,
              facturación, configuración, y todo otro dato operativo) son propiedad del Hotel.
              SolmiOS actúa como proveedor de la infraestructura que los almacena y procesa, y no
              reclama propiedad sobre ellos (ver distinción de responsabilidades en la Política de
              Privacidad, sección 5).
            </p>
          </section>

          <section id="disponibilidad">
            <h2>6. Disponibilidad y soporte</h2>
            <p>
              SolmiOS pone razonable diligencia en mantener el Servicio disponible y operativo, pero
              no garantiza un porcentaje específico de disponibilidad (uptime) salvo que se acuerde
              un Acuerdo de Nivel de Servicio (SLA) por separado con el Hotel
              <span class="placeholder">[completar — SLA específico, si aplica al plan contratado]</span>.
              Pueden existir interrupciones programadas (mantenimiento) o no programadas (incidentes
              técnicos, causas de fuerza mayor, fallas de proveedores externos como Stripe, Channex
              o el proveedor de email).
            </p>
            <p>
              El soporte técnico se brinda por los canales que SolmiOS indique (email, chat u otro),
              con los tiempos de respuesta que correspondan al plan contratado
              <span class="placeholder">[completar — tiempos de respuesta por plan, si se definen]</span>.
            </p>
          </section>

          <section id="responsabilidad">
            <h2>7. Limitación de responsabilidad</h2>
            <p>
              En la máxima medida permitida por la ley aplicable, SolmiOS no será responsable por
              daños indirectos, incidentales, especiales, o consecuentes (incluyendo pérdida de
              ingresos, de reservas, o de datos) derivados del uso o la imposibilidad de uso del
              Servicio. La responsabilidad total de SolmiOS ante cualquier reclamo relacionado con
              el Servicio no superará el monto pagado por el Hotel en los últimos
              <span class="placeholder">[completar — período, ej. 3 o 12 meses]</span> anteriores al
              hecho que originó el reclamo.
            </p>
            <p>
              SolmiOS no es responsable por el contenido o la exactitud de los datos que el Hotel
              carga en el sistema, ni por las decisiones comerciales que el Hotel tome en base a la
              información del Servicio. SolmiOS tampoco es responsable por fallas de terceros
              integrados (Stripe, Channex, TTLock, proveedores de email o WhatsApp) que escapen a su
              control directo, aunque hará esfuerzos razonables para mitigar su impacto.
            </p>
          </section>

          <section id="terminacion">
            <h2>8. Terminación del servicio</h2>
            <p>SolmiOS puede suspender o terminar el acceso del Hotel al Servicio, con aviso previo cuando sea razonablemente posible, en casos como:</p>
            <ul>
              <li>Incumplimiento de estos Términos, en particular la sección de Uso Aceptable.</li>
              <li>Falta de pago de la suscripción tras los avisos correspondientes.</li>
              <li>Requerimiento de una autoridad competente.</li>
              <li>Decisión del Hotel de cancelar su cuenta.</li>
            </ul>
            <p>
              Tras la terminación, se aplica la política de conservación y eliminación de datos
              descripta en la sección 3 y en la Política de Privacidad.
            </p>
          </section>

          <section id="ley-aplicable">
            <h2>9. Ley aplicable y jurisdicción</h2>
            <p>
              Estos Términos se rigen por las leyes de
              <span class="placeholder">[jurisdicción — completar, ej. República Dominicana]</span>.
              Cualquier controversia derivada de estos Términos se someterá a los tribunales
              competentes de <span class="placeholder">[jurisdicción — completar]</span>, salvo que
              la ley aplicable disponga un fuero distinto de manera imperativa.
            </p>
          </section>

          <section id="modificaciones">
            <h2>10. Modificaciones a estos términos</h2>
            <p>
              SolmiOS puede modificar estos Términos en cualquier momento. Los cambios relevantes se
              notificarán al Hotel por email o mediante un aviso dentro de la Plataforma, con una
              antelación razonable antes de su entrada en vigencia. El uso continuado del Servicio
              tras la entrada en vigencia de los cambios implica la aceptación de los nuevos
              Términos.
            </p>
          </section>

          <section id="contacto">
            <h2>11. Contacto</h2>
            <p>
              Para consultas sobre estos Términos, escribir a
              <span class="placeholder">[email de contacto legal — completar]</span>.
            </p>
            <p class="text-text-muted">
              <span class="placeholder">[Razón social — completar]</span> ·
              <span class="placeholder">[dirección — completar]</span>
            </p>
          </section>
        </article>
      </SectionCard>

      <p class="text-center text-xs text-text-muted mt-6">
        <router-link to="/legal/privacidad" class="text-cyan font-bold hover:underline">Ver Política de Privacidad</router-link>
        ·
        <router-link to="/registro" class="text-cyan font-bold hover:underline">Volver al registro</router-link>
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
import SectionCard from '@/components/ui/SectionCard.vue'

const ICON_WARN = '<svg class="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>'
</script>

<style scoped>
.legal-doc :deep(h2) {
  font-size: 0.95rem;
  font-weight: 900;
  color: var(--color-navy);
  margin-bottom: 0.5rem;
}
.legal-doc :deep(p) {
  margin-bottom: 0.5rem;
}
.legal-doc :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
  margin-bottom: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.legal-doc :deep(.placeholder) {
  font-weight: 700;
  color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  border-radius: 0.25rem;
  padding: 0.05rem 0.35rem;
}
</style>
