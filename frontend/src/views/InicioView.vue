<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Combobox from '../components/Combobox.vue'
import { authState, productosService } from '@/services/api'
import {
  ArrowRight, Bell, Check, ChevronUp, CircleDollarSign, Clock3, Minus, Plus, ShoppingBag, X, Banknote, CreditCard, ArrowRightLeft,
} from 'lucide-vue-next'

const route = useRoute()

const paymentOptions = [
  { value: 'Efectivo', label: 'Efectivo', icon: Banknote },
  { value: 'Tarjeta', label: 'Tarjeta', icon: CreditCard },
  { value: 'Transferencia', label: 'Transferencia', icon: ArrowRightLeft },
]

const burgerImage = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-qw3nfbnetm1rXMnXgRGCZbDkTOypHG.png'

const productosDeEjemplo = [
  {
    id: 1,
    name: 'Burger clásica',
    description: 'Doble smash, cheddar, cebolla caramelizada y salsa de la casa.',
    price: 1890,
    category: 'Plato Principal',
    image: burgerImage,
  },
  {
    id: 2,
    name: 'Papas a la piedra',
    description: 'Crocantes por fuera, suaves por dentro, con romero y sal de escamas.',
    price: 950,
    category: 'Plato Principal',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 3,
    name: 'Milanesa de pollo',
    description: 'Rebozada crocante con limón y ensalada fresca.',
    price: 1050,
    category: 'Plato Principal',
    image: burgerImage,
  },
  {
    id: 4,
    name: 'Limonada casera',
    description: 'Limón natural, menta y un toque de jengibre.',
    price: 780,
    category: 'Bebidas',
    image: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 5,
    name: 'Cheesecake de frutos rojos',
    description: 'Cremoso, suave y con salsa de frutos rojos.',
    price: 1200,
    category: 'Postres',
    image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=500&q=80',
  },
]
// La carta sale de la base: estos productos de ejemplo quedan sólo para la
// portada, cuando todavía no hay sesión con la que leer el menú real.
const products = ref(productosDeEjemplo)
const cargandoCarta = ref(false)
const errorCarta = ref("")

const cargarCarta = async () => {
  if (!authState.token) return
  cargandoCarta.value = true
  errorCarta.value = ""

  const res = await productosService.listar({ activo: true, orden: "nombre", dir: "asc", limite: 100 })

  if (!res.success) {
    errorCarta.value = res.message || "No se pudo cargar la carta."
  } else {
    products.value = res.data.map((p) => ({
      id: p.id,
      name: p.nombre,
      description: p.descripcion || "",
      price: Number(p.precio),
      category: "Carta",
      image: p.imagen_url || burgerImage,
    }))
    cart.value = []
    // sin productos activos la carta queda vacía, pero la pantalla no se rompe
    category.value = categorias.value[0] ?? ""
  }

  cargandoCarta.value = false
}

onMounted(cargarCarta)
watch(() => authState.token, cargarCarta)


const formatPrice = (price) => `$ ${price.toLocaleString('es-AR')}`

// Sincronización de vista según rol y query de la URL (?vista=mesas | ?vista=carta)
const permisoMesas = computed(() => authState.rol === 'admin' || authState.rol === 'empleado')
const initialView = (route.query.vista === 'mesas' && permisoMesas.value) ? 'cajero' : 'cliente'
const view = ref(initialView)

watch(() => route.query.vista, (nuevaVista) => {
  if (nuevaVista === 'mesas' && permisoMesas.value) {
    view.value = 'cajero'
  } else {
    view.value = 'cliente'
  }
})
const category = ref('Plato Principal')
const cart = ref([])
const selected = ref(null)
const orderSent = ref(false)
const mobileCartOpen = ref(false)
const occupied = ref([4, 7])
const selectedTable = ref(4)
const payment = ref('Efectivo')

// Sin conexión con el backend la carta no sale de la base: avisarlo.
const modoLocal = computed(() => Boolean(authState.user) && !authState.backendConnected)

// El router manda acá con ?denegado=true cuando el rol no alcanza; sin esto
// el usuario aparecía en otra pantalla sin ninguna explicación.
const accesoDenegado = computed(() => route.query.denegado === 'true')

const categorias = computed(() => [...new Set(products.value.map((p) => p.category))])

const visibleProducts = computed(() => {
  return products.value.filter((product) => product.category === category.value)
})

const cartProducts = computed(() => {
  return cart.value.map((id) => products.value.find((product) => product.id === id)).filter(Boolean)
})

const cartItems = computed(() => {
  const grouped = new Map()
  for (const id of cart.value) {
    const product = products.value.find((p) => p.id === id)
    if (!product) continue
    if (!grouped.has(id)) {
      grouped.set(id, { product, qty: 0, subtotal: 0 })
    }
    const entry = grouped.get(id)
    entry.qty += 1
    entry.subtotal = entry.qty * product.price
  }
  return Array.from(grouped.values())
})

const getProductQty = (id) => cart.value.filter((item) => item === id).length

const total = computed(() => {
  return cartProducts.value.reduce((sum, product) => sum + product.price, 0)
})

const tableOccupied = computed(() => {
  return occupied.value.includes(selectedTable.value)
})

const addToCart = (id) => {
  orderSent.value = false
  cart.value.push(id)
}

const removeFromCart = (id) => {
  const index = cart.value.lastIndexOf(id)
  if (index >= 0) {
    cart.value.splice(index, 1)
  }
  if (cart.value.length === 0) {
    mobileCartOpen.value = false
  }
}

const removeAllFromCart = (id) => {
  cart.value = cart.value.filter((item) => item !== id)
  if (cart.value.length === 0) {
    mobileCartOpen.value = false
  }
}

const sendOrder = () => {
  orderSent.value = true
  if (!occupied.value.includes(4)) {
    occupied.value.push(4)
  }
}

const selectCategory = (item) => {
  category.value = item
}

const freeTable = () => {
  // Registra la venta y comanda liquidada para que impacte en tiempo real en el Dashboard
  try {
    const dbRaw = localStorage.getItem('trackmenu_saas_db')
    if (dbRaw) {
      const db = JSON.parse(dbRaw)
      if (!db.ventas) db.ventas = []
      const metodo = payment.value.toLowerCase().includes('transf') ? 'transferencia_qr' : payment.value.toLowerCase()
      const nuevaVentaId = 'vnt_' + Date.now().toString().slice(-6)
      
      db.ventas.unshift({
        id: nuevaVentaId,
        organizacion_id: authState.organizacion?.id || 'org_demo_1',
        mesa_numero: selectedTable.value,
        total: 2840,
        metodo_pago: metodo,
        estado: 'completada',
        usuario_id: authState.user?.id || 'usr_empleado_1',
        created_at: new Date().toISOString(),
        anulado_en: null,
        anulado_por: null,
        motivo_anulacion: null,
      })

      if (!db.detalle_ventas) db.detalle_ventas = []
      db.detalle_ventas.push(
        { id: 'det_' + Date.now() + '_1', venta_id: nuevaVentaId, producto_id: 'prod_1', cantidad: 1, precio_unitario: 1890, subtotal: 1890 },
        { id: 'det_' + Date.now() + '_2', venta_id: nuevaVentaId, producto_id: 'prod_2', cantidad: 1, precio_unitario: 950, subtotal: 950 }
      )

      localStorage.setItem('trackmenu_saas_db', JSON.stringify(db))
    }
  } catch (err) {
    console.error('Error registrando venta al liberar mesa:', err)
  }

  occupied.value = occupied.value.filter((table) => table !== selectedTable.value)
}
</script>

<template>
  <main class="relative z-0 min-h-dvh overflow-x-hidden bg-[#0c0a09] text-[#f5f2eb]">
    <p v-if="accesoDenegado" role="alert"
      class="relative z-20 w-full bg-[#7f1d1d] px-4 py-2 text-center text-[11px] font-bold text-red-50 sm:px-8">
      No tenés permiso para entrar a esa pantalla con tu rol ({{ route.query.rol || authState.rol }}).
    </p>
    <p v-if="modoLocal" role="status"
      class="relative z-20 w-full bg-[#7c2d12] px-4 py-2 text-center text-[11px] font-bold text-amber-50 sm:px-8">
      Sin conexión con el servidor: la carta no se está leyendo de la base de datos.
    </p>
    <p v-else-if="errorCarta" role="alert"
      class="relative z-20 w-full bg-[#7f1d1d] px-4 py-2 text-center text-[11px] font-bold text-red-50 sm:px-8">
      {{ errorCarta }}
    </p>
    <!-- Ambient glow background decoration -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40">
      <div class="absolute -top-[20%] left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#e58a4e]/15 via-[#e58a4e]/5 to-transparent blur-3xl"></div>
    </div>

    <!-- CLIENTE VIEW -->
    <section v-if="view === 'cliente'"
      class="relative mx-auto grid w-full min-w-0 max-w-[1400px] gap-6 px-4 pt-4 pb-6 sm:gap-8 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_380px] md:px-8">
      <div class="mx-auto w-full min-w-0 max-w-[760px] lg:mx-0">
        <!-- Title & Table tag -->
        <div class="mb-4 flex items-end justify-between gap-3 sm:mb-6">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e58a4e] sm:text-xs">Escanea y elegí</p>
            <h1 class="mt-0.5 font-serif text-2xl font-bold tracking-tight text-white sm:mt-1 sm:text-4xl">Trackea tu Menú</h1>
          </div>
          <span class="shrink-0 rounded-full bg-[#e58a4e] px-3.5 py-1.5 text-xs font-bold text-[#190d05]">
            Mesa 4
          </span>
        </div>

        <!-- Categories -->
        <div class="no-scrollbar mb-5 flex items-center gap-2 overflow-x-auto touch-pan-x sm:mb-6 sm:gap-2.5" role="tablist">
          <button v-for="item in categorias" :key="item" type="button"
            @click="selectCategory(item)"
            class="min-h-[40px] whitespace-nowrap rounded-full px-4 sm:px-5 py-2 text-xs font-bold transition duration-150 active:scale-[0.97]"
            :class="category === item ? 'bg-[#e58a4e] text-[#190d05]' : 'bg-[#17120f] border border-white/5 text-stone-400 hover:text-stone-200 hover:bg-[#221a15]'">
            {{ item }}
          </button>
        </div>

        <!-- Product Cards -->
        <div class="w-full min-w-0 space-y-3 sm:space-y-3.5">
          <article v-for="product in visibleProducts" :key="product.id"
            @click="selected = product"
            class="box-border flex w-full min-w-0 max-w-full cursor-pointer gap-3.5 overflow-hidden rounded-2xl border border-white/5 bg-[#17120f] p-3.5 transition duration-150 hover:border-white/10 active:scale-[0.99] sm:gap-4 sm:p-4">
            <img :src="product.image" :alt="product.name"
              class="h-24 w-24 shrink-0 rounded-xl object-cover bg-stone-900 sm:h-28 sm:w-28" />
            <div class="flex min-w-0 flex-1 flex-col justify-between overflow-hidden">
              <div class="min-w-0">
                <div class="flex min-w-0 items-start justify-between gap-2">
                  <h2 class="min-w-0 text-[15px] font-bold leading-snug text-white sm:text-lg">{{ product.name }}</h2>
                  <span class="shrink-0 tabular-nums text-sm font-bold text-[#e58a4e] sm:text-base">
                    {{ formatPrice(product.price) }}
                  </span>
                </div>
                <p class="mt-1 line-clamp-2 max-w-[430px] break-words text-xs leading-relaxed text-stone-400 sm:line-clamp-none">
                  {{ product.description }}
                </p>
              </div>
              <div class="mt-3 flex items-center justify-between gap-2">
                <button type="button" @click.stop="selected = product"
                  class="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-white/10 bg-[#221a15] px-4 py-1.5 text-xs font-bold text-stone-200 transition hover:border-white/20 hover:bg-[#2e231d] hover:text-white active:scale-[0.96]">
                  <Plus :size="14" class="text-[#e58a4e]" />
                  <span>Agregar</span>
                </button>
                <span v-if="getProductQty(product.id) > 0"
                  class="rounded-full border border-[#e58a4e]/35 bg-[#e58a4e]/10 px-2.5 py-1 text-[11px] font-bold text-[#e58a4e]">
                  {{ getProductQty(product.id) }} en pedido
                </span>
              </div>
            </div>
          </article>
        </div>
      </div>

      <!-- Mobile Bottom Sheet Backdrop -->
      <div
        v-show="mobileCartOpen"
        class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm lg:hidden"
        @click="mobileCartOpen = false"
      />

      <!-- Right Aside (Desktop Sticky) / Bottom Sheet (Mobile) -->
      <aside
        :class="mobileCartOpen
          ? 'fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl border-t border-x border-white/10 bg-[#17120f] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl lg:static lg:z-auto lg:block lg:max-h-none lg:overflow-visible lg:rounded-3xl lg:border lg:border-white/5 lg:p-6 lg:sticky lg:top-24'
          : 'hidden lg:block h-fit min-w-0 max-w-full overflow-hidden rounded-3xl border border-white/5 bg-[#17120f] p-6 shadow-2xl lg:sticky lg:top-24'">
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-700 lg:hidden" />

        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Tu pedido</p>
            <h2 class="mt-0.5 font-serif text-2xl font-bold text-white">Mesa 4</h2>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-[#221a15] text-[#e58a4e]">
              <ShoppingBag :size="18" />
            </div>
            <button v-if="mobileCartOpen" type="button" @click="mobileCartOpen = false" aria-label="Cerrar pedido"
              class="flex h-10 w-10 items-center justify-center rounded-full border border-stone-800 bg-[#110d0b] text-stone-300 transition active:scale-95 lg:hidden">
              <X :size="18" />
            </button>
          </div>
        </div>

        <div v-if="orderSent" class="mt-6 rounded-2xl border border-[#204933] bg-[#163223] p-5 text-center sm:mt-8">
          <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#4ade80] text-[#120a05]">
            <Check :size="21" class="stroke-[3]" />
          </div>
          <h3 class="mt-3 font-serif text-xl font-bold text-white">Pedido recibido</h3>
          <p class="mt-1 text-sm text-[#82e1a3]">Tu comida está en preparación.</p>
          <p class="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-stone-400">
            <Clock3 :size="14" /> Tiempo estimado: 20–30 min
          </p>
        </div>

        <template v-else>
          <div class="mt-5 space-y-3 sm:mt-6">
            <div v-for="item in cartItems" :key="item.product.id"
              class="flex items-center justify-between gap-3 rounded-2xl border border-stone-800/60 bg-[#110d0b]/70 p-3 text-sm">
              <div class="min-w-0 flex-1">
                <p class="truncate font-bold text-white">{{ item.product.name }}</p>
                <div class="mt-1.5 flex items-center gap-2">
                  <button type="button" @click="removeFromCart(item.product.id)" aria-label="Restar unidad"
                    class="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-800 bg-[#17120f] text-stone-300 transition hover:border-stone-700 active:scale-95">
                    <Minus :size="14" />
                  </button>
                  <span class="min-w-[20px] text-center text-xs font-bold tabular-nums text-white">{{ item.qty }}</span>
                  <button type="button" @click="addToCart(item.product.id)" aria-label="Sumar unidad"
                    class="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-800 bg-[#17120f] text-[#e58a4e] transition hover:border-stone-700 active:scale-95">
                    <Plus :size="14" />
                  </button>
                </div>
              </div>
              <div class="shrink-0 text-right">
                <p class="font-bold tabular-nums text-white">{{ formatPrice(item.subtotal) }}</p>
                <button type="button" @click="removeAllFromCart(item.product.id)"
                  class="mt-1 py-1 text-[11px] font-bold text-[#e58a4e] transition hover:text-[#f09559] hover:underline">
                  Quitar
                </button>
              </div>
            </div>
            <div v-if="!cartItems.length" class="py-6 text-center text-xs text-stone-500">
              El carrito está vacío
            </div>
          </div>

          <div class="my-5 border-t border-dashed border-stone-800" />

          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-stone-400">Subtotal</span>
            <span class="text-xl font-bold tabular-nums text-white">{{ formatPrice(total) }}</span>
          </div>

          <button type="button" @click="sendOrder" :disabled="!cart.length"
            class="mt-5 flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#e58a4e] px-4 py-3.5 text-sm font-bold text-[#190d05] transition hover:bg-[#ee975e] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
            <span>Enviar pedido a cocina</span>
            <ArrowRight :size="16" />
          </button>
          <p class="mt-3 text-center text-[11px] leading-relaxed text-stone-500">
            Al enviar, la mesa queda bloqueada temporalmente para evitar pedidos duplicados.
          </p>
        </template>
      </aside>
    </section>

    <!-- CAJERO VIEW (MAPA DE MESAS) -->
    <section v-else class="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-[#e58a4e]">Panel de control</p>
          <h1 class="mt-1 font-serif text-3xl font-bold text-white sm:text-4xl">Mapa de mesas</h1>
          <p class="mt-2 text-sm text-stone-400">
            Actualización en tiempo real · Última sincronización hace un momento
          </p>
        </div>
        <div class="flex items-center gap-2 rounded-full border border-[#1e4830] bg-[#0d2217] px-3.5 py-1.5 text-xs font-semibold text-[#4ade80]">
          <span class="h-2 w-2 animate-pulse rounded-full bg-[#4ade80]" />
          <span>Sistema conectado</span>
        </div>
      </div>

      <div class="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <!-- Salón principal -->
        <div class="rounded-3xl border border-white/5 bg-[#17120f] p-5 sm:p-7">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="font-serif text-2xl font-bold text-white">Salón principal</h2>
            <div class="flex gap-4 text-xs font-semibold text-stone-400">
              <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-full bg-[#4ade80]" /> Libre</span>
              <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-full bg-[#e58a4e]" /> Ocupada</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <button v-for="number in 12" :key="number" type="button" @click="selectedTable = number"
              class="group relative min-h-32 rounded-2xl p-4 text-left transition duration-200"
              :class="[
                selectedTable === number ? 'ring-2 ring-[#e58a4e] ring-offset-2 ring-offset-[#0c0a09] shadow-lg shadow-[#e58a4e]/20' : '',
                occupied.includes(number)
                  ? 'bg-[#3a1e14] border-2 border-[#d97736]'
                  : 'bg-[#163223] border border-[#204933] hover:border-[#32694b]'
              ]">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-widest"
                  :class="occupied.includes(number) ? 'text-[#f09559]' : 'text-[#4ade80]'">
                  {{ occupied.includes(number) ? 'Ocupada' : 'Libre' }}
                </span>
                <Bell v-if="occupied.includes(number)" :size="15" class="text-[#f09559]" />
              </div>

              <span class="mt-7 block font-serif text-3xl font-bold"
                :class="occupied.includes(number) ? 'text-white' : 'text-[#e6f4ec]'">
                {{ number }}
              </span>
              <span v-if="occupied.includes(number)"
                class="absolute bottom-3 right-3 text-[10px] font-semibold text-[#f09559]">
                Pedido activo
              </span>
            </button>
          </div>
        </div>

        <!-- Comanda Activa -->
        <aside class="h-fit rounded-3xl border border-white/5 bg-[#17120f] p-6 shadow-2xl">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Comanda activa</p>
              <h2 class="mt-1 font-serif text-2xl font-bold text-white">Mesa {{ selectedTable }}</h2>
            </div>
            <span class="rounded-full px-3 py-1 text-xs font-bold"
              :class="tableOccupied ? 'border border-[#a2512f]/40 bg-[#3a1e14] text-[#f09559]' : 'border border-[#204933] bg-[#163223] text-[#4ade80]'">
              {{ tableOccupied ? 'Ocupada' : 'Libre' }}
            </span>
          </div>

          <template v-if="tableOccupied">
            <div class="mt-6 rounded-2xl border border-white/5 bg-[#110d0b] p-4">
              <div class="flex items-center justify-between text-xs text-stone-400">
                <span class="flex items-center gap-1.5">
                  <Clock3 :size="14" class="text-stone-500" /> Ingreso 20:14
                </span>
                <span class="font-medium text-stone-400">Pedido #104</span>
              </div>
              <div class="mt-4 space-y-3">
                <div class="flex justify-between text-sm">
                  <span class="text-stone-200"><b class="text-white">1x</b> Burger clásica</span>
                  <span class="font-bold text-white">{{ formatPrice(1890) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-stone-200"><b class="text-white">1x</b> Papas a la piedra</span>
                  <span class="font-bold text-white">{{ formatPrice(950) }}</span>
                </div>
              </div>
              <div class="mt-4 flex justify-between border-t border-stone-800/80 pt-3 text-base font-bold">
                <span class="text-stone-300">Total</span>
                <span class="text-white text-lg">{{ formatPrice(2840) }}</span>
              </div>
            </div>

            <div class="mt-5">
              <Combobox
                v-model="payment"
                :options="paymentOptions"
                label="Método de pago"
                size="md"
              />
            </div>

            <button type="button" @click="freeTable"
              class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e58a4e] px-4 py-3.5 text-sm font-bold text-[#190d05] shadow-lg shadow-[#e58a4e]/10 transition hover:bg-[#ee975e] active:scale-[0.99]">
              <CircleDollarSign :size="17" /> Cobrar y liberar mesa
            </button>
          </template>

          <div v-else class="mt-10 text-center">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#204933] bg-[#163223] text-[#4ade80]">
              <Check :size="25" />
            </div>
            <h3 class="mt-4 font-serif text-xl font-bold text-white">Mesa disponible</h3>
            <p class="mt-1 text-sm text-stone-400">Esperando un nuevo pedido desde el QR.</p>
          </div>
        </aside>
      </div>
    </section>

    <!-- Modal Personalizar Producto (Bottom Sheet en Móvil) -->
    <div v-if="selected" @click.self="selected = null"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
      <div class="max-h-[88dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border border-white/10 bg-[#17120f] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] text-white shadow-2xl sm:rounded-3xl sm:p-6">
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-700 sm:hidden" />

        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Personalizá tu pedido</p>
            <h2 class="mt-1 font-serif text-2xl font-bold text-white">{{ selected.name }}</h2>
          </div>
          <button type="button" @click="selected = null" aria-label="Cerrar"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-[#221a15] hover:text-white active:scale-95 transition">
            <X :size="18" />
          </button>
        </div>

        <div class="mt-5 space-y-2.5 sm:mt-6 sm:space-y-3">
          <p class="text-xs font-bold uppercase tracking-wider text-stone-400">Opciones</p>
          <label v-for="(option, index) in ['Sin cebolla', 'Papas grandes', 'Salsa extra']" :key="option"
            class="flex min-h-[48px] cursor-pointer items-center justify-between rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-3 text-sm text-stone-200 hover:border-stone-700 active:scale-[0.99] transition">
            <span>{{ option }}</span>
            <input type="checkbox" :default-checked="index === 1" class="h-5 w-5 accent-[#e58a4e]" />
          </label>
        </div>

        <div class="mt-6 flex items-center justify-between gap-4 border-t border-stone-800/70 pt-4">
          <span class="text-xl font-bold tabular-nums text-white">{{ formatPrice(selected.price) }}</span>
          <button type="button" @click="addToCart(selected.id); selected = null"
            class="flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#e58a4e] px-5 py-3 text-sm font-bold text-[#190d05] transition hover:bg-[#ee975e] active:scale-[0.97]">
            <Plus :size="16" /> Agregar al carrito
          </button>
        </div>
      </div>
    </div>

    <!-- Pie discreto con acceso en letra chica para personal autorizado -->
    <footer
      class="relative mx-auto mt-6 flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2 border-t border-stone-900/80 px-4 pt-5 text-[11px] text-stone-600 sm:px-6 md:px-8"
      :class="view === 'cliente' && (cart.length > 0 || orderSent) ? 'pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6' : 'pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6'">
      <span>Carta Digital TrackMenú · Pedidos en mesa</span>
      <RouterLink v-if="!authState.user" to="/login"
        class="py-1 text-stone-500 underline decoration-stone-700 underline-offset-4 transition hover:text-[#e58a4e] hover:decoration-[#e58a4e]/60">
        Acceso para personal del local
      </RouterLink>
    </footer>

    <!-- Barra Flotante Inferior de Pedido (Solo Móvil < lg, fuera de section para mantener z-index superior) -->
    <div
      v-if="view === 'cliente' && !mobileCartOpen && (cart.length > 0 || orderSent)"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-stone-900 bg-[#0c0a09] px-3 pt-2.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:hidden">
      <button
        type="button"
        @click="mobileCartOpen = true"
        class="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left shadow-2xl transition active:scale-[0.99]"
        :class="orderSent
          ? 'border-[#204933] bg-[#163223] text-white'
          : 'border-[#e58a4e]/40 bg-[#17120f] text-white'">
        <template v-if="orderSent">
          <div class="flex items-center gap-3 min-w-0">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4ade80] text-[#120a05]">
              <Check :size="18" class="stroke-[3]" />
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-white">Pedido enviado a cocina</p>
              <p class="text-[11px] text-[#82e1a3]">Tiempo estimado: 20–30 min</p>
            </div>
          </div>
          <span class="flex shrink-0 items-center gap-1 rounded-xl bg-black/25 px-3 py-1.5 text-xs font-bold text-[#82e1a3]">
            Ver <ChevronUp :size="15" />
          </span>
        </template>

        <template v-else>
          <div class="flex items-center gap-3 min-w-0">
            <span class="flex h-9 min-w-[36px] shrink-0 items-center justify-center rounded-xl bg-[#e58a4e] px-2 text-sm font-extrabold text-[#190d05] tabular-nums">
              {{ cart.length }}
            </span>
            <div class="min-w-0">
              <p class="text-[11px] font-bold uppercase tracking-wider text-stone-400">Tu pedido · Mesa 4</p>
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
