<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

// La carta que abre el cliente al escanear el QR de la mesa: sin sesión.
const route = useRoute()
const negocio = ref('')
const productos = ref([])
const cargando = ref(true)
const error = ref('')

const formatearPrecio = (valor) => `$ ${Number(valor).toLocaleString('es-AR')}`

onMounted(async () => {
  try {
    const res = await fetch(`/api/publico/carta/${route.params.organizacion}`)
    const json = await res.json()
    if (!res.ok || !json.success) {
      error.value = json.message || 'No se pudo cargar la carta.'
    } else {
      negocio.value = json.data.organizacion
      productos.value = json.data.productos
    }
  } catch {
    error.value = 'No se pudo conectar con el servidor.'
  }
  cargando.value = false
})
</script>

<template>
  <main class="min-h-dvh bg-[#0c0a09] px-4 py-8 text-[#f5f2eb] sm:px-6">
    <div class="mx-auto w-full max-w-2xl">
      <header class="text-center">
        <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e58a4e]">Carta digital</p>
        <h1 class="mt-1 font-serif text-3xl font-bold sm:text-4xl">{{ negocio || 'TrackMenú' }}</h1>
        <p v-if="route.query.mesa" class="mt-2 text-sm text-stone-400">Mesa {{ route.query.mesa }}</p>
      </header>

      <p v-if="cargando" class="mt-10 text-center text-sm text-stone-400">Cargando la carta…</p>

      <p v-else-if="error" role="alert"
        class="mt-10 rounded-2xl border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-center text-sm text-rose-200">
        {{ error }}
      </p>

      <ul v-else class="mt-8 space-y-3">
        <li v-for="producto in productos" :key="producto.id"
          class="flex gap-4 rounded-2xl border border-white/5 bg-[#17120f] p-4">
          <img v-if="producto.imagen_url" :src="producto.imagen_url" :alt="producto.nombre"
            class="h-20 w-20 shrink-0 rounded-xl bg-stone-900 object-cover" />
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <h2 class="min-w-0 text-base font-bold leading-snug">{{ producto.nombre }}</h2>
              <span class="shrink-0 font-bold tabular-nums text-[#e58a4e]">{{ formatearPrecio(producto.precio) }}</span>
            </div>
            <p v-if="producto.descripcion" class="mt-1 text-sm leading-relaxed text-stone-400">
              {{ producto.descripcion }}
            </p>
          </div>
        </li>
      </ul>

      <p v-if="!cargando && !error" class="mt-8 text-center text-[11px] text-stone-500">
        Para pedir, avisale al personal del local.
      </p>
    </div>
  </main>
</template>
