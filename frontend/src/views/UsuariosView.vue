<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Users, UserPlus, Shield, User, Search, ChevronRight,
  Filter, X, CheckCircle2, AlertCircle, Phone, Mail,
  Calendar, Briefcase
} from 'lucide-vue-next'
import { adminService, authState } from '@/services/api'

const router = useRouter()

const usuarios = ref([])
const cargando = ref(true)
const terminoBusqueda = ref('')
const filtroRol = ref('todos') // 'todos' | 'admin' | 'empleado'
const filtroEstado = ref('todos') // 'todos' | 'activo' | 'inactivo'

async function cargarUsuarios() {
  cargando.value = true
  const res = await adminService.getUsuarios()
  if (res.success && Array.isArray(res.data)) {
    usuarios.value = res.data
  }
  cargando.value = false
}

onMounted(() => {
  cargarUsuarios()
})

// Métricas de resumen
const totalUsuarios = computed(() => usuarios.value.length)
const totalAdmins = computed(() => usuarios.value.filter((u) => u.rol === 'admin').length)
const totalEmpleados = computed(() => usuarios.value.filter((u) => u.rol === 'empleado').length)
const totalActivos = computed(() => usuarios.value.filter((u) => u.estado !== 'inactivo').length)

// Filtrado de la lista
const usuariosFiltrados = computed(() => {
  const q = terminoBusqueda.value.trim().toLowerCase()
  return usuarios.value.filter((u) => {
    if (q) {
      const matchNombre = (u.nombre || '').toLowerCase().includes(q)
      const matchEmail = (u.email || '').toLowerCase().includes(q)
      const matchPuesto = (u.puesto || '').toLowerCase().includes(q)
      const matchTelefono = (u.telefono || '').toLowerCase().includes(q)
      if (!matchNombre && !matchEmail && !matchPuesto && !matchTelefono) return false
    }

    if (filtroRol.value !== 'todos' && u.rol !== filtroRol.value) return false
    if (filtroEstado.value === 'activo' && u.estado === 'inactivo') return false
    if (filtroEstado.value === 'inactivo' && u.estado !== 'inactivo') return false

    return true
  })
})

function seleccionarTarjetaFiltro(tipo) {
  if (tipo === 'todos') {
    filtroRol.value = 'todos'
    filtroEstado.value = 'todos'
    return
  }
  if (tipo === 'admin' || tipo === 'empleado') {
    filtroRol.value = filtroRol.value === tipo ? 'todos' : tipo
    return
  }
  if (tipo === 'activo') {
    filtroEstado.value = filtroEstado.value === 'activo' ? 'todos' : 'activo'
  }
}

function irAPerfil(usuario) {
  const id = usuario.usuario_id || usuario.id
  router.push(`/usuarios/${id}`)
}

function irANuevoUsuario() {
  router.push('/usuarios/nuevo')
}

function obtenerIniciales(nombre) {
  if (!nombre) return 'U'
  const partes = nombre.trim().split(' ').filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return nombre.slice(0, 2).toUpperCase()
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return 'Registro inicial'
  try {
    const d = new Date(fechaStr)
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return 'Reciente'
  }
}
</script>

<template>
  <main class="min-h-dvh overflow-x-clip bg-[#0c0a09] px-4 py-6 sm:px-6 lg:px-8 text-[#f5f2eb]">
    <div class="mx-auto max-w-[1440px] space-y-6">

      <!-- ENCABEZADO Y ACCIONES PRINCIPALES -->
      <section class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#e58a4e]">Equipo y Permisos</p>
          <div class="mt-1 flex items-center gap-2.5 flex-wrap">
            <h1 class="font-girassol text-2xl sm:text-3xl text-white">
              Control de Usuarios
            </h1>
            <span class="rounded-full border border-stone-800 bg-[#17120f] px-2.5 py-0.5 text-[11px] font-medium text-stone-400">
              {{ totalUsuarios }}
            </span>
          </div>
          <p class="hidden sm:block mt-1 text-xs text-stone-400">
            Perfiles, roles y estado de acceso del personal.
          </p>
        </div>

        <div class="w-full sm:w-auto">
          <button
            type="button"
            @click="irANuevoUsuario"
            class="btn-icon-plus flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-[#e58a4e] px-5 py-3 text-xs sm:text-sm font-bold text-[#190d05] hover:bg-[#ed965c]"
          >
            <UserPlus :size="16" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </section>

      <!-- RESUMEN / METRICAS INTERACTIVAS (2x2 en móvil, 4 columnas en desktop) -->
      <section class="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        <!-- Tarjeta 1: Total Usuarios -->
        <button
          type="button"
          @click="seleccionarTarjetaFiltro('todos')"
          :aria-pressed="filtroRol === 'todos' && filtroEstado === 'todos'"
          class="cursor-pointer rounded-2xl border p-3.5 sm:p-4 text-left transition-colors duration-200"
          :class="filtroRol === 'todos' && filtroEstado === 'todos'
            ? 'border-stone-400 bg-stone-800/35'
            : 'border-stone-800/80 bg-[#17120f] hover:border-stone-400/80'"
        >
          <p class="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-stone-300 truncate">Total Usuarios</p>
          <div class="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <span class="text-xl sm:text-3xl font-extrabold text-white tabular-nums">{{ totalUsuarios }}</span>
            <span class="text-[10px] sm:text-xs text-stone-500">en equipo</span>
          </div>
        </button>

        <!-- Tarjeta 2: Administradores -->
        <button
          type="button"
          @click="seleccionarTarjetaFiltro('admin')"
          :aria-pressed="filtroRol === 'admin'"
          class="cursor-pointer rounded-2xl border p-3.5 sm:p-4 text-left transition-colors duration-200"
          :class="filtroRol === 'admin'
            ? 'border-[#e58a4e] bg-[#e58a4e]/[0.08]'
            : 'border-stone-800/80 bg-[#17120f] hover:border-[#e58a4e]/80'"
        >
          <p class="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#e58a4e] truncate">Administradores</p>
          <div class="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <span class="text-xl sm:text-3xl font-extrabold text-[#e58a4e] tabular-nums">{{ totalAdmins }}</span>
            <span class="text-[10px] sm:text-xs text-stone-500">control total</span>
          </div>
        </button>

        <!-- Tarjeta 3: Personal -->
        <button
          type="button"
          @click="seleccionarTarjetaFiltro('empleado')"
          :aria-pressed="filtroRol === 'empleado'"
          class="cursor-pointer rounded-2xl border p-3.5 sm:p-4 text-left transition-colors duration-200"
          :class="filtroRol === 'empleado'
            ? 'border-emerald-500 bg-emerald-950/20'
            : 'border-stone-800/80 bg-[#17120f] hover:border-emerald-500/80'"
        >
          <p class="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-400 truncate">Personal</p>
          <div class="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <span class="text-xl sm:text-3xl font-extrabold text-emerald-400 tabular-nums">{{ totalEmpleados }}</span>
            <span class="text-[10px] sm:text-xs text-stone-500">mesas y carta</span>
          </div>
        </button>

        <!-- Tarjeta 4: Cuentas Activas -->
        <button
          type="button"
          @click="seleccionarTarjetaFiltro('activo')"
          :aria-pressed="filtroEstado === 'activo'"
          class="cursor-pointer rounded-2xl border p-3.5 sm:p-4 text-left transition-colors duration-200"
          :class="filtroEstado === 'activo'
            ? 'border-sky-400 bg-sky-950/20'
            : 'border-stone-800/80 bg-[#17120f] hover:border-sky-400/80'"
        >
          <p class="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-sky-400 truncate">Cuentas Activas</p>
          <div class="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
            <span class="text-xl sm:text-3xl font-extrabold text-sky-400 tabular-nums">{{ totalActivos }}</span>
            <span class="text-[10px] sm:text-xs text-stone-500">habilitadas</span>
          </div>
        </button>
      </section>

      <!-- TABLA PRINCIPAL DE USUARIOS -->
      <section class="space-y-4 rounded-3xl border border-stone-800/80 bg-[#17120f] p-4 sm:p-7 shadow-xl">
        <!-- Buscador y Filtros -->
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="relative w-full lg:flex-1 lg:max-w-md">
            <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              v-model="terminoBusqueda"
              type="text"
              placeholder="Buscar por nombre, correo, puesto o teléfono..."
              class="w-full rounded-2xl border border-stone-800 bg-[#110d0b] py-2.5 pl-10 pr-4 text-xs sm:text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
            />
            <button
              v-if="terminoBusqueda"
              type="button"
              @click="terminoBusqueda = ''"
              class="btn-inline-clear absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
              aria-label="Limpiar búsqueda"
            >
              <X :size="14" />
            </button>
          </div>

          <!-- Filtros de Rol y Estado -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto text-xs">
            <div class="grid grid-cols-3 lg:flex w-full lg:w-auto items-center gap-1 bg-[#110d0b] p-1 rounded-2xl border border-stone-800">
              <button
                type="button"
                @click="filtroRol = 'todos'"
                class="btn-filter whitespace-nowrap rounded-xl px-2.5 sm:px-3 py-1.5 text-center text-xs font-bold transition"
                :class="filtroRol === 'todos' ? 'bg-[#e58a4e] text-[#190d05]' : 'text-stone-400 hover:text-white'"
              >
                Todos
              </button>
              <button
                type="button"
                @click="filtroRol = 'admin'"
                class="btn-filter whitespace-nowrap rounded-xl px-2.5 sm:px-3 py-1.5 text-center text-xs font-bold transition"
                :class="filtroRol === 'admin' ? 'bg-[#e58a4e] text-[#190d05]' : 'text-stone-400 hover:text-white'"
              >
                Admins
              </button>
              <button
                type="button"
                @click="filtroRol = 'empleado'"
                class="btn-filter whitespace-nowrap rounded-xl px-2.5 sm:px-3 py-1.5 text-center text-xs font-bold transition"
                :class="filtroRol === 'empleado' ? 'bg-emerald-600 text-white' : 'text-stone-400 hover:text-white'"
              >
                Personal
              </button>
            </div>

            <div class="grid grid-cols-3 lg:flex w-full lg:w-auto items-center gap-1 bg-[#110d0b] p-1 rounded-2xl border border-stone-800">
              <button
                type="button"
                @click="filtroEstado = 'todos'"
                class="btn-filter whitespace-nowrap rounded-xl px-2.5 sm:px-3 py-1.5 text-center text-xs font-bold transition"
                :class="filtroEstado === 'todos' ? 'bg-[#e58a4e] text-[#190d05]' : 'text-stone-400 hover:text-white'"
              >
                Todos
              </button>
              <button
                type="button"
                @click="filtroEstado = 'activo'"
                class="btn-filter whitespace-nowrap rounded-xl px-2.5 sm:px-3 py-1.5 text-center text-xs font-bold transition"
                :class="filtroEstado === 'activo' ? 'bg-sky-500 text-[#08131a]' : 'text-stone-400 hover:text-white'"
              >
                Activos
              </button>
              <button
                type="button"
                @click="filtroEstado = 'inactivo'"
                class="btn-filter whitespace-nowrap rounded-xl px-2.5 sm:px-3 py-1.5 text-center text-xs font-bold transition"
                :class="filtroEstado === 'inactivo' ? 'bg-stone-700 text-white' : 'text-stone-400 hover:text-white'"
              >
                Inactivos
              </button>
            </div>
          </div>
        </div>

        <!-- TARJETAS MÓVILES DE USUARIOS (< md) -->
        <div class="divide-y divide-stone-800/60 rounded-2xl border border-stone-800/80 bg-[#110d0b] md:hidden">
          <div v-if="!usuariosFiltrados.length" class="py-10 px-4 text-center text-xs text-stone-500">
            No se encontraron usuarios que coincidan con los filtros de búsqueda.
          </div>

          <article
            v-for="u in usuariosFiltrados"
            :key="`card-${u.usuario_id || u.id}`"
            @click="irAPerfil(u)"
            class="p-4 space-y-3 cursor-pointer transition hover:bg-[#1a1410]"
          >
            <div class="flex items-start gap-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-bold"
                :class="u.rol === 'admin'
                  ? 'bg-gradient-to-br from-[#e58a4e] to-[#c76c33] text-[#190d05] shadow'
                  : 'bg-stone-800 text-stone-200 border border-stone-700'"
              >
                {{ obtenerIniciales(u.nombre) }}
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-bold text-white text-sm leading-snug">{{ u.nombre }}</h3>
                  <span
                    v-if="(u.usuario_id || u.id) === authState.user?.id"
                    class="rounded-full border border-[#e58a4e]/50 bg-[#e58a4e]/10 px-2 py-0.5 text-[9px] font-bold text-[#e58a4e]"
                  >
                    Tu Cuenta
                  </span>
                </div>
                <p class="truncate text-xs text-stone-400 mt-0.5">{{ u.email }}</p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                :class="u.rol === 'admin'
                  ? 'border border-[#e58a4e]/40 bg-[#e58a4e]/10 text-[#e58a4e]'
                  : 'border border-blue-500/30 bg-blue-950/30 text-blue-300'"
              >
                <Shield v-if="u.rol === 'admin'" :size="11" />
                <User v-else :size="11" />
                {{ u.rol === 'admin' ? 'Administrador' : 'Personal' }}
              </span>

              <span
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                :class="u.estado === 'inactivo'
                  ? 'border border-stone-700 bg-stone-900 text-stone-400'
                  : 'border border-emerald-500/30 bg-emerald-950/30 text-emerald-300'"
              >
                <span
                  class="h-1.5 w-1.5 rounded-full"
                  :class="u.estado === 'inactivo' ? 'bg-stone-500' : 'bg-emerald-400'"
                />
                {{ u.estado === 'inactivo' ? 'Inactivo' : 'Activo' }}
              </span>

              <span class="text-[11px] text-stone-400">
                {{ u.puesto || (u.rol === 'admin' ? 'Administrador' : 'Empleado de salón') }}
              </span>
            </div>

            <div class="flex items-center justify-between gap-2 pt-0.5">
              <span class="text-[11px] text-stone-500">
                Alta: {{ formatearFecha(u.creado_en) }}
              </span>
              <button
                type="button"
                @click.stop="irAPerfil(u)"
                class="btn-icon-shift inline-flex items-center gap-1.5 rounded-xl border border-stone-800 bg-[#17120f] px-3 py-1.5 text-xs font-semibold text-stone-200 hover:border-[#e58a4e]/50 hover:text-[#e58a4e]"
              >
                <span>Administrar</span>
                <ChevronRight :size="14" />
              </button>
            </div>
          </article>
        </div>

        <!-- TABLA DE USUARIOS COMPLETA (md+) -->
        <div class="hidden md:block overflow-x-auto rounded-2xl border border-stone-800/80 bg-[#110d0b]">
          <table class="w-full text-left text-xs sm:text-sm">
            <thead class="border-b border-stone-800 bg-[#17120f] text-[11px] font-bold uppercase tracking-wider text-stone-400">
              <tr>
                <th scope="col" class="py-4 pl-5 pr-3">Integrante</th>
                <th scope="col" class="px-4 py-4">Rol & Permisos</th>
                <th scope="col" class="px-4 py-4">Puesto / Cargo</th>
                <th scope="col" class="px-4 py-4">Estado</th>
                <th scope="col" class="px-4 py-4 hidden md:table-cell">Contacto</th>
                <th scope="col" class="px-4 py-4 hidden lg:table-cell">Fecha de Alta</th>
                <th scope="col" class="py-4 pl-3 pr-5 text-right">Administración</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-800/60">
              <tr
                v-for="u in usuariosFiltrados"
                :key="u.usuario_id || u.id"
                @click="irAPerfil(u)"
                class="group cursor-pointer transition hover:bg-[#1a1410]"
              >
                <!-- Integrante (Avatar, Nombre, Email) -->
                <td class="py-4 pl-5 pr-3">
                  <div class="flex items-center gap-3.5">
                    <div
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-bold transition-transform group-hover:scale-105"
                      :class="u.rol === 'admin'
                        ? 'bg-gradient-to-br from-[#e58a4e] to-[#c76c33] text-[#190d05] shadow'
                        : 'bg-stone-800 text-stone-200 border border-stone-700'"
                    >
                      {{ obtenerIniciales(u.nombre) }}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-white text-sm group-hover:text-[#e58a4e] transition">{{ u.nombre }}</span>
                        <span
                          v-if="(u.usuario_id || u.id) === authState.user?.id"
                          class="rounded-full border border-[#e58a4e]/50 bg-[#e58a4e]/10 px-2 py-0.5 text-[9px] font-bold text-[#e58a4e]"
                        >
                          Tu Cuenta
                        </span>
                      </div>
                      <p class="truncate text-xs text-stone-400 mt-0.5">{{ u.email }}</p>
                    </div>
                  </div>
                </td>

                <!-- Rol -->
                <td class="px-4 py-4">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
                    :class="u.rol === 'admin'
                      ? 'border border-[#e58a4e]/40 bg-[#e58a4e]/10 text-[#e58a4e]'
                      : 'border border-blue-500/30 bg-blue-950/30 text-blue-300'"
                  >
                    <Shield v-if="u.rol === 'admin'" :size="12" />
                    <User v-else :size="12" />
                    {{ u.rol === 'admin' ? 'Administrador' : 'Personal' }}
                  </span>
                </td>

                <!-- Puesto / Cargo -->
                <td class="px-4 py-4">
                  <span class="text-xs font-medium text-stone-200">
                    {{ u.puesto || (u.rol === 'admin' ? 'Administrador' : 'Empleado de salón') }}
                  </span>
                </td>

                <!-- Estado -->
                <td class="px-4 py-4">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    :class="u.estado === 'inactivo'
                      ? 'border border-stone-700 bg-stone-900 text-stone-400'
                      : 'border border-emerald-500/30 bg-emerald-950/30 text-emerald-300'"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      :class="u.estado === 'inactivo' ? 'bg-stone-500' : 'bg-emerald-400'"
                    />
                    {{ u.estado === 'inactivo' ? 'Inactivo' : 'Activo' }}
                  </span>
                </td>

                <!-- Contacto -->
                <td class="px-4 py-4 hidden md:table-cell text-xs text-stone-300">
                  {{ u.telefono || '—' }}
                </td>

                <!-- Fecha de Alta -->
                <td class="px-4 py-4 hidden lg:table-cell text-xs text-stone-400">
                  {{ formatearFecha(u.creado_en) }}
                </td>

                <!-- Botón de Acción -->
                <td class="py-4 pl-3 pr-5 text-right">
                  <button
                    type="button"
                    @click.stop="irAPerfil(u)"
                    class="btn-icon-shift inline-flex items-center gap-1.5 rounded-xl border border-stone-800 bg-[#17120f] px-3.5 py-2 text-xs font-semibold text-stone-300 hover:border-[#e58a4e]/50 hover:bg-[#e58a4e]/10 hover:text-[#e58a4e] group-hover:border-[#e58a4e]/50 group-hover:bg-[#e58a4e]/10 group-hover:text-[#e58a4e]"
                  >
                    <span>Administrar Perfil</span>
                    <ChevronRight :size="14" />
                  </button>
                </td>
              </tr>

              <tr v-if="!usuariosFiltrados.length">
                <td colspan="7" class="py-12 text-center text-xs text-stone-500">
                  No se encontraron usuarios que coincidan con los filtros de búsqueda.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>
  </main>
</template>
