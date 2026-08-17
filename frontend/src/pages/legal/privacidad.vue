<template>
  <div class="bg-white min-h-screen">
    <PublicSiteHeader />

    <main class="pt-32 md:pt-40 pb-20 px-6">
      <div class="max-w-3xl mx-auto">
        <div class="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100">
          <span class="text-[11px] font-extrabold tracking-wide text-blue uppercase">Legal</span>
        </div>
        <h1 class="text-navy font-black text-3xl sm:text-4xl mb-2">Política de Privacidad</h1>
        <p class="text-slate-500 text-sm mb-8">SOLMI OS — Última actualización: 10 de agosto de 2026</p>

        <div class="flex flex-wrap gap-2 mb-10">
          <router-link to="/legal/terminos" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-slate-50 border border-slate-200 text-navy hover:border-blue-200 hover:bg-blue-50 transition-colors">
            Términos y Condiciones
          </router-link>
          <router-link to="/legal/eliminacion-datos" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-slate-50 border border-slate-200 text-navy hover:border-blue-200 hover:bg-blue-50 transition-colors">
            Eliminación de Datos
          </router-link>
        </div>

        <article class="legal-doc rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60 p-6 sm:p-10 space-y-8 text-[14px] leading-relaxed text-slate-600">
          <section id="quienes-somos">
            <h2>1. Quiénes somos</h2>
            <p>
              SOLMI OS es un nombre comercial registrado ante la Oficina Nacional de la Propiedad
              Industrial (ONAPI) de la República Dominicana bajo el número de registro
              <strong>941808</strong>, cuyo titular es <strong>Leonardo Batista Soliman</strong>.
              SOLMI OS es una plataforma de gestión hotelera (PMS) que incluye un asistente de
              atención automatizada por WhatsApp, Instagram y Facebook Messenger.
            </p>
            <dl class="legal-dl">
              <div><dt>Responsable del tratamiento</dt><dd>Leonardo Batista Soliman (SOLMI OS)</dd></div>
              <div><dt>Domicilio</dt><dd>Calle Activo 2030, No. 34, Ensanche Ozama, Santo Domingo Este, Provincia Santo Domingo, República Dominicana</dd></div>
              <div><dt>Correo de contacto</dt><dd><span class="placeholder">privacidad@tudominio.com — pendiente</span></dd></div>
              <div><dt>Teléfono</dt><dd><span class="placeholder">pendiente</span></dd></div>
            </dl>
          </section>

          <section id="que-es">
            <h2>2. Qué es esta política</h2>
            <p>
              Este documento explica qué datos personales recogemos, para qué los usamos, con
              quién los compartimos, cuánto tiempo los conservamos y qué derechos tienes sobre
              ellos. Aplica a todas las personas que interactúan con SOLMI OS: huéspedes de los
              hoteles que usan nuestra plataforma, personal de esos hoteles, y visitantes de
              nuestro sitio web.
            </p>
            <p>Se rige por la Ley No. 172-13 sobre Protección de Datos Personales de la República Dominicana.</p>
          </section>

          <section id="datos-recogidos">
            <h2>3. Qué datos recogemos</h2>
            <h3>3.1 Cuando nos escribes por WhatsApp, Instagram o Facebook</h3>
            <ul>
              <li>Tu número de teléfono o identificador de usuario de la red social</li>
              <li>Tu nombre de perfil o el nombre que nos proporciones</li>
              <li>El contenido de los mensajes que envías y que te enviamos, incluidas imágenes, audios y documentos adjuntos</li>
              <li>La fecha y hora de cada mensaje y su estado de entrega y lectura</li>
            </ul>
            <h3>3.2 Cuando haces una reserva</h3>
            <ul>
              <li>Nombre completo y documento de identidad o pasaporte</li>
              <li>Correo electrónico y teléfono</li>
              <li>Fechas de estadía, tipo de habitación y preferencias declaradas</li>
              <li>Datos de acompañantes, cuando los proporcionas</li>
              <li>Historial de reservas y consumos en el establecimiento</li>
            </ul>
            <h3>3.3 Cuando pagas</h3>
            <p>
              Los pagos se procesan a través de pasarelas de pago externas. SOLMI OS no almacena
              números completos de tarjeta, códigos de seguridad (CVV) ni credenciales bancarias.
              Solo conservamos la confirmación de la transacción, el monto, la fecha y los últimos
              cuatro dígitos del medio de pago.
            </p>
            <h3>3.4 Datos técnicos</h3>
            <p>Dirección IP, tipo de dispositivo y navegador, y páginas visitadas dentro de nuestro sitio.</p>
          </section>

          <section id="para-que">
            <h2>4. Para qué usamos tus datos</h2>
            <div class="legal-table-wrap">
              <table class="legal-table">
                <thead><tr><th>Finalidad</th><th>Base legal</th></tr></thead>
                <tbody>
                  <tr><td>Responder tus mensajes y consultas, incluso de forma automatizada</td><td>Ejecución de la relación contractual y consentimiento</td></tr>
                  <tr><td>Crear, modificar y confirmar tus reservas de hotel y restaurante</td><td>Ejecución del contrato</td></tr>
                  <tr><td>Enviarte confirmaciones, códigos de acceso, instrucciones de llegada y enlaces de pago</td><td>Ejecución del contrato</td></tr>
                  <tr><td>Notificar al hotel sobre tu solicitud o cotización</td><td>Interés legítimo del establecimiento</td></tr>
                  <tr><td>Enviarte ofertas y promociones</td><td>Solo con tu consentimiento previo y expreso</td></tr>
                  <tr><td>Cumplir obligaciones legales, fiscales y de registro de huéspedes</td><td>Obligación legal</td></tr>
                  <tr><td>Mejorar la calidad del servicio y del asistente automatizado</td><td>Interés legítimo</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="ia">
            <h2>5. Uso de inteligencia artificial</h2>
            <p>Una parte de nuestras respuestas es generada por sistemas automatizados de inteligencia artificial. Esto significa que:</p>
            <ul>
              <li>Es posible que la primera respuesta que recibas no provenga de una persona.</li>
              <li>Siempre puedes pedir hablar con una persona real escribiendo "quiero hablar con una persona" o similar, y tu conversación será transferida al personal del establecimiento.</li>
              <li>Ninguna decisión con efectos legales o económicos significativos sobre ti (como el cobro de una penalidad o el rechazo de una reserva confirmada) se toma de forma exclusivamente automatizada sin revisión humana.</li>
            </ul>
          </section>

          <section id="compartir">
            <h2>6. Con quién compartimos tus datos</h2>
            <p>Compartimos datos únicamente con quien es necesario para prestarte el servicio:</p>
            <ul>
              <li>El establecimiento hotelero donde te hospedas o al que consultas. Cada hotel accede solamente a los datos de sus propios huéspedes.</li>
              <li>Meta Platforms, Inc. — al usar WhatsApp Business Platform, Instagram Messaging API y Messenger Platform, los mensajes transitan por la infraestructura de Meta y se rigen además por sus propias políticas.</li>
              <li>Proveedores de pago para procesar transacciones.</li>
              <li>Proveedores de infraestructura tecnológica (alojamiento en la nube y servicios de inteligencia artificial), bajo acuerdos de confidencialidad.</li>
              <li>Autoridades competentes, cuando exista una obligación legal.</li>
            </ul>
            <p class="legal-callout">No vendemos tus datos personales a terceros. Nunca.</p>
          </section>

          <section id="transferencias">
            <h2>7. Transferencias internacionales</h2>
            <p>
              Algunos de nuestros proveedores están ubicados fuera de la República Dominicana. En
              esos casos exigimos garantías contractuales de protección equivalentes a las que
              establece la Ley 172-13.
            </p>
          </section>

          <section id="retencion">
            <h2>8. Cuánto tiempo conservamos tus datos</h2>
            <div class="legal-table-wrap">
              <table class="legal-table">
                <thead><tr><th>Tipo de dato</th><th>Plazo de conservación</th></tr></thead>
                <tbody>
                  <tr><td>Conversaciones de mensajería</td><td>24 meses desde el último mensaje</td></tr>
                  <tr><td>Datos de reserva y estadía</td><td>10 años, por obligación fiscal y de registro hotelero</td></tr>
                  <tr><td>Datos de pago (comprobantes)</td><td>10 años, por obligación fiscal</td></tr>
                  <tr><td>Datos de marketing</td><td>Hasta que retires tu consentimiento</td></tr>
                  <tr><td>Datos técnicos y de navegación</td><td>12 meses</td></tr>
                </tbody>
              </table>
            </div>
            <p>Cumplido el plazo, los datos se eliminan o se anonimizan de forma irreversible.</p>
          </section>

          <section id="derechos">
            <h2>9. Tus derechos</h2>
            <p>Tienes derecho a:</p>
            <ul>
              <li>Acceder a los datos que tenemos sobre ti</li>
              <li>Rectificar los datos inexactos o incompletos</li>
              <li>Solicitar la eliminación de tus datos</li>
              <li>Oponerte al tratamiento o limitarlo</li>
              <li>Retirar tu consentimiento en cualquier momento</li>
              <li>Portabilidad: recibir tus datos en un formato legible</li>
              <li>Presentar una reclamación ante la autoridad competente</li>
            </ul>
            <p>
              Para ejercerlos, escríbenos a <span class="placeholder">privacidad@tudominio.com — pendiente</span>.
              Responderemos en un plazo máximo de quince (15) días hábiles.
            </p>
            <p>
              Para eliminar tus datos, consulta también nuestra
              <router-link to="/legal/eliminacion-datos" class="text-blue font-bold hover:underline">página de Eliminación de Datos</router-link>.
            </p>
          </section>

          <section id="seguridad">
            <h2>10. Cómo protegemos tus datos</h2>
            <ul>
              <li>Cifrado en tránsito (HTTPS/TLS) y en reposo</li>
              <li>Control de acceso por roles: cada persona del hotel ve únicamente lo que le corresponde a su función</li>
              <li>Registro de auditoría de los accesos a datos sensibles</li>
              <li>Copias de seguridad periódicas</li>
              <li>Verificación en dos pasos para las cuentas administrativas</li>
            </ul>
          </section>

          <section id="menores">
            <h2>11. Menores de edad</h2>
            <p>
              SOLMI OS no está dirigido a menores de 18 años. Los datos de menores que se hospedan
              solo se recogen a través de su padre, madre o tutor responsable de la reserva.
            </p>
          </section>

          <section id="cambios">
            <h2>12. Cambios a esta política</h2>
            <p>
              Publicaremos cualquier modificación en esta misma página con su fecha de
              actualización. Si el cambio es sustancial, te lo notificaremos por los medios de
              contacto que tengamos registrados.
            </p>
          </section>

          <section id="contacto">
            <h2>13. Contacto</h2>
            <p>SOLMI OS — Leonardo Batista Soliman</p>
            <p>Calle Activo 2030, No. 34, Ensanche Ozama, Santo Domingo Este, República Dominicana</p>
            <p><span class="placeholder">privacidad@tudominio.com — pendiente</span> · <span class="placeholder">teléfono — pendiente</span></p>
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
