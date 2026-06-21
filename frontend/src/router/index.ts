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
          path: 'api-keys',
          name: 'super-admin-api-keys',
          component: () => import('@/pages/super-admin/api-keys.vue'),
        },
        {
          path: 'roles',
          name: 'super-admin-roles',
          component: () => import('@/pages/super-admin/roles.vue'),
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
          name: 'dashboard',
          component: () => import('@/pages/dashboard/index.vue'),
        },
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
          meta: { requiresHotelAdmin: true },
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
          path: 'planning',
          name: 'planning',
          component: () => import('@/pages/planning/index.vue'),
          meta: { requiresHotelAdmin: true },
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
          path: 'caja',
          name: 'caja',
          component: () => import('@/pages/caja/index.vue'),
          meta: { requiresHotelAdmin: true },
        },
        {
          path: 'registro-viajeros',
          name: 'registro-viajeros',
          component: () => import('@/pages/registro-viajeros/index.vue'),
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

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()

  if (to.path === '/login') {
    if (auth.isAuthenticated) {
      if (auth.isSuperAdmin && !auth.impersonating) {
        next('/admin')
      } else {
        next('/panel')
      }
    } else {
      next()
    }
    return
  }

  if (to.meta.requiresSuperAdmin) {
    if (!auth.isAuthenticated) {
      next('/login')
      return
    }
    if (!auth.isSuperAdmin && !auth.impersonating) {
      next('/panel')
      return
    }
  }

  if (to.meta.requiresHotelAuth) {
    if (!auth.isAuthenticated) {
      next('/login')
      return
    }
    if (auth.isSuperAdmin && !auth.impersonating) {
      next('/admin')
      return
    }
  }

  if (to.meta.requiresHotelAdmin) {
    if (!auth.isAuthenticated) {
      next('/login')
      return
    }
    if (!auth.isSuperAdmin && !auth.isHotelAdmin) {
      next('/panel')
      return
    }
  }

  next()
})

export default router
