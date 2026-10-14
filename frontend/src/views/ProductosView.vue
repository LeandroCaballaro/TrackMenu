<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { LogIn, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-vue-next'
import logoIcono from '@/assets/2.png'
import { supabase } from '@/supabase'

const router = useRouter()

const productos = ref([])
const nombre = ref('')
const descripcion = ref('')
const precio = ref('')
const stock = ref(0)
const activo = ref(true)
const archivoImagen = ref(null)
const vistaPrevia = ref('')
const imagenUrlExistente = ref('')
const imagenRutaExistente = ref('')
const inputImagen = ref(null)
const productoEditandoId = ref(null)
const cargando = ref(false)
const mensaje = ref('')
const errorMensaje = ref('')

const formatearPrecio = (valor) =>
  `$ ${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`

async function cargarProductos(limpiarMensaje = true) {
  cargando.value = true
  errorMensaje.value = ''
  if (limpiarMensaje) mensaje.value = ''

  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .order('creado_en', { ascending: false })

  if (error) {
    errorMensaje.value = error.message
  } else {
    productos.value = data
  }

  cargando.value = false
}

function seleccionarImagen(evento) {
  errorMensaje.value = ''
  const archivo = evento.target.files?.[0]

  if (!archivo) {
    archivoImagen.value = null
    vistaPrevia.value = ''
    return
  }

  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp']

  if (!tiposPermitidos.includes(archivo.type)) {
    errorMensaje.value = 'La imagen debe ser JPG, PNG o WEBP.'
    evento.target.value = ''
    return
  }

  if (archivo.size > 5 * 1024 * 1024) {
    errorMensaje.value = 'La imagen no puede superar los 5 MB.'
    evento.target.value = ''
    return
  }

  if (vistaPrevia.value) URL.revokeObjectURL(vistaPrevia.value)
  archivoImagen.value = archivo
  vistaPrevia.value = URL.createObjectURL(archivo)
}

async function subirImagen() {
  if (!archivoImagen.value) return null

  const {
    data: { user },
    error: errorUsuario,
  } = await supabase.auth.getUser()

  if (errorUsuario || !user) {
    throw new Error('No hay un usuario autenticado.')
  }

  const extension = archivoImagen.value.name.split('.').pop().toLowerCase()
  const ruta = `${user.id}/${crypto.randomUUID()}.${extension}`

  const { error: errorSubida } = await supabase.storage
    .from('productos')
    .upload(ruta, archivoImagen.value, { cacheControl: '3600', upsert: false })

  if (errorSubida) throw errorSubida

  const { data } = supabase.storage.from('productos').getPublicUrl(ruta)

  return { url: data.publicUrl, ruta }
}

async function guardarProducto() {
  errorMensaje.value = ''
  mensaje.value = ''

  if (!nombre.value.trim()) {
    errorMensaje.value = 'El nombre es obligatorio.'
    return
  }

  if (precio.value === '' || Number(precio.value) < 0) {
    errorMensaje.value = 'Ingresá un precio válido.'
    return
  }

  if (Number(stock.value) < 0) {
    errorMensaje.value = 'El stock no puede ser negativo.'
    return
  }

  if (!productoEditandoId.value && !archivoImagen.value) {
    errorMensaje.value = 'Seleccioná una imagen para el producto.'
    return
  }

  cargando.value = true
  let nuevaImagen

  try {
    nuevaImagen = await subirImagen()

    const datosProducto = {
      nombre: nombre.value.trim(),
      descripcion: descripcion.value.trim() || null,
      precio: Number(precio.value),
      stock: Number(stock.value),
      activo: activo.value,
      imagen_url: nuevaImagen?.url ?? imagenUrlExistente.value,
      imagen_ruta: nuevaImagen?.ruta ?? imagenRutaExistente.value,
    }

    let error

    if (productoEditandoId.value) {
      ;({ error } = await supabase
        .from('productos')
        .update(datosProducto)
        .eq('id', productoEditandoId.value))
    } else {
      ;({ error } = await supabase.from('productos').insert(datosProducto))
    }

    if (error) {
      if (nuevaImagen?.ruta) {
        await supabase.storage.from('productos').remove([nuevaImagen.ruta])
      }
      throw error
    }

    if (productoEditandoId.value && nuevaImagen?.ruta && imagenRutaExistente.value) {
      await supabase.storage.from('productos').remove([imagenRutaExistente.value])
    }

    mensaje.value = productoEditandoId.value
      ? 'Producto actualizado correctamente.'
      : 'Producto creado correctamente.'

    limpiarFormulario()
    await cargarProductos(false)
  } catch (error) {
    errorMensaje.value = error.message
  } finally {
    cargando.value = false
  }
}

function editarProducto(producto) {
  productoEditandoId.value = producto.id
  nombre.value = producto.nombre
  descripcion.value = producto.descripcion ?? ''
  precio.value = producto.precio
  stock.value = producto.stock
  activo.value = producto.activo
  imagenUrlExistente.value = producto.imagen_url ?? ''
  imagenRutaExistente.value = producto.imagen_ruta ?? ''
  archivoImagen.value = null
  vistaPrevia.value = ''
  if (inputImagen.value) inputImagen.value.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function eliminarProducto(producto) {
  const confirmado = window.confirm(`¿Querés eliminar el producto "${producto.nombre}"?`)
  if (!confirmado) return

  cargando.value = true
  errorMensaje.value = ''
  mensaje.value = ''

  const { error } = await supabase.from('productos').delete().eq('id', producto.id)

  if (error) {
    errorMensaje.value = error.message
    cargando.value = false
    return
  }

  if (producto.imagen_ruta) {
    const { error: errorImagen } = await supabase.storage
      .from('productos')
      .remove([producto.imagen_ruta])

    if (errorImagen) {
      errorMensaje.value = 'El producto se eliminó, pero no se pudo borrar su imagen.'
    }
  }

  if (!errorMensaje.value) mensaje.value = 'Producto eliminado correctamente.'
  if (productoEditandoId.value === producto.id) limpiarFormulario()

  await cargarProductos(false)
  cargando.value = false
}

function limpiarFormulario() {
  nombre.value = ''
  descripcion.value = ''
  precio.value = ''
  stock.value = 0
  activo.value = true
  productoEditandoId.value = null
  archivoImagen.value = null
  imagenUrlExistente.value = ''
  imagenRutaExistente.value = ''
  if (vistaPrevia.value) URL.revokeObjectURL(vistaPrevia.value)
  vistaPrevia.value = ''
  if (inputImagen.value) inputImagen.value.value = ''
}

function cancelarEdicion() {
  limpiarFormulario()
  mensaje.value = ''
  errorMensaje.value = ''
}

async function cerrarSesion() {
  await supabase.auth.signOut()
  router.push('/login')
}

onMounted(cargarProductos)
</script>

<template>
  <main class="min-h-screen overflow-x-hidden bg-[#f6f1e8] text-[#17120e]">
    <header class="w-full border-b border-[#ded4c5] bg-[#fbf8f2] px-3 py-3 sm:px-5 sm:py-4 md:px-8">
      <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <RouterLink to="/inicio" class="flex items-center gap-3">
          <img :src="logoIcono" alt="TrackMenú" class="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16" />
          <span class="flex flex-col">
            <span class="font-girassol text-[24px] leading-none tracking-wide text-[#d65d2a]">TrackMenú</span>
            <span class="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a18262]">Administración del menú</span>
          </span>
        </RouterLink>
        <button type="button" @click="cerrarSesion"
          class="flex items-center justify-center gap-2 rounded-full border border-[#d8c8b4] bg-[#fffaf2] px-4 py-2.5 text-xs font-bold text-[#5b4938] transition hover:bg-[#f0e5d5]">
          <LogIn :size="15" class="rotate-180" /> Cerrar sesión
        </button>
      </div>
    </header>

    <div class="mx-auto grid w-full max-w-[1400px] gap-5 px-2 py-4 sm:gap-8 sm:px-5 sm:py-8 md:px-8 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section class="h-fit rounded-3xl border border-[#e4d9c8] bg-[#fffaf2] p-5 shadow-sm sm:p-6">
        <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a18262]">Administración</p>
        <h1 class="mt-1 font-serif text-2xl font-bold sm:text-3xl">
          {{ productoEditandoId ? 'Editar producto' : 'Nuevo producto' }}
        </h1>
        <p class="mt-2 text-sm leading-relaxed text-[#806f5d]">
          Completá los datos y guardá una imagen JPG, PNG o WEBP.
        </p>

        <form class="mt-5 space-y-4" @submit.prevent="guardarProducto">
          <label class="block text-xs font-bold text-[#806f5d]">
            Nombre
            <input v-model="nombre" type="text" maxlength="120" required
              class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
          </label>

          <label class="block text-xs font-bold text-[#806f5d]">
            Descripción
            <textarea v-model="descripcion" rows="3"
              class="mt-2 w-full resize-y rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]"></textarea>
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block text-xs font-bold text-[#806f5d]">
              Precio
              <input v-model="precio" type="number" min="0" step="0.01" required
                class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
            </label>
            <label class="block text-xs font-bold text-[#806f5d]">
              Stock
              <input v-model="stock" type="number" min="0" step="1" required
                class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
            </label>
          </div>

          <label class="block text-xs font-bold text-[#806f5d]">
            Imagen del producto
            <input ref="inputImagen" type="file" accept="image/jpeg,image/png,image/webp" @change="seleccionarImagen"
              class="mt-2 w-full cursor-pointer rounded-xl border border-dashed border-[#dfd1bd] bg-white px-3 py-3 text-xs text-[#5b4938] outline-none file:mr-3 file:rounded-full file:border-0 file:bg-[#eee5d8] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#5b4938] focus:border-[#d65d2a]" />
            <small class="mt-1 block text-[11px] font-semibold text-[#9b8874]">Máximo 5 MB.</small>
          </label>

          <div v-if="vistaPrevia || imagenUrlExistente" class="flex items-center gap-3 rounded-2xl bg-[#f6f1e8] p-3">
            <img :src="vistaPrevia || imagenUrlExistente" alt="Vista previa del producto"
              class="h-16 w-16 shrink-0 rounded-xl object-cover" />
            <span class="text-xs font-bold text-[#806f5d]">
              {{ vistaPrevia ? 'Nueva imagen seleccionada' : 'Imagen actual' }}
            </span>
          </div>

          <label class="flex items-center gap-2 text-xs font-bold text-[#5b4938]">
            <input v-model="activo" type="checkbox" class="h-4 w-4 accent-[#d65d2a]" />
            Producto activo
          </label>

          <p v-if="errorMensaje" role="alert" class="rounded-xl bg-[#fbe6de] px-3 py-2 text-sm text-[#b83d14]">
            {{ errorMensaje }}
          </p>
          <p v-if="mensaje" class="rounded-xl bg-[#e3f0e6] px-3 py-2 text-sm text-[#2f6f4f]">{{ mensaje }}</p>

          <div class="flex flex-col gap-2 sm:flex-row">
            <button type="submit" :disabled="cargando"
              class="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#d65d2a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#b94b1e] disabled:opacity-60">
              <component :is="productoEditandoId ? Save : Plus" :size="16" />
              {{ cargando ? 'Guardando...' : productoEditandoId ? 'Actualizar producto' : 'Crear producto' }}
            </button>
            <button v-if="productoEditandoId" type="button" @click="cancelarEdicion"
              class="flex items-center justify-center gap-2 rounded-full border border-[#d8c8b4] bg-[#fffaf2] px-4 py-3 text-sm font-bold text-[#5b4938] transition hover:bg-[#f0e5d5]">
              <X :size="16" /> Cancelar
            </button>
          </div>
        </form>
      </section>

      <section class="rounded-3xl border border-[#e4d9c8] bg-[#fffaf2] p-5 shadow-sm sm:p-6">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a18262]">Inventario</p>
            <h2 class="mt-1 font-serif text-2xl font-bold sm:text-3xl">Mis productos</h2>
          </div>
          <button type="button" :disabled="cargando" @click="cargarProductos"
            class="flex w-fit items-center gap-2 rounded-full border border-[#d8c8b4] bg-[#fffaf2] px-4 py-2.5 text-xs font-bold text-[#5b4938] transition hover:bg-[#f0e5d5] disabled:opacity-60">
            <RefreshCw :size="15" /> Actualizar
          </button>
        </div>

        <p v-if="cargando && !productos.length" class="mt-6 text-sm text-[#806f5d]">Cargando productos...</p>
        <p v-else-if="!productos.length"
          class="mt-6 rounded-2xl bg-[#f6f1e8] px-4 py-6 text-center text-sm font-semibold text-[#806f5d]">
          Todavía no creaste productos.
        </p>

        <div v-else class="mt-5 overflow-x-auto">
          <table class="w-full min-w-[640px] border-separate border-spacing-y-2 text-left text-sm">
            <thead>
              <tr class="text-[11px] font-bold uppercase tracking-[0.14em] text-[#a18262]">
                <th class="px-3 pb-1">Imagen</th>
                <th class="px-3 pb-1">Producto</th>
                <th class="px-3 pb-1">Precio</th>
                <th class="px-3 pb-1">Stock</th>
                <th class="px-3 pb-1">Estado</th>
                <th class="px-3 pb-1 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="producto in productos" :key="producto.id" class="bg-[#f6f1e8]">
                <td class="rounded-l-2xl px-3 py-3">
                  <img v-if="producto.imagen_url" :src="producto.imagen_url" :alt="producto.nombre"
                    class="h-14 w-14 rounded-xl object-cover" />
                  <span v-else class="text-[11px] font-semibold text-[#9b8874]">Sin imagen</span>
                </td>
                <td class="px-3 py-3">
                  <strong class="block font-bold text-[#17120e]">{{ producto.nombre }}</strong>
                  <small class="mt-0.5 block max-w-[280px] text-xs leading-relaxed text-[#806f5d]">
                    {{ producto.descripcion || 'Sin descripción' }}
                  </small>
                </td>
                <td class="px-3 py-3 font-bold">{{ formatearPrecio(producto.precio) }}</td>
                <td class="px-3 py-3 font-semibold">{{ producto.stock }}</td>
                <td class="px-3 py-3">
                  <span class="rounded-full px-3 py-1.5 text-[11px] font-bold"
                    :class="producto.activo ? 'bg-[#e3f0e6] text-[#2f6f4f]' : 'bg-[#eee5d8] text-[#806f5d]'">
                    {{ producto.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="rounded-r-2xl px-3 py-3">
                  <div class="flex justify-end gap-2">
                    <button type="button" @click="editarProducto(producto)"
                      class="flex items-center gap-1.5 rounded-full border border-[#d8c8b4] bg-[#fffaf2] px-3 py-2 text-xs font-bold text-[#5b4938] transition hover:bg-[#f0e5d5]">
                      <Pencil :size="14" /> Editar
                    </button>
                    <button type="button" @click="eliminarProducto(producto)"
                      class="flex items-center gap-1.5 rounded-full bg-[#b83d14] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#95300e]">
                      <Trash2 :size="14" /> Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>
</template>
