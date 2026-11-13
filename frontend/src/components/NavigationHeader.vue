<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  UtensilsCrossed, LayoutGrid, Package, TrendingUp, LogOut,
  Shield, Users
} from 'lucide-vue-next'
import logoIcono from '@/assets/3.png'
import { authState, authService } from '@/services/api'

const route = useRoute()
const router = useRouter()

// Control de visibilidad por rol
const esAdmin = computed(() => authState.rol === 'admin')
const esEmpleado = computed(() => authState.rol === 'empleado')
const estaAutenticado = computed(() => Boolean(authState.user))
// Con las cuentas de demostración (@demo.com) o sin backend, lo que se carga
// queda sólo en este navegador. Hay que verlo, no sólo saberlo.
const modoLocal = computed(() => estaAutenticado.value && !authState.backendConnected)

// Identificar qué vista está activa actualmente
const seccionActiva = computed(() => {
  if (route.path.startsWith('/dashboard')) return 'dashboard'
  if (route.path.startsWith('/productos')) return 'productos'
  if (route.path === '/inicio' || route.path === '/') {
    return route.query.vista === 'mesas' ? 'mesas' : 'carta'
  }
  return ''
})

// Accesos disponibles según el rol del usuario
const accesosVisibles = computed(() => {
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
  }

  return tabs
})

// Medición para la línea indicadora deslizante
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
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', actualizarIndicador)
})

watch([seccionActiva, accesosVisibles], () => {
  nextTick(() => {
    actualizarIndicador()
  })
})

function navegarA(seccion) {
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
  authService.logout()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full border-b border-stone-800/80 bg-[#0c0a09] pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 sm:pb-3.5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:px-8">
    <div
      class="mx-auto flex min-h-[48px] max-w-[1400px] gap-2.5 sm:gap-3.5 lg:flex-row lg:items-center lg:justify-between"
      :class="estaAutenticado ? 'flex-col' : 'flex-row items-center justify-between'">

      <!-- Lado Izquierdo: Identidad y Negocio -->
      <div class="flex items-center justify-between gap-3 min-w-0">
        <RouterLink to="/inicio" class="group flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <img :src="logoIcono" alt="TrackMenú" class="h-10 w-10 sm:h-12 sm:w-12 shrink-0 object-contain transition-transform duration-200 ease-out group-hover:scale-[1.03]" />
          <div class="flex flex-col justify-center min-w-0">
            <span class="font-girassol text-[23px] sm:text-[29px] font-normal leading-none tracking-wide text-[#e58a4e]">
              TrackMenú
            </span>
            <p class="mt-0.5 sm:mt-1 truncate text-[8px] sm:text-[10px] font-semibold uppercase tracking-[0.03em] sm:tracking-[0.2em] text-[#8e7e73]">
              {{ authState.organizacion?.nombre || 'Pedidos simples, mesas al día' }}
            </p>
          </div>
        </RouterLink>

        <!-- Identificador de Rol en móvil -->
        <div v-if="estaAutenticado" class="flex sm:hidden items-center gap-1.5 shrink-0 rounded-full border border-stone-800 bg-[#17120f] px-3 py-1 text-[11px]">
          <span class="h-2 w-2 rounded-full"
            :class="esAdmin ? 'bg-[#e58a4e]' : 'bg-blue-400'" />
          <span class="font-bold uppercase text-stone-200 text-[10px]">{{ authState.rol }}</span>
        </div>
      </div>

      <!-- Centro: Barra de Vistas con Línea Deslizante Animada -->
      <nav class="overflow-x-auto pb-0.5 lg:pb-0 no-scrollbar shrink-0" aria-label="Navegación principal">
        <div ref="navRailRef" class="relative inline-flex min-w-max items-center gap-1 sm:gap-2 pb-1.5">
          <button
            v-for="tab in accesosVisibles"
            :key="tab.id"
            :ref="(el) => setTabRef(tab.id, el)"
            type="button"
            @click="navegarA(tab.id)"
            class="nav-tab relative flex items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-[13px] tracking-wide select-none"
            :class="[
              seccionActiva === tab.id
                ? 'bg-[#e58a4e]/[0.08] text-[#e58a4e] font-semibold'
                : 'text-stone-400 font-medium hover:text-stone-100'
            ]"
          >
            <component
              :is="tab.icon"
              :size="15"
              class="shrink-0 transition-colors duration-150"
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

      <!-- Lado Derecho: Perfil de Sesión y Salida (solo visible para personal autenticado) -->
      <div v-if="estaAutenticado" class="flex items-center justify-end gap-2.5 sm:gap-3">
        <div class="hidden sm:flex items-center gap-2 rounded-full border border-stone-800 bg-[#17120f] px-3.5 py-2 text-xs text-stone-300">
          <Shield v-if="esAdmin" :size="14" class="text-[#e58a4e]" />
          <Users v-else :size="14" class="text-blue-400" />
          <span class="text-stone-400">Rol:</span>
          <span class="font-bold text-white uppercase text-[11px] tracking-wider">{{ authState.rol }}</span>
        </div>

        <button type="button" @click="cerrarSesion"
          class="nav-action flex items-center gap-1.5 rounded-2xl border border-rose-900/40 bg-rose-950/20 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-950/40 hover:border-rose-900/60"
          title="Cerrar sesión activa">
          <LogOut :size="14" />
          <span>Salir</span>
        </button>
      </div>

    </div>
  </header>

  <p v-if="modoLocal" role="status"
    class="w-full bg-[#7c2d12] px-4 py-2 text-center text-[11px] font-bold text-amber-50 sm:px-8">
    Modo demostración: estás usando una cuenta local, así que lo que cargues queda sólo en este navegador y no llega a la base de datos.
  </p>
</template>

<style scoped>
.nav-tab {
  transition: color 160ms ease, background-color 160ms ease, transform 120ms var(--ease-out);
}

.nav-tab:active,
.nav-action:active {
  transform: scale(0.97);
}

.nav-action {
  transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease, transform 120ms var(--ease-out);
}

.nav-slider {
  transition:
    clip-path 240ms var(--ease-in-out),
    opacity 180ms var(--ease-out);
  will-change: clip-path;
}

@media (hover: hover) and (pointer: fine) {
  .nav-tab:hover {
    background-color: rgba(255, 255, 255, 0.04);
  }
}

@media (prefers-reduced-motion: reduce) {
  .nav-slider {
    transition: opacity 150ms ease;
  }
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
