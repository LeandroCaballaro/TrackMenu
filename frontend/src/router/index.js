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
    // Pública a propósito: es la carta que abre el cliente desde el QR.
    {
      path: '/carta/:organizacion',
      name: 'carta-publica',
      component: () => import('@/views/CartaPublicaView.vue'),
    },
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
    {
      path: '/usuarios',
      name: 'usuarios',
      component: () => import('@/views/UsuariosView.vue'),
      meta: { requiereAutenticacion: true, rolRequerido: ['admin', 'superadmin'] },
    },
    {
      path: '/usuarios/nuevo',
      name: 'usuarios-nuevo',
      component: () => import('@/views/UsuarioPerfilView.vue'),
      meta: { requiereAutenticacion: true, rolRequerido: ['admin', 'superadmin'], modo: 'nuevo' },
    },
    {
      path: '/usuarios/:id',
      name: 'usuario-perfil',
      component: () => import('@/views/UsuarioPerfilView.vue'),
      meta: { requiereAutenticacion: true, rolRequerido: ['admin', 'superadmin'], modo: 'editar' },
    },
    {
      path: '/superadmin',
      name: 'superadmin',
      component: () => import('@/views/SuperAdminView.vue'),
      meta: { requiereAutenticacion: true, rolRequerido: 'superadmin' },
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

    // Validación estricta de rol
    if (to.meta.rolRequerido) {
      const permitidos = Array.isArray(to.meta.rolRequerido)
        ? to.meta.rolRequerido
        : [to.meta.rolRequerido]

      if (!permitidos.includes(authState.rol)) {
        const destino = authState.rol === 'superadmin' ? '/superadmin' : '/inicio'
        return next({ path: destino, query: { denegado: 'true', rol: authState.rol } })
      }
    }
  }

  // Si ya tiene sesión e intenta entrar a login
  if (to.path === '/login' && authState.user) {
    if (authState.rol === 'superadmin') {
      return next({ path: '/superadmin' })
    }
    return next({ path: '/productos' })
  }

  // El superadmin solo opera en /superadmin y /usuarios; si intenta ir a vistas operativas de local, se redirige a superadmin
  if (authState.rol === 'superadmin') {
    const esRutaPermitida = to.path.startsWith('/superadmin') || to.path.startsWith('/usuarios')
    if (!esRutaPermitida) {
      return next({ path: '/superadmin' })
    }
  }

  next()
})

export default router
