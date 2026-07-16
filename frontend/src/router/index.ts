import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('@/pages/landing/index.vue'),
      meta: { layout: 'none' },
    },
    {
      path: '/checkin/:hash',
      name: 'pre-checkin',
      component: () => import('@/pages/pre-checkin/index.vue'),
      meta: { layout: 'none' },
    },
    {
      path: '/book/:slug',
      name: 'booking-widget',
      component: () => import('@/pages/booking-widget/index.vue'),
      meta: { layout: 'none' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/login.vue'),
      meta: { layout: 'none' },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/pages/auth/forgot-password.vue'),
      meta: { layout: 'none' },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/pages/auth/reset-password.vue'),
      meta: { layout: 'none' },
    },
    {
      path: '/change-password',
      name: 'change-password',
      component: () => import('@/pages/auth/change-password.vue'),
      meta: { layout: 'none' },
    },
    {
      path: '/admin',
      component: () => import('@/layouts/SuperAdminLayout.vue'),
      meta: { requiresSuperAdmin: true },
      children: [
        {
          path: '',
          name: 'super-admin',
          component: () => import('@/pages/super-admin/index.vue'),
        },
        {
          path: 'hotels',
          name: 'super-admin-hotels',
          component: () => import('@/pages/super-admin/hotels.vue'),
        },
        {
          path: 'subscriptions',
          name: 'super-admin-subscriptions',
          component: () => import('@/pages/super-admin/subscriptions.vue'),
        },
        {
          path: 'support',
          name: 'super-admin-support',
          component: () => import('@/pages/super-admin/support.vue'),
        },
        {
          path: 'billing',
          name: 'super-admin-billing',
          component: () => import('@/pages/super-admin/billing.vue'),
        },
        {
          path: 'analytics',
          name: 'super-admin-analytics',
          component: () => import('@/pages/super-admin/analytics.vue'),
        },
        {
          path: 'users',
          name: 'super-admin-users',
          component: () => import('@/pages/super-admin/users.vue'),
        },
        {
          path: 'settings',
          name: 'super-admin-settings',
          component: () => import('@/pages/super-admin/settings.vue'),
        },
        {
          path: 'audit',
          name: 'super-admin-audit',
          component: () => import('@/pages/super-admin/audit.vue'),
        },
        {
          path: 'feedback',
          name: 'super-admin-feedback',
          component: () => import('@/pages/super-admin/feedback.vue'),
        },
        {
          path: 'monitoring',
          name: 'super-admin-monitoring',
          component: () => import('@/pages/super-admin/monitoring.vue'),
        },
        {
          path: 'announcements',
          name: 'super-admin-announcements',
          component: () => import('@/pages/super-admin/announcements.vue'),
        },
        {
          path: 'plans',
          name: 'super-admin-plans',
          component: () => import('@/pages/super-admin/plans.vue'),
        },
        {
          path: 'amenities',
          name: 'super-admin-amenities',
          component: () => import('@/pages/super-admin/amenities.vue'),
        },
        {
          path: 'api-keys',
          name: 'super-admin-api-keys',
          component: () => import('@/pages/super-admin/api-keys.vue'),
        },
        {
          path: 'roles',
          name: 'super-admin-roles',
          component: () => import('@/pages/super-admin/roles.vue'),
        },
        {
          path: 'empleados',
          name: 'super-admin-empleados',
          component: () => import('@/pages/empleados/index.vue'),
        },
      ],
    },
    {
      path: '/panel',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresHotelAuth: true },
      children: [
        {
          path: '',
          redirect: '/panel/dashboard',
        },
        // Compat: las URLs viejas de RRHH (planas) redirigen a las nuevas bajo /panel/rrhh/*,
        // así no se rompen links guardados ni bookmarks.
        { path: 'empleados', redirect: '/panel/rrhh/empleados' },
        { path: 'attendance', redirect: '/panel/rrhh/attendance' },
        { path: 'payroll', redirect: '/panel/rrhh/payroll' },
        { path: 'team', redirect: '/panel/rrhh/team' },
        { path: 'activos', redirect: '/panel/rrhh/activos' },
        { path: 'capacitacion', redirect: '/panel/rrhh/capacitacion' },
        { path: 'roles', redirect: '/panel/rrhh/roles' },
        { path: 'rrhh-dashboard', redirect: '/panel/rrhh/dashboard' },
        {
          path: 'dashboard',
          name: 'dashboard-general',
          component: () => import('@/pages/dashboard/index.vue'),
        },
        // Compat: URLs viejas del dashboard, retiradas en favor de /panel/dashboard — redirect por links/bookmarks guardados.
        { path: 'dashboard/general', redirect: '/panel/dashboard' },
        { path: 'dashboard/administrativo', redirect: '/panel/dashboard' },
        {
          path: 'reservations',
          name: 'reservations',
          component: () => import('@/pages/reservations/index.vue'),
        },
        {
          path: 'rooms',
          name: 'rooms',
          component: () => import('@/pages/rooms/index.vue'),
        },
        {
          path: 'guests',
          name: 'guests',
          component: () => import('@/pages/guests/index.vue'),
        },
        {
          path: 'billing',
          name: 'billing',
          component: () => import('@/pages/billing/index.vue'),
        },
        {
          path: 'reports',
          name: 'reports',
          component: () => import('@/pages/reports/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'housekeeping',
          name: 'housekeeping',
          component: () => import('@/pages/housekeeping/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'maintenance',
          name: 'maintenance',
          component: () => import('@/pages/maintenance/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'technical-providers',
          name: 'technical-providers',
          component: () => import('@/pages/technical-providers/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'team-chat',
          name: 'team-chat',
          component: () => import('@/pages/team-chat/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'night-audit',
          name: 'night-audit',
          component: () => import('@/pages/night-audit/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'groups',
          name: 'groups',
          component: () => import('@/pages/groups/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'opiniones',
          name: 'opiniones',
          component: () => import('@/pages/opiniones/index.vue'),
          meta: { requiresHotelAuth: true },
        },
        {
          path: 'gastos',
          name: 'gastos',
          component: () => import('@/pages/gastos/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/pages/settings/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'support',
          name: 'support',
          component: () => import('@/pages/support/index.vue'),
        },
        {
          path: 'booking-engine',
          name: 'booking-engine',
          component: () => import('@/pages/booking-engine/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'checkin',
          name: 'checkin',
          component: () => import('@/pages/checkin/index.vue'),
        },
        {
          path: 'packages',
          name: 'packages',
          component: () => import('@/pages/packages/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'ai-receptionist',
          name: 'ai-receptionist',
          component: () => import('@/pages/ai-receptionist/chat.vue'),
        },
        {
          path: 'ai-receptionist/config',
          name: 'ai-receptionist-config',
          component: () => import('@/pages/ai-receptionist/config.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'rrhh/empleados',
          name: 'empleados',
          component: () => import('@/pages/empleados/index.vue'),
          meta: { requiresHotelAuth: true },
        },
        {
          path: 'rrhh/dashboard',
          name: 'rrhh-dashboard',
          component: () => import('@/pages/rrhh-dashboard/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'rrhh/payroll',
          name: 'payroll',
          component: () => import('@/pages/payroll/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'rrhh/attendance',
          name: 'attendance',
          component: () => import('@/pages/attendance/index.vue'),
          meta: { requiresHotelAuth: true },
        },
        {
          path: 'rrhh/reclutamiento',
          name: 'reclutamiento',
          component: () => import('@/pages/reclutamiento/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'rrhh/reembolsos',
          name: 'reembolsos',
          component: () => import('@/pages/reembolsos/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'rrhh/organigrama',
          name: 'organigrama',
          component: () => import('@/pages/organigrama/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'ai-gerente',
          name: 'ai-gerente',
          component: () => import('@/pages/ai-gerente/index.vue'),
          meta: { requiresHotelAuth: true },
        },
        {
          path: 'crm',
          name: 'crm',
          component: () => import('@/pages/crm/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'planning',
          name: 'planning',
          component: () => import('@/pages/planning/index.vue'),
          meta: { requiresHotelAuth: true },
        },
        {
          path: 'channel-manager',
          name: 'channel-manager',
          component: () => import('@/pages/channel-manager/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'channel/:id',
          name: 'channel-detail',
          component: () => import('@/pages/channel-detail/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'email-queue',
          name: 'email-queue',
          component: () => import('@/pages/email-queue/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'devices',
          name: 'devices',
          component: () => import('@/pages/devices/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'auto-messages',
          name: 'auto-messages',
          component: () => import('@/pages/auto-messages/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'cerraduras',
          name: 'cerraduras',
          component: () => import('@/pages/cerraduras/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'pagos',
          name: 'pagos',
          component: () => import('@/pages/pagos/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'caja',
          name: 'caja',
          component: () => import('@/pages/caja/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'whatsapp-templates',
          name: 'whatsapp-templates',
          component: () => import('@/pages/whatsapp-templates/index.vue'),
          meta: { requiresHotelAuth: true },
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('@/pages/notifications/index.vue'),
          meta: { requiresHotelAuth: true },
        },
        {
          path: 'folios',
          name: 'folios',
          component: () => import('@/pages/folios/index.vue'),
          meta: { requiresHotelAuth: true },
        },
        {
          path: 'payments',
          name: 'payments',
          component: () => import('@/pages/payments/index.vue'),
          meta: { requiresHotelAuth: true },
        },
        {
          path: 'rrhh/team',
          name: 'team',
          component: () => import('@/pages/team/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'rrhh/roles',
          name: 'roles',
          component: () => import('@/pages/roles/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'rrhh/activos',
          name: 'activos',
          component: () => import('@/pages/activos/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'rrhh/capacitacion',
          name: 'capacitacion',
          component: () => import('@/pages/capacitacion/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'message-logs',
          name: 'message-logs',
          component: () => import('@/pages/message-logs/index.vue'),
          meta: { requiresHotelAuth: true },
        },
        {
          path: 'push-tokens',
          name: 'push-tokens',
          component: () => import('@/pages/push-tokens/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.path === '/login') {
    if (auth.isAuthenticated) {
      if (auth.isSuperAdmin && !auth.impersonating) {
        return '/admin'
      } else {
        return '/panel'
      }
    }
    return true
  }

  if (to.meta.requiresSuperAdmin) {
    if (!auth.isAuthenticated) return '/login'
    if (!auth.isSuperAdmin && !auth.impersonating) return '/panel'
  }

  if (to.meta.requiresHotelAuth) {
    if (!auth.isAuthenticated) return '/login'
    if (auth.isSuperAdmin && !auth.impersonating) return '/admin'
  }

  if (to.meta.requiresHotelAdmin) {
    if (!auth.isAuthenticated) return '/login'
    if (!auth.isSuperAdmin && !auth.isHotelAdmin) return '/panel'
  }

  return true
})

export default router
