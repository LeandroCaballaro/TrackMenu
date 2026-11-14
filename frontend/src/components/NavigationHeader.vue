<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  UtensilsCrossed, LayoutGrid, Package, TrendingUp, LogOut,
  Users, Building2, User, Menu, X, ChevronRight, LogIn
} from 'lucide-vue-next'
import logoIcono from '@/assets/logo-campana.png'
import { authState, authService } from '@/services/api'

const route = useRoute()
const router = useRouter()

// Control de visibilidad por rol
const esSuperAdmin = computed(() => authState.rol === 'superadmin')
const esAdmin = computed(() => authState.rol === 'admin')
const esEmpleado = computed(() => authState.rol === 'empleado')
const estaAutenticado = computed(() => Boolean(authState.user))

const nombreUsuario = computed(() => {
  const u = authState.user
  if (!u) return ''
  const raw =
    u.nombre ||
    u.user_metadata?.nombre ||
    u.user_metadata?.full_name ||
    (u.email ? u.email.split('@')[0] : '') ||
    'Usuario'
  return String(raw).replace(/\s*SaaS\b/gi, '').trim()
})

// Identificar qué vista está activa actualmente
const seccionActiva = computed(() => {
  if (route.path.startsWith('/superadmin')) return 'superadmin'
  if (route.path.startsWith('/dashboard')) return 'dashboard'
  if (route.path.startsWith('/usuarios')) return 'usuarios'
  if (route.path.startsWith('/productos')) return 'productos'
  if (route.path === '/inicio' || route.path === '/') {
    return route.query.vista === 'mesas' ? 'mesas' : 'carta'
  }
  return ''
})

// Accesos disponibles según el rol del usuario
const accesosVisibles = computed(() => {
  // El SuperAdmin solo tiene acceso a Usuarios y al panel de SuperAdmin (no ve secciones operativas de restaurante)
  if (esSuperAdmin.value) {
    return [
      { id: 'superadmin', label: 'SuperAdmin', icon: Building2 },
      { id: 'usuarios', label: 'Usuarios', icon: Users },
    ]
  }

  // Personal del restaurante (admin / empleado) o clientes en carta pública
  const tabs = [
    { id: 'carta', label: 'Carta Digital', icon: UtensilsCrossed },
  ]

  if (esAdmin.value || esEmpleado.value) {
    tabs.push({ id: 'mesas', label: 'Control de Mesas', icon: LayoutGrid })
  }

  if (estaAutenticado.value) {
    tabs.push({
      id: 'productos',
      label: 'Platos y Precios',
      icon: Package,
    })
  }

  if (esAdmin.value) {
    tabs.push({ id: 'dashboard', label: 'Ventas y Control', icon: TrendingUp })
    tabs.push({ id: 'usuarios', label: 'Usuarios', icon: Users })
  }

  return tabs
})

// Panel lateral desplegable/plegable para accesos en móvil/tablet
const panelLateralAbierto = ref(false)

function alternarPanelLateral() {
  panelLateralAbierto.value = !panelLateralAbierto.value
}

function cerrarPanelLateral() {
  panelLateralAbierto.value = false
}

function manejarTeclado(event) {
  if (event.key === 'Escape' && panelLateralAbierto.value) {
    cerrarPanelLateral()
  }
}

// Medición para la línea indicadora deslizante (desktop)
const navRailRef = ref(null)
const tabRefs = ref({})
const sliderMetrics = ref({ left: 0, right: 0, ready: false })

function setTabRef(id, el) {
  if (el) {
    tabRefs.value[id] = el
  } else {
    delete tabRefs.value[id]
  }
}

function actualizarIndicador() {
  const railEl = navRailRef.value
  const activeEl = tabRefs.value[seccionActiva.value]
  if (!railEl || !activeEl) {
    sliderMetrics.value = { left: 0, right: 0, ready: false }
    return
  }

  const railWidth = railEl.offsetWidth
  const left = activeEl.offsetLeft
  const right = Math.max(0, railWidth - (left + activeEl.offsetWidth))

  sliderMetrics.value = {
    left,
    right,
    ready: railWidth > 0,
  }
}

const sliderStyle = computed(() => {
  if (!sliderMetrics.value.ready) {
    return {
      opacity: 0,
      clipPath: 'inset(0 100% 0 0 round 999px)',
    }
  }
  return {
    opacity: 1,
    clipPath: `inset(0 ${sliderMetrics.value.right}px 0 ${sliderMetrics.value.left}px round 999px)`,
  }
})

let resizeObserver = null

onMounted(() => {
  nextTick(() => {
    actualizarIndicador()
  })

  if (typeof ResizeObserver !== 'undefined' && navRailRef.value) {
    resizeObserver = new ResizeObserver(() => {
      actualizarIndicador()
    })
    resizeObserver.observe(navRailRef.value)
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      nextTick(actualizarIndicador)
    })
  }

  window.addEventListener('resize', actualizarIndicador)
  window.addEventListener('keydown', manejarTeclado)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', actualizarIndicador)
  window.removeEventListener('keydown', manejarTeclado)
})

watch([seccionActiva, accesosVisibles], () => {
  nextTick(() => {
    actualizarIndicador()
  })
})

watch(() => route.fullPath, () => {
  cerrarPanelLateral()
})

function navegarA(seccion) {
  cerrarPanelLateral()
  if (seccion === 'superadmin') {
    router.push('/superadmin')
    return
  }
  if (seccion === 'usuarios') {
    router.push('/usuarios')
    return
  }

  // Si es superadmin, no permitir navegar a secciones operativas del restaurante
  if (esSuperAdmin.value) {
    router.push('/superadmin')
    return
  }

  if (seccion === 'carta') {
    if (route.path === '/inicio' || route.path === '/') {
      router.replace({ path: '/inicio', query: { vista: 'carta' } })
    } else {
      router.push({ path: '/inicio', query: { vista: 'carta' } })
    }
  } else if (seccion === 'mesas') {
    if (route.path === '/inicio' || route.path === '/') {
      router.replace({ path: '/inicio', query: { vista: 'mesas' } })
    } else {
      router.push({ path: '/inicio', query: { vista: 'mesas' } })
    }
  } else if (seccion === 'productos') {
    router.push('/productos')
  } else if (seccion === 'dashboard') {
    router.push('/dashboard')
  }
}

function cerrarSesion() {
  cerrarPanelLateral()
  authService.logout()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full border-b border-stone-800/80 bg-[#0c0a09] pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 sm:pb-3.5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-8">
    <div class="mx-auto flex min-h-[48px] max-w-[1400px] flex-row items-center justify-between gap-2 sm:gap-3.5">

      <!-- Lado Izquierdo: Botón Panel Lateral (< lg) + Identidad y Negocio -->
      <div class="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          @click="alternarPanelLateral"
          :aria-expanded="panelLateralAbierto"
          aria-controls="nav-panel-lateral"
          :aria-label="panelLateralAbierto ? 'Plegar panel de accesos' : 'Desplegar panel de accesos'"
          class="nav-action flex lg:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition"
          :class="panelLateralAbierto
            ? 'border-[#e58a4e]/50 bg-[#e58a4e]/15 text-[#e58a4e]'
            : 'border-stone-800 bg-[#17120f] text-stone-200 hover:border-[#e58a4e]/40 hover:text-white'"
        >
          <component :is="panelLateralAbierto ? X : Menu" :size="18" class="shrink-0" />
        </button>

        <RouterLink :to="esSuperAdmin ? '/superadmin' : '/inicio'" class="group flex items-center gap-2 sm:gap-3.5 min-w-0">
          <img :src="logoIcono" alt="TrackMenú" class="h-8 w-9 sm:h-11 sm:w-12 shrink-0 object-contain transition-transform duration-200 ease-out group-hover:scale-[1.04]" />
          <div class="flex flex-col justify-center min-w-0">
            <span class="font-girassol text-[22px] sm:text-[32px] font-normal leading-none tracking-wide text-[#e58a4e]">
              TrackMenú
            </span>
            <p
              v-if="!esSuperAdmin"
              class="mt-0.5 sm:mt-1 truncate text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.03em] sm:tracking-[0.2em] text-[#8e7e73]"
            >
              {{ authState.organizacion?.nombre || 'Pedidos simples, mesas al día' }}
            </p>
          </div>
        </RouterLink>
      </div>

      <!-- Centro (Desktop lg+): Barra de Vistas con Línea Deslizante Animada -->
      <nav class="hidden lg:block overflow-x-auto no-scrollbar shrink-0" aria-label="Navegación principal">
        <div ref="navRailRef" class="relative inline-flex min-w-max items-center gap-2 pb-1.5">
          <button
            v-for="tab in accesosVisibles"
            :key="tab.id"
            :ref="(el) => setTabRef(tab.id, el)"
            type="button"
            @click="navegarA(tab.id)"
            :aria-current="seccionActiva === tab.id ? 'page' : undefined"
            class="nav-tab relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] tracking-wide select-none"
            :class="[
              seccionActiva === tab.id
                ? 'nav-tab-active bg-[#e58a4e]/[0.08] text-[#e58a4e] font-semibold'
                : 'text-stone-400 font-medium hover:bg-stone-800/40 hover:text-stone-100'
            ]"
          >
            <component
              :is="tab.icon"
              :size="15"
              class="shrink-0"
              :class="seccionActiva === tab.id ? 'text-[#e58a4e]' : 'text-stone-500'"
            />
            <span class="whitespace-nowrap">{{ tab.label }}</span>
          </button>

          <!-- Carril base sutil -->
          <div class="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-stone-800/70" />

          <!-- Línea indicadora animada que se desliza de un acceso al otro -->
          <div
            class="nav-slider pointer-events-none absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#e58a4e]"
            :style="sliderStyle"
          />
        </div>
      </nav>

      <!-- Usuario en Móvil / Tablet (< lg) -->
      <div v-if="estaAutenticado" class="flex lg:hidden items-center shrink-0">
        <div class="flex items-center gap-1.5 rounded-full border border-stone-800 bg-[#17120f] px-2.5 py-1.5 text-[11px]">
          <span
            class="h-2 w-2 rounded-full shrink-0"
            :class="esSuperAdmin ? 'bg-amber-400' : (esAdmin ? 'bg-[#e58a4e]' : 'bg-blue-400')"
          />
          <span class="font-semibold text-stone-200 text-[11px] truncate max-w-[110px] sm:max-w-[180px]">
            {{ nombreUsuario }}
          </span>
        </div>
      </div>

      <!-- Lado Derecho: Perfil de Sesión y Salida (Desktop lg+) -->
      <div v-if="estaAutenticado" class="hidden lg:flex items-center justify-end gap-2.5 shrink-0">
        <div class="flex items-center gap-2 rounded-full border border-stone-800 bg-[#17120f] px-3.5 py-2 text-xs text-stone-300">
          <User :size="14" :class="esSuperAdmin ? 'text-amber-400' : (esAdmin ? 'text-[#e58a4e]' : 'text-blue-400')" />
          <span class="font-semibold text-stone-100 text-xs truncate max-w-[180px]">{{ nombreUsuario }}</span>
        </div>

        <button type="button" @click="cerrarSesion"
          class="btn-icon-shift nav-action flex items-center gap-1.5 rounded-2xl border border-rose-900/40 bg-rose-950/20 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-950/40 hover:border-rose-900/60"
          title="Cerrar sesión activa">
          <LogOut :size="14" />
          <span>Salir</span>
        </button>
      </div>

    </div>
  </header>

  <!-- Panel Lateral Desplegable / Plegable (Móvil y Tablet < lg) -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="panelLateralAbierto"
        class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs lg:hidden"
        aria-hidden="true"
        @click="cerrarPanelLateral"
      />
    </Transition>

    <Transition
      enter-active-class="transform transition duration-250 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transform transition duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="panelLateralAbierto"
        id="nav-panel-lateral"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de accesos"
        class="fixed inset-y-0 left-0 z-50 flex w-[285px] max-w-[84vw] flex-col justify-between border-r border-stone-800/90 bg-[#120e0c] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[#f5f2eb] shadow-2xl lg:hidden"
      >
        <div class="flex flex-col min-h-0 flex-1">
          <!-- Cabecera del Panel Lateral -->
          <div class="flex items-center justify-between gap-2 border-b border-stone-800/80 pb-3.5">
            <div class="flex items-center gap-2.5 min-w-0">
              <img :src="logoIcono" alt="TrackMenú" class="h-8 w-9 shrink-0 object-contain" />
              <div class="min-w-0">
                <p class="font-girassol text-xl leading-none text-[#e58a4e]">TrackMenú</p>
                <p class="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                  {{ esSuperAdmin ? 'Administración SaaS' : (authState.organizacion?.nombre || 'Navegación') }}
                </p>
              </div>
            </div>

            <button
              type="button"
              @click="cerrarPanelLateral"
              aria-label="Plegar panel lateral"
              title="Plegar panel"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-800 bg-[#1a1411] text-stone-300 transition hover:border-stone-700 hover:text-white"
            >
              <X :size="16" />
            </button>
          </div>

          <!-- Lista de Todos los Accesos -->
          <nav class="mt-4 flex-1 space-y-1.5 overflow-y-auto pr-0.5" aria-label="Accesos del panel lateral">
            <p class="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
              Accesos
            </p>

            <button
              v-for="tab in accesosVisibles"
              :key="`drawer-${tab.id}`"
              type="button"
              @click="navegarA(tab.id)"
              :aria-current="seccionActiva === tab.id ? 'page' : undefined"
              class="flex w-full items-center justify-between gap-2.5 rounded-2xl border px-3.5 py-3 text-left text-sm transition"
              :class="seccionActiva === tab.id
                ? 'border-[#e58a4e]/45 bg-[#e58a4e]/12 font-semibold text-[#e58a4e]'
                : 'border-stone-800/60 bg-[#17120f]/70 font-medium text-stone-300 hover:border-stone-700 hover:bg-[#1d1612] hover:text-white'"
            >
              <span class="flex items-center gap-3 min-w-0">
                <component
                  :is="tab.icon"
                  :size="17"
                  class="shrink-0"
                  :class="seccionActiva === tab.id ? 'text-[#e58a4e]' : 'text-stone-400'"
                />
                <span class="truncate">{{ tab.label }}</span>
              </span>
              <ChevronRight
                :size="15"
                class="shrink-0"
                :class="seccionActiva === tab.id ? 'text-[#e58a4e]' : 'text-stone-600'"
              />
            </button>
          </nav>
        </div>

        <!-- Pie del Panel Lateral: Cuenta y Salir -->
        <div class="mt-4 border-t border-stone-800/80 pt-4 space-y-2.5 shrink-0">
          <template v-if="estaAutenticado">
            <div class="flex items-center gap-2.5 rounded-2xl border border-stone-800 bg-[#17120f] px-3.5 py-2.5">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-stone-800 bg-[#110d0b]"
              >
                <User :size="15" :class="esSuperAdmin ? 'text-amber-400' : (esAdmin ? 'text-[#e58a4e]' : 'text-blue-400')" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-bold text-stone-100">{{ nombreUsuario }}</p>
                <p class="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                  {{ esSuperAdmin ? 'SuperAdmin' : (esAdmin ? 'Administrador' : 'Personal') }}
                </p>
              </div>
            </div>

            <button
              type="button"
              @click="cerrarSesion"
              class="btn-icon-shift flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-900/40 bg-rose-950/25 px-4 py-3 text-xs font-bold text-rose-300 transition hover:bg-rose-950/45 hover:border-rose-900/60"
            >
              <LogOut :size="15" />
              <span>Cerrar Sesión</span>
            </button>
          </template>

          <RouterLink
            v-else
            to="/login"
            @click="cerrarPanelLateral"
            class="flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-800 bg-[#17120f] px-4 py-3 text-xs font-bold text-[#e58a4e] transition hover:border-[#e58a4e]/40 hover:bg-[#1f1713]"
          >
            <LogIn :size="15" />
            <span>Ingresar al sistema</span>
          </RouterLink>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.nav-tab {
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  transition: color 180ms var(--ease-out), background-color 180ms var(--ease-out);
}

.nav-tab svg {
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  transition: transform 200ms var(--ease-out), color 160ms var(--ease-out);
}

.nav-tab:active,
.nav-action:active {
  transform: translate3d(0, 1px, 0);
  transition-duration: 100ms;
}

.nav-action {
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  transition:
    transform 200ms var(--ease-out),
    color 180ms var(--ease-out),
    background-color 180ms var(--ease-out),
    border-color 180ms var(--ease-out);
}

.nav-slider {
  transition:
    clip-path 240ms var(--ease-in-out),
    opacity 180ms var(--ease-out);
  will-change: clip-path;
}

@media (hover: hover) and (pointer: fine) {
  .nav-tab:not(.nav-tab-active):hover svg {
    transform: translate3d(0, -1px, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-slider {
    transition: opacity 150ms ease;
  }
  .nav-tab:not(.nav-tab-active):hover svg,
  .nav-tab:active,
  .nav-action:active {
    transform: none;
  }
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
