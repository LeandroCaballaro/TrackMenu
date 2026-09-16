<script setup>
import { ref, computed } from 'vue'
import {
  ArrowRight,
  Bell,
  Check,
  CircleDollarSign,
  Clock3,
  LayoutGrid,
  Plus,
  ShoppingBag,
  Smartphone,
  Utensils,
  X,
} from 'lucide-vue-next'

const burgerImage = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-qw3nfbnetm1rXMnXgRGCZbDkTOypHG.png'

const products = [
  {
    id: 1,
    name: 'Burger clásica',
    description: 'Doble smash, cheddar, cebolla caramelizada y salsa de la casa.',
    price: 1890,
    category: 'Hamburguesas',
    image: burgerImage,
  },
  {
    id: 2,
    name: 'Papas a la piedra',
    description: 'Crocantes por fuera, suaves por dentro, con romero y sal de escamas.',
    price: 950,
    category: 'Hamburguesas',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=500&q=80',
  },
  {
    id: 3,
    name: 'Milanesa de pollo',
    description: 'Rebozada crocante con limón y ensalada fresca.',
    price: 1050,
    category: 'Hamburguesas',
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

const formatPrice = (price) => `$ ${price.toLocaleString('es-AR')}`

// Estados reactivos
const view = ref('cliente')
const category = ref('Hamburguesas')
const cart = ref([1])
const selected = ref(null)
const orderSent = ref(false)
const occupied = ref([4, 7])
const selectedTable = ref(4)
const payment = ref('Efectivo')

// Computados
const visibleProducts = computed(() => {
  return products.filter((product) => product.category === category.value)
})

const cartProducts = computed(() => {
  return cart.value.map((id) => products.find((product) => product.id === id)).filter(Boolean)
})

const total = computed(() => {
  return cartProducts.value.reduce((sum, product) => sum + product.price, 0)
})

const tableOccupied = computed(() => {
  return occupied.value.includes(selectedTable.value)
})

// Acciones
const addToCart = (id) => {
  cart.value.push(id)
}

const removeFromCart = (id) => {
  const index = cart.value.lastIndexOf(id)
  if (index >= 0) {
    cart.value.splice(index, 1)
  }
}

const sendOrder = () => {
  orderSent.value = true
  if (!occupied.value.includes(4)) {
    occupied.value.push(4)
  }
}

const selectCategory = (item) => {
  category.value = item === 'Pasta' ? 'Hamburguesas' : item
}

const freeTable = () => {
  occupied.value = occupied.value.filter((table) => table !== selectedTable.value)
}
</script>

<template>
  <main class="min-h-screen overflow-x-hidden bg-[#f6f1e8] text-[#17120e]">
    <!-- Encabezado / Header -->
    <header class="w-full min-w-0 border-b border-[#ded4c5] bg-[#fbf8f2] px-3 py-3 sm:px-5 sm:py-4 md:px-8">
      <div class="mx-auto flex w-full min-w-0 max-w-[1400px] flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#20160f] text-[#f7cf7a]">
            <Utensils :size="19" />
          </div>
          <div>
            <p class="font-serif text-xl font-bold leading-none">TrackMenú</p>
            <p class="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9c8770]">
              Pedidos simples, mesas al día
            </p>
          </div>
        </div>

        <div class="flex w-full rounded-full bg-[#eee5d8] p-1 text-xs font-bold sm:w-auto">
          <button
            type="button"
            @click="view = 'cliente'"
            class="flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 transition"
            :class="view === 'cliente' ? 'bg-[#20160f] text-white shadow-sm' : 'text-[#806f5d] hover:text-[#20160f]'"
          >
            <Smartphone :size="14" /> Cliente
          </button>
          <button
            type="button"
            @click="view = 'cajero'"
            class="flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 transition"
            :class="view === 'cajero' ? 'bg-[#20160f] text-white shadow-sm' : 'text-[#806f5d] hover:text-[#20160f]'"
          >
            <LayoutGrid :size="14" /> Cajero
          </button>
        </div>
      </div>
    </header>

    <!-- Vista Cliente -->
    <section
      v-if="view === 'cliente'"
      class="mx-auto grid w-full min-w-0 max-w-[1400px] gap-5 overflow-hidden px-2 py-4 sm:gap-8 sm:px-5 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px] md:px-8"
    >
      <div class="mx-auto w-full min-w-0 max-w-[720px] lg:mx-0">
        <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a18262]">Escaneá y elegí</p>
            <h1 class="mt-1 font-serif text-3xl font-bold sm:text-4xl">Vendimia</h1>
          </div>
          <span class="w-fit shrink-0 rounded-full bg-[#20160f] px-3 py-2 text-xs font-bold text-white sm:px-4">
            Mesa 4
          </span>
        </div>

        <!-- Categorías -->
        <div class="mb-6 flex gap-2 overflow-auto pb-1" role="tablist">
          <button
            v-for="item in ['Hamburguesas', 'Pasta', 'Bebidas', 'Postres']"
            :key="item"
            type="button"
            @click="selectCategory(item)"
            class="whitespace-nowrap rounded-full px-5 py-2.5 text-xs font-bold transition"
            :class="category === (item === 'Pasta' ? 'Hamburguesas' : item) ? 'bg-[#20160f] text-white' : 'bg-[#e8ddcc] text-[#5b4938] hover:bg-[#ded0bc]'"
          >
            {{ item }}
          </button>
        </div>

        <!-- Lista de Productos -->
        <div class="w-full min-w-0 space-y-3 overflow-hidden">
          <article
            v-for="product in visibleProducts"
            :key="product.id"
            class="box-border flex w-full min-w-0 max-w-full gap-2.5 overflow-hidden rounded-2xl border border-[#dfd1bd] bg-[#fbf7ee] p-2.5 shadow-[0_4px_14px_rgba(71,46,20,0.04)] sm:gap-4 sm:p-3"
          >
            <img
              :src="product.image"
              :alt="product.name"
              class="h-20 w-20 shrink-0 rounded-xl object-cover sm:h-24 sm:w-24"
            />
            <div class="flex min-w-0 flex-1 flex-col justify-between overflow-hidden py-0.5">
              <div class="min-w-0">
                <div class="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                  <h2 class="min-w-0 font-bold leading-tight">{{ product.name }}</h2>
                  <span class="shrink-0 text-sm font-semibold text-[#b83d14] sm:text-base">
                    {{ formatPrice(product.price) }}
                  </span>
                </div>
                <p class="mt-1 max-w-[430px] break-words text-[11px] leading-[1.35] text-[#755f49] sm:text-xs sm:leading-relaxed">
                  {{ product.description }}
                </p>
              </div>
              <button
                type="button"
                @click="selected = product"
                class="mt-2 w-fit rounded-full bg-[#20160f] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#432d1d]"
              >
                Agregar
              </button>
            </div>
          </article>
        </div>
      </div>

      <!-- Carrito lateral / Comanda Mesa -->
      <aside
        class="h-fit min-w-0 max-w-full overflow-hidden rounded-3xl border border-[#dfd1bd] bg-[#fffaf2] p-4 sm:p-5 shadow-[0_10px_30px_rgba(71,46,20,0.07)] lg:sticky lg:top-6"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a18262]">Tu pedido</p>
            <h2 class="mt-1 font-serif text-2xl font-bold">Mesa 4</h2>
          </div>
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0dfbf] text-[#9a5c17]">
            <ShoppingBag :size="18" />
          </div>
        </div>

        <!-- Estado de Pedido Enviado -->
        <div v-if="orderSent" class="mt-8 rounded-2xl bg-[#e5f0df] p-5 text-center">
          <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#58764d] text-white">
            <Check :size="21" />
          </div>
          <h3 class="mt-3 font-serif text-xl font-bold">Pedido recibido</h3>
          <p class="mt-1 text-sm text-[#52704b]">Tu comida está en preparación.</p>
          <p class="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-[#6c655c]">
            <Clock3 :size="14" /> Tiempo estimado: 20–30 min
          </p>
        </div>

        <!-- Estado Carrito Activo -->
        <template v-else>
          <div class="mt-6 space-y-3">
            <div
              v-for="product in cartProducts"
              :key="product.id"
              class="flex items-center justify-between gap-3 text-sm"
            >
              <div>
                <p class="font-bold">{{ product.name }}</p>
                <p class="text-xs text-[#8f7860]">1 unidad</p>
              </div>
              <div class="text-right">
                <p class="font-semibold">{{ formatPrice(product.price) }}</p>
                <button
                  type="button"
                  @click="removeFromCart(product.id)"
                  class="text-[11px] font-bold text-[#b83d14] hover:underline"
                >
                  Quitar
                </button>
              </div>
            </div>
          </div>

          <div class="my-5 border-t border-dashed border-[#d8c8b4]" />

          <div class="flex items-center justify-between">
            <span class="text-sm text-[#806f5d]">Subtotal</span>
            <span class="text-xl font-bold">{{ formatPrice(total) }}</span>
          </div>

          <button
            type="button"
            @click="sendOrder"
            :disabled="!cart.length"
            class="mt-5 flex w-full min-w-0 items-center justify-center gap-1 rounded-full bg-[#d65d2a] px-2 py-3.5 text-xs font-bold text-white transition hover:bg-[#b94b1e] disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-4 sm:text-sm"
          >
            Enviar pedido a cocina <ArrowRight :size="16" />
          </button>
          <p class="mt-3 text-center text-[11px] leading-relaxed text-[#9b8874]">
            Al enviar, la mesa queda bloqueada temporalmente para evitar pedidos duplicados.
          </p>
        </template>
      </aside>
    </section>

    <!-- Vista Cajero -->
    <section v-else class="mx-auto max-w-[1400px] px-5 py-8 md:px-8">
      <div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a18262]">Panel de control</p>
          <h1 class="mt-1 font-serif text-4xl font-bold">Mapa de mesas</h1>
          <p class="mt-2 text-sm text-[#806f5d]">Actualización en tiempo real · Última sincronización hace un momento</p>
        </div>
        <div class="flex items-center gap-2 rounded-full bg-[#e5f0df] px-3 py-2 text-xs font-bold text-[#52704b]">
          <span class="h-2 w-2 animate-pulse rounded-full bg-[#5a884b]" /> Sistema conectado
        </div>
      </div>

      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <!-- Salón de mesas -->
        <div class="rounded-3xl border border-[#dfd1bd] bg-[#fbf7ee] p-5 md:p-7">
          <div class="mb-5 flex items-center justify-between">
            <h2 class="font-serif text-2xl font-bold">Salón principal</h2>
            <div class="flex gap-4 text-xs font-semibold text-[#806f5d]">
              <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-full bg-[#b8d1ad]" /> Libre</span>
              <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-full bg-[#e48b63]" /> Ocupada</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <button
              v-for="number in 12"
              :key="number"
              type="button"
              @click="selectedTable = number"
              class="group relative min-h-32 rounded-2xl border-2 p-4 text-left transition"
              :class="[
                selectedTable === number ? 'border-[#d65d2a] shadow-[0_0_0_4px_rgba(214,93,42,0.12)]' : 'border-transparent',
                occupied.includes(number) ? 'bg-[#f5d7c9]' : 'bg-[#e5f0df] hover:bg-[#dcebd6]',
              ]"
            >
              <div class="flex items-center justify-between">
                <span
                  class="text-xs font-bold uppercase tracking-widest"
                  :class="occupied.includes(number) ? 'text-[#a54120]' : 'text-[#52704b]'"
                >
                  {{ occupied.includes(number) ? 'Ocupada' : 'Libre' }}
                </span>
                <Bell v-if="occupied.includes(number)" :size="15" class="text-[#c45229]" />
              </div>

              <span class="mt-7 block font-serif text-3xl font-bold">{{ number }}</span>
              <span v-if="occupied.includes(number)" class="absolute bottom-3 right-3 text-[10px] font-semibold text-[#a54120]">
                Pedido activo
              </span>
            </button>
          </div>
        </div>

        <!-- Detalle de comanda de mesa en Cajero -->
        <aside class="h-fit rounded-3xl border border-[#dfd1bd] bg-[#fffaf2] p-6">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a18262]">Comanda activa</p>
              <h2 class="mt-1 font-serif text-2xl font-bold">Mesa {{ selectedTable }}</h2>
            </div>
            <span
              class="rounded-full px-3 py-1.5 text-xs font-bold"
              :class="tableOccupied ? 'bg-[#f5d7c9] text-[#a54120]' : 'bg-[#e5f0df] text-[#52704b]'"
            >
              {{ tableOccupied ? 'Ocupada' : 'Libre' }}
            </span>
          </div>

          <template v-if="tableOccupied">
            <div class="mt-6 rounded-2xl bg-[#f6f1e8] p-4">
              <div class="flex items-center justify-between text-xs text-[#806f5d]">
                <span class="flex items-center gap-1.5"><Clock3 :size="14" /> Ingresó 20:14</span>
                <span>Pedido #104</span>
              </div>
              <div class="mt-4 space-y-3">
                <div class="flex justify-between text-sm">
                  <span><b>1x</b> Burger clásica</span>
                  <span class="font-semibold">{{ formatPrice(1890) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span><b>1x</b> Papas a la piedra</span>
                  <span class="font-semibold">{{ formatPrice(950) }}</span>
                </div>
              </div>
              <div class="mt-4 flex justify-between border-t border-[#dfd1bd] pt-3 font-bold">
                <span>Total</span>
                <span class="text-[#b83d14]">{{ formatPrice(2840) }}</span>
              </div>
            </div>

            <label class="mt-5 block text-xs font-bold uppercase tracking-wider text-[#806f5d]">
              Método de pago
              <select
                v-model="payment"
                class="mt-2 w-full appearance-none rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm font-semibold outline-none"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Transferencia">Transferencia</option>
              </select>
            </label>

            <button
              type="button"
              @click="freeTable"
              class="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#20160f] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#432d1d]"
            >
              <CircleDollarSign :size="17" /> Cobrar y liberar mesa
            </button>
          </template>

          <div v-else class="mt-10 text-center">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e5f0df] text-[#52704b]">
              <Check :size="25" />
            </div>
            <h3 class="mt-4 font-serif text-xl font-bold">Mesa disponible</h3>
            <p class="mt-1 text-sm text-[#806f5d]">Esperando un nuevo pedido desde el QR.</p>
          </div>
        </aside>
      </div>
    </section>

    <!-- Modal de Personalización de Producto -->
    <div
      v-if="selected"
      class="fixed inset-0 z-50 flex items-end justify-center bg-[#20160f]/40 p-4 sm:items-center"
    >
      <div class="w-full max-w-md rounded-3xl bg-[#fffaf2] p-6 shadow-2xl">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a18262]">Personalizá tu pedido</p>
            <h2 class="mt-1 font-serif text-2xl font-bold">{{ selected.name }}</h2>
          </div>
          <button
            type="button"
            @click="selected = null"
            aria-label="Cerrar"
            class="rounded-full p-2 text-[#806f5d] hover:bg-[#f0e5d5]"
          >
            <X :size="18" />
          </button>
        </div>

        <div class="mt-6 space-y-3">
          <p class="text-xs font-bold uppercase tracking-wider text-[#806f5d]">Opciones</p>
          <label
            v-for="(option, index) in ['Sin cebolla', 'Papas grandes', 'Salsa extra']"
            :key="option"
            class="flex cursor-pointer items-center justify-between rounded-xl border border-[#dfd1bd] bg-[#fbf7ee] p-3 text-sm"
          >
            <span>{{ option }}</span>
            <input
              type="checkbox"
              :default-checked="index === 1"
              class="h-4 w-4 accent-[#d65d2a]"
            />
          </label>
        </div>

        <div class="mt-6 flex items-center justify-between">
          <span class="font-bold">{{ formatPrice(selected.price) }}</span>
          <button
            type="button"
            @click="addToCart(selected.id); selected = null"
            class="flex items-center gap-2 rounded-full bg-[#d65d2a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b94b1e]"
          >
            <Plus :size="16" /> Agregar al carrito
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
