<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Building2, AlertTriangle, CheckCircle2, Plus,
  Search, X, Check, Edit2, Ban, Users, Clock,
  RefreshCw, AlertCircle
} from 'lucide-vue-next'
import { superAdminService, authState } from '@/services/api'

const router = useRouter()

// Estado
const cargando = ref(true)
const organizaciones = ref([])
const kpis = ref({
  total_organizaciones: 0,
  organizaciones_al_dia: 0,
  organizaciones_en_mora: 0,
  organizaciones_bloqueadas: 0,
  mrr_total: 0,
  deuda_en_mora: 0,
  total_productos: 0,
  total_usuarios: 0,
})

// Filtros y búsqueda
const terminoBusqueda = ref('')
const filtroEstado = ref('todos') // 'todos' | 'al_dia' | 'mora' | 'bloqueado'
const filtroPlan = ref('todos') // 'todos' | 'basico' | 'pro' | 'enterprise'

// Feedback
const mensajeFeedback = ref({ texto: '', tipo: '' })
const guardando = ref(false)

// Modal Crear/Editar Negocio
const modalAbierto = ref(false)
const modoModal = ref('crear') // 'crear' | 'editar'
const errorModal = ref('')

const formOrg = ref({
  id: '',
  nombre: '',
  plan: 'pro',
  monto_mensual: 28000,
  fecha_vencimiento: '',
  estado_suscripcion: 'al_dia',
  bloqueo_mora: false,
  notas_facturacion: '',
  admin_nombre: '',
  admin_email: '',
  admin_password: '',
  telefono: '',
})

// Cargar datos
async function cargarDatos() {
  cargando.value = true
  const [resKpis, resOrgs] = await Promise.all([
    superAdminService.getKpis(),
    superAdminService.getOrganizaciones(),
  ])

  if (resKpis.success && resKpis.data) {
    kpis.value = resKpis.data
  }
  if (resOrgs.success && Array.isArray(resOrgs.data)) {
    organizaciones.value = resOrgs.data
  }
  cargando.value = false
}

onMounted(() => {
  cargarDatos()
})

function notificar(texto, tipo = 'exito') {
  mensajeFeedback.value = { texto, tipo }
  setTimeout(() => {
    if (mensajeFeedback.value.texto === texto) {
      mensajeFeedback.value = { texto: '', tipo: '' }
    }
  }, 4000)
}

// Monto mensual de locales con suscripción al día
const montoAlDia = computed(() =>
  organizaciones.value
    .filter((o) => o.estado_suscripcion === 'al_dia' && !o.bloqueo_mora && !(o.dias_mora > 0))
    .reduce((acc, o) => acc + Number(o.monto_mensual || 0), 0)
)

function seleccionarFiltroTarjeta(estado) {
  if (estado === 'todos') {
    filtroEstado.value = 'todos'
    return
  }
  filtroEstado.value = filtroEstado.value === estado ? 'todos' : estado
}

function claseBordeTarjetaNegocio(org) {
  if (org.bloqueo_mora || org.estado_suscripcion === 'mora' || org.dias_mora > 0) {
    return 'border-rose-500/35 hover:border-rose-500/75'
  }
  if (org.estado_suscripcion === 'pendiente') {
    return 'border-amber-500/35 hover:border-amber-500/75'
  }
  return 'border-stone-800/80 hover:border-emerald-500/75'
}

// Filtrado de negocios
const organizacionesFiltradas = computed(() => {
  const q = terminoBusqueda.value.trim().toLowerCase()
  const lista = organizaciones.value.filter((o) => {
    if (q) {
      const matchNombre = (o.nombre || '').toLowerCase().includes(q)
      const matchEmail = (o.admin_email || '').toLowerCase().includes(q)
      const matchId = (o.id || '').toLowerCase().includes(q)
      if (!matchNombre && !matchEmail && !matchId) return false
    }

    if (filtroPlan.value !== 'todos' && o.plan !== filtroPlan.value) return false

    if (filtroEstado.value === 'al_dia') {
      return o.estado_suscripcion === 'al_dia' && !o.bloqueo_mora && !(o.dias_mora > 0)
    }
    if (filtroEstado.value === 'mora') {
      return o.estado_suscripcion === 'mora' || o.estado_suscripcion === 'pendiente' || o.dias_mora > 0
    }
    if (filtroEstado.value === 'bloqueado') {
      return Boolean(o.bloqueo_mora)
    }
    if (filtroEstado.value === 'facturacion') {
      return Number(o.monto_mensual || 0) > 0
    }

    return true
  })

  if (filtroEstado.value === 'facturacion') {
    return [...lista].sort((a, b) => Number(b.monto_mensual || 0) - Number(a.monto_mensual || 0))
  }

  return lista
})

// Abrir modal para crear negocio
function abrirCrear() {
  modoModal.value = 'crear'
  errorModal.value = ''
  const enUnMes = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  formOrg.value = {
    id: '',
    nombre: '',
    plan: 'pro',
    monto_mensual: 28000,
    fecha_vencimiento: enUnMes,
    estado_suscripcion: 'al_dia',
    bloqueo_mora: false,
    notas_facturacion: '',
    admin_nombre: '',
    admin_email: '',
    admin_password: '',
    telefono: '',
  }
  modalAbierto.value = true
}

// Abrir modal para editar negocio
function abrirEditar(org) {
  modoModal.value = 'editar'
  errorModal.value = ''
  const vencimientoStr = org.fecha_vencimiento ? org.fecha_vencimiento.slice(0, 10) : ''
  formOrg.value = {
    id: org.id,
    nombre: org.nombre || '',
    plan: org.plan || 'pro',
    monto_mensual: org.monto_mensual || 28000,
    fecha_vencimiento: vencimientoStr,
    estado_suscripcion: org.estado_suscripcion || 'al_dia',
    bloqueo_mora: Boolean(org.bloqueo_mora),
    notas_facturacion: org.notas_facturacion || '',
    admin_nombre: org.admin_nombre || '',
    admin_email: org.admin_email || '',
    admin_password: '',
    telefono: org.telefono || '',
  }
  modalAbierto.value = true
}

// Guardar negocio (crear o editar)
async function guardarNegocio() {
  errorModal.value = ''
  const f = formOrg.value

  if (!f.nombre.trim()) {
    errorModal.value = 'El nombre del negocio es obligatorio.'
    return
  }

  guardando.value = true

  if (modoModal.value === 'crear') {
    const res = await superAdminService.crearOrganizacion({
      nombre: f.nombre,
      plan: f.plan,
      monto_mensual: f.monto_mensual,
      fecha_vencimiento: f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toISOString() : undefined,
      estado_suscripcion: f.estado_suscripcion,
      bloqueo_mora: f.bloqueo_mora,
      notas_facturacion: f.notas_facturacion,
      admin_nombre: f.admin_nombre,
      admin_email: f.admin_email,
      admin_password: f.admin_password,
      telefono: f.telefono,
    })
    guardando.value = false

    if (!res.success) {
      errorModal.value = res.message || 'Error al crear el negocio.'
      return
    }

    modalAbierto.value = false
    notificar(`Negocio "${f.nombre}" creado exitosamente.`, 'exito')
    await cargarDatos()
  } else {
    const res = await superAdminService.actualizarOrganizacion(f.id, {
      nombre: f.nombre,
      plan: f.plan,
      monto_mensual: f.monto_mensual,
      fecha_vencimiento: f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toISOString() : undefined,
      estado_suscripcion: f.estado_suscripcion,
      bloqueo_mora: f.bloqueo_mora,
      notas_facturacion: f.notas_facturacion,
    })
    guardando.value = false

    if (!res.success) {
      errorModal.value = res.message || 'Error al actualizar el negocio.'
      return
    }

    modalAbierto.value = false
    notificar(`Suscripción y datos de "${f.nombre}" actualizados.`, 'exito')
    await cargarDatos()
  }
}

// Registrar pago (dejar al día)
async function registrarPago(org) {
  const res = await superAdminService.registrarPago(org.id)
  if (res.success) {
    notificar(`Pago registrado. "${org.nombre}" quedó al día.`, 'exito')
    await cargarDatos()
  } else {
    notificar(res.message || 'Error al registrar el pago.', 'error')
  }
}

// Suspender o reactivar por mora
async function alternarBloqueoMora(org) {
  if (org.bloqueo_mora) {
    // Desbloquear
    const res = await superAdminService.actualizarOrganizacion(org.id, {
      bloqueo_mora: false,
      estado_suscripcion: 'al_dia',
    })
    if (res.success) {
      notificar(`Acceso de "${org.nombre}" reactivado con éxito.`, 'exito')
      await cargarDatos()
    }
  } else {
    // Bloquear por mora
    const res = await superAdminService.suspenderPorMora(org.id)
    if (res.success) {
      notificar(`Acceso de "${org.nombre}" suspendido por falta de pago.`, 'error')
      await cargarDatos()
    }
  }
}

// Conmutar negocio activo para gestionar sus usuarios y configuración
function entrarComoLocal(org) {
  superAdminService.cambiarNegocioActivo(org)
  notificar(`Ahora estás administrando "${org.nombre}". Accediendo a sus usuarios...`, 'exito')
  setTimeout(() => {
    router.push('/usuarios')
  }, 500)
}

function formatearMoneda(monto) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(monto || 0))
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return 'Sin fecha'
  try {
    const d = new Date(fechaStr)
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return 'Fecha inválida'
  }
}

function etiquetaPlan(plan) {
  const mapa = {
    basico: 'Básico',
    pro: 'Pro',
    enterprise: 'Enterprise',
    trial: 'Prueba',
  }
  return mapa[plan] || plan || 'Estándar'
}
</script>

<template>
  <main class="min-h-dvh overflow-x-clip bg-[#0c0a09] px-4 py-6 sm:px-6 lg:px-8 text-[#f5f2eb]">
    <!-- Notificación flotante -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="mensajeFeedback.texto"
        class="fixed top-20 right-4 z-50 flex items-center gap-2.5 rounded-2xl border px-5 py-3.5 text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur-md"
        :class="mensajeFeedback.tipo === 'error'
          ? 'border-rose-500/40 bg-rose-950/90 text-rose-200'
          : 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200'"
      >
        <component :is="mensajeFeedback.tipo === 'error' ? AlertCircle : CheckCircle2" :size="18" class="shrink-0" />
        <span>{{ mensajeFeedback.texto }}</span>
      </div>
    </Transition>

    <div class="mx-auto max-w-[1360px] space-y-6">

      <!-- ENCABEZADO -->
      <section class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-stone-800/70 pb-4 sm:pb-5">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e58a4e]">Administración General</p>
          <h1 class="mt-1 font-girassol text-2xl sm:text-3xl text-white">
            Negocios y Suscripciones
          </h1>
          <p class="hidden sm:block mt-1 text-xs text-stone-400">
            Locales activos, planes contratados y estado de cobro.
          </p>
        </div>

        <div class="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            @click="cargarDatos"
            class="btn-icon-rotate flex shrink-0 items-center justify-center rounded-2xl border border-stone-800 bg-[#14110f] p-2.5 text-stone-400 hover:bg-[#1d1815] hover:text-white hover:border-stone-700"
            title="Refrescar datos"
            aria-label="Refrescar datos"
          >
            <RefreshCw :size="16" :class="{ 'animate-spin': cargando }" />
          </button>

          <button
            type="button"
            @click="abrirCrear"
            class="btn-icon-plus flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-2xl bg-[#e58a4e] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#190d05] hover:bg-[#ed965c]"
          >
            <Plus :size="16" />
            <span>Nuevo Negocio</span>
          </button>
        </div>
      </section>

      <!-- INDICADORES INTERACTIVOS (FILTROS POR TARJETA: 2x2 en móvil, 4 en desktop) -->
      <section class="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <!-- Tarjeta 1: Todos los negocios (#e58a4e) -->
        <button
          type="button"
          @click="seleccionarFiltroTarjeta('todos')"
          :aria-pressed="filtroEstado === 'todos'"
          class="cursor-pointer rounded-2xl border px-3 py-3 sm:px-4 sm:py-3.5 text-left"
          :class="filtroEstado === 'todos'
            ? 'border-[#e58a4e] bg-[#e58a4e]/[0.06]'
            : 'border-stone-800/80 bg-[#14110f] hover:border-[#e58a4e]/80'"
        >
          <span class="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium" :class="filtroEstado === 'todos' ? 'text-[#e58a4e]' : 'text-stone-400'">
            <span class="h-1.5 w-1.5 rounded-full bg-[#e58a4e] shrink-0" />
            <span class="truncate">Negocios</span>
          </span>
          <div class="mt-1 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <span class="text-xl sm:text-2xl font-bold text-white tabular-nums">{{ kpis.total_organizaciones }}</span>
            <span class="text-[10px] sm:text-[11px] font-medium text-stone-400 tabular-nums">
              {{ kpis.total_usuarios }} usr · {{ kpis.total_productos }} pl.
            </span>
          </div>
        </button>

        <!-- Tarjeta 2: Al día (emerald) -->
        <button
          type="button"
          @click="seleccionarFiltroTarjeta('al_dia')"
          :aria-pressed="filtroEstado === 'al_dia'"
          class="cursor-pointer rounded-2xl border px-3 py-3 sm:px-4 sm:py-3.5 text-left"
          :class="filtroEstado === 'al_dia'
            ? 'border-emerald-500 bg-emerald-950/20'
            : 'border-stone-800/80 bg-[#14110f] hover:border-emerald-500/80'"
        >
          <span class="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium" :class="filtroEstado === 'al_dia' ? 'text-emerald-300' : 'text-stone-400'">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span class="truncate">Al día</span>
          </span>
          <div class="mt-1 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <span class="text-xl sm:text-2xl font-bold text-emerald-400 tabular-nums">{{ kpis.organizaciones_al_dia }}</span>
            <span class="text-[10px] sm:text-[11px] font-medium text-emerald-300/90 tabular-nums">
              {{ montoAlDia > 0 ? `${formatearMoneda(montoAlDia)} cobrados` : 'sin deuda activa' }}
            </span>
          </div>
        </button>

        <!-- Tarjeta 3: En mora / pendientes (rose) -->
        <button
          type="button"
          @click="seleccionarFiltroTarjeta('mora')"
          :aria-pressed="filtroEstado === 'mora'"
          class="cursor-pointer rounded-2xl border px-3 py-3 sm:px-4 sm:py-3.5 text-left"
          :class="filtroEstado === 'mora'
            ? 'border-rose-500 bg-rose-950/20'
            : 'border-stone-800/80 bg-[#14110f] hover:border-rose-500/80'"
        >
          <span class="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium" :class="filtroEstado === 'mora' || kpis.organizaciones_en_mora > 0 ? 'text-rose-300' : 'text-stone-400'">
            <span class="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
            <span class="truncate">En mora</span>
          </span>
          <div class="mt-1 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <span class="text-xl sm:text-2xl font-bold text-rose-400 tabular-nums">
              {{ kpis.organizaciones_en_mora }}
            </span>
            <span class="text-[10px] sm:text-[11px] font-medium text-rose-300/90 tabular-nums">
              {{ kpis.deuda_en_mora > 0 ? `${formatearMoneda(kpis.deuda_en_mora)} adeud.` : 'sin deuda' }}
            </span>
          </div>
        </button>

        <!-- Tarjeta 4: Facturación mensual (amber) -->
        <button
          type="button"
          @click="seleccionarFiltroTarjeta('facturacion')"
          :aria-pressed="filtroEstado === 'facturacion'"
          class="cursor-pointer rounded-2xl border px-3 py-3 sm:px-4 sm:py-3.5 text-left"
          :class="filtroEstado === 'facturacion'
            ? 'border-amber-400 bg-amber-950/20'
            : 'border-stone-800/80 bg-[#14110f] hover:border-amber-400/80'"
        >
          <span class="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium" :class="filtroEstado === 'facturacion' ? 'text-amber-300' : 'text-stone-400'">
            <span class="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span class="truncate">Facturación</span>
          </span>
          <div class="mt-1 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <span class="text-xl sm:text-2xl font-bold text-amber-400 tabular-nums">{{ formatearMoneda(kpis.mrr_total) }}</span>
            <span class="text-[10px] sm:text-[11px] font-medium text-stone-400 tabular-nums">
              {{ kpis.total_organizaciones }} abonos
            </span>
          </div>
        </button>
      </section>

      <!-- BUSCADOR Y FILTROS -->
      <section class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="relative flex-1 max-w-md">
          <Search :size="15" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            v-model="terminoBusqueda"
            type="text"
            placeholder="Buscar negocio o correo..."
            class="w-full rounded-2xl border border-stone-800 bg-[#14110f] py-2.5 pl-10 pr-8 text-xs sm:text-sm text-white placeholder-stone-500 outline-none transition-colors duration-150 focus:border-[#e58a4e]"
          />
          <button
            v-if="terminoBusqueda"
            type="button"
            @click="terminoBusqueda = ''"
            class="btn-inline-clear absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200"
            aria-label="Limpiar búsqueda"
          >
            <X :size="14" />
          </button>
        </div>

        <div class="flex w-full sm:w-auto max-w-full overflow-x-auto no-scrollbar items-center gap-1 rounded-2xl border border-stone-800/80 bg-[#14110f] p-1 text-xs">
          <button
            type="button"
            @click="filtroEstado = 'todos'"
            class="btn-filter whitespace-nowrap rounded-xl px-3 py-1.5 font-semibold"
            :class="filtroEstado === 'todos' ? 'bg-[#e58a4e] text-[#190d05]' : 'text-stone-400 hover:bg-stone-800/60 hover:text-white'"
          >
            Todos ({{ organizaciones.length }})
          </button>
          <button
            type="button"
            @click="filtroEstado = 'al_dia'"
            class="btn-filter whitespace-nowrap rounded-xl px-3 py-1.5 font-semibold"
            :class="filtroEstado === 'al_dia' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:bg-stone-800/60 hover:text-white'"
          >
            Al día
          </button>
          <button
            type="button"
            @click="filtroEstado = 'mora'"
            class="btn-filter whitespace-nowrap rounded-xl px-3 py-1.5 font-semibold"
            :class="filtroEstado === 'mora' ? 'bg-rose-600 text-white' : 'text-rose-400 hover:bg-rose-950/40'"
          >
            En mora
          </button>
          <button
            type="button"
            @click="filtroEstado = 'bloqueado'"
            class="btn-filter whitespace-nowrap rounded-xl px-3 py-1.5 font-semibold"
            :class="filtroEstado === 'bloqueado' ? 'bg-stone-700 text-white' : 'text-stone-400 hover:bg-stone-800/60 hover:text-white'"
          >
            Suspendidos
          </button>
        </div>
      </section>

      <!-- GRILLA DE TARJETAS DE NEGOCIOS -->
      <section v-if="organizacionesFiltradas.length" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="org in organizacionesFiltradas"
          :key="org.id"
          class="flex flex-col justify-between rounded-2xl border bg-[#14110f] p-5 transition-colors duration-200"
          :class="claseBordeTarjetaNegocio(org)"
        >
          <!-- Cabecera de tarjeta -->
          <div>
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="truncate text-base font-bold text-white">
                    {{ org.nombre }}
                  </h2>
                  <span
                    v-if="org.id === authState.organizacion?.id"
                    class="rounded-full bg-[#e58a4e]/15 px-2 py-0.5 text-[10px] font-semibold text-[#e58a4e]"
                  >
                    Activo
                  </span>
                </div>
                <p class="mt-0.5 truncate text-xs text-stone-400">
                  {{ org.admin_nombre || org.admin_email || 'Sin encargado asignado' }}
                </p>
              </div>

              <!-- Badge único de estado -->
              <span
                v-if="org.bloqueo_mora"
                class="shrink-0 inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/50 px-2.5 py-1 text-[11px] font-semibold text-rose-300"
              >
                <Ban :size="11" />
                <span>Suspendido</span>
              </span>
              <span
                v-else-if="org.estado_suscripcion === 'mora' || org.dias_mora > 0"
                class="shrink-0 inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/40 px-2.5 py-1 text-[11px] font-semibold text-rose-300"
              >
                <AlertTriangle :size="11" />
                <span>En mora · {{ org.dias_mora || 1 }}d</span>
              </span>
              <span
                v-else-if="org.estado_suscripcion === 'pendiente'"
                class="shrink-0 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-300"
              >
                <Clock :size="11" />
                <span>Pendiente</span>
              </span>
              <span
                v-else
                class="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-semibold text-emerald-300"
              >
                <CheckCircle2 :size="11" />
                <span>Al día</span>
              </span>
            </div>

            <!-- Plan y vencimiento -->
            <div class="mt-4 grid grid-cols-2 gap-3 border-t border-stone-800/50 pt-4 text-xs">
              <div>
                <span class="block text-[11px] text-stone-500">Plan {{ etiquetaPlan(org.plan) }}</span>
                <span class="mt-0.5 block font-bold text-stone-100 tabular-nums">
                  {{ formatearMoneda(org.monto_mensual) }}<span class="text-[11px] font-normal text-stone-500">/mes</span>
                </span>
              </div>

              <div>
                <span class="block text-[11px] text-stone-500">Vencimiento</span>
                <span
                  class="mt-0.5 block font-semibold tabular-nums"
                  :class="org.dias_mora > 0 ? 'text-rose-300' : 'text-stone-200'"
                >
                  {{ formatearFecha(org.fecha_vencimiento) }}
                </span>
              </div>
            </div>

            <!-- Nota opcional -->
            <p
              v-if="org.notas_facturacion"
              class="mt-3 line-clamp-1 text-xs text-stone-400"
              :title="org.notas_facturacion"
            >
              {{ org.notas_facturacion }}
            </p>
          </div>

          <!-- Pie con acciones limpias -->
          <div class="mt-4 flex items-center justify-between gap-2 border-t border-stone-800/60 pt-3.5">
            <div class="flex items-center gap-1.5">
              <button
                v-if="org.estado_suscripcion !== 'al_dia' || org.dias_mora > 0"
                type="button"
                @click="registrarPago(org)"
                class="inline-flex items-center gap-1 rounded-xl bg-emerald-600/90 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500"
                title="Registrar pago y prorrogar 30 días"
              >
                <Check :size="12" />
                <span>Cobrado</span>
              </button>

              <button
                type="button"
                @click="entrarComoLocal(org)"
                class="btn-icon-shift inline-flex items-center gap-1.5 rounded-xl border border-stone-800 bg-[#17120f] px-2.5 py-1.5 text-[11px] font-semibold text-stone-300 hover:bg-[#e58a4e]/10 hover:border-[#e58a4e]/50 hover:text-[#e58a4e]"
                title="Administrar usuarios de este negocio"
              >
                <Users :size="12" />
                <span>Usuarios</span>
              </button>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="alternarBloqueoMora(org)"
                class="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold"
                :class="org.bloqueo_mora
                  ? 'border border-emerald-600/50 bg-emerald-950/35 text-emerald-300 hover:bg-emerald-900/45'
                  : 'border border-rose-900/50 bg-rose-950/20 text-rose-300 hover:bg-rose-950/45'"
                :title="org.bloqueo_mora ? 'Reactivar acceso' : 'Suspender acceso por mora'"
              >
                <Ban :size="12" />
                <span>{{ org.bloqueo_mora ? 'Reactivar' : 'Suspender' }}</span>
              </button>

              <button
                type="button"
                @click="abrirEditar(org)"
                class="rounded-xl border border-stone-800 bg-[#17120f] p-1.5 text-stone-400 hover:bg-[#1e1814] hover:border-stone-700 hover:text-white"
                title="Editar negocio y suscripción"
                aria-label="Editar negocio y suscripción"
              >
                <Edit2 :size="13" />
              </button>
            </div>
          </div>
        </article>
      </section>

      <!-- ESTADO VACÍO -->
      <section
        v-else
        class="rounded-2xl border border-stone-800/70 bg-[#14110f] px-6 py-12 text-center"
      >
        <Building2 :size="24" class="mx-auto text-stone-600" />
        <p class="mt-2.5 text-sm font-medium text-stone-300">
          No hay negocios que coincidan con los filtros seleccionados.
        </p>
      </section>

    </div>

    <!-- MODAL CREAR / EDITAR NEGOCIO -->
    <div
      v-if="modalAbierto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5"
      @click.self="modalAbierto = false"
    >
      <div class="flex max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-stone-800 bg-[#17120f] text-white shadow-2xl">
        <div class="shrink-0 flex items-start justify-between border-b border-stone-800/80 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#e58a4e]">
              {{ modoModal === 'crear' ? 'Nuevo Local' : 'Administración de Negocio' }}
            </span>
            <h2 class="text-xl font-bold font-girassol text-white mt-0.5">
              {{ modoModal === 'crear' ? 'Dar de Alta Restaurante' : `Editar ${formOrg.nombre}` }}
            </h2>
          </div>
          <button
            type="button"
            @click="modalAbierto = false"
            class="rounded-xl border border-stone-800 bg-[#110d0b] p-1.5 text-stone-400 hover:bg-[#1a1410] hover:border-stone-700 hover:text-white"
            aria-label="Cerrar modal"
          >
            <X :size="16" />
          </button>
        </div>

        <form @submit.prevent="guardarNegocio" class="flex min-h-0 flex-1 flex-col text-xs">
          <div class="flex-1 overflow-y-auto px-5 py-3.5 sm:px-6 sm:py-4 space-y-3">
            <div v-if="errorModal" class="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300">
              {{ errorModal }}
            </div>
          <!-- Nombre del Negocio -->
          <div>
            <label class="block font-semibold text-stone-300">Nombre del Restaurante / Negocio *</label>
            <input
              v-model="formOrg.nombre"
              type="text"
              required
              placeholder="Ej: Parrilla Don Julio"
              class="mt-1 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2.5 text-xs text-white placeholder-stone-500 outline-none focus:border-[#e58a4e] transition"
            />
          </div>

          <!-- Plan y Cuota Mensual -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-stone-300">Plan de Suscripción</label>
              <select
                v-model="formOrg.plan"
                class="mt-1 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3 py-2.5 text-xs text-white outline-none focus:border-[#e58a4e] transition"
              >
                <option value="basico">Básico ($18.000 / mes)</option>
                <option value="pro">Pro ($28.000 / mes)</option>
                <option value="enterprise">Enterprise ($45.000 / mes)</option>
                <option value="trial">Prueba Gratuita</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-stone-300">Monto Mensual ($ ARS)</label>
              <input
                v-model="formOrg.monto_mensual"
                type="number"
                min="0"
                step="500"
                required
                class="mt-1 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#e58a4e] transition"
              />
            </div>
          </div>

          <!-- Estado de la Suscripción y Vencimiento -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-stone-300">Estado de Pago</label>
              <select
                v-model="formOrg.estado_suscripcion"
                class="mt-1 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3 py-2.5 text-xs text-white outline-none focus:border-[#e58a4e] transition"
              >
                <option value="al_dia">✅ Suscripción Al Día</option>
                <option value="pendiente">⏳ Pago Pendiente</option>
                <option value="mora">⚠️ En Mora / Vencido</option>
              </select>
            </div>

            <div>
              <label class="block font-semibold text-stone-300">Fecha de Vencimiento</label>
              <input
                v-model="formOrg.fecha_vencimiento"
                type="date"
                required
                class="mt-1 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3 py-2.5 text-xs text-white outline-none focus:border-[#e58a4e] transition"
              />
            </div>
          </div>

          <!-- Bloqueo preventivo por mora -->
          <div class="rounded-xl border border-stone-800 bg-[#110d0b] p-3">
            <label class="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                v-model="formOrg.bloqueo_mora"
                class="rounded border-stone-700 text-rose-500 focus:ring-0"
              />
              <div>
                <span class="block font-bold text-xs" :class="formOrg.bloqueo_mora ? 'text-rose-400' : 'text-stone-300'">
                  Suspender acceso por falta de pago
                </span>
                <span class="block text-[11px] text-stone-400">
                  Bloquea las funciones del restaurante hasta que se registre la regularización de la suscripción.
                </span>
              </div>
            </label>
          </div>

          <!-- Datos de administrador inicial si es creación -->
          <div v-if="modoModal === 'crear'" class="space-y-3 pt-2 border-t border-stone-800/80">
            <p class="text-[11px] font-bold uppercase tracking-wider text-[#e58a4e]">
              Usuario Administrador del Local
            </p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-stone-300">Nombre del Dueño</label>
                <input
                  v-model="formOrg.admin_nombre"
                  type="text"
                  placeholder="Ej: Marcelo Gallardo"
                  class="mt-1 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3 py-2 text-xs text-white outline-none focus:border-[#e58a4e] transition"
                />
              </div>
              <div>
                <label class="block font-semibold text-stone-300">Teléfono / WhatsApp</label>
                <input
                  v-model="formOrg.telefono"
                  type="text"
                  placeholder="+54 11 0000-0000"
                  class="mt-1 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3 py-2 text-xs text-white outline-none focus:border-[#e58a4e] transition"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold text-stone-300">Email de Ingreso</label>
                <input
                  v-model="formOrg.admin_email"
                  type="email"
                  placeholder="dueño@restaurante.com"
                  class="mt-1 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3 py-2 text-xs text-white outline-none focus:border-[#e58a4e] transition"
                />
              </div>
              <div>
                <label class="block font-semibold text-stone-300">Contraseña Inicial</label>
                <input
                  v-model="formOrg.admin_password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  class="mt-1 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3 py-2 text-xs text-white outline-none focus:border-[#e58a4e] transition"
                />
              </div>
            </div>
          </div>

            <!-- Notas internas de facturación -->
            <div>
              <label class="block font-semibold text-stone-300">Notas de Facturación / Cobranzas</label>
              <textarea
                v-model="formOrg.notas_facturacion"
                rows="2"
                placeholder="Ej: Pago pendiente de confirmación por transferencia bancaria..."
                class="mt-1 w-full resize-none rounded-xl border border-stone-800 bg-[#110d0b] p-2.5 text-xs text-white outline-none focus:border-[#e58a4e] transition"
              />
            </div>
          </div>

          <div class="shrink-0 flex items-center justify-end gap-3 border-t border-stone-800/80 px-5 py-3 sm:px-6 bg-[#17120f]">
            <button
              type="button"
              @click="modalAbierto = false"
              class="rounded-xl border border-stone-800 bg-[#110d0b] px-4 py-2 text-xs font-semibold text-stone-300 hover:bg-[#1a1410] hover:border-stone-700 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="guardando"
              class="flex items-center gap-1.5 rounded-xl bg-[#e58a4e] px-5 py-2 text-xs font-bold text-[#190d05] hover:bg-[#ed965c] disabled:opacity-50"
            >
              <Check :size="14" />
              <span>{{ guardando ? 'Guardando...' : (modoModal === 'crear' ? 'Dar de Alta Negocio' : 'Guardar Cambios') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>

