<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  ShieldAlert, TrendingUp, Receipt, DollarSign, AlertTriangle, Download,
  Eye, X, Check, History, Clock, Building2, CreditCard, Banknote,
  ArrowRightLeft, FileSpreadsheet, RefreshCw, Ban, ShieldCheck, ChevronRight,
  Users, UserPlus
} from 'lucide-vue-next'
import Combobox from '@/components/Combobox.vue'
import { authState, adminService } from '@/services/api'

interface DetalleItem {
  id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  productos?: {
    id: string
    nombre: string
  }
}

interface Venta {
  id: string
  organizacion_id: string
  mesa_numero: number
  total: number
  metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia_qr'
  estado: 'completada' | 'anulada'
  usuario_id: string
  created_at: string
  anulado_en?: string | null
  anulado_por?: string | null
  motivo_anulacion?: string | null
  detalle_ventas?: DetalleItem[]
}

interface KpisData {
  facturacionTotal: number
  ticketsTotal: number
  ticketMedio: number
  pagosPorcentaje: {
    efectivo: number
    tarjeta: number
    transferencia_qr: number
  }
  pagosCount: {
    efectivo: number
    tarjeta: number
    transferencia_qr: number
  }
  stockCritico: Array<{ id: string; nombre: string; stock: number; precio: number }>
  platosMasVendidos: Array<{ id: string; nombre: string; cantidad: number }>
}

interface AuditLog {
  id: string
  organizacion_id: string
  usuario_id: string
  accion: string
  detalles: Record<string, any>
  created_at: string
}

interface UsuarioMiembro {
  usuario_id: string
  nombre: string
  email: string
  rol: 'admin' | 'empleado' | 'consulta'
  creado_en?: string | null
}

// Estado reactivo
const cargando = ref(true)
const kpis = ref<KpisData>({
  facturacionTotal: 0,
  ticketsTotal: 0,
  ticketMedio: 0,
  pagosPorcentaje: { efectivo: 0, tarjeta: 0, transferencia_qr: 0 },
  pagosCount: { efectivo: 0, tarjeta: 0, transferencia_qr: 0 },
  stockCritico: [],
  platosMasVendidos: [],
})

const ventas = ref<Venta[]>([])
const auditoriaLogs = ref<AuditLog[]>([])
const usuariosEquipo = ref<UsuarioMiembro[]>([])

// La auditoría guarda el id del usuario afectado: mostrarlo tal cual no le
// dice nada a nadie, así que se resuelve contra el equipo ya cargado.
const nombrarUsuario = (id?: string) => {
  if (!id) return '—'
  const u = usuariosEquipo.value.find((x) => x.usuario_id === id)
  return u?.email || u?.nombre || id
}

// Gestión de usuarios (solo Admin)
const opcionesRol = [
  { value: 'consulta', label: 'Consulta (Solo lectura)' },
  { value: 'empleado', label: 'Personal / Cajero (Mesas y avisos)' },
  { value: 'admin', label: 'Administrador (Control total)' },
]
const modalCrearUsuarioAbierto = ref(false)
const creandoUsuario = ref(false)
const errorUsuario = ref('')
const nuevoUsuario = ref({
  nombre: '',
  email: '',
  password: '',
  rol: 'empleado' as 'admin' | 'empleado' | 'consulta',
})

// Filtros de ventas
const filtroMetodoPago = ref('')
const filtroEstado = ref('')

const opcionesMetodoPago = [
  { value: '', label: 'Todos los métodos' },
  { value: 'efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
  { value: 'transferencia_qr', label: 'Transferencia / QR', icon: ArrowRightLeft },
]

const opcionesEstado = [
  { value: '', label: 'Todos los estados' },
  { value: 'completada', label: 'Completadas' },
  { value: 'anulada', label: 'Anuladas' },
]

// Modales
const ventaDetalle = ref<Venta | null>(null)
const modalDetalleAbierto = ref(false)

const ventaAAnular = ref<Venta | null>(null)
const motivoAnulacion = ref('')
const errorAnulacion = ref('')
const modalAnularAbierto = ref(false)
const procesandoAnulacion = ref(false)

// Notificaciones Toast
const notificacion = ref({ visible: false, mensaje: '', tipo: 'exito' })
const mostrarNotificacion = (mensaje: string, tipo: 'exito' | 'error' | 'info' = 'exito') => {
  notificacion.value = { visible: true, mensaje, tipo }
  setTimeout(() => {
    notificacion.value.visible = false
  }, 4000)
}

// Formateadores
const formatearPrecio = (valor: number) => `$ ${Number(valor || 0).toLocaleString('es-AR')}`

const formatearFechaHora = (iso: string) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// Cargar información consolidada
async function cargarDashboard() {
  cargando.value = true
  const [resKpis, resVentas, resAudit, resUsuarios] = await Promise.all([
    adminService.getKpis(),
    adminService.getVentas({
      metodo_pago: filtroMetodoPago.value,
      estado: filtroEstado.value,
    }),
    adminService.getAuditoria(),
    adminService.getUsuarios(),
  ])

  if (resKpis.success && resKpis.data) {
    kpis.value = resKpis.data
  }
  if (resVentas.success && resVentas.data) {
    ventas.value = resVentas.data
  }
  if (resAudit.success && resAudit.data) {
    auditoriaLogs.value = resAudit.data
  }
  if (resUsuarios.success && resUsuarios.data) {
    usuariosEquipo.value = resUsuarios.data
  }
  cargando.value = false
}

watch([filtroMetodoPago, filtroEstado], async () => {
  const res = await adminService.getVentas({
    metodo_pago: filtroMetodoPago.value,
    estado: filtroEstado.value,
  })
  if (res.success && res.data) {
    ventas.value = res.data
  }
})

// Abrir detalle
function verDetalleTicket(v: Venta) {
  ventaDetalle.value = v
  modalDetalleAbierto.value = true
}

// Anulación
function iniciarAnulacion(v: Venta) {
  ventaAAnular.value = v
  motivoAnulacion.value = ''
  errorAnulacion.value = ''
  modalAnularAbierto.value = true
}

async function confirmarAnulacion() {
  if (!ventaAAnular.value) return
  if (!motivoAnulacion.value || motivoAnulacion.value.trim().length < 5) {
    errorAnulacion.value = 'El motivo de anulación es obligatorio (mínimo 5 caracteres).'
    return
  }

  procesandoAnulacion.value = true
  errorAnulacion.value = ''

  const res = await adminService.anularVenta(ventaAAnular.value.id, motivoAnulacion.value)
  procesandoAnulacion.value = false

  if (res.success) {
    mostrarNotificacion(res.message || 'Ticket anulado y stock restituido.', 'exito')
    modalAnularAbierto.value = false
    ventaAAnular.value = null
    await cargarDashboard()
  } else {
    errorAnulacion.value = res.message || 'Error al anular la venta.'
  }
}

// Exportación CSV
function exportarCSV() {
  const exito = adminService.exportarVentasCSV(ventas.value)
  if (exito) {
    mostrarNotificacion('Reporte de ventas exportado en formato CSV.', 'exito')
  } else {
    mostrarNotificacion('No hay ventas disponibles para exportar.', 'info')
  }
}

// Alta y gestión de equipo (solo Admin)
function abrirModalCrearUsuario() {
  nuevoUsuario.value = { nombre: '', email: '', password: '', rol: 'empleado' }
  errorUsuario.value = ''
  modalCrearUsuarioAbierto.value = true
}

async function crearNuevoUsuario() {
  errorUsuario.value = ''
  if (!nuevoUsuario.value.nombre.trim() || !nuevoUsuario.value.email.trim()) {
    errorUsuario.value = 'Completá el nombre y el correo electrónico.'
    return
  }
  if (nuevoUsuario.value.password.length < 8) {
    errorUsuario.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }

  creandoUsuario.value = true
  const res = await adminService.crearUsuario({ ...nuevoUsuario.value })
  creandoUsuario.value = false

  if (res.success) {
    modalCrearUsuarioAbierto.value = false
    mostrarNotificacion(res.message || 'Usuario creado correctamente.', 'exito')
    await cargarDashboard()
  } else {
    errorUsuario.value = res.message || 'No se pudo crear el usuario.'
  }
}

async function actualizarRol(usuarioId: string, nuevoRol: string) {
  const res = await adminService.cambiarRolUsuario(usuarioId, nuevoRol)
  if (res.success) {
    mostrarNotificacion(res.message || 'Permiso actualizado.', 'exito')
    await cargarDashboard()
  } else {
    mostrarNotificacion(res.message || 'No se pudo actualizar el permiso.', 'error')
    await cargarDashboard()
  }
}

onMounted(() => {
  cargarDashboard()
})
</script>

<template>
  <main class="min-h-screen overflow-x-hidden bg-[#0c0a09] text-[#f5f2eb]">
    <!-- Notificación Flotante -->
    <transition
      enter-active-class="transform transition ease-out duration-200"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0">
      <div v-if="notificacion.visible"
        class="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-xs font-semibold shadow-2xl backdrop-blur-md"
        :class="[
          notificacion.tipo === 'exito' ? 'border-[#204933] bg-[#163223] text-[#4ade80]' : '',
          notificacion.tipo === 'error' ? 'border-rose-900/60 bg-[#2b1111] text-rose-300' : '',
          notificacion.tipo === 'info' ? 'border-stone-800 bg-[#17120f] text-[#e58a4e]' : ''
        ]">
        <Check v-if="notificacion.tipo === 'exito'" :size="16" />
        <AlertTriangle v-else :size="16" />
        <span>{{ notificacion.mensaje }}</span>
        <button type="button" @click="notificacion.visible = false" class="ml-2 text-stone-400 hover:text-white">
          <X :size="14" />
        </button>
      </div>
    </transition>

    <!-- Contenedor Principal del Dashboard -->
    <div class="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 md:px-8 space-y-6">
      <!-- Encabezado de Sección -->
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e58a4e]">Visión Global del Negocio</p>
          <h1 class="mt-1 font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Panel de Ventas y Movimientos
          </h1>
          <p class="mt-1 text-xs text-stone-400">
            Resumen de recaudación del día, tickets cobrados y avisos enviados por el personal.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" @click="cargarDashboard" :disabled="cargando"
            class="flex items-center gap-1.5 rounded-2xl border border-stone-800 bg-[#17120f] px-3.5 py-2.5 text-xs font-semibold text-stone-300 transition hover:border-stone-700 hover:text-white disabled:opacity-50">
            <RefreshCw :size="14" :class="cargando ? 'animate-spin text-[#e58a4e]' : ''" />
            <span>Actualizar</span>
          </button>

          <button type="button" @click="exportarCSV"
            class="flex items-center gap-2 rounded-2xl bg-[#e58a4e] px-4 py-2.5 text-xs font-bold text-[#190d05] transition hover:bg-[#ee975e] active:scale-[0.99]">
            <Download :size="15" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      <!-- 1. BARRA DE MÉTRICAS (KPI CARDS) -->
      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Card 1: Facturación del Día -->
        <article class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-5 shadow-sm">
          <div class="flex items-center justify-between text-xs text-stone-400 font-semibold">
            <span>Facturación del Día</span>
            <span class="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-800 bg-[#110d0b] text-[#e58a4e]">
              <DollarSign :size="16" />
            </span>
          </div>
          <div class="mt-3">
            <span class="font-serif text-3xl font-bold text-white tracking-tight">
              {{ formatearPrecio(kpis.facturacionTotal) }}
            </span>
            <p class="mt-1 flex items-center gap-1 text-[11px] text-[#4ade80] font-medium">
              <TrendingUp :size="13" /> Comandas cobradas hoy
            </p>
          </div>
        </article>

        <!-- Card 2: Tickets y Promedio -->
        <article class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-5 shadow-sm">
          <div class="flex items-center justify-between text-xs text-stone-400 font-semibold">
            <span>Tickets / Ticket Promedio</span>
            <span class="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-800 bg-[#110d0b] text-[#e58a4e]">
              <Receipt :size="16" />
            </span>
          </div>
          <div class="mt-3">
            <div class="flex items-baseline gap-2">
              <span class="font-serif text-3xl font-bold text-white tracking-tight">
                {{ kpis.ticketsTotal }}
              </span>
              <span class="text-xs text-stone-400 font-medium">comandas</span>
            </div>
            <p class="mt-1 text-[11px] text-stone-400 font-medium">
              Promedio: <strong class="text-stone-200">{{ formatearPrecio(kpis.ticketMedio) }}</strong>
            </p>
          </div>
        </article>

        <!-- Card 3: Mix de Métodos de Pago -->
        <article class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-5 shadow-sm">
          <div class="flex items-center justify-between text-xs text-stone-400 font-semibold mb-2">
            <span>Mix de Pagos</span>
            <span class="text-[10px] text-stone-500 font-bold uppercase">Distribución</span>
          </div>
          <div class="space-y-2 mt-2">
            <div>
              <div class="flex justify-between text-[11px] font-semibold text-stone-300">
                <span class="flex items-center gap-1"><Banknote :size="12" class="text-[#e58a4e]" /> Efectivo</span>
                <span>{{ kpis.pagosPorcentaje.efectivo }}%</span>
              </div>
              <div class="mt-1 h-1.5 w-full rounded-full bg-stone-900 overflow-hidden">
                <div class="h-full bg-[#e58a4e] rounded-full" :style="{ width: `${kpis.pagosPorcentaje.efectivo}%` }"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-[11px] font-semibold text-stone-300">
                <span class="flex items-center gap-1"><ArrowRightLeft :size="12" class="text-emerald-400" /> QR / Transf.</span>
                <span>{{ kpis.pagosPorcentaje.transferencia_qr }}%</span>
              </div>
              <div class="mt-1 h-1.5 w-full rounded-full bg-stone-900 overflow-hidden">
                <div class="h-full bg-emerald-500 rounded-full" :style="{ width: `${kpis.pagosPorcentaje.transferencia_qr}%` }"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-[11px] font-semibold text-stone-300">
                <span class="flex items-center gap-1"><CreditCard :size="12" class="text-blue-400" /> Tarjeta</span>
                <span>{{ kpis.pagosPorcentaje.tarjeta }}%</span>
              </div>
              <div class="mt-1 h-1.5 w-full rounded-full bg-stone-900 overflow-hidden">
                <div class="h-full bg-blue-500 rounded-full" :style="{ width: `${kpis.pagosPorcentaje.tarjeta}%` }"></div>
              </div>
            </div>
          </div>
        </article>

        <!-- Card 4: Alertas de Stock Crítico -->
        <article class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-5 shadow-sm">
          <div class="flex items-center justify-between text-xs text-stone-400 font-semibold">
            <span>Stock Crítico (&le; 5 un.)</span>
            <span class="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-800 bg-[#110d0b]"
              :class="kpis.stockCritico.length ? 'text-amber-400' : 'text-stone-500'">
              <AlertTriangle :size="16" />
            </span>
          </div>
          <div class="mt-3">
            <span class="font-serif text-3xl font-bold tracking-tight"
              :class="kpis.stockCritico.length ? 'text-amber-400' : 'text-white'">
              {{ kpis.stockCritico.length }}
            </span>
            <p v-if="kpis.stockCritico.length" class="mt-1 text-[11px] text-stone-400 truncate">
              Atención: <strong class="text-stone-200">{{ kpis.stockCritico[0]?.nombre }}</strong> ({{ kpis.stockCritico[0]?.stock }} un.)
            </p>
            <p v-else class="mt-1 text-[11px] text-[#4ade80]">
              Inventario en niveles óptimos
            </p>
          </div>
        </article>
      </section>

      <!-- 2. HISTORIAL DE VENTAS Y TICKETS (FILTROS Y TABLA) -->
      <section class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-5 sm:p-6 shadow-sm space-y-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="font-serif text-2xl font-bold text-white">Historial de Ventas</h2>
            <p class="text-xs text-stone-400">Comandas cerradas con trazabilidad de método de pago y anulación.</p>
          </div>

          <!-- Filtros de búsqueda para Ventas -->
          <div class="flex flex-wrap items-center gap-2">
            <div class="w-44">
              <Combobox
                v-model="filtroMetodoPago"
                :options="opcionesMetodoPago"
                size="sm"
                placeholder="Método de pago"
              />
            </div>
            <div class="w-40">
              <Combobox
                v-model="filtroEstado"
                :options="opcionesEstado"
                size="sm"
                placeholder="Estado"
              />
            </div>
          </div>
        </div>

        <!-- Tabla de Ventas -->
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-stone-800/80 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400 bg-[#130f0d]">
                <th class="py-3.5 px-4">Ticket</th>
                <th class="py-3.5 px-4">Fecha / Hora</th>
                <th class="py-3.5 px-4">Mesa</th>
                <th class="py-3.5 px-4">Total</th>
                <th class="py-3.5 px-4">Método de Pago</th>
                <th class="py-3.5 px-4">Estado</th>
                <th class="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-800/50">
              <tr v-for="v in ventas" :key="v.id" class="transition hover:bg-[#1a1411]">
                <td class="py-3.5 px-4 font-mono font-semibold text-stone-300">
                  #{{ v.id.slice(0, 8) }}
                </td>
                <td class="py-3.5 px-4 text-stone-400">
                  {{ formatearFechaHora(v.created_at) }}
                </td>
                <td class="py-3.5 px-4 font-bold text-white">
                  Mesa {{ v.mesa_numero }}
                </td>
                <td class="py-3.5 px-4 font-serif font-bold text-sm text-[#e58a4e]">
                  {{ formatearPrecio(v.total) }}
                </td>
                <td class="py-3.5 px-4">
                  <span class="inline-flex items-center gap-1.5 capitalize text-stone-300 font-medium">
                    <Banknote v-if="v.metodo_pago === 'efectivo'" :size="13" class="text-[#e58a4e]" />
                    <CreditCard v-else-if="v.metodo_pago === 'tarjeta'" :size="13" class="text-blue-400" />
                    <ArrowRightLeft v-else :size="13" class="text-emerald-400" />
                    {{ v.metodo_pago.replace('_', ' ') }}
                  </span>
                </td>
                <td class="py-3.5 px-4">
                  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
                    :class="v.estado === 'completada' ? 'border border-[#204933] bg-[#163223] text-[#4ade80]' : 'border border-rose-900/60 bg-[#2b1111] text-rose-300'">
                    <span class="h-1.5 w-1.5 rounded-full" :class="v.estado === 'completada' ? 'bg-[#4ade80]' : 'bg-rose-400'" />
                    {{ v.estado === 'completada' ? 'Completada' : 'Anulada' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button type="button" @click="verDetalleTicket(v)"
                      class="flex items-center gap-1 rounded-xl border border-stone-800 bg-[#110d0b] px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-stone-700 hover:text-white">
                      <Eye :size="13" />
                      <span>Ver Ítems</span>
                    </button>

                    <button v-if="v.estado === 'completada'" type="button" @click="iniciarAnulacion(v)"
                      class="flex items-center gap-1 rounded-xl border border-rose-900/40 bg-rose-950/20 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-950/40"
                      title="Anular venta y restituir stock">
                      <Ban :size="13" />
                      <span>Anular</span>
                    </button>
                    <span v-else class="text-[11px] text-stone-500 italic pr-2">
                      Anulada
                    </span>
                  </div>
                </td>
              </tr>
              <tr v-if="!ventas.length">
                <td colspan="7" class="py-8 text-center text-xs text-stone-500">
                  No se encontraron ventas con los filtros seleccionados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 3. HISTORIAL DE MOVIMIENTOS Y AVISOS -->
      <section class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-5 sm:p-6 shadow-sm space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-serif text-2xl font-bold text-white">Historial de Movimientos y Avisos</h2>
            <p class="text-xs text-stone-400">Avisos de falta de stock, cambios de precios y tickets anulados, guardados automáticamente.</p>
          </div>
          <span class="shrink-0 rounded-full border border-stone-800 bg-[#110d0b] px-3 py-1 text-[11px] font-semibold text-stone-400">
            {{ auditoriaLogs.length }} {{ auditoriaLogs.length === 1 ? 'movimiento' : 'movimientos' }}
          </span>
        </div>

        <div class="space-y-3">
          <div v-for="log in auditoriaLogs" :key="log.id"
            class="flex items-start gap-3 rounded-2xl border border-stone-800/60 bg-[#110d0b] p-3.5 transition hover:border-stone-700">
            <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
              :class="[
                log.accion === 'anulacion_ticket' ? 'border-rose-900/60 bg-rose-950/30 text-rose-400' : '',
                log.accion === 'alerta_stock' ? 'border-amber-800/60 bg-amber-950/30 text-amber-400' : '',
                log.accion === 'cambio_precio' ? 'border-[#e58a4e]/40 bg-[#221a15] text-[#e58a4e]' : '',
                log.accion === 'ajuste_stock' ? 'border-blue-900/60 bg-blue-950/30 text-blue-400' : '',
                log.accion === 'alta_usuario' ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-400' : '',
                log.accion === 'cambio_rol' ? 'border-purple-900/60 bg-purple-950/30 text-purple-400' : ''
              ]">
              <Ban v-if="log.accion === 'anulacion_ticket'" :size="15" />
              <AlertTriangle v-else-if="log.accion === 'alerta_stock'" :size="15" />
              <DollarSign v-else-if="log.accion === 'cambio_precio'" :size="15" />
              <Receipt v-else-if="log.accion === 'ajuste_stock'" :size="15" />
              <UserPlus v-else-if="log.accion === 'alta_usuario'" :size="15" />
              <ShieldCheck v-else :size="15" />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span class="text-xs font-bold uppercase tracking-wider"
                  :class="[
                    log.accion === 'anulacion_ticket' ? 'text-rose-300' : '',
                    log.accion === 'cambio_precio' ? 'text-[#e58a4e]' : '',
                    log.accion === 'ajuste_stock' ? 'text-blue-300' : '',
                    log.accion === 'alerta_stock' ? 'text-amber-300' : '',
                    log.accion === 'alta_usuario' ? 'text-emerald-300' : '',
                    log.accion === 'cambio_rol' ? 'text-purple-300' : ''
                  ]">
                  {{
                    log.accion === 'alerta_stock' ? 'Aviso de falta de stock' :
                    log.accion === 'anulacion_ticket' ? 'Ticket anulado' :
                    log.accion === 'cambio_precio' ? 'Cambio de precio' :
                    log.accion === 'ajuste_stock' ? 'Ajuste de inventario' :
                    log.accion === 'alta_usuario' ? 'Alta de usuario' :
                    log.accion === 'cambio_rol' ? 'Cambio de permisos' :
                    log.accion.replace('_', ' ')
                  }}
                </span>
                <span class="flex items-center gap-1 text-[11px] text-stone-500">
                  <Clock :size="12" /> {{ formatearFechaHora(log.created_at) }}
                </span>
              </div>

              <!-- Detalles del evento -->
              <p class="mt-1 text-xs text-stone-300">
                <span v-if="log.accion === 'anulacion_ticket'">
                  Ticket <strong>#{{ String(log.detalles?.venta_id || '').slice(0, 8) }}</strong> (Mesa {{ log.detalles?.mesa_numero }})
                  anulado por importe de <strong class="text-[#e58a4e]">{{ formatearPrecio(log.detalles?.total) }}</strong>.
                  Motivo: <em>"{{ log.detalles?.motivo }}"</em>.
                </span>
                <span v-else-if="log.accion === 'alerta_stock'">
                  <span class="inline-flex items-center gap-1 font-semibold text-amber-300">
                    Aviso urgente:
                  </span>
                  El personal informó que el producto <strong>"{{ log.detalles?.producto_nombre }}"</strong> se quedó sin stock.
                  <span v-if="log.detalles?.motivo" class="italic text-stone-400"> ({{ log.detalles?.motivo }})</span>
                </span>
                <span v-else-if="log.accion === 'cambio_precio'">
                  Producto <strong>{{ log.detalles?.producto }}</strong>: precio actualizado de
                  {{ formatearPrecio(log.detalles?.precio_anterior) }} a <strong class="text-[#e58a4e]">{{ formatearPrecio(log.detalles?.precio_nuevo) }}</strong>.
                </span>
                <span v-else-if="log.accion === 'ajuste_stock'">
                  Ajuste de inventario en <strong>{{ log.detalles?.producto }}</strong>:
                  tipo {{ log.detalles?.tipo }} por {{ log.detalles?.cantidad }} unidades.
                </span>
                <span v-else-if="log.accion === 'alta_usuario'">
                  Nuevo integrante dado de alta: <strong>{{ log.detalles?.nombre || log.detalles?.email }}</strong>
                  ({{ log.detalles?.email }}) con rol <strong class="text-emerald-300">{{ log.detalles?.rol }}</strong>.
                </span>
                <span v-else-if="log.accion === 'cambio_rol'">
                  Se actualizaron los permisos de <strong>{{ log.detalles?.nombre || nombrarUsuario(log.detalles?.usuario_afectado) }}</strong>
                  a <strong class="text-purple-300">{{ log.detalles?.nuevo_rol }}</strong>.
                </span>
                <span v-else>
                  {{ JSON.stringify(log.detalles) }}
                </span>
              </p>
            </div>
          </div>

          <div v-if="!auditoriaLogs.length" class="py-6 text-center text-xs text-stone-500">
            Todavía no hay movimientos ni avisos registrados.
          </div>
        </div>
      </section>

      <!-- 4. EQUIPO Y USUARIOS DEL LOCAL -->
      <section class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-5 sm:p-6 shadow-sm space-y-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-3">
            <div class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#e58a4e]/30 bg-[#221a15] text-[#e58a4e]">
              <Users :size="18" />
            </div>
            <div>
              <h2 class="font-serif text-2xl font-bold text-white">Equipo y Usuarios del Local</h2>
              <p class="text-xs text-stone-400">Solo el administrador puede crear cuentas y elegir qué puede hacer cada persona en el sistema.</p>
            </div>
          </div>

          <button type="button" @click="abrirModalCrearUsuario"
            class="flex items-center justify-center gap-2 rounded-2xl bg-[#e58a4e] px-4 py-2.5 text-xs font-bold text-[#190d05] transition hover:bg-[#ee975e]">
            <UserPlus :size="15" />
            <span>Crear Nuevo Usuario</span>
          </button>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div v-for="miembro in usuariosEquipo" :key="miembro.usuario_id"
            class="flex flex-col justify-between gap-3 rounded-2xl border border-stone-800/70 bg-[#110d0b] p-4 sm:flex-row sm:items-center">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-bold text-white">{{ miembro.nombre }}</p>
                <span v-if="miembro.usuario_id === authState.user?.id"
                  class="rounded-full border border-[#e58a4e]/40 bg-[#e58a4e]/10 px-2 py-0.5 text-[10px] font-bold text-[#e58a4e]">
                  Tu cuenta
                </span>
              </div>
              <p class="truncate text-xs text-stone-400 mt-0.5">{{ miembro.email }}</p>
            </div>

            <div class="w-full sm:w-64 shrink-0">
              <div v-if="miembro.usuario_id === authState.user?.id"
                class="rounded-xl border border-stone-800 bg-[#17120f] px-3 py-2 text-xs font-semibold text-stone-300">
                Administrador (Control total)
              </div>
              <Combobox
                v-else
                :modelValue="miembro.rol"
                :options="opcionesRol"
                size="sm"
                @update:modelValue="(nuevoRol) => actualizarRol(miembro.usuario_id, String(nuevoRol))"
              />
            </div>
          </div>
        </div>

        <div v-if="!usuariosEquipo.length" class="py-6 text-center text-xs text-stone-500">
          Todavía no hay usuarios cargados en este local.
        </div>
      </section>
    </div>

    <!-- MODAL DETALLE DE TICKET -->
    <div v-if="modalDetalleAbierto && ventaDetalle"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      @click.self="modalDetalleAbierto = false">
      <div class="w-full max-w-lg rounded-3xl border border-stone-800 bg-[#17120f] p-6 text-white shadow-2xl">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Detalle de Comanda</p>
            <h3 class="font-serif text-2xl font-bold text-white mt-0.5">
              Ticket #{{ ventaDetalle.id.slice(0, 8) }}
            </h3>
            <p class="text-xs text-stone-400 mt-1">
              Mesa {{ ventaDetalle.mesa_numero }} · {{ formatearFechaHora(ventaDetalle.created_at) }}
            </p>
          </div>
          <button type="button" @click="modalDetalleAbierto = false"
            class="rounded-full p-2 text-stone-400 hover:bg-[#221a15] hover:text-white transition">
            <X :size="16" />
          </button>
        </div>

        <div class="mt-5 space-y-3 border-t border-stone-800/80 pt-4">
          <div class="space-y-2">
            <div v-for="d in ventaDetalle.detalle_ventas" :key="d.id"
              class="flex items-center justify-between text-xs py-1.5 border-b border-stone-800/40">
              <div>
                <strong class="text-stone-100">{{ d.productos?.nombre || 'Plato' }}</strong>
                <span class="text-stone-500 ml-2">x{{ d.cantidad }}</span>
              </div>
              <div class="text-right">
                <span class="text-stone-300 font-semibold">{{ formatearPrecio(d.subtotal) }}</span>
                <span class="block text-[10px] text-stone-500">({{ formatearPrecio(d.precio_unitario) }} c/u)</span>
              </div>
            </div>
          </div>

          <div class="flex justify-between items-center pt-3 text-base font-bold">
            <span class="text-stone-300">Total Liquidado</span>
            <span class="font-serif text-2xl text-[#e58a4e]">{{ formatearPrecio(ventaDetalle.total) }}</span>
          </div>

          <div class="mt-4 rounded-xl border border-stone-800 bg-[#110d0b] p-3 text-xs text-stone-400">
            <p><strong>Método de Pago:</strong> <span class="capitalize text-stone-200">{{ ventaDetalle.metodo_pago.replace('_', ' ') }}</span></p>
            <p v-if="ventaDetalle.motivo_anulacion" class="mt-1 text-rose-400">
              <strong>Motivo de Anulación:</strong> {{ ventaDetalle.motivo_anulacion }}
            </p>
          </div>
        </div>

        <div class="mt-5 flex justify-end">
          <button type="button" @click="modalDetalleAbierto = false"
            class="rounded-xl border border-stone-800 bg-[#110d0b] px-4 py-2 text-xs font-semibold text-stone-300 hover:text-white transition">
            Cerrar
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL DE ANULACIÓN DE TICKET CON RESTITUCIÓN DE STOCK -->
    <div v-if="modalAnularAbierto && ventaAAnular"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      @click.self="modalAnularAbierto = false">
      <div class="w-full max-w-md rounded-3xl border border-rose-900/60 bg-[#17120f] p-6 text-white shadow-2xl">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-900/60 bg-rose-950/40 text-rose-300">
            <Ban :size="18" />
          </div>
          <div>
            <h3 class="font-serif text-xl font-bold text-white">Anular Venta / Ticket</h3>
            <p class="text-xs text-stone-400">Ticket #{{ ventaAAnular.id.slice(0, 8) }} · Mesa {{ ventaAAnular.mesa_numero }}</p>
          </div>
        </div>

        <div class="mt-4 rounded-xl border border-amber-900/40 bg-amber-950/20 p-3 text-xs text-amber-200/90 leading-relaxed">
          <p class="font-semibold text-amber-300">⚠️ Impacto administrativo:</p>
          Esta acción anulará el ingreso de <strong>{{ formatearPrecio(ventaAAnular.total) }}</strong>, restituirá automáticamente las unidades al stock del menú y guardará el registro en el historial de movimientos.
        </div>

        <form class="mt-4 space-y-3" @submit.prevent="confirmarAnulacion">
          <label class="block text-xs font-bold text-stone-300">
            Motivo de la anulación *
            <textarea v-model="motivoAnulacion" rows="3" required placeholder="Ej: Comanda duplicada / Error de mesa por parte del mozo..."
              class="mt-1.5 w-full resize-none rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2.5 text-xs text-white outline-none focus:border-rose-500 transition"></textarea>
          </label>

          <p v-if="errorAnulacion" role="alert" class="text-xs font-medium text-rose-400">
            {{ errorAnulacion }}
          </p>

          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-800/80">
            <button type="button" @click="modalAnularAbierto = false"
              class="rounded-xl border border-stone-800 bg-[#110d0b] px-4 py-2.5 text-xs font-semibold text-stone-300 hover:text-white transition">
              Cancelar
            </button>
            <button type="submit" :disabled="procesandoAnulacion"
              class="rounded-xl border border-rose-900/60 bg-rose-900/40 px-4 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-900/60 transition disabled:opacity-50">
              {{ procesandoAnulacion ? 'Procesando...' : 'Confirmar Anulación' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL CREAR NUEVO USUARIO (SOLO ADMIN) -->
    <div v-if="modalCrearUsuarioAbierto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      @click.self="modalCrearUsuarioAbierto = false">
      <div class="w-full max-w-md rounded-3xl border border-stone-800 bg-[#17120f] p-6 text-white shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Alta de Personal</p>
            <h3 class="mt-0.5 font-serif text-2xl font-bold text-white">Crear Nuevo Usuario</h3>
            <p class="mt-1 text-xs text-stone-400">La cuenta quedará habilitada únicamente dentro de este local.</p>
          </div>
          <button type="button" @click="modalCrearUsuarioAbierto = false"
            class="rounded-full p-2 text-stone-400 hover:bg-[#221a15] hover:text-white transition">
            <X :size="16" />
          </button>
        </div>

        <form class="mt-5 space-y-3.5" @submit.prevent="crearNuevoUsuario">
          <label class="block text-xs font-bold text-stone-300">
            Nombre y apellido
            <input v-model="nuevoUsuario.nombre" type="text" required placeholder="Ej: Sofía González"
              class="mt-1.5 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#e58a4e] transition" />
          </label>

          <label class="block text-xs font-bold text-stone-300">
            Correo electrónico
            <input v-model="nuevoUsuario.email" type="email" required placeholder="sofia@tulocal.com"
              class="mt-1.5 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#e58a4e] transition" />
          </label>

          <label class="block text-xs font-bold text-stone-300">
            Contraseña inicial (mínimo 8 caracteres)
            <input v-model="nuevoUsuario.password" type="password" minlength="8" required placeholder="••••••••"
              class="mt-1.5 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#e58a4e] transition" />
          </label>

          <div>
            <Combobox
              v-model="nuevoUsuario.rol"
              :options="opcionesRol"
              label="Nivel de acceso"
              size="md"
            />
          </div>

          <p v-if="errorUsuario" role="alert" class="text-xs font-medium text-rose-400">
            {{ errorUsuario }}
          </p>

          <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-800/80">
            <button type="button" @click="modalCrearUsuarioAbierto = false"
              class="rounded-xl border border-stone-800 bg-[#110d0b] px-4 py-2.5 text-xs font-semibold text-stone-300 hover:text-white transition">
              Cancelar
            </button>
            <button type="submit" :disabled="creandoUsuario"
              class="rounded-xl bg-[#e58a4e] px-4 py-2.5 text-xs font-bold text-[#190d05] hover:bg-[#ee975e] transition disabled:opacity-50">
              {{ creandoUsuario ? 'Creando...' : 'Crear Usuario' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>

