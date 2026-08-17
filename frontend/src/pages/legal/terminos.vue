<template>
  <div class="bg-white min-h-screen">
    <PublicSiteHeader />

    <main class="pt-32 md:pt-40 pb-20 px-6">
      <div class="max-w-3xl mx-auto">
        <div class="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100">
          <span class="text-[11px] font-extrabold tracking-wide text-blue uppercase">Legal</span>
        </div>
        <h1 class="text-navy font-black text-3xl sm:text-4xl mb-2">Términos y Condiciones de Uso</h1>
        <p class="text-slate-500 text-sm mb-8">SOLMI OS — Última actualización: 10 de agosto de 2026</p>

        <div class="flex flex-wrap gap-2 mb-10">
          <router-link to="/legal/privacidad" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-slate-50 border border-slate-200 text-navy hover:border-blue-200 hover:bg-blue-50 transition-colors">
            Política de Privacidad
          </router-link>
          <router-link to="/legal/eliminacion-datos" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-slate-50 border border-slate-200 text-navy hover:border-blue-200 hover:bg-blue-50 transition-colors">
            Eliminación de Datos
          </router-link>
        </div>

        <article class="legal-doc rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60 p-6 sm:p-10 space-y-8 text-[14px] leading-relaxed text-slate-600">
          <section id="aceptacion">
            <h2>1. Aceptación</h2>
            <p>
              Al usar SOLMI OS —ya sea escribiéndonos por WhatsApp, Instagram o Facebook,
              navegando nuestro sitio, o accediendo al panel de gestión— aceptas estos términos.
              Si no estás de acuerdo, por favor no uses el servicio.
            </p>
          </section>

          <section id="quien-presta">
            <h2>2. Quién presta el servicio</h2>
            <p>
              SOLMI OS, nombre comercial registrado ante ONAPI bajo el número 941808, cuyo
              titular es Leonardo Batista Soliman, con domicilio en Calle Activo 2030, No. 34,
              Ensanche Ozama, Santo Domingo Este, República Dominicana.
            </p>
          </section>

          <section id="que-es">
            <h2>3. Qué es SOLMI OS</h2>
            <p>SOLMI OS es una plataforma de gestión hotelera que ofrece:</p>
            <ul>
              <li>Gestión de reservas, habitaciones, tarifas y disponibilidad</li>
              <li>Conexión con canales de venta (Booking, Airbnb, Expedia y otros)</li>
              <li>Gestión de restaurante, inventario, compras y finanzas</li>
              <li>Módulo de operaciones: limpieza, mantenimiento, asistencia del personal y comunicación interna</li>
              <li>Asistente de atención automatizada por WhatsApp, Instagram y Facebook</li>
            </ul>
          </section>

          <section id="tipos-usuario">
            <h2>4. Dos tipos de usuario</h2>
            <p>Estos términos aplican de forma distinta según quién seas:</p>
            <h3>4.1 Establecimientos clientes</h3>
            <p>Hoteles, restaurantes y negocios que contratan SOLMI OS para gestionar su operación. Su relación se rige además por el contrato de servicio firmado.</p>
            <h3>4.2 Huéspedes y público general</h3>
            <p>Personas que interactúan con el asistente automatizado o reservan a través de los canales de un establecimiento cliente.</p>
            <p class="legal-callout">
              Importante para huéspedes: el contrato de hospedaje, consumo o servicio se celebra
              directamente con el establecimiento, no con SOLMI OS. SOLMI OS es la herramienta
              tecnológica que facilita la comunicación y la gestión.
            </p>
          </section>

          <section id="asistente">
            <h2>5. El asistente automatizado</h2>
            <ul>
              <li>Una parte de las respuestas se genera mediante inteligencia artificial.</li>
              <li>El asistente puede tomar tus datos, crear reservas, enviarte confirmaciones, códigos de acceso y enlaces de pago.</li>
              <li>Puede cometer errores. Ninguna respuesta automatizada constituye una oferta vinculante hasta que el establecimiento la confirme.</li>
              <li>Ante cualquier discrepancia entre lo que dijo el asistente y lo que confirma el establecimiento, prevalece la confirmación del establecimiento.</li>
              <li>Siempre puedes solicitar atención humana.</li>
            </ul>
          </section>

          <section id="reservas-pagos">
            <h2>6. Reservas y pagos</h2>
            <ul>
              <li>Las tarifas, disponibilidad, políticas de cancelación y condiciones de cada reserva las define el establecimiento, no SOLMI OS.</li>
              <li>Los pagos se procesan mediante pasarelas externas. SOLMI OS no almacena datos completos de tarjetas.</li>
              <li>Los reclamos por cobros, reembolsos, cancelaciones o calidad del servicio deben dirigirse al establecimiento.</li>
            </ul>
          </section>

          <section id="uso-aceptable">
            <h2>7. Uso aceptable</h2>
            <p>Al usar SOLMI OS te comprometes a no:</p>
            <ul>
              <li>Suplantar la identidad de otra persona o entidad</li>
              <li>Enviar contenido ilegal, ofensivo, difamatorio o que vulnere derechos de terceros</li>
              <li>Usar el servicio para enviar spam o comunicaciones masivas no solicitadas</li>
              <li>Intentar acceder sin autorización a cuentas, datos o sistemas</li>
              <li>Realizar ingeniería inversa, copiar o revender la plataforma</li>
              <li>Interferir con el funcionamiento del servicio mediante automatizaciones, sobrecarga o cualquier medio técnico</li>
            </ul>
            <p>El incumplimiento puede resultar en la suspensión inmediata del acceso.</p>
          </section>

          <section id="meta">
            <h2>8. Reglas de las plataformas de Meta</h2>
            <p>
              El uso de los canales de WhatsApp, Instagram y Facebook está sujeto además a las
              políticas de Meta Platforms, Inc., incluidas la Política Comercial de WhatsApp y las
              Condiciones de las Herramientas Empresariales de Meta. SOLMI OS puede suspender el
              servicio de mensajería si Meta restringe la cuenta.
            </p>
          </section>

          <section id="propiedad-intelectual">
            <h2>9. Propiedad intelectual</h2>
            <p>
              El software, la marca SOLMI OS, su logotipo, diseño e identidad visual son propiedad
              de Leonardo Batista Soliman y están protegidos por la Ley 20-00 sobre Propiedad
              Industrial. El registro del nombre comercial ante ONAPI (No. 941808) confiere
              protección por diez años desde el 13 de julio de 2026.
            </p>
            <p>Los datos y contenidos que cada establecimiento carga en la plataforma siguen siendo propiedad del establecimiento.</p>
          </section>

          <section id="disponibilidad">
            <h2>10. Disponibilidad del servicio</h2>
            <p>
              Procuramos mantener el servicio disponible de forma continua, pero no garantizamos
              que esté libre de interrupciones. Pueden ocurrir cortes por mantenimiento
              programado, fallas de proveedores externos (incluidos Meta y las pasarelas de pago)
              o causas de fuerza mayor.
            </p>
          </section>

          <section id="responsabilidad">
            <h2>11. Limitación de responsabilidad</h2>
            <p>En la máxima medida permitida por la ley dominicana, SOLMI OS no responde por:</p>
            <ul>
              <li>Actos, omisiones, tarifas o incumplimientos del establecimiento</li>
              <li>Interrupciones causadas por proveedores externos</li>
              <li>Pérdidas indirectas, lucro cesante o daño reputacional</li>
              <li>Errores derivados de datos incorrectos suministrados por el usuario</li>
            </ul>
            <p>
              Nada en esta cláusula limita la responsabilidad que por ley no puede excluirse,
              incluidos los derechos que otorga la Ley 358-05 de Protección de los Derechos del
              Consumidor.
            </p>
          </section>

          <section id="privacidad-ref">
            <h2>12. Privacidad</h2>
            <p>
              El tratamiento de datos personales se rige por nuestra
              <router-link to="/legal/privacidad" class="text-blue font-bold hover:underline">Política de Privacidad</router-link>,
              que forma parte integrante de estos términos.
            </p>
          </section>

          <section id="modificaciones">
            <h2>13. Modificaciones</h2>
            <p>
              Podemos actualizar estos términos. La versión vigente será siempre la publicada en
              esta página, con su fecha de actualización. Los cambios sustanciales se notificarán
              con treinta (30) días de anticipación a los establecimientos clientes.
            </p>
          </section>

          <section id="terminacion">
            <h2>14. Terminación</h2>
            <p>
              Puedes dejar de usar el servicio cuando quieras. Los establecimientos clientes se
              rigen por los plazos de su contrato. Podemos suspender el acceso ante incumplimiento
              grave de estos términos.
            </p>
          </section>

          <section id="ley-aplicable">
            <h2>15. Ley aplicable y jurisdicción</h2>
            <p>
              Estos términos se rigen por las leyes de la República Dominicana. Cualquier
              controversia se someterá a los tribunales competentes del Distrito Nacional, con
              renuncia expresa a cualquier otro fuero.
            </p>
          </section>

          <section id="contacto">
            <h2>16. Contacto</h2>
            <p>SOLMI OS — Leonardo Batista Soliman</p>
            <p>Calle Activo 2030, No. 34, Ensanche Ozama, Santo Domingo Este, República Dominicana</p>
            <p><span class="placeholder">correo — pendiente</span> · <span class="placeholder">teléfono — pendiente</span></p>
          </section>
        </article>
      </div>
    </main>

    <PublicSiteFooter />
  </div>
</template>

<script setup lang="ts">
import PublicSiteHeader from '@/components/landing/PublicSiteHeader.vue'
import PublicSiteFooter from '@/components/landing/PublicSiteFooter.vue'
import '@/assets/legal-doc.css'
</script>
