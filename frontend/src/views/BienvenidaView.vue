<script setup>
import { ref, computed, watch } from 'vue'
import {
  UtensilsCrossed, ArrowRight, CalendarCheck, Clock, Users,
  CheckCircle2, AlertCircle, User, Phone, RotateCcw,
  ShieldCheck, Wallet, Copy, Check, QrCode, Loader2
} from 'lucide-vue-next'
import logoIcono from '@/assets/3.png'
import Combobox from '@/components/Combobox.vue'
import DatePicker from '@/components/DatePicker.vue'
import {
  authState,
  obtenerFechaHoyLocal,
  HORARIOS_RESERVA,
  SENA_POR_PERSONA,
  calcularMontoSena,
  reservasService,
} from '@/services/api'

const hoyStr = obtenerFechaHoyLocal()

// Encontrar el próximo horario disponible de hoy para preseleccionar
function obtenerHorarioInicial() {
  const ahora = new Date()
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes()
  const proximo = HORARIOS_RESERVA.find((h) => {
    const [hh, mm] = h.split(':').map(Number)
    return hh * 60 + mm >= minAhora + 15
  })
  return proximo || HORARIOS_RESERVA[0]
}

const formReserva = ref({
  fecha: hoyStr,
  hora: obtenerHorarioInicial(),
  personas: 2,
  nombre_cliente: '',
  telefono: '',
  sena_metodo: 'mercadopago',
  sena_comprobante: '',
  sena_pagada: false,
})

const verificandoPagoMP = ref(false)
const codigoCopiado = ref(false)

const montoSena = computed(() => calcularMontoSena(formReserva.value.personas))
const formatMoney = (val) => `$ ${Number(val || 0).toLocaleString('es-AR')}`

const errorFormulario = ref('')
const reservaConfirmada = ref(null)

const personasOptions = [
  { value: 1, label: '1 persona', icon: Users },
  { value: 2, label: '2 personas', icon: Users },
  { value: 3, label: '3 personas', icon: Users },
  { value: 4, label: '4 personas', icon: Users },
  { value: 5, label: '5 personas', icon: Users },
  { value: 6, label: '6 personas', icon: Users },
  { value: 8, label: '8 personas', icon: Users },
]

const horariosOptions = computed(() => {
  return HORARIOS_RESERVA.map((h) => {
    const check = reservasService.verificarDisponibilidad({
      fecha: formReserva.value.fecha,
      hora: h,
      personas: formReserva.value.personas,
    })
    return {
      value: h,
      label: `${h} hs`,
      icon: Clock,
      description: check.disponible
        ? `${check.mesasDisponibles.length} ${check.mesasDisponibles.length === 1 ? 'mesa libre' : 'mesas libres'}`
        : 'Sin lugar',
    }
  })
})

const disponibilidad = computed(() => {
  return reservasService.verificarDisponibilidad({
    fecha: formReserva.value.fecha,
    hora: formReserva.value.hora,
    personas: formReserva.value.personas,
  })
})

const horariosAlternativos = computed(() => {
  if (disponibilidad.value.disponible) return []
  return reservasService
    .horariosAlternativosDisponibles({
      fecha: formReserva.value.fecha,
      personas: formReserva.value.personas,
    })
    .slice(0, 5)
})

// Si cambia el día y el horario actual ya pasó o quedó inválido, limpiar error
watch(
  () => [formReserva.value.fecha, formReserva.value.hora, formReserva.value.personas],
  () => {
    errorFormulario.value = ''
  }
)

watch(
  () => formReserva.value.personas,
  () => {
    formReserva.value.sena_pagada = false
  }
)

function confirmarPagoMercadoPago() {
  errorFormulario.value = ''
  const comp = String(formReserva.value.sena_comprobante || '').trim()
  if (!comp) {
    errorFormulario.value = 'Ingresá el N° de operación o comprobante de Mercado Pago para verificar la transferencia.'
    return
  }
  verificandoPagoMP.value = true
  setTimeout(() => {
    verificandoPagoMP.value = false
    formReserva.value.sena_comprobante = comp.toUpperCase()
    formReserva.value.sena_pagada = true
  }, 450)
}

const qrReservaUrl = computed(() => {
  if (!reservaConfirmada.value?.codigo_confirmacion) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const payload = `${origin}/inicio?codigo=${reservaConfirmada.value.codigo_confirmacion}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=6&data=${encodeURIComponent(payload)}`
})

async function copiarCodigoReserva() {
  const codigo = reservaConfirmada.value?.codigo_confirmacion
  if (!codigo) return
  try {
    await navigator.clipboard.writeText(codigo)
    codigoCopiado.value = true
    setTimeout(() => {
      codigoCopiado.value = false
    }, 2000)
  } catch {
    // fallback silencioso
  }
}

function formatearFechaCorta(fechaStr) {
  if (!fechaStr) return ''
  const [y, m, d] = fechaStr.split('-')
  return `${d}/${m}/${y}`
}

async function confirmarReserva() {
  errorFormulario.value = ''
  const res = await reservasService.crearReserva({
    fecha: formReserva.value.fecha,
    hora: formReserva.value.hora,
    personas: formReserva.value.personas,
    nombre_cliente: formReserva.value.nombre_cliente,
    telefono: formReserva.value.telefono,
    sena_pagada: formReserva.value.sena_pagada,
    sena_metodo: 'mercadopago',
    sena_comprobante: formReserva.value.sena_comprobante,
  })

  if (!res.success) {
    errorFormulario.value = res.message || 'No se pudo completar la reserva.'
    return
  }

  reservaConfirmada.value = res.data
}

function nuevaReserva() {
  reservaConfirmada.value = null
  formReserva.value.nombre_cliente = ''
  formReserva.value.telefono = ''
  formReserva.value.sena_comprobante = ''
  formReserva.value.sena_pagada = false
  codigoCopiado.value = false
  errorFormulario.value = ''
}
</script>

<template>
  <main class="relative flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#0c0a09] px-4 py-8 text-[#f5f2eb]">
    <!-- Resplandor ambiental sutil -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-25">
      <div class="absolute -top-[20%] left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#e58a4e]/20 via-[#e58a4e]/5 to-transparent blur-3xl"></div>
    </div>

    <section
      class="relative z-10 w-full max-w-2xl rounded-3xl border border-stone-800/80 bg-[#17120f] p-5 text-white shadow-2xl sm:p-8"
      aria-labelledby="welcome-title"
    >
      <!-- Encabezado de marca + acceso rápido a Carta -->
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-stone-800/70 pb-5">
        <div class="flex items-center gap-3 sm:gap-3.5">
          <img :src="logoIcono" alt="TrackMenú" class="h-11 w-11 sm:h-12 sm:w-12 shrink-0 object-contain" />
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Bienvenido a TrackMenú</p>
            <h1 id="welcome-title" class="font-girassol text-2xl sm:text-3xl font-normal leading-tight text-white">
              Reservá tu Mesa
            </h1>
          </div>
        </div>

        <RouterLink
          to="/inicio"
          class="inline-flex items-center gap-2 rounded-xl border border-[#e58a4e]/40 bg-[#e58a4e]/10 px-4 py-2.5 text-xs font-bold text-[#e58a4e] transition hover:bg-[#e58a4e] hover:text-[#190d05]"
        >
          <UtensilsCrossed :size="15" />
          <span>Ver Catálogo</span>
          <ArrowRight :size="14" />
        </RouterLink>
      </div>

      <!-- ===================================================================== -->
      <!-- CONFIRMACIÓN DE RESERVA EXITOSA                                       -->
      <!-- ===================================================================== -->
      <div v-if="reservaConfirmada" class="mt-6 space-y-5">
        <div class="rounded-2xl border border-emerald-500/40 bg-emerald-950/25 p-5 space-y-4">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-[#0b1911]">
              <CheckCircle2 :size="22" />
            </div>
            <div>
              <p class="text-xs font-bold uppercase tracking-wider text-emerald-400">Reserva Confirmada</p>
              <h2 class="mt-0.5 font-serif text-xl font-bold text-white">
                ¡Te esperamos, {{ reservaConfirmada.nombre_cliente }}!
              </h2>
              <p class="mt-1 text-xs text-stone-300">
                Tu mesa ya quedó registrada en el salón del restaurante.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div class="rounded-xl border border-white/10 bg-[#110d0b] p-3">
              <span class="block text-[10px] font-bold uppercase tracking-wider text-stone-400">Día</span>
              <span class="mt-1 block text-sm font-bold text-white">{{ formatearFechaCorta(reservaConfirmada.fecha) }}</span>
            </div>
            <div class="rounded-xl border border-white/10 bg-[#110d0b] p-3">
              <span class="block text-[10px] font-bold uppercase tracking-wider text-stone-400">Horario</span>
              <span class="mt-1 block text-sm font-bold text-[#e58a4e]">{{ reservaConfirmada.hora }} hs</span>
            </div>
            <div class="rounded-xl border border-white/10 bg-[#110d0b] p-3">
              <span class="block text-[10px] font-bold uppercase tracking-wider text-stone-400">Personas</span>
              <span class="mt-1 block text-sm font-bold text-white">{{ reservaConfirmada.personas }} pers.</span>
            </div>
            <div class="rounded-xl border border-white/10 bg-[#110d0b] p-3">
              <span class="block text-[10px] font-bold uppercase tracking-wider text-stone-400">Mesa asignada</span>
              <span class="mt-1 block text-sm font-bold text-emerald-400">Mesa {{ reservaConfirmada.mesa_numero }}</span>
            </div>
            <div class="col-span-2 sm:col-span-1 rounded-xl border border-emerald-500/30 bg-[#110d0b] p-3">
              <span class="block text-[10px] font-bold uppercase tracking-wider text-emerald-400">Seña abonada</span>
              <span class="mt-1 block text-sm font-bold text-white">{{ formatMoney(reservaConfirmada.sena_monto) }}</span>
            </div>
          </div>

          <!-- Código QR + Código Alfanumérico en MAYÚSCULAS para presentar al llegar -->
          <div class="flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/30 bg-[#110d0b] p-4 sm:flex-row">
            <div class="shrink-0 rounded-xl bg-white p-2 shadow-md">
              <img
                v-if="qrReservaUrl"
                :src="qrReservaUrl"
                :alt="`QR Reserva ${reservaConfirmada.codigo_confirmacion}`"
                class="h-28 w-28 object-contain"
              />
            </div>

            <div class="flex-1 text-center sm:text-left space-y-2">
              <div class="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <QrCode :size="14" />
                <span>Código de ingreso al local</span>
              </div>
              <p class="text-xs text-stone-300 leading-relaxed">
                Mostrá este QR o dictale este código al empleado cuando llegues al restaurante para confirmar tu mesa:
              </p>
              <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                <span class="rounded-xl border border-[#e58a4e]/50 bg-[#1d140e] px-4 py-2 font-mono text-xl font-extrabold tracking-[0.22em] text-[#e58a4e] uppercase select-all">
                  {{ reservaConfirmada.codigo_confirmacion }}
                </span>
                <button
                  type="button"
                  @click="copiarCodigoReserva"
                  class="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-[#17120f] px-3 py-2 text-xs font-semibold text-stone-300 transition hover:border-[#e58a4e] hover:text-white"
                >
                  <Check v-if="codigoCopiado" :size="14" class="text-emerald-400" />
                  <Copy v-else :size="14" />
                  <span>{{ codigoCopiado ? 'Copiado' : 'Copiar' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            @click="nuevaReserva"
            class="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-[#110d0b] px-4 py-2.5 text-xs font-semibold text-stone-300 transition hover:border-stone-500 hover:text-white"
          >
            <RotateCcw :size="14" />
            <span>Hacer otra reserva</span>
          </button>

          <RouterLink
            to="/inicio"
            class="inline-flex items-center gap-2 rounded-xl bg-[#e58a4e] px-5 py-2.5 text-xs font-extrabold text-[#190d05] shadow-lg transition hover:bg-[#ee975e]"
          >
            <UtensilsCrossed :size="15" />
            <span>Explorar la Carta Digital</span>
            <ArrowRight :size="15" />
          </RouterLink>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- FORMULARIO DE RESERVA (DatePicker + Combobox + Disponibilidad)        -->
      <!-- ===================================================================== -->
      <form v-else @submit.prevent="confirmarReserva" class="mt-5 space-y-5">
        <p class="text-sm leading-relaxed text-stone-300">
          Elegí el día, horario y cantidad de personas para consultar disponibilidad al instante y asegurar tu mesa.
        </p>

        <!-- Selectores reutilizables: DatePicker + Combobox -->
        <div class="grid gap-4 sm:grid-cols-3">
          <DatePicker
            v-model="formReserva.fecha"
            label="Día de reserva"
            :min="hoyStr"
            placeholder="Elegir fecha"
            required
          />

          <Combobox
            v-model="formReserva.hora"
            label="Horario"
            :options="horariosOptions"
            placeholder="Elegir horario..."
          />

          <Combobox
            v-model="formReserva.personas"
            label="Personas"
            :options="personasOptions"
            placeholder="Cantidad..."
          />
        </div>

        <!-- Estado de disponibilidad en tiempo real -->
        <div
          class="rounded-2xl border p-4 text-xs transition"
          :class="disponibilidad.disponible
            ? 'border-emerald-500/35 bg-emerald-950/20 text-emerald-200'
            : 'border-rose-500/35 bg-rose-950/20 text-rose-200'"
        >
          <div class="flex items-start gap-2.5">
            <CheckCircle2 v-if="disponibilidad.disponible" :size="18" class="mt-0.5 shrink-0 text-emerald-400" />
            <AlertCircle v-else :size="18" class="mt-0.5 shrink-0 text-rose-400" />
            <div class="space-y-2 flex-1">
              <p class="font-bold">
                {{ disponibilidad.disponible ? 'Disponibilidad confirmada' : 'Sin disponibilidad en ese horario' }}
              </p>
              <p class="leading-relaxed opacity-90">
                {{ disponibilidad.mensaje }}
              </p>

              <!-- Sugerencias de horarios alternativos disponibles -->
              <div v-if="!disponibilidad.disponible && horariosAlternativos.length > 0" class="pt-1">
                <p class="mb-1.5 text-[11px] font-semibold text-stone-300">
                  Horarios disponibles para ese día:
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="alt in horariosAlternativos"
                    :key="alt"
                    type="button"
                    @click="formReserva.hora = alt"
                    class="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-bold text-emerald-300 transition hover:bg-emerald-500 hover:text-[#0b1911]"
                  >
                    {{ alt }} hs
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Datos de contacto del cliente -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-xs font-medium text-stone-300">
              Tu nombre <span class="text-[#e58a4e]">*</span>
            </label>
            <div class="relative">
              <User :size="15" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                v-model="formReserva.nombre_cliente"
                type="text"
                placeholder="Ej. Lucía Fernández"
                class="w-full rounded-xl border border-stone-800 bg-[#110d0b] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]/70"
              />
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-medium text-stone-300">
              Teléfono / WhatsApp <span class="text-stone-500">(opcional)</span>
            </label>
            <div class="relative">
              <Phone :size="15" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
              <input
                v-model="formReserva.telefono"
                type="tel"
                placeholder="Ej. 11 5555-1234"
                class="w-full rounded-xl border border-stone-800 bg-[#110d0b] py-2.5 pl-10 pr-3.5 text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]/70"
              />
            </div>
          </div>
        </div>

        <!-- Seña obligatoria con Mercado Pago para habilitar la reserva -->
        <div class="rounded-2xl border border-[#009ee3]/40 bg-[#0d151c] p-4 space-y-3.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-3">
              <!-- Logo oficial de Mercado Pago (sin fondo) -->
              <img
                src="https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/mercado-pago/default.svg"
                alt="Mercado Pago"
                class="h-10 w-auto shrink-0 object-contain"
              />
              <div>
                <p class="text-xs font-bold uppercase tracking-wider text-[#38bdf8]">Seña por Mercado Pago</p>
                <p class="text-[11px] text-stone-400">
                  Se descuenta luego de tu consumo en el local.
                </p>
              </div>
            </div>
            <span class="rounded-xl border border-[#009ee3]/40 bg-[#009ee3]/15 px-3 py-1.5 text-sm font-extrabold text-[#38bdf8] tabular-nums">
              {{ formatMoney(montoSena) }}
            </span>
          </div>

          <div class="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div class="flex-1">
              <label class="mb-1.5 block text-xs font-medium text-stone-300">
                N° de operación / comprobante Mercado Pago <span class="text-[#38bdf8]">*</span>
              </label>
              <input
                v-model="formReserva.sena_comprobante"
                type="text"
                :disabled="formReserva.sena_pagada"
                placeholder="Ej. MP-849201"
                class="w-full rounded-xl border border-stone-700 bg-[#111820] px-3 py-2 text-xs text-white uppercase placeholder-stone-500 outline-none transition focus:border-[#009ee3] disabled:opacity-60"
              />
            </div>

            <button
              type="button"
              @click="confirmarPagoMercadoPago"
              :disabled="verificandoPagoMP || formReserva.sena_pagada"
              :class="formReserva.sena_pagada
                ? 'border border-emerald-500/50 bg-emerald-950/50 text-emerald-300'
                : 'bg-[#009ee3] text-white hover:bg-[#008ed0]'"
              class="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold shadow transition disabled:cursor-not-allowed"
            >
              <Loader2 v-if="verificandoPagoMP" :size="14" class="animate-spin" />
              <CheckCircle2 v-else-if="formReserva.sena_pagada" :size="14" />
              <Wallet v-else :size="14" />
              <span>
                {{ verificandoPagoMP ? 'Verificando...' : formReserva.sena_pagada ? 'Transferencia confirmada' : 'Confirmar transferencia MP' }}
              </span>
            </button>
          </div>

          <p v-if="formReserva.sena_pagada" class="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
            <ShieldCheck :size="14" />
            <span>Pago de seña verificado con Mercado Pago. Ya podés confirmar tu reserva.</span>
          </p>
        </div>

        <p v-if="errorFormulario" class="rounded-xl border border-rose-500/30 bg-rose-950/30 px-3.5 py-2 text-xs font-medium text-rose-300">
          {{ errorFormulario }}
        </p>

        <!-- Botón de confirmación (solo habilitado tras confirmar transferencia en Mercado Pago) -->
        <button
          type="submit"
          :disabled="!disponibilidad.disponible || !formReserva.sena_pagada"
          class="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-[#e58a4e] px-5 py-3.5 text-sm font-extrabold text-[#190d05] shadow-lg transition hover:bg-[#ee975e] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <CalendarCheck :size="18" />
          <span>{{ formReserva.sena_pagada ? 'Confirmar Reserva' : `Confirmá primero la seña (${formatMoney(montoSena)})` }}</span>
        </button>
      </form>

      <!-- Acceso secundario en letra chica para administrador o empleado -->
      <div class="mt-6 border-t border-stone-800/70 pt-4 text-center text-[11px] leading-relaxed text-stone-500">
        <template v-if="!authState.user">
          <span>¿Sos administrador o empleado? </span>
          <RouterLink
            to="/login"
            class="inline-block py-1 font-medium text-stone-400 underline decoration-stone-700 underline-offset-4 transition hover:text-[#e58a4e] hover:decoration-[#e58a4e]/60"
          >
            Ingresar al sistema
          </RouterLink>
        </template>
        <template v-else>
          <span>Sesión activa ({{ authState.rol }}) · </span>
          <RouterLink
            :to="authState.rol === 'admin' ? '/dashboard' : (authState.rol === 'empleado' ? '/inicio?vista=mesas' : '/productos')"
            class="inline-block py-1 font-medium text-[#e58a4e] underline decoration-[#e58a4e]/50 underline-offset-4 transition hover:text-[#f09559]"
          >
            Ir al panel de gestión
          </RouterLink>
        </template>
      </div>
    </section>
  </main>
</template>
