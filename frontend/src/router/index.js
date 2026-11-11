import { createRouter, createWebHistory } from 'vue-router'
import BienvenidaView from '@/views/BienvenidaView.vue'
import InicioView from '@/views/InicioView.vue'
import LoginView from '@/views/LoginView.vue'
import ProductosView from '@/views/ProductosView.vue'
import { authService, authState } from '@/services/api'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'bienvenida', component: BienvenidaView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/registro', redirect: '/' },
    { path: '/inicio', name: 'inicio', component: InicioView },
    {
      path: '/productos',
      name: 'productos',
      component: ProductosView,
      meta: { requiereAutenticacion: true },
    },
    {
      path: '/productos/nuevo',
      name: 'productos-nuevo',
      component: ProductosView,
      meta: { requiereAutenticacion: true, accion: 'nuevo' },
    },
    {
      path: '/productos/:id/editar',
      name: 'productos-editar',
      component: ProductosView,
      meta: { requiereAutenticacion: true, accion: 'editar' },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { requiereAutenticacion: true, rolRequerido: 'admin' },
    },
  ],
})

// Guardia de navegación: protege las pantallas privadas y valida roles
router.beforeEach(async (to, from, next) => {
  if (to.meta.requiereAutenticacion) {
    if (!authState.user || !authState.organizacion) {
      // Sin sesión activa, redirige inmediatamente a /login
      return next({ path: '/login', query: { redirect: to.fullPath } })
    }

    // Validación estricta de rol (ej: /dashboard requiere rol 'admin')
    if (to.meta.rolRequerido && authState.rol !== to.meta.rolRequerido) {
      return next({ path: '/inicio', query: { denegado: 'true', rol: authState.rol } })
    }
  }

  // Si ya tiene sesión e intenta entrar a login, redirige a productos
  if (to.path === '/login' && authState.user) {
    return next({ path: '/productos' })
  }

  next()
})

export default router
