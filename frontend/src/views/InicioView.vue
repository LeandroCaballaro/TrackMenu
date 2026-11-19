<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import Combobox from '../components/Combobox.vue'
import PlanoMesas from '../components/PlanoMesas.vue'
import {
  authState,
  productosService,
  mesasService,
  reservasService,
  obtenerFechaHoyLocal,
  sincronizarConServidor,
} from '@/services/api'
import {
  ArrowRight, Bell, Check, ChevronUp, CircleDollarSign, Clock3, Minus, Plus,
  ShoppingBag, X, Banknote, CreditCard, ArrowRightLeft, Search, Trash2,
  RefreshCw, AlertCircle, UtensilsCrossed, CalendarCheck, Lock, QrCode,
} from 'lucide-vue-next'

const route = useRoute()

const paymentOptions = [
  { value: 'Efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'Tarjeta', label: 'Tarjeta', icon: CreditCard },
  { value: 'Transferencia', label: 'Transferencia', icon: ArrowRightLeft },
]

const parseMesaQuery = (raw) => {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

const opcionesPersonalizacion = ['Sin cebolla', 'Sin sal', 'Papas grandes', 'Salsa aparte']

const formatPrice = (price) => `$ ${Number(price || 0).toLocaleString('es-AR')}`

// Sincronización de vista según rol y query de la URL (?vista=mesas | ?vista=carta)
const permisoMesas = computed(() => authState.rol === 'admin' || authState.rol === 'empleado')
const esAdmin = computed(() => authState.rol === 'admin' || authState.rol === 'superadmin')
const initialView = (route.query.vista === 'mesas' && permisoMesas.value) ? 'cajero' : 'cliente'
const view = ref(initialView)
const editandoMapa = ref(false)

watch(() => route.query.vista, (nuevaVista) => {
  if (nuevaVista === 'mesas' && permisoMesas.value) {
    view.value = 'cajero'
  } else {
    view.value = 'cliente'
  }
})
// El router manda acá con ?denegado=true cuando el rol no alcanza.
const accesoDenegado = computed(() => route.query.denegado === 'true')

watch(() => route.query.mesa, (nuevaMesa) => {
  if (nuevaMesa !== undefined) {
    mesaCliente.value = parseMesaQuery(nuevaMesa)
  }
})

// Catálogo real y estado real de las 12 mesas
const productosCatalogo = ref([])
const cargandoCatalogo = ref(true)
const mesas = ref(
  Array.from({ length: 12 }, (_, idx) => ({ numero: idx + 1, ocupada: false, comanda: null })),
)
const mesaOptions = computed(() => {
  if (Array.isArray(mesas.value) && mesas.value.length > 0) {
    return mesas.value.map((m) => ({
      value: m.numero,
      label: `Mesa ${m.numero}`,
    }))
  }
  return Array.from({ length: 12 }, (_, idx) => ({
    value: idx + 1,
    label: `Mesa ${idx + 1}`,
  }))
})
const cargandoMesas = ref(false)

// Estado vista Cliente (Carta Digital)
const mesaCliente = ref(parseMesaQuery(route.query.mesa))
const busquedaCatalogo = ref('')
const soloDisponibles = ref(false)
const cart = ref([]) // [{ key, producto_id, nombre, precio_unitario, cantidad, opciones, stock_disponible }]
const selected = ref(null)
const opcionesSeleccionadas = ref([])
const notaProducto = ref('')
const orderSent = ref(false)
const ultimoPedidoEnviado = ref(null)
const enviandoPedido = ref(false)
const mobileCartOpen = ref(false)

// Estado vista Cajero (Control de Mesas)
const selectedTable = ref(parseMesaQuery(route.query.mesa))
const panelComandaRef = ref(null)
const payment = ref('Efectivo')
const productoRapidoId = ref('')
const cantidadRapida = ref(1)
const procesandoMesa = ref(false)

const seleccionarMesa = (numero) => {
  selectedTable.value = numero
  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    panelComandaRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function onActualizarMesasConfig() {
  cargarMesas()
}

function onNotificarPlano({ mensaje, tipo }) {
  mostrarFeedback(mensaje, tipo)
}

// Feedback inline / Toast
const feedback = ref({ visible: false, tipo: 'exito', mensaje: '' })
let feedbackTimer = null
const mostrarFeedback = (mensaje, tipo = 'exito') => {
  if (feedbackTimer) clearTimeout(feedbackTimer)
  feedback.value = { visible: true, tipo, mensaje }
  feedbackTimer = setTimeout(() => {
    feedback.value.visible = false
  }, 4000)
}

const fallbackImagen = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80'

async function cargarCatalogo() {
  cargandoCatalogo.value = true
  const res = await productosService.listar({ activo: true, orden: 'nombre', dir: 'asc', limite: 100 })
  cargandoCatalogo.value = false
  if (res.success && Array.isArray(res.data)) {
    productosCatalogo.value = res.data.filter((p) => p.activo !== false)
  }
}

const reservasHoy = ref([])
const codigoReservaInput = ref('')
const reservaCliente = ref(null)
const codigoClienteInput = ref('')

const puedePedirCliente = computed(() =>
  Boolean(reservaCliente.value && reservaCliente.value.asistencia_confirmada === true),
)

function sincronizarReservaCliente() {
  const queryCodigo = String(route.query.codigo || '').trim().toUpperCase()
  if (queryCodigo && !permisoMesas.value) {
    reservasService.guardarCodigoReservaCliente(queryCodigo)
  }

  const codigo = queryCodigo || reservasService.obtenerCodigoReservaCliente()
  const encontrada = codigo ? reservasService.obtenerReservaPorCodigo(codigo) : null
  reservaCliente.value = encontrada
  if (encontrada?.mesa_numero) {
    mesaCliente.value = Number(encontrada.mesa_numero)
  }
  cargarReservasHoy()
}

function vincularCodigoCliente() {
  const codigo = codigoClienteInput.value.trim().toUpperCase()
  if (!codigo) {
    mostrarFeedback('Ingresá el código de tu reserva.', 'error')
    return
  }
  const encontrada = reservasService.obtenerReservaPorCodigo(codigo)
  if (!encontrada) {
    mostrarFeedback(`No encontramos ninguna reserva activa con el código ${codigo}.`, 'error')
    return
  }
  reservasService.guardarCodigoReservaCliente(codigo)
  codigoClienteInput.value = ''
  sincronizarReservaCliente()
  mostrarFeedback(
    encontrada.asistencia_confirmada
      ? `¡Mesa ${encontrada.mesa_numero} habilitada! Ya podés hacer tu pedido.`
      : `Reserva vinculada (Mesa ${encontrada.mesa_numero}). Esperando que el empleado escanee tu QR o confirme tu código.`,
    encontrada.asistencia_confirmada ? 'exito' : 'info',
  )
}

function cargarReservasHoy() {
  reservasHoy.value = reservasService.obtenerReservasPorFecha(obtenerFechaHoyLocal())
}

const reservasMesaSeleccionada = computed(() =>
  reservasHoy.value.filter((r) => Number(r.mesa_numero) === Number(selectedTable.value)),
)

function confirmarLlegadaReserva(codigoOverride = null, mesaNumero = null) {
  const codigo = (codigoOverride ?? codigoReservaInput.value).trim().toUpperCase()
  const res = reservasService.confirmarLlegadaPorCodigo(codigo, mesaNumero)
  if (!res.success) {
    mostrarFeedback(res.message, 'error')
    return
  }
  codigoReservaInput.value = ''
  cargarReservasHoy()
  if (res.data?.mesa_numero) {
    selectedTable.value = Number(res.data.mesa_numero)
  }
  mostrarFeedback(res.message, 'exito')
}

function cancelarReservaMesa(id) {
  const res = reservasService.cancelarReserva(id)
  if (res.success) {
    cargarReservasHoy()
    mostrarFeedback('Reserva cancelada y mesa liberada.', 'info')
  }
}

async function cargarMesas() {
  cargandoMesas.value = true
  const res = await mesasService.listarMesas()
  cargandoMesas.value = false
  if (res.success && Array.isArray(res.data)) {
    mesas.value = res.data
  }
  cargarReservasHoy()
}

onMounted(async () => {
  // El plano y las reservas viven en la base: se traen antes de pintar.
  await sincronizarConServidor()
  await Promise.all([cargarCatalogo(), cargarMesas()])
  sincronizarReservaCliente()

  // Si un empleado/admin escanea el QR de una reserva (?codigo=...), confirmar llegada automáticamente
  const codigoQuery = String(route.query.codigo || '').trim().toUpperCase()
  if (codigoQuery && permisoMesas.value) {
    view.value = 'cajero'
    confirmarLlegadaReserva(codigoQuery)
  }

  window.addEventListener('storage', sincronizarReservaCliente)
  window.addEventListener('focus', sincronizarReservaCliente)
})

onUnmounted(() => {
  window.removeEventListener('storage', sincronizarReservaCliente)
  window.removeEventListener('focus', sincronizarReservaCliente)
})

watch(() => authState.organizacion?.id, async () => {
  cart.value = []
  orderSent.value = false
  ultimoPedidoEnviado.value = null
  await Promise.all([cargarCatalogo(), cargarMesas()])
})

const visibleProducts = computed(() => {
  const term = busquedaCatalogo.value.trim().toLowerCase()
  return productosCatalogo.value.filter((p) => {
    if (soloDisponibles.value && Number(p.stock || 0) <= 0) return false
    if (!term) return true
    return (
      String(p.nombre || '').toLowerCase().includes(term) ||
      String(p.descripcion || '').toLowerCase().includes(term)
    )
  })
})

const totalUnidadesCarrito = computed(() =>
  cart.value.reduce((sum, item) => sum + Number(item.cantidad || 0), 0),
)

const total = computed(() =>
  cart.value.reduce((sum, item) => sum + Number(item.precio_unitario || 0) * Number(item.cantidad || 0), 0),
)

const mesaClienteActual = computed(() =>
  mesas.value.find((m) => m.numero === mesaCliente.value) || { numero: mesaCliente.value, ocupada: false, comanda: null },
)

const getProductQtyInCart = (productoId) =>
  cart.value
    .filter((item) => String(item.producto_id) === String(productoId))
    .reduce((sum, item) => sum + Number(item.cantidad || 0), 0)

const stockRestanteParaProducto = (product) => {
  const stockReal = Number(product.stock ?? 0)
  const enComandaMesa = (mesaClienteActual.value?.comanda?.items || [])
    .filter((it) => String(it.producto_id) === String(product.id))
    .reduce((sum, it) => sum + Number(it.cantidad || 0), 0)
  return Math.max(0, stockReal - enComandaMesa - getProductQtyInCart(product.id))
}

const buildItemKey = (productoId, opciones = []) => {
  const cleanOps = [...opciones].map((o) => String(o).trim()).filter(Boolean).sort()
  return `${productoId}::${JSON.stringify(cleanOps)}`
}

const abrirModalPersonalizar = (product) => {
  if (permisoMesas.value) return
  if (view.value === 'cliente' && !puedePedirCliente.value) {
    mostrarFeedback(
      reservaCliente.value
        ? 'Tu reserva aún no fue validada en el local. Mostrá tu QR o código al empleado para habilitar pedidos.'
        : 'Solo podés ver el catálogo. Para hacer un pedido primero debés realizar una reserva.',
      'error',
    )
    return
  }
  if (Number(product.stock ?? 0) <= 0) {
    mostrarFeedback(`"${product.nombre}" se encuentra sin stock en este momento.`, 'error')
    return
  }
  selected.value = product
  opcionesSeleccionadas.value = []
  notaProducto.value = ''
}

const addToCart = (product, opciones = []) => {
  if (!product) return
  if (stockRestanteParaProducto(product) <= 0) {
    mostrarFeedback(`No queda más stock disponible de "${product.nombre}".`, 'error')
    return
  }

  orderSent.value = false
  ultimoPedidoEnviado.value = null
  const cleanOpciones = opciones.map((o) => String(o).trim()).filter(Boolean)
  const key = buildItemKey(product.id, cleanOpciones)
  const existing = cart.value.find((item) => item.key === key)

  if (existing) {
    existing.cantidad += 1
  } else {
    cart.value.push({
      key,
      producto_id: product.id,
      nombre: product.nombre,
      precio_unitario: Number(product.precio || 0),
      cantidad: 1,
      opciones: cleanOpciones,
      stock_disponible: Number(product.stock ?? 0),
    })
  }
}

const agregarDesdeModal = () => {
  if (!selected.value) return
  const opciones = [...opcionesSeleccionadas.value]
  if (notaProducto.value.trim()) {
    opciones.push(`Nota: ${notaProducto.value.trim()}`)
  }
  addToCart(selected.value, opciones)
  selected.value = null
}

const incrementCartItem = (key) => {
  const item = cart.value.find((i) => i.key === key)
  if (!item) return
  const prod = productosCatalogo.value.find((p) => String(p.id) === String(item.producto_id))
  if (prod && stockRestanteParaProducto(prod) <= 0) {
    mostrarFeedback(`Alcanzaste el límite de stock de "${item.nombre}".`, 'error')
    return
  }
  item.cantidad += 1
}

const decrementCartItem = (key) => {
  const index = cart.value.findIndex((i) => i.key === key)
  if (index === -1) return
  if (cart.value[index].cantidad > 1) {
    cart.value[index].cantidad -= 1
  } else {
    cart.value.splice(index, 1)
  }
  if (cart.value.length === 0) {
    mobileCartOpen.value = false
  }
}

const removeCartItem = (key) => {
  cart.value = cart.value.filter((i) => i.key !== key)
  if (cart.value.length === 0) {
    mobileCartOpen.value = false
  }
}

const sendOrder = async () => {
  if (!puedePedirCliente.value) {
    mostrarFeedback(
      reservaCliente.value
        ? 'Tu reserva aún no fue escaneada/confirmada en el local.'
        : 'Debés tener una reserva confirmada y validada para enviar un pedido.',
      'error',
    )
    return
  }
  if (!cart.value.length || enviandoPedido.value) return
  enviandoPedido.value = true
  const res = await mesasService.enviarPedido({
    mesaNumero: mesaCliente.value,
    items: cart.value,
  })
  enviandoPedido.value = false

  if (res.success && res.data) {
    ultimoPedidoEnviado.value = {
      numero_pedido: res.data.numero_pedido,
      mesa_numero: res.data.mesa_numero,
      total: res.data.total,
    }
    orderSent.value = true
    cart.value = []
    await cargarMesas()
    mostrarFeedback(res.message, 'exito')
  } else {
    mostrarFeedback(res.message || 'No se pudo enviar el pedido.', 'error')
  }
}

const iniciarNuevoPedido = () => {
  orderSent.value = false
  ultimoPedidoEnviado.value = null
}

// Lógica de Control de Mesas (Cajero / Mozo)
const mesaActual = computed(() =>
  mesas.value.find((m) => m.numero === selectedTable.value) || {
    numero: selectedTable.value,
    ocupada: false,
    comanda: null,
  },
)

const comandaActual = computed(() => mesaActual.value?.comanda || null)
const tableOccupied = computed(() => Boolean(mesaActual.value?.ocupada && comandaActual.value))

const opcionesProductoRapido = computed(() =>
  productosCatalogo.value
    .filter((p) => Number(p.stock || 0) > 0)
    .map((p) => ({
      value: p.id,
      label: `${p.nombre} · ${formatPrice(p.precio)} (${p.stock} disp.)`,
    })),
)

const agregarPlatoAMesa = async () => {
  if (!productoRapidoId.value || procesandoMesa.value) return
  const prod = productosCatalogo.value.find((p) => String(p.id) === String(productoRapidoId.value))
  if (!prod) {
    mostrarFeedback('Seleccioná un producto válido del catálogo.', 'error')
    return
  }
  const cant = Math.max(1, Number(cantidadRapida.value || 1))
  procesandoMesa.value = true
  const res = await mesasService.enviarPedido({
    mesaNumero: selectedTable.value,
    items: [
      {
        producto_id: prod.id,
        nombre: prod.nombre,
        precio_unitario: Number(prod.precio || 0),
        cantidad: cant,
        stock_disponible: Number(prod.stock ?? 0),
      },
    ],
  })
  procesandoMesa.value = false

  if (res.success) {
    productoRapidoId.value = ''
    cantidadRapida.value = 1
    await cargarMesas()
    mostrarFeedback(res.message, 'exito')
  } else {
    mostrarFeedback(res.message || 'No se pudo agregar el producto a la mesa.', 'error')
  }
}

const quitarItemComanda = async (index) => {
  if (procesandoMesa.value) return
  procesandoMesa.value = true
  const res = await mesasService.quitarItemMesa({
    mesaNumero: selectedTable.value,
    index,
  })
  procesandoMesa.value = false

  if (res.success) {
    await cargarMesas()
    mostrarFeedback(res.message, 'exito')
  } else {
    mostrarFeedback(res.message || 'No se pudo quitar el ítem.', 'error')
  }
}

const cancelarComanda = async () => {
  if (procesandoMesa.value || !tableOccupied.value) return
  procesandoMesa.value = true
  const res = await mesasService.cancelarComandaMesa({
    mesaNumero: selectedTable.value,
  })
  procesandoMesa.value = false

  if (res.success) {
    await cargarMesas()
    mostrarFeedback(res.message, 'exito')
  } else {
    mostrarFeedback(res.message || 'No se pudo cancelar la comanda.', 'error')
  }
}

const freeTable = async () => {
  if (procesandoMesa.value || !tableOccupied.value) return
  procesandoMesa.value = true
  const res = await mesasService.cobrarYLiberarMesa({
    mesaNumero: selectedTable.value,
    metodoPago: payment.value,
  })
  procesandoMesa.value = false

  if (res.success) {
    await Promise.all([cargarMesas(), cargarCatalogo()])
    mostrarFeedback(res.message, 'exito')
  } else {
    mostrarFeedback(res.message || 'No se pudo cobrar y liberar la mesa.', 'error')
  }
}
</script>

<template>
  <main class="relative z-0 min-h-dvh overflow-x-clip bg-[#0c0a09] text-[#f5f2eb]">
    <p v-if="accesoDenegado" role="alert"
      class="relative z-20 w-full bg-[#7f1d1d] px-4 py-2 text-center text-[11px] font-bold text-red-50 sm:px-8">
      No tenés permiso para entrar a esa pantalla con tu rol ({{ route.query.rol || authState.rol }}).
    </p>

    <!-- Notificación Flotante -->
    <transition
      enter-active-class="transform transition ease-out duration-200"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0">
      <div
        v-if="feedback.visible"
        class="fixed bottom-20 right-5 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold shadow-2xl backdrop-blur-md lg:bottom-5"
        :class="feedback.tipo === 'error'
          ? 'border-rose-900/60 bg-[#2b1111] text-rose-200'
          : 'border-[#204933] bg-[#163223] text-[#4ade80]'">
        <AlertCircle v-if="feedback.tipo === 'error'" :size="15" />
        <Check v-else :size="15" />
        <span>{{ feedback.mensaje }}</span>
        <button type="button" @click="feedback.visible = false" class="ml-1 text-stone-400 hover:text-white">
          <X :size="13" />
        </button>
      </div>
    </transition>
    <!-- Ambient glow background decoration -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40">
      <div class="absolute -top-[20%] left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#e58a4e]/15 via-[#e58a4e]/5 to-transparent blur-3xl"></div>
    </div>

    <!-- CLIENTE / CATÁLOGO VIEW (CARTA DIGITAL REAL) -->
    <section
      v-if="view === 'cliente'"
      :class="permisoMesas ? 'max-w-[960px]' : 'max-w-[1400px] lg:grid-cols-[minmax(0,1fr)_380px]'"
      class="relative mx-auto grid w-full min-w-0 gap-6 px-4 pt-4 pb-6 sm:gap-8 sm:px-6 sm:py-8 md:px-8">
      <div :class="permisoMesas ? 'w-full min-w-0' : 'mx-auto w-full min-w-0 max-w-[760px] lg:mx-0'">
        <!-- Title & Table selector (solo cliente) o acceso a edición (admin) -->
        <div class="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e58a4e] sm:text-xs">
              {{ permisoMesas ? (esAdmin ? 'Vista Administrador' : 'Vista de Equipo') : 'Escanea y elegí' }}
            </p>
            <h1 class="mt-0.5 font-serif text-2xl font-bold tracking-tight text-white sm:mt-1 sm:text-4xl">
              {{ permisoMesas ? 'Catálogo del Local' : 'Trackea tu Menú' }}
            </h1>
          </div>

          <template v-if="permisoMesas">
            <RouterLink
              v-if="esAdmin"
              to="/productos"
              class="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#e58a4e]/40 bg-[#e58a4e]/10 px-4 py-2 text-xs font-bold text-[#e58a4e] transition hover:bg-[#e58a4e] hover:text-[#190d05]"
            >
              <span>Editar platos y precios</span>
              <ArrowRight :size="14" />
            </RouterLink>
          </template>
          <template v-else>
            <div v-if="reservaCliente" class="shrink-0 rounded-xl border border-[#e58a4e]/40 bg-[#17120f] px-3.5 py-2 text-xs font-bold text-[#e58a4e]">
              Mesa {{ reservaCliente.mesa_numero }}
            </div>
            <div v-else class="w-36 shrink-0">
              <Combobox
                v-model="mesaCliente"
                :options="mesaOptions"
                size="sm"
                placeholder="Mesa"
              />
            </div>
          </template>
        </div>

        <!-- Banner de habilitación de pedidos por reserva + QR (solo para clientes) -->
        <template v-if="!permisoMesas">
        <div
          v-if="!reservaCliente"
          class="mb-5 rounded-2xl border border-amber-500/35 bg-[#1b140e] p-4 text-xs space-y-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-start gap-2.5">
              <Lock :size="16" class="mt-0.5 shrink-0 text-amber-400" />
              <div>
                <p class="font-bold text-amber-200">Catálogo en modo consulta</p>
                <p class="mt-0.5 text-stone-300 leading-relaxed">
                  Podés explorar toda nuestra carta, pero para realizar pedidos debés tener una reserva confirmada y validada al llegar al local.
                </p>
              </div>
            </div>
            <RouterLink
              to="/"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#e58a4e] px-3.5 py-2 text-xs font-extrabold text-[#190d05] transition hover:bg-[#ee975e]">
              <CalendarCheck :size="14" />
              <span>Hacer reserva</span>
            </RouterLink>
          </div>

          <div class="flex flex-wrap items-center gap-2 border-t border-white/5 pt-2.5">
            <span class="text-[11px] text-stone-400">¿Ya tenés código de reserva?</span>
            <input
              v-model="codigoClienteInput"
              type="text"
              maxlength="12"
              placeholder="Ej. 8K4M2P9X"
              @keydown.enter.prevent="vincularCodigoCliente"
              class="w-36 rounded-lg border border-stone-700 bg-[#110d0b] px-2.5 py-1 font-mono text-[11px] uppercase text-white placeholder-stone-500 outline-none focus:border-[#e58a4e]"
            />
            <button
              type="button"
              @click="vincularCodigoCliente"
              class="rounded-lg border border-stone-700 bg-[#221a15] px-2.5 py-1 text-[11px] font-bold text-stone-200 transition hover:border-[#e58a4e] hover:text-white">
              Vincular código
            </button>
          </div>
        </div>

        <div
          v-else-if="!puedePedirCliente"
          class="mb-5 rounded-2xl border border-violet-500/40 bg-[#1a132b] p-4 text-xs">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-start gap-2.5">
              <QrCode :size="17" class="mt-0.5 shrink-0 text-violet-300" />
              <div>
                <p class="font-bold text-violet-200">
                  Reserva pendiente de validación · Mesa {{ reservaCliente.mesa_numero }} ({{ reservaCliente.hora }} hs)
                </p>
                <p class="mt-0.5 text-stone-300 leading-relaxed">
                  Código: <b class="font-mono text-[#e58a4e]">{{ reservaCliente.codigo_confirmacion }}</b> · Mostrá tu QR o código al empleado cuando llegues al local para habilitar los pedidos.
                </p>
              </div>
            </div>
            <button
              type="button"
              @click="sincronizarReservaCliente"
              class="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-400/40 bg-violet-950/50 px-3 py-1.5 text-[11px] font-bold text-violet-200 transition hover:bg-violet-800/50">
              <RefreshCw :size="12" />
              <span>Verificar QR</span>
            </button>
          </div>
        </div>

        <div
          v-else
          class="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-950/25 px-4 py-2.5 text-xs text-emerald-200">
          <div class="flex items-center gap-2">
            <Check :size="15" class="text-emerald-400" />
            <span>
              <b>¡Pedidos habilitados!</b> Llegada confirmada para Mesa {{ reservaCliente.mesa_numero }} ({{ reservaCliente.nombre_cliente }}).
            </span>
          </div>
          <span class="font-mono text-[11px] font-bold text-emerald-400">{{ reservaCliente.codigo_confirmacion }}</span>
        </div>
        </template>

        <!-- Buscador y filtro de disponibilidad -->
        <div class="mb-5 flex flex-col gap-2.5 sm:mb-6 sm:flex-row sm:items-center">
          <div class="relative flex-1">
            <Search :size="15" class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              v-model="busquedaCatalogo"
              type="text"
              placeholder="Buscar platos o bebidas del menú..."
              class="w-full rounded-full border border-white/10 bg-[#17120f] py-2.5 pl-10 pr-9 text-xs text-white placeholder:text-stone-500 outline-none focus:border-[#e58a4e] transition"
            />
            <button
              v-if="busquedaCatalogo"
              type="button"
              @click="busquedaCatalogo = ''"
              aria-label="Limpiar búsqueda"
              class="btn-inline-clear absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white">
              <X :size="14" />
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="soloDisponibles = false"
              class="btn-filter min-h-[38px] whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition"
              :class="!soloDisponibles ? 'bg-[#e58a4e] text-[#190d05]' : 'bg-[#17120f] border border-white/5 text-stone-400 hover:text-stone-200'">
              Todos ({{ productosCatalogo.length }})
            </button>
            <button
              type="button"
              @click="soloDisponibles = true"
              class="btn-filter min-h-[38px] whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition"
              :class="soloDisponibles ? 'bg-[#e58a4e] text-[#190d05]' : 'bg-[#17120f] border border-white/5 text-stone-400 hover:text-stone-200'">
              Con stock
            </button>
          </div>
        </div>

        <!-- Estado de carga o catálogo vacío -->
        <div v-if="cargandoCatalogo" class="rounded-2xl border border-white/5 bg-[#17120f] p-8 text-center text-xs text-stone-400">
          Cargando carta actualizada...
        </div>

        <div
          v-else-if="!visibleProducts.length"
          class="rounded-2xl border border-dashed border-stone-800 bg-[#17120f]/60 p-8 text-center">
          <UtensilsCrossed :size="24" class="mx-auto text-stone-600" />
          <p class="mt-3 text-sm font-semibold text-stone-300">No encontramos platos disponibles</p>
          <p class="mt-1 text-xs text-stone-500">
            {{ busquedaCatalogo ? 'Probá con otro término de búsqueda.' : 'El local todavía no publicó platos activos.' }}
          </p>
        </div>

        <!-- Product Cards reales del catálogo -->
        <div v-else class="w-full min-w-0 space-y-3 sm:space-y-3.5">
          <article
            v-for="product in visibleProducts"
            :key="product.id"
            @click="abrirModalPersonalizar(product)"
            class="box-border flex w-full min-w-0 max-w-full cursor-pointer gap-3.5 overflow-hidden rounded-2xl border border-white/5 bg-[#17120f] p-3.5 transition duration-150 hover:border-white/15 sm:gap-4 sm:p-4"
            :class="Number(product.stock ?? 0) <= 0 ? 'opacity-65' : ''">
            <img
              :src="product.imagen_url || fallbackImagen"
              :alt="product.nombre"
              class="h-20 w-20 shrink-0 rounded-xl object-cover bg-stone-900 sm:h-28 sm:w-28"
            />
            <div class="flex min-w-0 flex-1 flex-col justify-between overflow-hidden">
              <div class="min-w-0">
                <div class="flex min-w-0 items-start justify-between gap-2">
                  <h2 class="min-w-0 text-[15px] font-bold leading-snug text-white sm:text-lg">
                    {{ product.nombre }}
                  </h2>
                  <span class="shrink-0 tabular-nums text-sm font-bold text-[#e58a4e] sm:text-base">
                    {{ formatPrice(product.precio) }}
                  </span>
                </div>
                <p class="mt-1 line-clamp-2 max-w-[430px] break-words text-xs leading-relaxed text-stone-400 sm:line-clamp-none">
                  {{ product.descripcion || 'Preparado en el momento.' }}
                </p>
              </div>

              <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  v-if="!permisoMesas"
                  type="button"
                  :disabled="!puedePedirCliente || stockRestanteParaProducto(product) <= 0"
                  @click.stop="abrirModalPersonalizar(product)"
                  class="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-white/10 bg-[#221a15] px-4 py-1.5 text-xs font-bold text-stone-200 transition hover:border-white/20 hover:bg-[#2e231d] hover:text-white disabled:cursor-not-allowed disabled:opacity-45">
                  <Lock v-if="!puedePedirCliente" :size="13" class="text-stone-400" />
                  <Plus v-else :size="14" class="text-[#e58a4e]" />
                  <span>
                    {{
                      !puedePedirCliente
                        ? (reservaCliente ? 'Esperando QR' : 'Requiere reserva')
                        : Number(product.stock ?? 0) <= 0
                          ? 'Sin stock'
                          : 'Agregar'
                    }}
                  </span>
                </button>
                <span v-else class="text-[11px] font-medium text-stone-500">
                  {{ product.categoria || 'Plato activo en carta' }}
                </span>

                <div class="flex items-center gap-2">
                  <span
                    v-if="getProductQtyInCart(product.id) > 0"
                    class="rounded-full border border-[#e58a4e]/35 bg-[#e58a4e]/10 px-2.5 py-1 text-[11px] font-bold text-[#e58a4e]">
                    {{ getProductQtyInCart(product.id) }} en pedido
                  </span>
                  <span
                    class="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                    :class="Number(product.stock ?? 0) <= 0
                      ? 'border border-rose-900/60 bg-rose-950/30 text-rose-300'
                      : Number(product.stock ?? 0) <= 5
                        ? 'border border-amber-800/50 bg-amber-950/25 text-amber-300'
                        : 'text-stone-500'">
                    {{ Number(product.stock ?? 0) <= 0 ? 'Agotado' : `${product.stock} disp.` }}
                  </span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      <!-- Mobile Bottom Sheet Backdrop (solo cliente) -->
      <div
        v-if="!permisoMesas"
        v-show="mobileCartOpen"
        class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm lg:hidden"
        @click="mobileCartOpen = false"
      />

      <!-- Right Aside (Desktop Sticky) / Bottom Sheet (Mobile) - solo cliente -->
      <aside
        v-if="!permisoMesas"
        :class="mobileCartOpen
          ? 'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-x border-white/10 bg-[#17120f] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl lg:static lg:z-auto lg:block lg:max-h-none lg:overflow-visible lg:rounded-3xl lg:border lg:border-white/5 lg:p-6 lg:sticky lg:top-24'
          : 'hidden lg:block h-fit min-w-0 max-w-full overflow-hidden rounded-3xl border border-white/5 bg-[#17120f] p-6 shadow-2xl lg:sticky lg:top-24'">
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-700 lg:hidden" />

        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Tu pedido</p>
            <h2 class="mt-0.5 font-serif text-2xl font-bold text-white">Mesa {{ mesaCliente }}</h2>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-[#221a15] text-[#e58a4e]">
              <ShoppingBag :size="18" />
            </div>
            <button
              v-if="mobileCartOpen"
              type="button"
              @click="mobileCartOpen = false"
              aria-label="Cerrar pedido"
              class="flex h-10 w-10 items-center justify-center rounded-full border border-stone-800 bg-[#110d0b] text-stone-300 transition lg:hidden">
              <X :size="18" />
            </button>
          </div>
        </div>

        <!-- Resumen de comanda ya enviada en esta mesa -->
        <div
          v-if="mesaClienteActual.ocupada && mesaClienteActual.comanda"
          class="mt-4 rounded-2xl border border-[#e58a4e]/30 bg-[#221a15]/70 px-3.5 py-2.5 text-xs">
          <div class="flex items-center justify-between text-[#e58a4e] font-semibold">
            <span>Comanda abierta · Pedido #{{ mesaClienteActual.comanda.numero_pedido }}</span>
            <span>{{ formatPrice(mesaClienteActual.comanda.total) }}</span>
          </div>
          <p class="mt-0.5 text-[11px] text-stone-400">
            Si enviás más platos se sumarán automáticamente a tu mesa.
          </p>
        </div>

        <div v-if="orderSent && ultimoPedidoEnviado" class="mt-6 rounded-2xl border border-[#204933] bg-[#163223] p-5 text-center sm:mt-8">
          <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#4ade80] text-[#120a05]">
            <Check :size="21" class="stroke-[3]" />
          </div>
          <h3 class="mt-3 font-serif text-xl font-bold text-white">
            Pedido #{{ ultimoPedidoEnviado.numero_pedido }} recibido
          </h3>
          <p class="mt-1 text-sm text-[#82e1a3]">
            Mesa {{ ultimoPedidoEnviado.mesa_numero }} · Tu comida está en preparación.
          </p>
          <p class="mt-3 text-xs font-semibold text-stone-300">
            Total acumulado en mesa: {{ formatPrice(ultimoPedidoEnviado.total) }}
          </p>
          <button
            type="button"
            @click="iniciarNuevoPedido"
            class="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-[#204933] bg-[#0d2217] px-3.5 py-2 text-xs font-bold text-[#82e1a3] transition hover:text-white">
            <Plus :size="14" /> Seguir pidiendo
          </button>
        </div>

        <template v-else>
          <div class="mt-5 space-y-3 sm:mt-6">
            <div
              v-for="item in cart"
              :key="item.key"
              class="flex items-center justify-between gap-3 rounded-2xl border border-stone-800/60 bg-[#110d0b]/70 p-3 text-sm">
              <div class="min-w-0 flex-1">
                <p class="truncate font-bold text-white">{{ item.nombre }}</p>
                <p v-if="item.opciones?.length" class="mt-0.5 truncate text-[11px] text-stone-400">
                  {{ item.opciones.join(' · ') }}
                </p>
                <div class="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    @click="decrementCartItem(item.key)"
                    aria-label="Restar unidad"
                    class="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-800 bg-[#17120f] text-stone-300 transition hover:border-stone-700">
                    <Minus :size="14" />
                  </button>
                  <span class="min-w-[20px] text-center text-xs font-bold tabular-nums text-white">{{ item.cantidad }}</span>
                  <button
                    type="button"
                    @click="incrementCartItem(item.key)"
                    aria-label="Sumar unidad"
                    class="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-800 bg-[#17120f] text-[#e58a4e] transition hover:border-stone-700">
                    <Plus :size="14" />
                  </button>
                </div>
              </div>
              <div class="shrink-0 text-right">
                <p class="font-bold tabular-nums text-white">{{ formatPrice(item.precio_unitario * item.cantidad) }}</p>
                <button
                  type="button"
                  @click="removeCartItem(item.key)"
                  class="mt-1 py-1 text-[11px] font-bold text-[#e58a4e] transition hover:text-[#f09559] hover:underline">
                  Quitar
                </button>
              </div>
            </div>
            <div v-if="!cart.length" class="py-6 text-center text-xs text-stone-500">
              Tu pedido está vacío. Elegí platos de la carta.
            </div>
          </div>

          <div class="my-5 border-t border-dashed border-stone-800" />

          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-stone-400">Subtotal nuevo envío</span>
            <span class="text-xl font-bold tabular-nums text-white">{{ formatPrice(total) }}</span>
          </div>

          <button
            type="button"
            @click="sendOrder"
            :disabled="!cart.length || enviandoPedido"
            class="mt-5 flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#e58a4e] px-4 py-3.5 text-sm font-bold text-[#190d05] transition hover:bg-[#ee975e] disabled:cursor-not-allowed disabled:opacity-40">
            <span>{{ enviandoPedido ? 'Enviando...' : 'Enviar pedido a cocina' }}</span>
            <ArrowRight :size="16" class="btn-icon-shift" />
          </button>
          <p class="mt-3 text-center text-[11px] leading-relaxed text-stone-500">
            El pedido se asigna directamente a la Mesa {{ mesaCliente }} para su preparación y cobro.
          </p>
        </template>
      </aside>
    </section>

    <!-- CAJERO VIEW (MAPA DE MESAS REAL) -->
    <section v-else class="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <div class="mb-5 sm:mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e58a4e]">Salón en Vivo</p>
          <h1 class="mt-1 font-serif text-2xl sm:text-3xl font-bold text-white">Mapa de mesas</h1>
          <p class="hidden sm:block mt-1 text-xs text-stone-400">
            Estado de mesas, comandas activas y cobro en caja.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            @click="cargarMesas(); cargarCatalogo()"
            :disabled="cargandoMesas"
            class="flex items-center gap-1.5 rounded-full border border-stone-800 bg-[#17120f] px-3.5 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-stone-700 hover:text-white disabled:opacity-50">
            <RefreshCw :size="13" class="btn-icon-rotate" :class="cargandoMesas ? 'animate-spin text-[#e58a4e]' : ''" />
            <span>Actualizar</span>
          </button>

          <div class="flex items-center gap-2 rounded-full border border-[#1e4830] bg-[#0d2217] px-3.5 py-1.5 text-xs font-semibold text-[#4ade80]">
            <span class="h-2 w-2 animate-pulse rounded-full bg-[#4ade80]" />
            <span>Sincronizado</span>
          </div>
        </div>
      </div>

      <div class="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <!-- Salón y Plano interactivo de mesas -->
        <PlanoMesas
          :mesas="mesas"
          :selected-table="selectedTable"
          :es-admin="esAdmin"
          :reservas="reservasHoy"
          :format-price="formatPrice"
          :class="editandoMapa ? 'lg:col-span-2' : ''"
          @seleccionar-mesa="seleccionarMesa"
          @actualizar-mesas="onActualizarMesasConfig"
          @notificar="onNotificarPlano"
          @modo-edicion="editandoMapa = $event"
        />

        <!-- Comanda Activa (Datos reales de la mesa seleccionada, oculta al editar mapa) -->
        <aside v-if="!editandoMapa" ref="panelComandaRef" class="h-fit scroll-mt-24 rounded-3xl border border-white/5 bg-[#17120f] p-5 sm:p-6 shadow-2xl space-y-5">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Comanda activa</p>
              <h2 class="mt-1 font-serif text-2xl font-bold text-white">Mesa {{ selectedTable }}</h2>
            </div>
            <span
              class="rounded-full px-3 py-1 text-xs font-bold"
              :class="tableOccupied
                ? 'border border-[#a2512f]/40 bg-[#3a1e14] text-[#f09559]'
                : reservasMesaSeleccionada.length > 0
                  ? 'border border-violet-400/50 bg-[#22193a] text-violet-300'
                  : 'border border-[#204933] bg-[#163223] text-[#4ade80]'">
              {{ tableOccupied ? 'Ocupada' : reservasMesaSeleccionada.length > 0 ? 'Reservada' : 'Libre' }}
            </span>
          </div>

          <!-- Reservas programadas para esta mesa hoy -->
          <div
            v-if="reservasMesaSeleccionada.length > 0"
            class="space-y-2.5 rounded-2xl border border-violet-500/35 bg-[#1b142d] p-3.5 text-xs">
            <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-300">
              <CalendarCheck :size="14" />
              <span>{{ reservasMesaSeleccionada.length === 1 ? 'Reserva de hoy' : 'Reservas de hoy' }}</span>
            </div>
            <div
              v-for="res in reservasMesaSeleccionada"
              :key="res.id"
              class="space-y-2 rounded-xl border border-white/5 bg-[#120d1f] px-3 py-2.5">
              <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-bold text-white truncate">
                    {{ res.hora }} hs · {{ res.nombre_cliente }}
                  </p>
                  <p class="text-[11px] text-stone-400">
                    {{ res.personas }} {{ res.personas === 1 ? 'persona' : 'personas' }}<span v-if="res.telefono"> · {{ res.telefono }}</span>
                  </p>
                  <p v-if="res.sena_pagada" class="mt-0.5 text-[10px] font-semibold text-emerald-400">
                    Seña MP abonada: {{ formatPrice(res.sena_monto) }}<span v-if="res.sena_comprobante" class="text-stone-400"> · Ref: {{ res.sena_comprobante }}</span>
                  </p>
                </div>
                <button
                  type="button"
                  @click="cancelarReservaMesa(res.id)"
                  title="Cancelar reserva"
                  class="shrink-0 rounded-lg border border-rose-900/50 bg-rose-950/40 px-2 py-1 text-[10px] font-semibold text-rose-300 transition hover:bg-rose-900/70">
                  Cancelar
                </button>
              </div>

              <!-- Confirmación de llegada con código alfanumérico -->
              <div v-if="res.asistencia_confirmada" class="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300">
                <Check :size="13" />
                <span>Llegada confirmada · Código {{ res.codigo_confirmacion }}</span>
              </div>
              <div v-else class="flex items-center gap-1.5 pt-1 border-t border-white/5">
                <input
                  v-model="codigoReservaInput"
                  type="text"
                  maxlength="12"
                  placeholder="Código del cliente (ej. 8K4M2P9X)"
                  @keydown.enter.prevent="confirmarLlegadaReserva(null, selectedTable)"
                  class="min-w-0 flex-1 rounded-lg border border-violet-500/30 bg-[#0d0917] px-2.5 py-1.5 font-mono text-[11px] uppercase text-white placeholder-stone-500 outline-none focus:border-violet-400"
                />
                <button
                  type="button"
                  @click="confirmarLlegadaReserva(null, selectedTable)"
                  class="shrink-0 rounded-lg bg-violet-500 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-violet-400">
                  Confirmar llegada
                </button>
              </div>
            </div>
          </div>

          <template v-if="tableOccupied && comandaActual">
            <div class="rounded-2xl border border-white/5 bg-[#110d0b] p-4">
              <div class="flex items-center justify-between text-xs text-stone-400">
                <span class="flex items-center gap-1.5">
                  <Clock3 :size="14" class="text-stone-500" />
                  Ingreso {{ comandaActual.hora_ingreso || 'Recién' }}
                </span>
                <span class="font-medium text-stone-400">Pedido #{{ comandaActual.numero_pedido }}</span>
              </div>

              <div class="mt-4 space-y-3">
                <div
                  v-for="(item, idx) in comandaActual.items"
                  :key="`${item.producto_id}-${idx}`"
                  class="flex items-start justify-between gap-2 text-sm">
                  <div class="min-w-0 flex-1">
                    <span class="text-stone-200">
                      <b class="text-white">{{ item.cantidad }}x</b> {{ item.nombre }}
                    </span>
                    <p v-if="item.opciones?.length" class="text-[11px] text-stone-500">
                      {{ item.opciones.join(' · ') }}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="font-bold tabular-nums text-white">{{ formatPrice(item.subtotal) }}</span>
                    <button
                      type="button"
                      @click="quitarItemComanda(idx)"
                      :disabled="procesandoMesa"
                      title="Quitar ítem de la comanda"
                      class="rounded-lg p-1 text-stone-500 transition hover:bg-rose-950/40 hover:text-rose-300">
                      <Trash2 :size="13" />
                    </button>
                  </div>
                </div>
              </div>

              <div class="mt-4 flex justify-between border-t border-stone-800/80 pt-3 text-base font-bold">
                <span class="text-stone-300">Total</span>
                <span class="text-white text-lg tabular-nums">{{ formatPrice(comandaActual.total) }}</span>
              </div>
            </div>

            <!-- Carga rápida de más platos a la comanda existente -->
            <div class="rounded-2xl border border-stone-800/70 bg-[#110d0b]/70 p-3.5 space-y-2.5">
              <p class="text-[11px] font-bold uppercase tracking-wider text-stone-400">Sumar plato a la mesa</p>
              <Combobox
                v-model="productoRapidoId"
                :options="opcionesProductoRapido"
                size="sm"
                placeholder="Elegir plato del catálogo..."
              />
              <div class="flex items-center gap-2">
                <input
                  v-model.number="cantidadRapida"
                  type="number"
                  min="1"
                  max="50"
                  aria-label="Cantidad"
                  class="w-20 rounded-xl border border-stone-800 bg-[#17120f] px-3 py-2 text-xs text-white outline-none focus:border-[#e58a4e]"
                />
                <button
                  type="button"
                  :disabled="!productoRapidoId || procesandoMesa"
                  @click="agregarPlatoAMesa"
                  class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e58a4e]/40 bg-[#221a15] px-3 py-2 text-xs font-bold text-[#e58a4e] transition hover:bg-[#2c211b] disabled:opacity-45">
                  <Plus :size="14" class="btn-icon-plus" />
                  <span>Agregar plato</span>
                </button>
              </div>
            </div>

            <div>
              <Combobox
                v-model="payment"
                :options="paymentOptions"
                label="Método de pago"
                size="md"
              />
            </div>

            <div class="space-y-2">
              <button
                type="button"
                @click="freeTable"
                :disabled="procesandoMesa"
                class="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e58a4e] px-4 py-3.5 text-sm font-bold text-[#190d05] transition hover:bg-[#ee975e] disabled:opacity-50">
                <CircleDollarSign :size="17" />
                <span>{{ procesandoMesa ? 'Procesando...' : 'Cobrar y liberar mesa' }}</span>
              </button>

              <button
                type="button"
                @click="cancelarComanda"
                :disabled="procesandoMesa"
                class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-900/40 bg-rose-950/15 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-950/35 disabled:opacity-50">
                <X :size="14" /> Cancelar comanda sin cobrar
              </button>
            </div>
          </template>

          <div v-else class="space-y-5 pt-2">
            <div class="text-center">
              <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#204933] bg-[#163223] text-[#4ade80]">
                <Check :size="25" />
              </div>
              <h3 class="mt-4 font-serif text-xl font-bold text-white">Mesa disponible</h3>
              <p class="mt-1 text-sm text-stone-400">
                Esperando pedido desde la Carta Digital o carga manual abajo.
              </p>
            </div>

            <!-- Carga manual rápida en mesa libre -->
            <div class="rounded-2xl border border-stone-800/70 bg-[#110d0b]/80 p-3.5 space-y-2.5">
              <p class="text-[11px] font-bold uppercase tracking-wider text-stone-400">Abrir comanda manual</p>
              <Combobox
                v-model="productoRapidoId"
                :options="opcionesProductoRapido"
                size="sm"
                placeholder="Elegir plato del catálogo..."
              />
              <div class="flex items-center gap-2">
                <input
                  v-model.number="cantidadRapida"
                  type="number"
                  min="1"
                  max="50"
                  aria-label="Cantidad"
                  class="w-20 rounded-xl border border-stone-800 bg-[#17120f] px-3 py-2 text-xs text-white outline-none focus:border-[#e58a4e]"
                />
                <button
                  type="button"
                  :disabled="!productoRapidoId || procesandoMesa"
                  @click="agregarPlatoAMesa"
                  class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#e58a4e] px-3 py-2 text-xs font-bold text-[#190d05] transition hover:bg-[#ee975e] disabled:opacity-45">
                  <Plus :size="14" class="btn-icon-plus" />
                  <span>Cargar pedido</span>
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <!-- Modal Personalizar Producto (Bottom Sheet en Móvil) -->
    <div
      v-if="selected"
      @click.self="selected = null"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div class="max-h-[88dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border border-white/10 bg-[#17120f] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-white shadow-2xl sm:rounded-3xl sm:p-6">
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-700 sm:hidden" />

        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Personalizá tu pedido</p>
            <h2 class="mt-1 font-serif text-2xl font-bold text-white">{{ selected.nombre }}</h2>
          </div>
          <button
            type="button"
            @click="selected = null"
            aria-label="Cerrar"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-[#221a15] hover:text-white transition">
            <X :size="18" />
          </button>
        </div>

        <div class="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3">
          <p class="text-xs font-bold uppercase tracking-wider text-stone-400">Opciones e indicaciones</p>
          <label
            v-for="option in opcionesPersonalizacion"
            :key="option"
            class="flex min-h-[46px] cursor-pointer items-center justify-between rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2.5 text-sm text-stone-200 hover:border-stone-700 transition">
            <span>{{ option }}</span>
            <input
              v-model="opcionesSeleccionadas"
              type="checkbox"
              :value="option"
              class="h-5 w-5 accent-[#e58a4e]"
            />
          </label>

          <label class="block pt-1 text-xs font-bold text-stone-400">
            Nota para cocina (opcional)
            <input
              v-model="notaProducto"
              type="text"
              maxlength="80"
              placeholder="Ej: Punto de cocción medio..."
              class="mt-1.5 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2.5 text-xs text-white placeholder:text-stone-600 outline-none focus:border-[#e58a4e]"
            />
          </label>
        </div>

        <div class="mt-6 flex items-center justify-between gap-4 border-t border-stone-800/70 pt-4">
          <span class="text-xl font-bold tabular-nums text-white">{{ formatPrice(selected.precio) }}</span>
          <button
            type="button"
            :disabled="stockRestanteParaProducto(selected) <= 0"
            @click="agregarDesdeModal"
            class="flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#e58a4e] px-5 py-3 text-sm font-bold text-[#190d05] transition hover:bg-[#ee975e] disabled:opacity-45">
            <Plus :size="16" class="btn-icon-plus" /> Agregar al pedido
          </button>
        </div>
      </div>
    </div>

    <!-- Pie discreto con acceso en letra chica para personal autorizado -->
    <footer
      class="relative mx-auto mt-6 flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2 border-t border-stone-900/80 px-4 pt-5 text-[11px] text-stone-600 sm:px-6 md:px-8"
      :class="view === 'cliente' && (cart.length > 0 || orderSent) ? 'pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6'">
      <span>Carta Digital TrackMenú · Pedidos en mesa</span>
      <RouterLink
        v-if="!authState.user"
        to="/login"
        class="py-1 text-stone-500 underline decoration-stone-700 underline-offset-4 transition hover:text-[#e58a4e] hover:decoration-[#e58a4e]/60">
        Acceso para personal del local
      </RouterLink>
    </footer>

    <!-- Barra Flotante Inferior de Pedido (Solo Móvil < lg) -->
    <div
      v-if="view === 'cliente' && !mobileCartOpen && (cart.length > 0 || orderSent)"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-stone-900 bg-[#0c0a09] px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:hidden">
      <button
        type="button"
        @click="mobileCartOpen = true"
        class="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left shadow-2xl transition"
        :class="orderSent
          ? 'border-[#204933] bg-[#163223] text-white'
          : 'border-[#e58a4e]/40 bg-[#17120f] text-white'">
        <template v-if="orderSent && ultimoPedidoEnviado">
          <div class="flex items-center gap-3 min-w-0">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4ade80] text-[#120a05]">
              <Check :size="18" class="stroke-[3]" />
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-white">
                Pedido #{{ ultimoPedidoEnviado.numero_pedido }} enviado a cocina
              </p>
              <p class="text-[11px] text-[#82e1a3]">Mesa {{ ultimoPedidoEnviado.mesa_numero }} · En preparación</p>
            </div>
          </div>
          <span class="flex shrink-0 items-center gap-1 rounded-xl bg-black/25 px-3 py-1.5 text-xs font-bold text-[#82e1a3]">
            Ver <ChevronUp :size="15" />
          </span>
        </template>

        <template v-else>
          <div class="flex items-center gap-3 min-w-0">
            <span class="flex h-9 min-w-[36px] shrink-0 items-center justify-center rounded-xl bg-[#e58a4e] px-2 text-sm font-extrabold text-[#190d05] tabular-nums">
              {{ totalUnidadesCarrito }}
            </span>
            <div class="min-w-0">
              <p class="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                Tu pedido · Mesa {{ mesaCliente }}
              </p>
              <p class="text-base font-bold tabular-nums text-white">{{ formatPrice(total) }}</p>
            </div>
          </div>
          <span class="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#e58a4e] px-3.5 py-2 text-xs font-bold text-[#190d05]">
            <span>Ver pedido</span>
            <ChevronUp :size="15" />
          </span>
        </template>
      </button>
    </div>
  </main>
</template>
