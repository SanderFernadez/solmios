# WhatsApp Business API — Guía de configuración

> Esta guía permite a un **admin de hotel** (sin conocimientos técnicos profundos) conectar WhatsApp Business API al sistema para envío real de mensajes (confirmaciones, pre-venta, check-in, códigos TTLock, etc.) — no solo links `wa.me`.
>
> Tiempo estimado: **45–60 minutos** + el tiempo de revisión de Meta (24–48h por plantilla).

---

## Requisitos previos

- Una cuenta de **Facebook** personal (para administrar el Business).
- Un **número de teléfono** dedicado a WhatsApp Business que NO esté activo en otra app de WhatsApp (si lo está, hay que migrarlo o usar uno nuevo).
- Acceso al panel del hotel → **Settings → Integraciones → WhatsApp**.

---

## Paso 1 — Crear cuenta de Meta Business

1. Ir a **https://business.facebook.com**.
2. Clic **Crear cuenta** → nombre del hotel (ej. "Hotel Boutique Palma") → tu nombre y email de trabajo.
3. Verificar el email de confirmación.
4. (Recomendado) Completar la **verificación del negocio** en Business Settings → Business Info → Verification. Algunas funciones avanzadas la requieren, pero **no es obligatoria para enviar plantillas aprobadas**.

---

## Paso 2 — Registrar la app en Meta for Developers

1. Ir a **https://developers.facebook.com** → iniciar sesión con la misma cuenta de Facebook.
2. Clic **My Apps → Create App**.
3. Tipo: **Business** → nombre "ManagerHotel WA" → asociar al Business creado en el Paso 1.
4. Dentro de la app, ir a **Dashboard → Add Product → WhatsApp → Set Up**.

---

## Paso 3 — Configurar WhatsApp Business API

Una vez agregado el producto WhatsApp:

1. **Phone Number ID**: copiar el valor que aparece en WhatsApp → API Setup.
2. **WhatsApp Business Account ID**: copiar de la misma pantalla.
3. **Permanent Access Token** (ver Paso 4) — el token temporal que muestra Meta sirve para pruebas, pero caduca; usar uno permanente.
4. **Webhook**:
   - En WhatsApp → Configuration → Webhook → **Edit**.
   - **Callback URL**: `https://hotel.zx89.site/api/whatsapp/webhook`
   - **Verify Token**: inventar una frase secreta y **anotarla** (se ingresa también en Settings → Integraciones → WhatsApp → `webhookVerifyToken`).
   - Suscribirse al campo `messages` y `template_status_update` (para el estado de aprobación de plantillas).

---

## Paso 4 — Permanent Access Token

El token de prueba caduca en 24h. Para producción se necesita uno permanente:

1. Business Settings → **Users → Usuarios del negocio → tu usuario → Editar**.
2. Asignar el rol de **Admin** del Business.
3. En **Apps**, asignar la app del Paso 2.
4. Crear el token: System Users → **Add → Create token**:
   - Permisos mínimos: `whatsapp_business_messaging`, `whatsapp_business_management`.
   - **Copiar el token** (solo se muestra una vez) y guardarlo en un lugar seguro (gestor de contraseñas).

> ⚠️ Si la app está en modo **Desarrollo**, los mensajes solo llegan a números de prueba (máx 5). Para enviar a cualquier número hay que poner la app en **Producción** y completar la revisión del negocio (App Review → Business Verification).

---

## Paso 5 — Plantillas de mensajes (approval flow)

WhatsApp **no permite enviar mensajes arbitrarios** a usuarios fuera de la ventana de 24h; hay que usar **plantillas pre-aprobadas**.

1. En WhatsApp Manager → **Account Tools → Message Templates → Create Template**.
2. Crear una plantilla por cada tipo de notificación que el sistema use. Ejemplos:
   - `reservation_confirmation` (cuerpo con `{{1}}` = nombre huésped, `{{2}}` = fechas).
   - `pre_sale_reminder`.
   - `checkin_welcome` (con `{{1}}` = código TTLock).
3. Categoría: **Utility** o **Marketing** según el caso. Lenguaje: `es` (y `en` si hay huéspedes angloparlantes).
4. Enviar a revisión. Meta responde en **24–48h**.
5. Cuando Meta aprueba, el sistema recibe el estado por webhook (`template_status_update`) y la plantilla queda `approved` → lista para envío real.

> El sistema permite crear y enviar plantillas a aprobación desde el panel (**Auto-Messages → "Enviar a aprobación"**). Si una plantilla es `rejected`, Meta devuelve el motivo y se puede editar y reenviar.

---

## Paso 6 — Cargar los datos en el sistema

Ir al panel del hotel → **Settings → Integraciones → WhatsApp** y completar:

| Campo | De dónde sale |
|---|---|
| `apiKey` (Permanent Access Token) | Paso 4 |
| `phoneNumberId` | Paso 3 |
| `businessAccountId` | Paso 3 |
| `webhookVerifyToken` | Paso 3 (la frase inventada, debe coincidir con Meta) |

Guardar. El sistema pasa automáticamente de modo `wa.me` (sin API) a **modo API real** cuando `apiKey` + `phoneNumberId` están configurados.

---

## Verificación

1. **Webhook**: en Meta for Developers → WhatsApp → Webhook, clic **Test**. Debe responder 200 OK.
2. **Envío de prueba**: crear una reserva con un huésped cuyo teléfono esté dado de alta como número de prueba (si la app sigue en Desarrollo). El auto-message debe llegar por WhatsApp con la plantilla aprobada.
3. **Logs**: en el panel → mensajes enviados deben aparecer con `status: sent` y el `message_id` devuelto por Meta. Si `failed`, el log incluye el motivo.

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| Webhook no verifica | `webhookVerifyToken` distinto en Meta y en Settings | Copiar exactamente el mismo valor en ambos |
| `status: failed` con código 401 | Token inválido o caducado | Regenerar Permanent Access Token (Paso 4) |
| Plantilla `rejected` | Contenido fuera de política | Corregir según motivo de Meta y reenviar |
| Mensaje no llega fuera de números de prueba | App en modo Desarrollo | Mover a Producción + Business Verification |
| Mensaje enviado pero sin `template` error | Uso de texto libre fuera de ventana 24h | Usar siempre plantillas aprobadas |
