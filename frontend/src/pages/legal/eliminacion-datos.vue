<template>
  <div class="bg-white min-h-screen">
    <PublicSiteHeader />

    <main class="pt-32 md:pt-40 pb-20 px-6">
      <div class="max-w-3xl mx-auto">
        <div class="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100">
          <span class="text-[11px] font-extrabold tracking-wide text-blue uppercase">Legal</span>
        </div>
        <h1 class="text-navy font-black text-3xl sm:text-4xl mb-2">Eliminación de Datos</h1>
        <p class="text-slate-500 text-sm mb-8">SOLMI OS — Última actualización: 10 de agosto de 2026</p>

        <div class="flex flex-wrap gap-2 mb-10">
          <router-link to="/legal/privacidad" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-slate-50 border border-slate-200 text-navy hover:border-blue-200 hover:bg-blue-50 transition-colors">
            Política de Privacidad
          </router-link>
          <router-link to="/legal/terminos" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-slate-50 border border-slate-200 text-navy hover:border-blue-200 hover:bg-blue-50 transition-colors">
            Términos y Condiciones
          </router-link>
        </div>

        <article class="legal-doc rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60 p-6 sm:p-10 space-y-8 text-[14px] leading-relaxed text-slate-600">
          <section id="derecho">
            <h2>Tienes derecho a que borremos tus datos</h2>
            <p>
              Si alguna vez nos escribiste por WhatsApp, Instagram o Facebook, o hiciste una
              reserva a través de SOLMI OS, puedes pedirnos que eliminemos tu información
              personal. Es tu derecho bajo la Ley No. 172-13 de la República Dominicana y no
              tienes que dar explicaciones.
            </p>
          </section>

          <section id="como-pedirlo">
            <h2>Cómo pedirlo — tres formas</h2>
            <h3>1. Por el formulario web (la más rápida)</h3>
            <p>Llena el formulario en <span class="placeholder">https://tudominio.com/eliminar-datos — pendiente</span> con:</p>
            <ul>
              <li>Tu nombre completo</li>
              <li>El número de teléfono o usuario con el que nos escribiste</li>
              <li>El hotel o establecimiento con el que interactuaste, si lo recuerdas</li>
            </ul>
            <h3>2. Por correo electrónico</h3>
            <p>
              Escribe a <span class="placeholder">privacidad@tudominio.com — pendiente</span> con
              el asunto "Eliminación de datos" e incluye los mismos datos de arriba.
            </p>
            <h3>3. Por WhatsApp</h3>
            <p>
              Escribe la palabra <strong>ELIMINAR MIS DATOS</strong> al mismo número por el que
              nos contactaste. El sistema abrirá tu solicitud automáticamente.
            </p>
          </section>

          <section id="que-pasa-despues">
            <h2>Qué pasa después</h2>
            <div class="legal-steps">
              <div>
                <span class="legal-step-badge">1</span>
                <span>Recibes un acuse de recibo con un número de solicitud</span>
                <span class="legal-step-deadline">Máx. 48 horas</span>
              </div>
              <div>
                <span class="legal-step-badge">2</span>
                <span>Verificamos tu identidad para proteger tu cuenta</span>
                <span class="legal-step-deadline">1 a 3 días hábiles</span>
              </div>
              <div>
                <span class="legal-step-badge">3</span>
                <span>Eliminamos tus datos y te confirmamos por escrito</span>
                <span class="legal-step-deadline">Máx. 15 días hábiles desde la verificación</span>
              </div>
            </div>
            <p>Todo el proceso toma como máximo 30 días naturales.</p>
          </section>

          <section id="que-se-elimina">
            <h2>Qué se elimina</h2>
            <ul>
              <li>Todo el historial de conversaciones por WhatsApp, Instagram y Facebook</li>
              <li>Tu nombre, teléfono, correo e identificadores de perfil</li>
              <li>Tus preferencias y notas de huésped</li>
              <li>Tu perfil de contacto en nuestra base de datos</li>
            </ul>
          </section>

          <section id="que-no-se-elimina">
            <h2>Qué NO podemos eliminar, y por qué</h2>
            <p>La ley dominicana nos obliga a conservar cierta información aunque tú pidas su eliminación:</p>
            <div class="legal-table-wrap">
              <table class="legal-table">
                <thead><tr><th>Qué se conserva</th><th>Por qué</th><th>Cuánto tiempo</th></tr></thead>
                <tbody>
                  <tr><td>Comprobantes fiscales y facturas</td><td>Código Tributario y normativa de la DGII</td><td>10 años</td></tr>
                  <tr><td>Registro de huéspedes hospedados</td><td>Normativa de registro hotelero</td><td>10 años</td></tr>
                  <tr><td>Registros de transacciones de pago</td><td>Prevención de fraude y obligación contable</td><td>10 años</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              Estos datos quedan bloqueados: no se usan para ninguna otra finalidad, no se
              comparten y solo se conservan a disposición de las autoridades. Cumplido el plazo
              legal, se eliminan de forma definitiva.
            </p>
          </section>

          <section id="datos-en-meta">
            <h2>Datos que están en Meta</h2>
            <p>
              Los mensajes que enviaste también pasaron por los servidores de Meta Platforms, Inc.
              (WhatsApp, Instagram, Facebook). Nosotros eliminamos nuestra copia, pero la copia
              que guarda Meta se rige por sus propias políticas.
            </p>
            <p>Para pedirle a Meta que elimine tus datos, debes hacerlo directamente en la configuración de tu cuenta de Facebook, Instagram o WhatsApp.</p>
          </section>

          <section id="establecimiento-cliente">
            <h2>Si eres un establecimiento cliente</h2>
            <p>Si tu hotel o negocio deja de usar SOLMI OS y quieres que eliminemos toda la información de tu operación:</p>
            <ul>
              <li>Escribe a <span class="placeholder">correo — pendiente</span> desde el correo del administrador registrado.</li>
              <li>Te entregamos una exportación completa de tus datos en formato legible antes de borrar nada.</li>
              <li>Conservamos la información 90 días después de la baja, por si necesitas recuperarla o cambias de opinión.</li>
              <li>Pasados esos 90 días, se elimina de forma irreversible, salvo lo que la ley obligue a conservar.</li>
            </ul>
          </section>

          <section id="problemas">
            <h2>¿Problemas?</h2>
            <p>
              Si no recibes respuesta en los plazos indicados, o no estás conforme con lo que
              hicimos, puedes presentar una reclamación ante la autoridad competente en materia de
              protección de datos de la República Dominicana.
            </p>
          </section>

          <section id="contacto">
            <h2>Contacto</h2>
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
