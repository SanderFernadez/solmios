<template>
  <div class="min-h-screen bg-surface">
    <!-- Header simple, consistente con las páginas públicas (login/registro/verificar-email) -->
    <header class="bg-navy px-4 sm:px-6 py-4">
      <div class="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <router-link to="/" class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-white text-sm shrink-0">S</div>
          <span class="font-black text-white leading-none">Solmi<span class="text-cyan">OS</span></span>
        </router-link>
        <router-link to="/legal/terminos" class="text-xs font-bold text-white/70 hover:text-white transition-colors">
          Términos y Condiciones →
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

      <SectionCard title="Política de Privacidad" subtitle="SolmiOS — Última actualización: 22 de julio de 2026">
        <article class="legal-doc space-y-7 text-[13.5px] leading-relaxed text-text-secondary">
          <section id="responsables">
            <p class="rounded-xl border border-cyan/25 bg-cyan/5 px-4 py-3 text-navy">
              <strong>Aclaración importante sobre roles:</strong> el <strong>Hotel</strong> (el cliente
              que contrata SolmiOS) es el <strong>responsable del tratamiento</strong> de los datos de
              sus huéspedes y empleados que carga en el sistema: decide qué datos recolectar y para
              qué los usa dentro de su operación. <strong>SolmiOS actúa como encargado del
              tratamiento / proveedor de la infraestructura</strong>: almacena y procesa esos datos
              por cuenta del Hotel, siguiendo sus instrucciones y esta política. Ante un pedido de un
              huésped o empleado sobre sus propios datos, corresponde dirigirse primero al Hotel
              donde se hospedó o trabajó.
            </p>
          </section>

          <section id="datos-recolectados">
            <h2>1. Qué datos se recolectan</h2>
            <p><strong>Datos del Hotel y de la persona que registra la cuenta:</strong> nombre y apellido, email, teléfono, nombre del hotel, país, ciudad, y demás datos del formulario de alta. Estos datos identifican a quien administra la cuenta del Hotel en la Plataforma.</p>
            <p><strong>Datos de huéspedes (terceros)</strong>, cargados por el Hotel en el curso de su operación: nombre, documento de identidad, datos de contacto (email, teléfono), nacionalidad, fecha de nacimiento, preferencias, y notas operativas. Estos datos NO los recolecta SolmiOS directamente: los ingresa el Hotel al gestionar sus reservas y huéspedes.</p>
            <p><strong>Datos de pago:</strong> los datos completos de la tarjeta de crédito/débito son procesados directamente por <strong>Stripe</strong>, el procesador de pagos. SolmiOS no almacena el número completo de la tarjeta ni el código de seguridad; solo recibe de Stripe los identificadores necesarios para asociar un cobro o una suscripción a la cuenta correspondiente.</p>
            <p><strong>Datos de empleados del Hotel</strong>, cargados por el Hotel en los módulos de RRHH: ficha del empleado, asistencia, nómina/payroll, evaluaciones, y datos relacionados a su rol dentro del hotel (recepción, limpieza, mantenimiento, gerencia, etc.).</p>
            <p><strong>Datos técnicos:</strong> registros de uso de la Plataforma (accesos, acciones dentro del sistema) con fines de seguridad, auditoría y soporte.</p>
          </section>

          <section id="uso-de-datos">
            <h2>2. Para qué se usan</h2>
            <ul>
              <li>Operar el PMS: gestión de reservas, habitaciones, check-in/check-out, limpieza y mantenimiento.</li>
              <li>Facturación, cobros y reportes financieros del Hotel.</li>
              <li>Comunicaciones automáticas relacionadas con la operación (confirmaciones de reserva, recordatorios, avisos de check-in, notificaciones internas al personal).</li>
              <li>Funciones asistidas por inteligencia artificial dentro de la Plataforma (por ejemplo, un asistente de recepción o de gerencia), cuando el Hotel las tenga habilitadas. Estas funciones procesan los datos que ya están en el sistema del Hotel para asistir en tareas operativas.</li>
              <li>Seguridad, prevención de fraude, y soporte técnico.</li>
              <li>Mejora del Servicio, en base a datos agregados o anonimizados cuando sea posible.</li>
            </ul>
          </section>

          <section id="compartir-datos">
            <h2>3. Con quién se comparten</h2>
            <p>SolmiOS comparte datos con los siguientes proveedores externos, que actúan como encargados del tratamiento (procesadores) en la medida necesaria para prestar el Servicio:</p>
            <ul>
              <li><strong>Stripe</strong> — procesamiento de pagos y suscripciones. Los datos de tarjeta viajan directamente a Stripe; SolmiOS no los almacena.</li>
              <li><strong>Proveedor de email</strong> (SMTP/Resend u otro configurado) — envío de correos transaccionales y automáticos (confirmaciones, notificaciones, verificación de cuenta).</li>
              <li><strong>Channex</strong> — channel manager, para sincronizar disponibilidad, tarifas y reservas con canales de venta externos (OTAs) cuando el Hotel tiene esa integración activa.</li>
              <li><strong>TTLock</strong> — gestión de cerraduras electrónicas, cuando el Hotel tiene esa integración activa (se comparten los datos mínimos necesarios para generar/revocar códigos de acceso).</li>
              <li><strong>WhatsApp Business API</strong> (Meta) — mensajería con huéspedes, cuando el Hotel tiene esa integración activa y configurada.</li>
            </ul>
            <p>SolmiOS no vende datos personales a terceros. Los datos solo se comparten con estos procesadores en la medida necesaria para prestar las funciones del Servicio que el Hotel tiene habilitadas, o cuando lo exija una autoridad competente.</p>
          </section>

          <section id="seguridad">
            <h2>4. Seguridad</h2>
            <p>
              SolmiOS aplica medidas de seguridad razonables para proteger los datos, entre ellas:
              cifrado de las comunicaciones en tránsito (HTTPS/TLS), contraseñas de usuario
              almacenadas con hash (no en texto plano), y claves de API (API keys) también
              almacenadas con hash. Estas medidas reducen el riesgo, pero ningún sistema es
              inviolable en términos absolutos. SolmiOS no cuenta actualmente con certificaciones de
              seguridad de terceros (por ejemplo ISO 27001, SOC 2, o certificación PCI-DSS propia); el
              procesamiento de tarjetas se delega a Stripe, que sí mantiene sus propias
              certificaciones como procesador de pagos.
            </p>
          </section>

          <section id="derechos">
            <h2>5. Derechos del titular de los datos</h2>
            <p>
              Toda persona cuyos datos estén cargados en el sistema (huésped, empleado, o usuario de
              una cuenta) tiene derecho a acceder, rectificar, o solicitar la eliminación de sus
              datos personales, en la medida que lo permita la ley aplicable.
            </p>
            <p>
              <strong>El Hotel es el responsable</strong> de atender estos pedidos respecto de los
              datos de sus huéspedes y empleados, porque es quien decidió recolectarlos y para qué
              fines. SolmiOS, como proveedor de la infraestructura, colabora con el Hotel dándole las
              herramientas del sistema para consultar, corregir o eliminar esos datos, y puede asistir
              técnicamente ante un pedido puntual del Hotel.
            </p>
            <p>
              Para los datos propios de la cuenta del Hotel (el usuario que administra la
              suscripción), el pedido puede dirigirse directamente a SolmiOS por el contacto indicado
              en la sección 10.
            </p>
          </section>

          <section id="retencion">
            <h2>6. Retención de datos</h2>
            <p>
              Los datos se conservan mientras la cuenta del Hotel esté activa, y por un período
              adicional razonable tras la cancelación para permitir su exportación o la reactivación
              de la cuenta (ver Términos y Condiciones, sección 3). Transcurrido ese período sin
              regularización, los datos pueden eliminarse definitivamente, salvo que una obligación
              legal (por ejemplo, fiscal o contable) exija conservarlos por más tiempo. El plazo
              exacto de retención <span class="placeholder">[completar — política de retención definitiva]</span>
              se informará al Hotel.
            </p>
          </section>

          <section id="cookies">
            <h2>7. Cookies y tracking</h2>
            <p>
              La Plataforma puede usar cookies o mecanismos de almacenamiento local del navegador
              (como localStorage/sessionStorage) con fines estrictamente funcionales: mantener la
              sesión iniciada, recordar preferencias de la interfaz, y evitar reprocesos ante errores
              técnicos. No se usan cookies de publicidad de terceros dentro del panel del Hotel.
              <span class="placeholder">[completar — si en el futuro se agrega analítica o marketing con cookies de terceros, detallar aquí cuáles y su finalidad]</span>.
            </p>
          </section>

          <section id="menores">
            <h2>8. Menores de edad</h2>
            <p>
              El Servicio está dirigido a hoteles y a las personas que estos autorizan a operarlo
              (personal adulto del hotel), no a menores de edad. El registro de una cuenta de Hotel
              requiere ser mayor de edad según la ley aplicable. La ficha de un huésped puede incluir
              datos de un menor (por ejemplo, un niño que viaja con su familia) únicamente porque el
              Hotel los carga como parte de la reserva de un adulto responsable; SolmiOS no recolecta
              datos de menores de forma directa ni independiente.
            </p>
          </section>

          <section id="cambios">
            <h2>9. Cambios a esta política</h2>
            <p>
              SolmiOS puede actualizar esta Política de Privacidad en cualquier momento. Los cambios
              relevantes se notificarán al Hotel por email o mediante un aviso dentro de la
              Plataforma, con una antelación razonable antes de su entrada en vigencia.
            </p>
          </section>

          <section id="contacto">
            <h2>10. Contacto</h2>
            <p>
              Para consultas sobre esta Política de Privacidad, o para ejercer los derechos descritos
              en la sección 5, escribir a
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
        <router-link to="/legal/terminos" class="text-cyan font-bold hover:underline">Ver Términos y Condiciones</router-link>
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
