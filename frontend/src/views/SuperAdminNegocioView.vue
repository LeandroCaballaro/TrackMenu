<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import {
  ArrowLeft, Building2, Check, AlertCircle, CheckCircle2,
  Calendar, DollarSign, ShieldAlert, CreditCard, Ban,
  FileText, User, Mail, Phone, Lock, Eye, EyeOff, Trash2,
  Clock, AlertTriangle, ExternalLink, Sparkles, Award, Layers
} from 'lucide-vue-next'
import Combobox from '@/components/Combobox.vue'
import DatePicker from '@/components/DatePicker.vue'
import { superAdminService, authState } from '@/services/api'

const route = useRoute()
const router = useRouter()

const modo = computed(() => route.meta.modo || (route.params.id ? 'editar' : 'nuevo'))
const negocioId = computed(() => route.params.id)

// Estado del formulario
const cargando = ref(true)
const guardando = ref(false)
const eliminando = ref(false)
const confirmarEliminar = ref(false)
const mostrarPassword = ref(false)
const mensajeFeedback = ref({ texto: '', tipo: '' })
const errorFormulario = ref('')

const form = ref({
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
  dias_mora: 0,
  creado_en: null,
})

// Opciones enriquecidas para Combobox reutilizable
const opcionesPlan = [
  { value: 'basico', label: 'Básico ($18.000 / mes)', description: 'Hasta 10 mesas y funciones esenciales', icon: Sparkles },
  { value: 'pro', label: 'Pro ($28.000 / mes)', description: 'Mesas ilimitadas, métricas y reportes', icon: Award },
  { value: 'enterprise', label: 'Enterprise ($45.000 / mes)', description: 'Soporte prioritario y multi-sucursal', icon: Layers },
  { value: 'trial', label: 'Prueba Gratuita', description: 'Acceso temporal de evaluación sin costo', icon: Clock },
]

const opcionesEstadoPago = [
  { value: 'al_dia', label: 'Suscripción Al Día', icon: CheckCircle2, description: 'Comprobante acreditado y acceso habilitado' },
  { value: 'pendiente', label: 'Pago Pendiente', icon: Clock, description: 'Vencimiento próximo o transferencia en revisión' },
  { value: 'mora', label: 'En Mora / Vencido', icon: AlertTriangle, description: 'Fecha de pago superada sin regularizar' },
]

// Auto-ajustar monto sugerido al cambiar de plan si es nuevo
function alCambiarPlan(nuevoPlan) {
  const plan = nuevoPlan || form.value.plan
  if (modo.value === 'nuevo') {
    if (plan === 'basico') form.value.monto_mensual = 18000
    else if (plan === 'pro') form.value.monto_mensual = 28000
    else if (plan === 'enterprise') form.value.monto_mensual = 45000
    else if (plan === 'trial') form.value.monto_mensual = 0
  }
}

async function cargarDatos() {
  if (modo.value === 'nuevo') {
    const enUnMes = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    form.value = {
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
      dias_mora: 0,
      creado_en: null,
    }
    cargando.value = false
    return
  }

  cargando.value = true
  const res = await superAdminService.getOrganizacionById(negocioId.value)
  if (res.success && res.data) {
    const org = res.data
    const vencimientoStr = org.fecha_vencimiento ? org.fecha_vencimiento.slice(0, 10) : ''
    form.value = {
      id: org.id,
      nombre: org.nombre || '',
      plan: org.plan || 'pro',
      monto_mensual: Number(org.monto_mensual || 28000),
      fecha_vencimiento: vencimientoStr,
      estado_suscripcion: org.estado_suscripcion || 'al_dia',
      bloqueo_mora: Boolean(org.bloqueo_mora),
      notas_facturacion: org.notas_facturacion || '',
      admin_nombre: org.admin_nombre || '',
      admin_email: org.admin_email || '',
      admin_password: '',
      telefono: org.telefono || '',
      dias_mora: org.dias_mora || 0,
      creado_en: org.creado_en || null,
    }
  } else {
    notificar(res.message || 'No se encontró la organización.', 'error')
    setTimeout(() => {
      router.push('/superadmin')
    }, 2000)
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

async function guardarNegocio() {
  errorFormulario.value = ''
  const f = form.value

  if (!f.nombre.trim()) {
    errorFormulario.value = 'El nombre del negocio es obligatorio.'
    return
  }

  if (f.monto_mensual === undefined || f.monto_mensual === null || f.monto_mensual < 0) {
    errorFormulario.value = 'El monto mensual debe ser un número mayor o igual a 0.'
    return
  }

  if (!f.fecha_vencimiento) {
    errorFormulario.value = 'Indicá la fecha de vencimiento de la suscripción.'
    return
  }

  guardando.value = true

  if (modo.value === 'nuevo') {
    if (f.admin_email && (!f.admin_email.includes('@') || !f.admin_email.includes('.'))) {
      errorFormulario.value = 'Ingresá un correo electrónico válido para el administrador.'
      guardando.value = false
      return
    }

    if (f.admin_email && (!f.admin_password || f.admin_password.length < 8)) {
      errorFormulario.value = 'Si indicás un usuario administrador, la contraseña debe tener al menos 8 caracteres.'
      guardando.value = false
      return
    }

    const res = await superAdminService.crearOrganizacion({
      nombre: f.nombre.trim(),
      plan: f.plan,
      monto_mensual: f.monto_mensual,
      fecha_vencimiento: f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toISOString() : undefined,
      estado_suscripcion: f.estado_suscripcion,
      bloqueo_mora: f.bloqueo_mora,
      notas_facturacion: f.notas_facturacion.trim(),
      admin_nombre: f.admin_nombre.trim(),
      admin_email: f.admin_email.trim(),
      admin_password: f.admin_password,
      telefono: f.telefono.trim(),
    })
    guardando.value = false

    if (!res.success) {
      errorFormulario.value = res.message || 'Error al crear el restaurante.'
      return
    }

    notificar(`Negocio "${f.nombre}" creado exitosamente.`, 'exito')
    setTimeout(() => {
      router.push('/superadmin')
    }, 1200)
  } else {
    const res = await superAdminService.actualizarOrganizacion(f.id, {
      nombre: f.nombre.trim(),
      plan: f.plan,
      monto_mensual: f.monto_mensual,
      fecha_vencimiento: f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toISOString() : undefined,
      estado_suscripcion: f.estado_suscripcion,
      bloqueo_mora: f.bloqueo_mora,
      notas_facturacion: f.notas_facturacion.trim(),
    })
    guardando.value = false

    if (!res.success) {
      errorFormulario.value = res.message || 'Error al actualizar el negocio.'
      return
    }

    notificar(`Suscripción y datos de "${f.nombre}" guardados.`, 'exito')
    await cargarDatos()
  }
}

async function registrarPagoRapido() {
  if (!form.value.id) return
  guardando.value = true
  const res = await superAdminService.registrarPago(form.value.id)
  guardando.value = false
  if (res.success) {
    notificar('Pago registrado: suscripción al día por 30 días.', 'exito')
    await cargarDatos()
  } else {
    notificar(res.message || 'Error al registrar el pago.', 'error')
  }
}

async function alternarBloqueo() {
  if (!form.value.id) return
  const nuevoBloqueo = !form.value.bloqueo_mora
  guardando.value = true
  const res = await superAdminService.actualizarOrganizacion(form.value.id, {
    bloqueo_mora: nuevoBloqueo,
    estado_suscripcion: nuevoBloqueo ? 'mora' : form.value.estado_suscripcion,
  })
  guardando.value = false
  if (res.success) {
    notificar(nuevoBloqueo ? 'Acceso suspendido preventivamente.' : 'Acceso restaurado.', 'exito')
    await cargarDatos()
  } else {
    notificar(res.message || 'Error al modificar estado.', 'error')
  }
}

function cambiarNegocioActivo() {
  if (!form.value.id) return
  superAdminService.cambiarNegocioActivo({
    id: form.value.id,
    nombre: form.value.nombre,
  })
  notificar(`Conectado al entorno de ${form.value.nombre}`, 'exito')
  setTimeout(() => {
    router.push('/productos')
  }, 900)
}

async function ejecutarBajaNegocio() {
  if (!form.value.id) return
  eliminando.value = true
  const res = await superAdminService.eliminarOrganizacion(form.value.id)
  eliminando.value = false

  if (!res.success) {
    errorFormulario.value = res.message || 'No se pudo eliminar el negocio.'
    return
  }

  notificar('Restaurante eliminado del sistema SaaS.', 'exito')
  setTimeout(() => {
    router.push('/superadmin')
  }, 1000)
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return 'No definida'
  try {
    const d = new Date(fechaStr)
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return fechaStr
  }
}
</script>

<template>
  <main class="min-h-dvh overflow-x-clip bg-[#0c0a09] px-4 py-6 sm:px-6 lg:px-8 text-[#f5f2eb]">
    <!-- Notificación flotante de confirmación -->
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

    <div class="mx-auto max-w-5xl space-y-6">
      <!-- BARRA SUPERIOR DE NAVEGACIÓN -->
      <nav class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-800/80 pb-4" aria-label="Navegación de retorno">
        <div class="flex items-center gap-3 flex-wrap">
          <RouterLink
            to="/superadmin"
            class="inline-flex items-center gap-2 rounded-xl border border-stone-800 bg-[#17120f] px-3.5 py-2 text-xs font-semibold text-stone-300 transition hover:bg-[#221a15] hover:text-[#e58a4e] hover:border-[#e58a4e]/40"
          >
            <ArrowLeft :size="15" />
            <span>Volver a Negocios</span>
          </RouterLink>

          <div class="hidden md:flex items-center gap-2 text-xs text-stone-500">
            <span>·</span>
            <span class="text-stone-400">
              {{ modo === 'nuevo' ? 'Alta de Nuevo Restaurante' : (form.nombre || 'Administración de Negocio') }}
            </span>
          </div>
        </div>

        <!-- Botones de Acción Rápidos en el Header -->
        <div class="flex items-center gap-2.5 w-full sm:w-auto">
          <RouterLink
            to="/superadmin"
            class="flex-1 sm:flex-initial text-center rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2 text-xs font-semibold text-stone-400 hover:text-white transition"
          >
            Cancelar
          </RouterLink>

          <button
            type="button"
            :disabled="guardando"
            @click="guardarNegocio"
            class="flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl bg-[#e58a4e] px-4 py-2 text-xs font-bold text-[#190d05] transition hover:bg-[#ee975e] active:scale-[0.98] disabled:opacity-50"
          >
            <Check :size="14" />
            <span>{{ guardando ? 'Guardando...' : (modo === 'nuevo' ? 'Dar de Alta Negocio' : 'Guardar Cambios') }}</span>
          </button>
        </div>
      </nav>

      <!-- SPINNER SI ESTÁ CARGANDO -->
      <div v-if="cargando" class="flex flex-col items-center justify-center py-20 text-stone-400 space-y-3">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-[#e58a4e] border-t-transparent"></div>
        <p class="text-xs font-semibold">Cargando información del negocio...</p>
      </div>

      <div v-else class="space-y-6">
        <!-- HEADER VISUAL DEL NEGOCIO -->
        <section class="rounded-3xl border border-stone-800/80 bg-gradient-to-br from-[#17120f] to-[#120d0b] p-4 sm:p-7 shadow-xl">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-3.5 sm:gap-5 min-w-0">
              <div
                class="flex h-14 w-14 sm:h-18 sm:w-18 shrink-0 items-center justify-center rounded-2xl sm:rounded-3xl shadow-lg border"
                :class="form.bloqueo_mora || form.estado_suscripcion === 'mora'
                  ? 'border-rose-500/40 bg-gradient-to-br from-rose-950/60 to-rose-900/30 text-rose-300'
                  : 'border-[#e58a4e]/40 bg-gradient-to-br from-[#e58a4e]/20 to-[#17120f] text-[#e58a4e]'"
              >
                <Building2 :size="28" />
              </div>

              <div class="space-y-1.5 min-w-0">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e58a4e]">
                    {{ modo === 'nuevo' ? 'Plataforma SaaS · Nuevo Restaurante' : 'Administración de Negocio' }}
                  </span>
                  <span
                    v-if="form.bloqueo_mora"
                    class="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/70 px-2.5 py-0.5 text-[10px] font-bold text-rose-300 uppercase tracking-wider"
                  >
                    <Ban :size="10" />
                    Acceso Suspendido
                  </span>
                  <span
                    v-else-if="form.estado_suscripcion === 'al_dia'"
                    class="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/70 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider"
                  >
                    <CheckCircle2 :size="10" />
                    Al Día
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/70 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 uppercase tracking-wider"
                  >
                    <Clock :size="10" />
                    {{ form.dias_mora > 0 ? `${form.dias_mora}d en Mora` : 'Pago Pendiente' }}
                  </span>
                </div>

                <h1 class="font-girassol text-2xl sm:text-3xl font-normal text-white break-words">
                  {{ modo === 'nuevo' ? 'Dar de Alta Restaurante' : (form.nombre || 'Restaurante') }}
                </h1>

                <p v-if="form.id" class="text-xs text-stone-400">
                  ID: <span class="font-mono text-stone-300">{{ form.id }}</span> · Cuota actual: <span class="font-semibold text-stone-200">${{ Number(form.monto_mensual || 0).toLocaleString('es-AR') }} / mes</span>
                </p>
              </div>
            </div>

            <!-- Acciones rápidas (si es edición) -->
            <div v-if="modo === 'editar'" class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                @click="registrarPagoRapido"
                :disabled="guardando"
                class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/40 hover:border-emerald-500 transition disabled:opacity-50"
                title="Registrar cobro y prorrogar 30 días"
              >
                <CheckCircle2 :size="13" />
                <span>Cobro Registrado</span>
              </button>

              <button
                type="button"
                @click="alternarBloqueo"
                :disabled="guardando"
                class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-50"
                :class="form.bloqueo_mora
                  ? 'border border-emerald-600/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/40'
                  : 'border border-rose-900/50 bg-rose-950/20 text-rose-300 hover:bg-rose-950/45'"
              >
                <Ban :size="13" />
                <span>{{ form.bloqueo_mora ? 'Reactivar Acceso' : 'Suspender Acceso' }}</span>
              </button>

              <button
                type="button"
                @click="cambiarNegocioActivo"
                class="inline-flex items-center gap-1.5 rounded-xl border border-stone-800 bg-[#14110f] px-3 py-2 text-xs font-semibold text-stone-300 hover:text-[#e58a4e] hover:border-[#e58a4e]/40 transition"
                title="Cambiar la sesión a este restaurante para inspeccionar su carta y mesas"
              >
                <ExternalLink :size="13" />
                <span>Ingresar</span>
              </button>
            </div>
          </div>
        </section>

        <!-- FORMULARIO PRINCIPAL -->
        <form @submit.prevent="guardarNegocio" class="space-y-6">
          <!-- Mensaje de error general si falló la validación -->
          <div
            v-if="errorFormulario"
            class="flex items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 text-xs sm:text-sm font-medium text-rose-300"
          >
            <AlertCircle :size="18" class="shrink-0 text-rose-400" />
            <span>{{ errorFormulario }}</span>
          </div>

          <!-- BLOQUE 1: DATOS GENERALES -->
          <section class="rounded-3xl border border-stone-800/80 bg-[#14110f] p-5 sm:p-7 space-y-5">
            <div class="flex items-center gap-2.5 border-b border-stone-800/80 pb-3">
              <Building2 :size="16" class="text-[#e58a4e]" />
              <h2 class="text-sm font-bold uppercase tracking-wider text-stone-200">
                Información del Restaurante
              </h2>
            </div>

            <div>
              <label class="block text-xs font-semibold text-stone-300">
                Nombre del Restaurante / Negocio <span class="text-[#e58a4e]">*</span>
              </label>
              <input
                v-model="form.nombre"
                type="text"
                required
                placeholder="Ej: Parrilla Don Julio o Cervecería Patagonia"
                class="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#110d0b] px-4 py-3 text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e] focus:ring-1 focus:ring-[#e58a4e]"
              />
            </div>
          </section>

          <!-- BLOQUE 2: PLAN Y SUSCRIPCIÓN -->
          <section class="rounded-3xl border border-stone-800/80 bg-[#14110f] p-5 sm:p-7 space-y-5">
            <div class="flex items-center gap-2.5 border-b border-stone-800/80 pb-3">
              <CreditCard :size="16" class="text-[#e58a4e]" />
              <h2 class="text-sm font-bold uppercase tracking-wider text-stone-200">
                Plan SaaS y Facturación
              </h2>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-xs font-semibold text-stone-300 mb-1.5">Plan de Suscripción</label>
                <Combobox
                  v-model="form.plan"
                  :options="opcionesPlan"
                  size="md"
                  @change="alCambiarPlan"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-stone-300">Monto Mensual ($ ARS)</label>
                <div class="relative mt-1.5">
                  <span class="absolute inset-y-0 left-0 flex items-center pl-4 text-stone-400 text-sm">$</span>
                  <input
                    v-model.number="form.monto_mensual"
                    type="number"
                    min="0"
                    step="500"
                    required
                    class="w-full rounded-2xl border border-stone-800 bg-[#110d0b] pl-8 pr-4 py-3 text-sm text-white outline-none transition focus:border-[#e58a4e]"
                  />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-xs font-semibold text-stone-300 mb-1.5">Estado de Pago</label>
                <Combobox
                  v-model="form.estado_suscripcion"
                  :options="opcionesEstadoPago"
                  size="md"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-stone-300 mb-1.5">Fecha de Vencimiento</label>
                <DatePicker
                  v-model="form.fecha_vencimiento"
                  size="md"
                  required
                />
              </div>
            </div>

            <!-- Suspender acceso por falta de pago -->
            <div
              class="rounded-2xl border p-4 transition"
              :class="form.bloqueo_mora
                ? 'border-rose-500/40 bg-rose-950/20'
                : 'border-stone-800 bg-[#110d0b]'"
            >
              <label class="flex items-start gap-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="form.bloqueo_mora"
                  class="mt-1 h-4 w-4 rounded border-stone-700 text-rose-500 focus:ring-0"
                />
                <div class="space-y-1">
                  <span
                    class="block font-bold text-sm"
                    :class="form.bloqueo_mora ? 'text-rose-300' : 'text-stone-200'"
                  >
                    Suspender acceso por falta de pago
                  </span>
                  <span class="block text-xs text-stone-400 leading-relaxed">
                    Bloquea las funciones del restaurante hasta que se registre la regularización de la suscripción. El equipo verá un banner informativo al iniciar sesión.
                  </span>
                </div>
              </label>
            </div>
          </section>

          <!-- BLOQUE 3: ADMINISTRADOR INICIAL (SÓLO AL CREAR) -->
          <section v-if="modo === 'nuevo'" class="rounded-3xl border border-stone-800/80 bg-[#14110f] p-5 sm:p-7 space-y-5">
            <div class="flex items-center gap-2.5 border-b border-stone-800/80 pb-3">
              <User :size="16" class="text-[#e58a4e]" />
              <h2 class="text-sm font-bold uppercase tracking-wider text-stone-200">
                Usuario Administrador del Local
              </h2>
            </div>
            <p class="text-xs text-stone-400">
              Podés crear inmediatamente la cuenta del dueño o encargado para que ingrese al restaurante.
            </p>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-xs font-semibold text-stone-300">Nombre del Dueño / Gerente</label>
                <input
                  v-model="form.admin_nombre"
                  type="text"
                  placeholder="Ej: Marcelo Gallardo"
                  class="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#110d0b] px-4 py-3 text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-stone-300">Teléfono / WhatsApp</label>
                <input
                  v-model="form.telefono"
                  type="text"
                  placeholder="+54 11 4455-6677"
                  class="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#110d0b] px-4 py-3 text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-xs font-semibold text-stone-300">Correo Electrónico de Ingreso</label>
                <input
                  v-model="form.admin_email"
                  type="email"
                  placeholder="dueño@restaurante.com"
                  class="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#110d0b] px-4 py-3 text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-stone-300">Contraseña Inicial</label>
                <div class="relative mt-1.5">
                  <input
                    v-model="form.admin_password"
                    :type="mostrarPassword ? 'text' : 'password'"
                    placeholder="Mínimo 8 caracteres"
                    class="w-full rounded-2xl border border-stone-800 bg-[#110d0b] px-4 py-3 pr-11 text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
                  />
                  <button
                    type="button"
                    @click="mostrarPassword = !mostrarPassword"
                    class="absolute inset-y-0 right-0 flex items-center pr-3.5 text-stone-400 hover:text-white"
                  >
                    <component :is="mostrarPassword ? EyeOff : Eye" :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- BLOQUE 4: NOTAS DE FACTURACIÓN -->
          <section class="rounded-3xl border border-stone-800/80 bg-[#14110f] p-5 sm:p-7 space-y-4">
            <div class="flex items-center gap-2.5 border-b border-stone-800/80 pb-3">
              <FileText :size="16" class="text-[#e58a4e]" />
              <h2 class="text-sm font-bold uppercase tracking-wider text-stone-200">
                Notas de Facturación y Cobranzas
              </h2>
            </div>

            <div>
              <label class="block text-xs font-semibold text-stone-300">
                Anotaciones internas (visibles sólo para SuperAdmins)
              </label>
              <textarea
                v-model="form.notas_facturacion"
                rows="3"
                placeholder="Ej: Factura A emitida los días 10 de cada mes. Pago por transferencia bancaria..."
                class="mt-1.5 w-full resize-none rounded-2xl border border-stone-800 bg-[#110d0b] p-4 text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
              ></textarea>
            </div>
          </section>

          <!-- BLOQUE 5: ZONA DE PELIGRO (SÓLO SI ES EDICIÓN) -->
          <section
            v-if="modo === 'editar'"
            class="rounded-3xl border border-rose-900/40 bg-rose-950/15 p-5 sm:p-7 space-y-4"
          >
            <div class="flex items-center gap-2 text-rose-300">
              <AlertTriangle :size="16" />
              <h2 class="text-sm font-bold uppercase tracking-wider">
                Zona de Peligro
              </h2>
            </div>
            <p class="text-xs text-rose-300/80">
              La eliminación de una organización borra de forma permanente sus productos, mesas, ventas asociadas y registros de suscripción.
            </p>

            <div v-if="!confirmarEliminar" class="pt-2">
              <button
                type="button"
                @click="confirmarEliminar = true"
                class="inline-flex items-center gap-2 rounded-2xl border border-rose-800/50 bg-rose-950/40 px-4 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/50 hover:text-white transition"
              >
                <Trash2 :size="14" />
                <span>Eliminar Restaurante del Sistema</span>
              </button>
            </div>

            <div
              v-else
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-rose-700/60 bg-rose-950/60 p-4"
            >
              <div class="space-y-0.5">
                <p class="text-xs font-bold text-white">¿Estás seguro de que deseas eliminar este restaurante?</p>
                <p class="text-[11px] text-rose-200">Esta acción no se puede deshacer.</p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  @click="confirmarEliminar = false"
                  class="rounded-xl border border-stone-700 bg-stone-900 px-3.5 py-1.5 text-xs font-semibold text-stone-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  :disabled="eliminando"
                  @click="ejecutarBajaNegocio"
                  class="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  <Trash2 :size="13" />
                  <span>{{ eliminando ? 'Eliminando...' : 'Sí, Eliminar' }}</span>
                </button>
              </div>
            </div>
          </section>

          <!-- BARRA INFERIOR DE BOTONES -->
          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end pt-2">
            <RouterLink
              to="/superadmin"
              class="rounded-2xl border border-stone-800 bg-[#17120f] px-6 py-3 text-center text-xs sm:text-sm font-semibold text-stone-300 hover:bg-[#201814] hover:text-white transition"
            >
              Cancelar
            </RouterLink>

            <button
              type="submit"
              :disabled="guardando"
              class="flex items-center justify-center gap-2 rounded-2xl bg-[#e58a4e] px-8 py-3 text-xs sm:text-sm font-bold text-[#190d05] shadow-lg transition hover:bg-[#ee975e] active:scale-[0.98] disabled:opacity-50"
            >
              <Check :size="16" />
              <span>{{ guardando ? 'Guardando...' : (modo === 'nuevo' ? 'Dar de Alta Restaurante' : 'Guardar Cambios') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>

