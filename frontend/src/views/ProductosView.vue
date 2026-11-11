<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Plus, Search, ArrowUpDown, Filter, Pencil, Trash2, X, Check, AlertCircle,
  LogIn, Shield, Users, Building2, Package, Sparkles, UploadCloud,
  Bell, BellRing
} from 'lucide-vue-next'
import logoIcono from '@/assets/3.png'
import NavigationHeader from '@/components/NavigationHeader.vue'
import Combobox from '@/components/Combobox.vue'
import { authState, authService, productosService } from '@/services/api'

const opcionesOrden = [
  { value: 'creado_en', label: 'Ordenar: Fecha' },
  { value: 'nombre', label: 'Ordenar: Nombre' },
  { value: 'precio', label: 'Ordenar: Precio' },
  { value: 'stock', label: 'Ordenar: Stock' },
]

const route = useRoute()
const router = useRouter()

// Estado de productos y listado
const productos = ref([])
const totalProductos = ref(0)
const cargando = ref(false)

// Filtros, búsqueda y ordenación
const busqueda = ref('')
const filtroActivo = ref('') // '' (todos) | 'true' | 'false'
const campoOrden = ref('creado_en') // 'creado_en' | 'nombre' | 'precio' | 'stock'
const direccionOrden = ref('desc') // 'desc' | 'asc'

// Notificaciones flotantes / alertas
const notificacion = ref({ visible: false, tipo: 'exito', mensaje: '' })
const mostrarNotificacion = (mensaje, tipo = 'exito') => {
  notificacion.value = { visible: true, tipo, mensaje }
  setTimeout(() => {
    notificacion.value.visible = false
  }, 4500)
}

// Modal / Formulario de Alta y Edición
const formularioAbierto = ref(false)
const modoEdicion = ref(false)
const productoActualId = ref(null)

const form = ref({
  nombre: '',
  descripcion: '',
  precio: '',
  stock: 0,
  activo: true,
  imagen_url: '',
})
const erroresForm = ref({})

// Modal de confirmación para eliminar
const modalEliminarAbierto = ref(false)
const productoAEliminar = ref(null)

// Formateo de precio
const formatearPrecio = (valor) => `$ ${Number(valor || 0).toLocaleString('es-AR')}`

// Formateo de fecha
const formatearFecha = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return ''
  }
}

// Cargar listado aplicando búsqueda, filtros y orden
async function cargarListado() {
  cargando.value = true
  const res = await productosService.listar({
    q: busqueda.value,
    activo: filtroActivo.value !== '' ? filtroActivo.value : null,
    orden: campoOrden.value,
    dir: direccionOrden.value,
  })
  cargando.value = false

  if (res.success) {
    productos.value = res.data
    totalProductos.value = res.total ?? res.data.length
  } else {
    mostrarNotificacion(res.message || 'Error al cargar productos', 'error')
  }
}

// Watchers para búsqueda y filtros reactivos
watch([busqueda, filtroActivo, campoOrden, direccionOrden], () => {
  cargarListado()
})

// Abrir formulario para nuevo registro
function abrirNuevoProducto() {
  modoEdicion.value = false
  productoActualId.value = null
  form.value = {
    nombre: '',
    descripcion: '',
    precio: '',
    stock: 0,
    activo: true,
    imagen_url: '',
  }
  erroresForm.value = {}
  formularioAbierto.value = true
}

// Abrir formulario para editar
async function abrirEditarProducto(producto) {
  modoEdicion.value = true
  productoActualId.value = producto.id
  form.value = {
    nombre: producto.nombre,
    descripcion: producto.descripcion || '',
    precio: producto.precio,
    stock: producto.stock,
    activo: producto.activo,
    imagen_url: producto.imagen_url || '',
  }
  erroresForm.value = {}
  formularioAbierto.value = true
}

// Guardar producto (Alta o Modificación)
async function guardarProducto() {
  erroresForm.value = {}

  let res
  if (modoEdicion.value) {
    res = await productosService.actualizar(productoActualId.value, { ...form.value })
  } else {
    res = await productosService.crear({ ...form.value })
  }

  if (res.success) {
    mostrarNotificacion(res.message, 'exito')
    formularioAbierto.value = false
    await cargarListado()
  } else {
    if (res.errors) {
      erroresForm.value = res.errors
      mostrarNotificacion(res.message || 'Verificá los errores en el formulario', 'error')
    } else {
      mostrarNotificacion(res.message || 'Ocurrió un error al procesar el producto', 'error')
    }
  }
}

// Diálogo de confirmación para eliminar
function confirmarEliminar(producto) {
  if (authState.rol !== 'admin') {
    mostrarNotificacion('Acceso denegado: sólo el Administrador puede eliminar registros.', 'error')
    return
  }
  productoAEliminar.value = producto
  modalEliminarAbierto.value = true
}

async function ejecutarEliminar() {
  if (!productoAEliminar.value) return
  const id = productoAEliminar.value.id
  modalEliminarAbierto.value = false

  const res = await productosService.eliminar(id)
  if (res.success) {
    mostrarNotificacion(res.message, 'exito')
    productoAEliminar.value = null
    await cargarListado()
  } else {
    mostrarNotificacion(res.message, 'error')
  }
}

// Subida de imagen desde dispositivo
const inputArchivo = ref(null)
const mostrarInputUrl = ref(false)

function abrirSelectorArchivo() {
  inputArchivo.value?.click()
}

function procesarArchivoSeleccionado(event) {
  const archivo = event.target.files?.[0]
  if (!archivo) return

  if (!archivo.type.startsWith('image/')) {
    mostrarNotificacion('Por favor, seleccioná un archivo de imagen válido (JPG, PNG, WebP).', 'error')
    return
  }

  if (archivo.size > 5 * 1024 * 1024) {
    mostrarNotificacion('La imagen no debe superar los 5MB.', 'error')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    form.value.imagen_url = e.target.result
    mostrarNotificacion('Imagen cargada desde tu dispositivo.', 'exito')
  }
  reader.onerror = () => {
    mostrarNotificacion('No se pudo leer la imagen seleccionada.', 'error')
  }
  reader.readAsDataURL(archivo)
}

function quitarImagen() {
  form.value.imagen_url = ''
  if (inputArchivo.value) {
    inputArchivo.value.value = ''
  }
}

// Modal y estado para Notificar Falta de Stock (Rol Empleado)
const modalNotificarStockAbierto = ref(false)
const productoANotificar = ref(null)
const motivoNotificacion = ref('')
const enviandoNotificacion = ref(false)

function abrirNotificarStock(producto) {
  productoANotificar.value = producto
  motivoNotificacion.value = 'Sin stock disponible en salón/cocina'
  modalNotificarStockAbierto.value = true
}

async function enviarNotificacionStock() {
  if (!productoANotificar.value) return
  enviandoNotificacion.value = true
  const res = await productosService.notificarFaltaStock(
    productoANotificar.value.id,
    motivoNotificacion.value
  )
  enviandoNotificacion.value = false
  modalNotificarStockAbierto.value = false

  if (res.success) {
    mostrarNotificacion(res.message, 'exito')
  } else {
    mostrarNotificacion(res.message || 'No se pudo enviar la notificación', 'error')
  }
}

// Cerrar sesión
function cerrarSesion() {
  authService.logout()
  router.push('/login')
}

onMounted(() => {
  cargarListado()
  // Si la ruta es /productos/nuevo, abrir formulario automáticamente
  if (route.meta.accion === 'nuevo') {
    abrirNuevoProducto()
  }
})
</script>

<template>
  <main class="min-h-screen overflow-x-hidden bg-[#0c0a09] text-[#f5f2eb]">
    <!-- Notificación Toast sobria -->
    <transition
      enter-active-class="transform transition ease-out duration-200"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0">
      <div v-if="notificacion.visible"
        class="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-xs font-semibold shadow-lg"
        :class="[
          notificacion.tipo === 'exito' ? 'border-[#204933] bg-[#163223] text-[#4ade80]' : '',
          notificacion.tipo === 'error' ? 'border-rose-900/60 bg-[#2b1111] text-rose-300' : '',
          notificacion.tipo === 'info' ? 'border-stone-800 bg-[#17120f] text-[#e58a4e]' : ''
        ]">
        <Check v-if="notificacion.tipo === 'exito'" :size="16" />
        <AlertCircle v-else :size="16" />
        <span>{{ notificacion.mensaje }}</span>
        <button type="button" @click="notificacion.visible = false" class="ml-2 text-stone-400 hover:text-white">
          <X :size="14" />
        </button>
      </div>
    </transition>

    <!-- Contenido Principal del Módulo -->
    <div class="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 md:px-8">
      <!-- Encabezado de la Sección -->
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e58a4e]">Catálogo de Menú</p>
            <span class="rounded-full border border-stone-800 bg-[#17120f] px-2.5 py-0.5 text-[10px] text-stone-400">
              {{ totalProductos }} {{ totalProductos === 1 ? 'producto' : 'productos' }}
            </span>
          </div>
          <h1 class="mt-1 font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Gestión de Productos
          </h1>
          <p class="mt-1 text-xs text-stone-400">
            Administrá los precios, stock y disponibilidad de tu restaurante con control de permisos por rol.
          </p>
        </div>

        <!-- Botón Crear Nuevo Registro -->
        <div>
          <button type="button" @click="abrirNuevoProducto"
            class="flex items-center gap-2 rounded-2xl bg-[#e58a4e] px-4 py-3 text-xs font-bold text-[#190d05] transition hover:bg-[#ee975e] active:scale-[0.99]">
            <Plus :size="16" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      <!-- Barra de Filtros, Búsqueda y Ordenación -->
      <section class="mb-6 rounded-2xl border border-stone-800/80 bg-[#17120f] p-4 text-white">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <!-- Búsqueda en vivo por nombre -->
          <div class="relative lg:col-span-5">
            <Search :size="15" class="absolute left-3.5 top-3.5 text-stone-400" />
            <input v-model="busqueda" type="text" placeholder="Buscar producto por nombre..."
              class="w-full rounded-xl border border-stone-800 bg-[#110d0b] pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-[#e58a4e] transition" />
            <button v-if="busqueda" type="button" @click="busqueda = ''"
              class="absolute right-3 top-3 text-stone-400 hover:text-white">
              <X :size="13" />
            </button>
          </div>

          <!-- Filtro por Estado (Todos, Activo, Inactivo) -->
          <div class="flex items-center gap-1 lg:col-span-4">
            <span class="text-[11px] font-semibold text-stone-400 mr-1 hidden sm:inline">Estado:</span>
            <div class="flex rounded-xl border border-stone-800 bg-[#110d0b] p-1 text-xs w-full sm:w-auto">
              <button type="button" @click="filtroActivo = ''"
                class="flex-1 sm:flex-none rounded-lg px-3 py-1.5 font-semibold transition"
                :class="filtroActivo === '' ? 'bg-[#221a15] text-[#e58a4e]' : 'text-stone-400 hover:text-white'">
                Todos
              </button>
              <button type="button" @click="filtroActivo = 'true'"
                class="flex-1 sm:flex-none rounded-lg px-3 py-1.5 font-semibold transition"
                :class="filtroActivo === 'true' ? 'bg-[#163223] text-[#4ade80]' : 'text-stone-400 hover:text-white'">
                Activos
              </button>
              <button type="button" @click="filtroActivo = 'false'"
                class="flex-1 sm:flex-none rounded-lg px-3 py-1.5 font-semibold transition"
                :class="filtroActivo === 'false' ? 'bg-[#2b1111] text-rose-300' : 'text-stone-400 hover:text-white'">
                Inactivos
              </button>
            </div>
          </div>

          <!-- Ordenación (Campo y Dirección) -->
          <div class="flex items-center gap-2 lg:col-span-3">
            <div class="flex-1">
              <Combobox
                v-model="campoOrden"
                :options="opcionesOrden"
                size="sm"
              />
            </div>
            <button type="button"
              @click="direccionOrden = direccionOrden === 'asc' ? 'desc' : 'asc'"
              :title="direccionOrden === 'asc' ? 'Ascendente (click para invertir)' : 'Descendente (click para invertir)'"
              class="flex items-center gap-1 rounded-xl border border-stone-800 bg-[#110d0b] px-3 py-2.5 text-xs font-semibold text-stone-300 transition hover:border-[#e58a4e]/40 hover:text-white">
              <ArrowUpDown :size="13" />
              <span>{{ direccionOrden === 'asc' ? 'Asc' : 'Desc' }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Tabla / Listado de Registros -->
      <section class="rounded-2xl border border-stone-800/80 bg-[#17120f] overflow-hidden">
        <!-- Estado de carga -->
        <div v-if="cargando" class="py-12 text-center text-xs text-stone-400">
          Cargando productos del menú...
        </div>

        <!-- Estado vacío: Sin resultados -->
        <div v-else-if="!productos.length" class="py-14 text-center px-4">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-stone-800 bg-[#110d0b] text-stone-400 mb-3">
            <Package :size="20" />
          </div>
          <h3 class="font-serif text-lg font-bold text-white">No se encontraron productos</h3>
          <p class="mt-1 text-xs text-stone-400 max-w-sm mx-auto">
            {{ busqueda || filtroActivo ? 'No hay productos que coincidan con la búsqueda o filtro aplicado.' : 'Aún no registraste productos para esta organización.' }}
          </p>
          <div class="mt-4 flex items-center justify-center gap-2">
            <button v-if="busqueda || filtroActivo" type="button" @click="busqueda = ''; filtroActivo = ''"
              class="rounded-full border border-stone-800 bg-[#110d0b] px-4 py-2 text-xs font-semibold text-stone-300 hover:text-white transition">
              Limpiar filtros
            </button>
            <button type="button" @click="abrirNuevoProducto"
              class="rounded-full bg-[#e58a4e] px-4 py-2 text-xs font-bold text-[#190d05] transition hover:bg-[#ee975e]">
              + Cargar Primer Producto
            </button>
          </div>
        </div>

        <!-- Tabla de Datos -->
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[700px] text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-stone-800/80 text-[10px] font-bold uppercase tracking-[0.16em] text-stone-400 bg-[#130f0d]">
                <th class="py-3.5 px-4">Producto</th>
                <th class="py-3.5 px-4">Descripción</th>
                <th class="py-3.5 px-4">Precio</th>
                <th class="py-3.5 px-4">Stock</th>
                <th class="py-3.5 px-4">Estado</th>
                <th class="py-3.5 px-4">Fecha</th>
                <th class="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-800/50">
              <tr v-for="producto in productos" :key="producto.id"
                class="transition hover:bg-[#1a1411]">
                <!-- Imagen y Nombre -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <img v-if="producto.imagen_url" :src="producto.imagen_url" :alt="producto.nombre"
                      class="h-10 w-10 shrink-0 rounded-xl object-cover bg-stone-900 border border-stone-800" />
                    <div v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-900 border border-stone-800 text-[9px] text-stone-400">
                      Sin foto
                    </div>
                    <span class="font-bold text-white text-sm">{{ producto.nombre }}</span>
                  </div>
                </td>

                <!-- Descripción -->
                <td class="py-3 px-4 max-w-[260px]">
                  <p class="truncate text-stone-400" :title="producto.descripcion || 'Sin descripción'">
                    {{ producto.descripcion || '—' }}
                  </p>
                </td>

                <!-- Precio -->
                <td class="py-3 px-4 font-bold text-[#e58a4e] text-sm">
                  {{ formatearPrecio(producto.precio) }}
                </td>

                <!-- Stock -->
                <td class="py-3 px-4">
                  <span class="font-semibold text-stone-200" :class="producto.stock <= 5 ? 'text-amber-400' : ''">
                    {{ producto.stock }} un.
                  </span>
                </td>

                <!-- Estado Activo / Inactivo -->
                <td class="py-3 px-4">
                  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
                    :class="producto.activo ? 'border border-[#204933] bg-[#163223] text-[#4ade80]' : 'border border-stone-800 bg-[#110d0b] text-stone-400'">
                    <span class="h-1.5 w-1.5 rounded-full" :class="producto.activo ? 'bg-[#4ade80]' : 'bg-stone-500'" />
                    {{ producto.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>

                <!-- Fecha -->
                <td class="py-3 px-4 text-stone-400">
                  {{ formatearFecha(producto.creado_en) }}
                </td>

                <!-- Acciones (según Rol) -->
                <td class="py-3 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <!-- Botón Modificar (Admin y Empleado) -->
                    <button type="button"
                      @click="abrirEditarProducto(producto)"
                      class="flex items-center gap-1 rounded-xl border border-stone-800 bg-[#110d0b] px-3 py-1.5 text-xs font-semibold text-stone-300 transition hover:border-stone-700 hover:text-white"
                      title="Modificar registro">
                      <Pencil :size="12" />
                      <span>Editar</span>
                    </button>

                    <!-- Notificar Falta de Stock (Empleado) -->
                    <button v-if="authState.rol === 'empleado'" type="button"
                      @click="abrirNotificarStock(producto)"
                      class="flex items-center gap-1 rounded-xl border border-amber-800/60 bg-amber-950/30 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/40 hover:text-amber-100"
                      title="Notificar falta de stock al Administrador">
                      <Bell :size="12" />
                      <span>Falta stock</span>
                    </button>

                    <!-- Botón Eliminar (ÚNICAMENTE Admin) -->
                    <button v-if="authState.rol === 'admin'" type="button"
                      @click="confirmarEliminar(producto)"
                      class="flex items-center gap-1 rounded-xl border border-rose-900/40 bg-rose-950/20 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-950/40"
                      title="Eliminar producto (requiere confirmación)">
                      <Trash2 :size="12" />
                      <span>Borrar</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Modal Formulario: Alta y Modificación de Producto -->
    <div v-if="formularioAbierto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
      @click.self="formularioAbierto = false">
      <div class="w-full max-w-lg rounded-3xl border border-stone-800 bg-[#17120f] p-6 text-white my-8 shadow-2xl">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">
              {{ modoEdicion ? 'Actualización de Datos' : 'Nuevo Registro de Menú' }}
            </p>
            <h2 class="font-serif text-2xl font-bold text-white mt-0.5">
              {{ modoEdicion ? 'Modificar Producto' : 'Crear Producto' }}
            </h2>
          </div>
          <button type="button" @click="formularioAbierto = false"
            class="rounded-full p-2 text-stone-400 hover:bg-[#221a15] hover:text-white transition">
            <X :size="16" />
          </button>
        </div>

        <form class="mt-5 space-y-4" @submit.prevent="guardarProducto">
          <!-- Nombre -->
          <div>
            <label class="block text-xs font-bold text-stone-300">
              Nombre del Producto *
              <input v-model="form.nombre" type="text" maxlength="80" required placeholder="Ej: Pizza Napolitana Especial"
                class="mt-1.5 w-full rounded-xl border bg-[#110d0b] px-3.5 py-2.5 text-xs text-white outline-none transition"
                :class="erroresForm.nombre ? 'border-rose-500' : 'border-stone-800 focus:border-[#e58a4e]'" />
            </label>
            <span v-if="erroresForm.nombre" class="text-[11px] font-medium text-rose-400 mt-1 block">
              {{ erroresForm.nombre }}
            </span>
          </div>

          <!-- Descripción -->
          <div>
            <label class="block text-xs font-bold text-stone-300">
              Descripción
              <textarea v-model="form.descripcion" rows="2" maxlength="500" placeholder="Ingredientes, detalles de preparación o presentación..."
                class="mt-1.5 w-full resize-none rounded-xl border bg-[#110d0b] px-3.5 py-2.5 text-xs text-white outline-none transition"
                :class="erroresForm.descripcion ? 'border-rose-500' : 'border-stone-800 focus:border-[#e58a4e]'"></textarea>
            </label>
            <span v-if="erroresForm.descripcion" class="text-[11px] font-medium text-rose-400 mt-1 block">
              {{ erroresForm.descripcion }}
            </span>
          </div>

          <!-- Precio y Stock en 2 columnas -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-stone-300">
                Precio ($) *
                <input v-model="form.precio" type="number" min="0" step="0.01" required placeholder="0.00"
                  class="mt-1.5 w-full rounded-xl border bg-[#110d0b] px-3.5 py-2.5 text-xs text-white outline-none transition"
                  :class="erroresForm.precio ? 'border-rose-500' : 'border-stone-800 focus:border-[#e58a4e]'" />
              </label>
              <span v-if="erroresForm.precio" class="text-[11px] font-medium text-rose-400 mt-1 block">
                {{ erroresForm.precio }}
              </span>
            </div>

            <div>
              <label class="block text-xs font-bold text-stone-300">
                Stock (unidades) *
                <input v-model="form.stock" type="number" min="0" step="1" required placeholder="0"
                  :disabled="authState.rol === 'empleado'"
                  class="mt-1.5 w-full rounded-xl border bg-[#110d0b] px-3.5 py-2.5 text-xs text-white outline-none transition"
                  :class="[
                    authState.rol === 'empleado'
                      ? 'opacity-50 cursor-not-allowed bg-stone-900 border-stone-800 text-stone-400'
                      : (erroresForm.stock ? 'border-rose-500' : 'border-stone-800 focus:border-[#e58a4e]')
                  ]" />
              </label>
              <p v-if="authState.rol === 'empleado'" class="mt-1 text-[11px] text-amber-400 flex items-start gap-1">
                <AlertCircle :size="12" class="shrink-0 mt-0.5" />
                <span>Solo Administradores pueden editar el stock. Si se agotó, podés notificarlo abajo.</span>
              </p>
              <span v-else-if="erroresForm.stock" class="text-[11px] font-medium text-rose-400 mt-1 block">
                {{ erroresForm.stock }}
              </span>
            </div>
          </div>

          <!-- Banner para rol Empleado para Notificar Falta de Stock -->
          <div v-if="modoEdicion && authState.rol === 'empleado'"
            class="flex items-center justify-between rounded-2xl border border-amber-900/50 bg-amber-950/20 p-3">
            <div class="flex items-center gap-2">
              <BellRing :size="16" class="text-amber-400 shrink-0" />
              <div class="text-[11px] text-stone-300">
                <p class="font-bold text-amber-300">¿No hay más stock de este producto?</p>
                <p class="text-stone-400">Podés avisarle al administrador de inmediato.</p>
              </div>
            </div>
            <button type="button"
              @click="abrirNotificarStock({ id: productoActualId, nombre: form.nombre, stock: form.stock })"
              class="rounded-xl border border-amber-800/60 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-800/60 transition">
              Notificar falta
            </button>
          </div>

          <!-- Imagen del Producto (Subir desde Dispositivo o URL) -->
          <div>
            <label class="block text-xs font-bold text-stone-300 mb-1.5">
              Imagen del Plato o Producto (Subir desde dispositivo)
            </label>

            <!-- Input invisible para archivo del dispositivo -->
            <input ref="inputArchivo" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
              class="hidden" @change="procesarArchivoSeleccionado" />

            <!-- Vista 1: Ya tiene imagen asignada -->
            <div v-if="form.imagen_url"
              class="flex items-center gap-3.5 rounded-2xl border border-stone-800 bg-[#110d0b] p-3">
              <div class="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-stone-700 bg-stone-900">
                <img :src="form.imagen_url" :alt="form.nombre || 'Vista previa'"
                  class="h-full w-full object-cover" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-stone-200 truncate">
                  {{ form.nombre ? form.nombre : 'Imagen del plato' }}
                </p>
                <p class="text-[10px] text-stone-400 mt-0.5">
                  {{ form.imagen_url.startsWith('data:') ? '✓ Archivo local cargado' : '✓ Enlace web configurado' }}
                </p>
                <div class="flex items-center gap-2 mt-2">
                  <button type="button" @click="abrirSelectorArchivo"
                    class="flex items-center gap-1 rounded-lg border border-stone-700 bg-stone-800/80 px-2.5 py-1 text-[11px] font-semibold text-stone-200 hover:bg-stone-700 hover:text-white transition">
                    <UploadCloud :size="12" />
                    <span>Cambiar archivo</span>
                  </button>
                  <button type="button" @click="quitarImagen"
                    class="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-400 hover:bg-rose-950/40 transition">
                    Quitar
                  </button>
                </div>
              </div>
            </div>

            <!-- Vista 2: Sin imagen, zona interactiva de carga -->
            <div v-else class="space-y-2">
              <div @click="abrirSelectorArchivo"
                class="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-800 bg-[#110d0b]/80 p-5 text-center cursor-pointer transition hover:border-[#e58a4e]/60 hover:bg-[#1a1411]">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-800/60 text-[#e58a4e] group-hover:scale-105 transition">
                  <UploadCloud :size="20" />
                </div>
                <p class="mt-2 text-xs font-bold text-stone-200 group-hover:text-[#e58a4e] transition">
                  Subir imagen desde este dispositivo
                </p>
                <p class="text-[11px] text-stone-400 mt-0.5">
                  Hacé clic acá para seleccionar archivo (JPG, PNG, WebP hasta 5MB)
                </p>
              </div>

              <!-- Enlace opcional para escribir URL web -->
              <div class="flex items-center justify-between px-1">
                <button type="button" @click="mostrarInputUrl = !mostrarInputUrl"
                  class="text-[11px] text-stone-400 hover:text-[#e58a4e] transition">
                  {{ mostrarInputUrl ? 'Ocultar ingreso por URL' : '¿O preferís ingresar una URL web?' }}
                </button>
              </div>

              <div v-if="mostrarInputUrl" class="mt-1">
                <input v-model="form.imagen_url" type="url" placeholder="https://ejemplo.com/foto-plato.jpg"
                  class="w-full rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2 text-xs text-white outline-none focus:border-[#e58a4e] transition" />
              </div>
            </div>

            <span v-if="erroresForm.imagen_url" class="text-[11px] font-medium text-rose-400 mt-1 block">
              {{ erroresForm.imagen_url }}
            </span>
          </div>

          <!-- Estado Activo / Inactivo -->
          <label class="flex cursor-pointer items-center gap-2.5 text-xs font-bold text-stone-300 pt-1">
            <input v-model="form.activo" type="checkbox" class="h-4 w-4 accent-[#e58a4e] rounded" />
            <span>Producto disponible en el menú (Activo)</span>
          </label>

          <!-- Botones de Acción del Formulario -->
          <div class="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-800/80">
            <button type="button" @click="formularioAbierto = false"
              class="rounded-xl border border-stone-800 bg-[#110d0b] px-4 py-2.5 text-xs font-semibold text-stone-300 hover:text-white transition">
              Cancelar
            </button>
            <button type="submit"
              class="flex items-center gap-1.5 rounded-xl bg-[#e58a4e] px-5 py-2.5 text-xs font-bold text-[#190d05] transition hover:bg-[#ee975e] active:scale-[0.99]">
              <Check :size="15" />
              <span>{{ modoEdicion ? 'Guardar Cambios' : 'Crear Producto' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal de Confirmación Elegante para Eliminar Registro -->
    <div v-if="modalEliminarAbierto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      @click.self="modalEliminarAbierto = false">
      <div class="w-full max-w-md rounded-3xl border border-rose-900/60 bg-[#17120f] p-6 text-white shadow-2xl">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-900/50 bg-rose-950/30 text-rose-300">
            <Trash2 :size="18" />
          </div>
          <div>
            <h3 class="font-serif text-xl font-bold text-white">¿Eliminar producto?</h3>
            <p class="text-xs text-stone-400">Esta acción no se puede deshacer.</p>
          </div>
        </div>

        <p class="mt-4 text-xs leading-relaxed text-stone-300">
          Estás por eliminar permanentemente
          <strong class="text-white">"{{ productoAEliminar?.nombre }}"</strong>
          del catálogo de tu negocio (<span class="text-[#e58a4e]">{{ authState.organizacion?.nombre }}</span>).
        </p>

        <div class="mt-6 flex items-center justify-end gap-2.5 border-t border-stone-800/80 pt-4">
          <button type="button" @click="modalEliminarAbierto = false"
            class="rounded-xl border border-stone-800 bg-[#110d0b] px-4 py-2.5 text-xs font-semibold text-stone-300 hover:text-white transition">
            Cancelar
          </button>
          <button type="button" @click="ejecutarEliminar"
            class="rounded-xl border border-rose-900/60 bg-rose-900/40 px-4 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-900/60 transition">
            Sí, eliminar registro
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Notificar Falta de Stock al Administrador (Rol Empleado) -->
    <div v-if="modalNotificarStockAbierto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      @click.self="modalNotificarStockAbierto = false">
      <div class="w-full max-w-md rounded-3xl border border-amber-800/60 bg-[#17120f] p-6 text-white shadow-2xl">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-900/50 bg-amber-950/30 text-amber-300">
            <BellRing :size="18" />
          </div>
          <div>
            <h3 class="font-serif text-xl font-bold text-white">Notificar falta de stock</h3>
            <p class="text-xs text-stone-400">Aviso directo al panel del Administrador</p>
          </div>
        </div>

        <p class="mt-4 text-xs leading-relaxed text-stone-300">
          ¿Deseás notificar que se agotó el stock de
          <strong class="text-white">"{{ productoANotificar?.nombre }}"</strong>?
          El administrador verá esta alerta inmediatamente en su panel de control.
        </p>

        <form class="mt-4 space-y-3" @submit.prevent="enviarNotificacionStock">
          <label class="block text-xs font-bold text-stone-300">
            Motivo o comentario (opcional)
            <textarea v-model="motivoNotificacion" rows="2"
              placeholder="Ej: Se terminaron las unidades en heladera durante el turno..."
              class="mt-1.5 w-full resize-none rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-500 transition"></textarea>
          </label>

          <div class="mt-5 flex items-center justify-end gap-2.5 border-t border-stone-800/80 pt-4">
            <button type="button" @click="modalNotificarStockAbierto = false"
              class="rounded-xl border border-stone-800 bg-[#110d0b] px-4 py-2.5 text-xs font-semibold text-stone-300 hover:text-white transition">
              Cancelar
            </button>
            <button type="submit" :disabled="enviandoNotificacion"
              class="flex items-center gap-1.5 rounded-xl border border-amber-800/60 bg-amber-500 hover:bg-amber-400 px-4 py-2.5 text-xs font-bold text-[#190d05] transition disabled:opacity-50">
              <Check :size="14" />
              <span>{{ enviandoNotificacion ? 'Enviando...' : 'Enviar Alerta al Admin' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>
