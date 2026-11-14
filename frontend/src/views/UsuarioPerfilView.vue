<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, Shield, User, Mail, Phone, Briefcase, Key,
  FileText, Check, Trash2, AlertCircle, CheckCircle2,
  Calendar, Eye, EyeOff, Sparkles, Building2, Lock, Unlock
} from 'lucide-vue-next'
import { adminService, authState } from '@/services/api'

const route = useRoute()
const router = useRouter()

const modo = computed(() => route.meta.modo || (route.params.id ? 'editar' : 'nuevo'))
const usuarioId = computed(() => route.params.id)

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
  email: '',
  rol: 'empleado',
  puesto: '',
  telefono: '',
  estado: 'activo',
  notas: '',
  password: '',
  creado_en: null,
})

const esMiPropiaCuenta = computed(() => {
  return form.value.id && authState.user && form.value.id === authState.user.id
})

async function cargarDatos() {
  if (modo.value === 'nuevo') {
    form.value = {
      id: '',
      nombre: '',
      email: '',
      rol: 'empleado',
      puesto: '',
      telefono: '',
      estado: 'activo',
      notas: '',
      password: '',
      creado_en: null,
    }
    cargando.value = false
    return
  }

  cargando.value = true
  const res = await adminService.getUsuarioById(usuarioId.value)
  if (res.success && res.data) {
    const u = res.data
    form.value = {
      id: u.usuario_id || u.id,
      nombre: u.nombre || '',
      email: u.email || '',
      rol: u.rol || 'empleado',
      puesto: u.puesto || (u.rol === 'admin' ? 'Administrador' : 'Personal'),
      telefono: u.telefono || '',
      estado: u.estado || 'activo',
      notas: u.notas || '',
      password: '',
      creado_en: u.creado_en || null,
    }
  } else {
    notificar(res.message || 'No se encontró el usuario.', 'error')
    setTimeout(() => {
      router.push('/usuarios')
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

async function guardarPerfil() {
  errorFormulario.value = ''
  const f = form.value

  if (!f.nombre.trim()) {
    errorFormulario.value = 'El nombre completo es obligatorio.'
    return
  }

  if (!f.email.trim() || !f.email.includes('@')) {
    errorFormulario.value = 'Ingresá un correo electrónico válido.'
    return
  }

  if (modo.value === 'nuevo') {
    if (!f.password || f.password.length < 8) {
      errorFormulario.value = 'La contraseña inicial debe tener al menos 8 caracteres.'
      return
    }

    guardando.value = true
    const res = await adminService.crearUsuario({
      nombre: f.nombre,
      email: f.email,
      password: f.password,
      rol: f.rol,
      telefono: f.telefono,
      puesto: f.puesto,
      estado: f.estado,
      notas: f.notas,
    })
    guardando.value = false

    if (!res.success) {
      errorFormulario.value = res.message || 'Error al dar de alta el usuario.'
      return
    }

    notificar('Usuario dado de alta exitosamente.', 'exito')
    setTimeout(() => {
      router.push('/usuarios')
    }, 1200)
  } else {
    if (f.password && f.password.length < 8) {
      errorFormulario.value = 'Si cambiás la contraseña, debe contener al menos 8 caracteres.'
      return
    }

    guardando.value = true
    const res = await adminService.actualizarUsuario({
      id: f.id,
      nombre: f.nombre,
      email: f.email,
      rol: f.rol,
      telefono: f.telefono,
      puesto: f.puesto,
      estado: f.estado,
      notas: f.notas,
      password: f.password || undefined,
    })
    guardando.value = false

    if (!res.success) {
      errorFormulario.value = res.message || 'Error al actualizar el perfil.'
      return
    }

    notificar('Perfil actualizado correctamente.', 'exito')
    form.value.password = ''
  }
}

async function ejecutarBajaUsuario() {
  if (!form.value.id) return

  eliminando.value = true
  const res = await adminService.eliminarUsuario(form.value.id)
  eliminando.value = false

  if (!res.success) {
    errorFormulario.value = res.message || 'No se pudo eliminar el usuario.'
    return
  }

  notificar('Usuario eliminado de la organización.', 'exito')
  setTimeout(() => {
    router.push('/usuarios')
  }, 1000)
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
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return 'Reciente'
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
            to="/usuarios"
            class="inline-flex items-center gap-2 rounded-xl border border-stone-800 bg-[#17120f] px-3.5 py-2 text-xs font-semibold text-stone-300 transition hover:bg-[#221a15] hover:text-[#e58a4e] hover:border-[#e58a4e]/40"
          >
            <ArrowLeft :size="15" />
            <span>Volver a la tabla de usuarios</span>
          </RouterLink>

          <div class="hidden md:flex items-center gap-2 text-xs text-stone-500">
            <span>·</span>
            <span class="text-stone-400">
              {{ modo === 'nuevo' ? 'Alta de Nuevo Integrante' : (form.nombre || 'Administración de Perfil') }}
            </span>
          </div>
        </div>

        <!-- Botones de Acción Rápidos en el Header -->
        <div class="flex items-center gap-2.5 w-full sm:w-auto">
          <RouterLink
            to="/usuarios"
            class="flex-1 sm:flex-initial text-center rounded-xl border border-stone-800 bg-[#110d0b] px-3.5 py-2 text-xs font-semibold text-stone-400 hover:text-white transition"
          >
            Cancelar
          </RouterLink>

          <button
            type="button"
            :disabled="guardando"
            @click="guardarPerfil"
            class="flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl bg-[#e58a4e] px-4 py-2 text-xs font-bold text-[#190d05] transition hover:bg-[#ee975e] active:scale-[0.98] disabled:opacity-50"
          >
            <Check :size="14" />
            <span>{{ guardando ? 'Guardando...' : (modo === 'nuevo' ? 'Crear Usuario' : 'Guardar') }}</span>
          </button>
        </div>
      </nav>

      <!-- SPINNER SI ESTÁ CARGANDO -->
      <div v-if="cargando" class="flex flex-col items-center justify-center py-20 text-stone-400 space-y-3">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-[#e58a4e] border-t-transparent"></div>
        <p class="text-xs font-semibold">Cargando información del perfil...</p>
      </div>

      <div v-else class="space-y-6">
        <!-- HEADER VISUAL DEL PERFIL -->
        <section class="rounded-3xl border border-stone-800/80 bg-gradient-to-br from-[#17120f] to-[#120d0b] p-4 sm:p-8 shadow-xl">
          <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-3.5 sm:gap-5 min-w-0">
              <div
                class="flex h-14 w-14 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl sm:rounded-3xl text-lg sm:text-2xl font-bold shadow-lg"
                :class="form.rol === 'admin'
                  ? 'bg-gradient-to-br from-[#e58a4e] to-[#c76c33] text-[#190d05]'
                  : 'bg-gradient-to-br from-stone-800 to-stone-900 text-stone-200 border border-stone-700'"
              >
                {{ obtenerIniciales(form.nombre) }}
              </div>

              <div class="space-y-1.5 min-w-0">
                <div class="flex items-center gap-2.5 flex-wrap">
                  <h1 class="font-girassol text-2xl sm:text-4xl font-normal text-white break-words">
                    {{ modo === 'nuevo' ? 'Nuevo Integrante del Local' : (form.nombre || 'Perfil de Usuario') }}
                  </h1>
                  <span
                    v-if="esMiPropiaCuenta"
                    class="rounded-full border border-[#e58a4e]/50 bg-[#e58a4e]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#e58a4e]"
                  >
                    Tu Cuenta
                  </span>
                </div>

                <div class="flex items-center gap-2 sm:gap-3 flex-wrap text-xs text-stone-400">
                  <span class="text-stone-300 font-medium break-all sm:break-normal">{{ form.email || 'correo@pendiente.com' }}</span>
                  <span>·</span>
                  <span class="text-stone-400">{{ form.puesto || (form.rol === 'admin' ? 'Administrador' : 'Personal') }}</span>
                  <template v-if="form.creado_en">
                    <span>·</span>
                    <span class="flex items-center gap-1 text-stone-500">
                      <Calendar :size="12" /> Miembro desde: {{ formatearFecha(form.creado_en) }}
                    </span>
                  </template>
                </div>
              </div>
            </div>

            <!-- BADGES DE ESTADO Y ROL -->
            <div class="flex flex-wrap sm:flex-col items-start sm:items-end gap-2 shrink-0">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
                :class="form.rol === 'admin'
                  ? 'border border-[#e58a4e]/50 bg-[#e58a4e]/10 text-[#e58a4e]'
                  : 'border border-blue-500/40 bg-blue-950/40 text-blue-300'"
              >
                <Shield v-if="form.rol === 'admin'" :size="13" />
                <User v-else :size="13" />
                Rol: {{ form.rol === 'admin' ? 'Administrador' : 'Personal' }}
              </span>

              <span
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                :class="form.estado === 'inactivo'
                  ? 'border border-stone-700 bg-stone-900 text-stone-400'
                  : 'border border-emerald-500/40 bg-emerald-950/40 text-emerald-300'"
              >
                <span
                  class="h-2 w-2 rounded-full"
                  :class="form.estado === 'inactivo' ? 'bg-stone-500' : 'bg-emerald-400'"
                />
                {{ form.estado === 'inactivo' ? 'Cuenta Inactiva / Suspendida' : 'Cuenta Habilitada' }}
              </span>
            </div>
          </div>
        </section>

        <!-- ALERTA DE ERROR SI FALLA VALIDACIÓN -->
        <div
          v-if="errorFormulario"
          class="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs sm:text-sm text-rose-300 shadow-md"
        >
          <AlertCircle :size="18" class="shrink-0 mt-0.5" />
          <span>{{ errorFormulario }}</span>
        </div>

        <!-- FORMULARIO DE ADMINISTRACIÓN COMPLETO -->
        <form @submit.prevent="guardarPerfil" class="space-y-6">

          <!-- BLOQUE 1: DATOS PERSONALES Y CONTACTO -->
          <section class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-6 sm:p-7 space-y-4">
            <div class="border-b border-stone-800/70 pb-3">
              <h2 class="text-sm font-bold uppercase tracking-wider text-[#e58a4e] flex items-center gap-2">
                <User :size="16" /> Datos Personales y de Contacto
              </h2>
              <p class="text-xs text-stone-400 mt-1">Identificación del usuario dentro del negocio y canales de comunicación directa.</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-stone-300">Nombre Completo *</label>
                <input
                  v-model="form.nombre"
                  type="text"
                  required
                  placeholder="Ej: Lucía Martínez"
                  class="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#110d0b] px-4 py-3 text-xs sm:text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-stone-300">Correo Electrónico (Acceso al sistema) *</label>
                <input
                  v-model="form.email"
                  type="email"
                  required
                  placeholder="lucia@mirestaurante.com"
                  class="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#110d0b] px-4 py-3 text-xs sm:text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-stone-300">Puesto o Cargo en el Local</label>
                <input
                  v-model="form.puesto"
                  type="text"
                  placeholder="Ej: Cajera / Moza Salón, Encargado de Barra, Jefe de Cocina"
                  class="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#110d0b] px-4 py-3 text-xs sm:text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-stone-300">Teléfono / WhatsApp</label>
                <input
                  v-model="form.telefono"
                  type="text"
                  placeholder="Ej: +54 11 5566-7788"
                  class="mt-1.5 w-full rounded-2xl border border-stone-800 bg-[#110d0b] px-4 py-3 text-xs sm:text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
                />
              </div>
            </div>
          </section>

          <!-- BLOQUE 2: PERMISOS Y ROL EN EL SISTEMA -->
          <section class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-6 sm:p-7 space-y-4">
            <div class="border-b border-stone-800/70 pb-3">
              <h2 class="text-sm font-bold uppercase tracking-wider text-[#e58a4e] flex items-center gap-2">
                <Shield :size="16" /> Permisos y Rol del Sistema
              </h2>
              <p class="text-xs text-stone-400 mt-1">Define qué puede ver y modificar este integrante en la plataforma.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- ROL EMPLEADO -->
              <label
                class="flex flex-col justify-between gap-3 rounded-2xl border p-5 cursor-pointer transition"
                :class="form.rol === 'empleado'
                  ? 'border-emerald-500/60 bg-emerald-950/20 text-white shadow-lg'
                  : 'border-stone-800 bg-[#110d0b] text-stone-400 hover:border-stone-700'"
              >
                <div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <User :size="18" class="text-emerald-400" />
                      <span class="font-bold text-sm text-white">Personal / Empleado</span>
                    </div>
                    <input
                      type="radio"
                      name="rol"
                      value="empleado"
                      v-model="form.rol"
                      :disabled="esMiPropiaCuenta"
                      class="text-emerald-500 focus:ring-0"
                    />
                  </div>
                  <p class="mt-3 text-xs leading-relaxed text-stone-300">
                    Diseñado para mozos, cajeros y personal de salón.
                  </p>
                  <ul class="mt-3 space-y-1.5 text-[11px] text-stone-400">
                    <li class="flex items-center gap-1.5 text-emerald-300">
                      <Check :size="13" /> Control de mesas y cobro de pedidos
                    </li>
                    <li class="flex items-center gap-1.5 text-emerald-300">
                      <Check :size="13" /> Visualización y edición permitida de platos
                    </li>
                    <li class="flex items-center gap-1.5 text-emerald-300">
                      <Check :size="13" /> Botón para alertar falta de stock al dueño
                    </li>
                    <li class="flex items-center gap-1.5 text-stone-500">
                      <Lock :size="13" /> Sin acceso a facturación, caja ni borrado de productos
                    </li>
                  </ul>
                </div>
              </label>

              <!-- ROL ADMIN -->
              <label
                class="flex flex-col justify-between gap-3 rounded-2xl border p-5 cursor-pointer transition"
                :class="form.rol === 'admin'
                  ? 'border-[#e58a4e]/70 bg-[#e58a4e]/10 text-white shadow-lg'
                  : 'border-stone-800 bg-[#110d0b] text-stone-400 hover:border-stone-700'"
              >
                <div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <Shield :size="18" class="text-[#e58a4e]" />
                      <span class="font-bold text-sm text-white">Administrador (Control Total)</span>
                    </div>
                    <input
                      type="radio"
                      name="rol"
                      value="admin"
                      v-model="form.rol"
                      :disabled="esMiPropiaCuenta"
                      class="text-[#e58a4e] focus:ring-0"
                    />
                  </div>
                  <p class="mt-3 text-xs leading-relaxed text-stone-300">
                    Para dueños y encargados generales del local.
                  </p>
                  <ul class="mt-3 space-y-1.5 text-[11px] text-stone-400">
                    <li class="flex items-center gap-1.5 text-[#e58a4e]">
                      <Check :size="13" /> ABM completo: alta, precios, stock y eliminación
                    </li>
                    <li class="flex items-center gap-1.5 text-[#e58a4e]">
                      <Check :size="13" /> Panel de Ventas, KPIs y anulación de tickets
                    </li>
                    <li class="flex items-center gap-1.5 text-[#e58a4e]">
                      <Check :size="13" /> Gestión de usuarios, roles y seguridad
                    </li>
                    <li class="flex items-center gap-1.5 text-[#e58a4e]">
                      <Check :size="13" /> Historial de auditoría y movimientos de mercadería
                    </li>
                  </ul>
                </div>
              </label>
            </div>

            <p v-if="esMiPropiaCuenta" class="text-[11px] text-amber-400/90 pt-1">
              * Estás editando tu propia cuenta. Por seguridad del sistema, no podés revocar tus propios permisos de administrador.
            </p>
          </section>

          <!-- BLOQUE 3: ESTADO Y SEGURIDAD DE LA CUENTA -->
          <section class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-6 sm:p-7 space-y-4">
            <div class="border-b border-stone-800/70 pb-3">
              <h2 class="text-sm font-bold uppercase tracking-wider text-[#e58a4e] flex items-center gap-2">
                <Key :size="16" /> Seguridad y Credenciales de Acceso
              </h2>
              <p class="text-xs text-stone-400 mt-1">Configuración de contraseña de inicio de sesión y estado operativo de la cuenta.</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <!-- Estado operativo -->
              <div>
                <label class="block text-xs font-semibold text-stone-300">Estado de la Cuenta</label>
                <div class="mt-2 space-y-2">
                  <label class="flex items-center gap-3 rounded-xl border border-stone-800 bg-[#110d0b] p-3 cursor-pointer transition hover:border-stone-700">
                    <input
                      type="radio"
                      name="estado"
                      value="activo"
                      v-model="form.estado"
                      class="text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span class="block text-xs font-bold text-emerald-300">Cuenta Activa</span>
                      <span class="block text-[11px] text-stone-400">El usuario puede ingresar y operar con normalidad.</span>
                    </div>
                  </label>

                  <label class="flex items-center gap-3 rounded-xl border border-stone-800 bg-[#110d0b] p-3 cursor-pointer transition hover:border-stone-700">
                    <input
                      type="radio"
                      name="estado"
                      value="inactivo"
                      v-model="form.estado"
                      :disabled="esMiPropiaCuenta"
                      class="text-stone-500 focus:ring-0"
                    />
                    <div>
                      <span class="block text-xs font-bold text-stone-300">Inactiva / Suspendida</span>
                      <span class="block text-[11px] text-stone-400">Bloquea temporalmente el inicio de sesión.</span>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Contraseña -->
              <div>
                <label class="block text-xs font-semibold text-stone-300">
                  {{ modo === 'nuevo' ? 'Contraseña Inicial *' : 'Cambiar Contraseña (Opcional)' }}
                </label>
                <div class="relative mt-2">
                  <input
                    v-model="form.password"
                    :type="mostrarPassword ? 'text' : 'password'"
                    :required="modo === 'nuevo'"
                    :placeholder="modo === 'nuevo' ? 'Mínimo 8 caracteres' : 'Dejar vacío para conservar la contraseña actual'"
                    class="w-full rounded-2xl border border-stone-800 bg-[#110d0b] px-4 py-3 pr-11 text-xs sm:text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
                  />
                  <button
                    type="button"
                    @click="mostrarPassword = !mostrarPassword"
                    class="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                  >
                    <component :is="mostrarPassword ? EyeOff : Eye" :size="16" />
                  </button>
                </div>
                <p class="mt-1.5 text-[11px] text-stone-500">
                  {{ modo === 'nuevo' ? 'El integrante usará esta clave para ingresar desde /login.' : 'Completá este campo únicamente si deseás asignar una nueva contraseña.' }}
                </p>
              </div>
            </div>
          </section>

          <!-- BLOQUE 4: NOTAS INTERNAS Y METADATOS -->
          <section class="rounded-3xl border border-stone-800/80 bg-[#17120f] p-6 sm:p-7 space-y-4">
            <div class="border-b border-stone-800/70 pb-3">
              <h2 class="text-sm font-bold uppercase tracking-wider text-[#e58a4e] flex items-center gap-2">
                <FileText :size="16" /> Observaciones y Notas Internas
              </h2>
              <p class="text-xs text-stone-400 mt-1">Notas visibles solo para administradores (turnos, asignaciones de mesas o recordatorios).</p>
            </div>

            <div>
              <textarea
                v-model="form.notas"
                rows="3"
                placeholder="Ej: Turnos fijos noche de jueves a domingos. Responsable de cierre de caja en sector terraza."
                class="w-full rounded-2xl border border-stone-800 bg-[#110d0b] p-4 text-xs sm:text-sm text-white placeholder-stone-500 outline-none transition focus:border-[#e58a4e]"
              />
            </div>

            <div v-if="form.id" class="pt-2 text-[11px] text-stone-500 flex flex-wrap gap-3 sm:gap-4">
              <span class="break-all">ID Interno: <code class="text-stone-400">{{ form.id }}</code></span>
              <span>Organización: <strong class="text-stone-400">{{ authState.organizacion?.nombre }}</strong></span>
            </div>
          </section>

          <!-- BLOQUE 5: ZONA DE PELIGRO / ELIMINAR (Solo en edición y si no es su propia cuenta) -->
          <section
            v-if="modo === 'editar' && !esMiPropiaCuenta"
            class="rounded-3xl border border-rose-900/40 bg-rose-950/15 p-5 sm:p-7 space-y-4"
          >
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 class="text-sm font-bold text-rose-300 flex items-center gap-2">
                  <Trash2 :size="16" /> Dar de baja integrante del local
                </h3>
                <p class="text-xs text-rose-300/80 mt-1">
                  Revoca el acceso de este usuario de forma permanente y lo elimina de la organización.
                </p>
              </div>

              <div v-if="!confirmarEliminar" class="w-full sm:w-auto">
                <button
                  type="button"
                  @click="confirmarEliminar = true"
                  class="w-full sm:w-auto rounded-2xl border border-rose-800 bg-rose-950/40 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-900/40 transition"
                >
                  Eliminar usuario
                </button>
              </div>
              <div v-else class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  :disabled="eliminando"
                  @click="ejecutarBajaUsuario"
                  class="flex-1 sm:flex-initial rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500 transition disabled:opacity-50"
                >
                  {{ eliminando ? 'Eliminando...' : 'Confirmar baja definitiva' }}
                </button>
                <button
                  type="button"
                  @click="confirmarEliminar = false"
                  class="flex-1 sm:flex-initial rounded-2xl border border-stone-800 bg-[#17120f] px-4 py-2.5 text-xs font-semibold text-stone-300 hover:text-white transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </section>

          <!-- ACCIONES AL PIE (En flujo natural, sin barra flotante sobre los campos) -->
          <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-4 pb-6 border-t border-stone-800/80">
            <RouterLink
              to="/usuarios"
              class="w-full sm:w-auto text-center rounded-xl border border-stone-800 bg-[#110d0b] px-4 py-2.5 text-xs font-semibold text-stone-300 hover:text-white transition"
            >
              Cancelar y volver
            </RouterLink>

            <button
              type="submit"
              :disabled="guardando"
              class="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#e58a4e] px-5 py-2.5 text-xs font-bold text-[#190d05] shadow transition hover:bg-[#ee975e] active:scale-[0.98] disabled:opacity-50"
            >
              <Check :size="15" />
              <span>{{ guardando ? 'Guardando...' : (modo === 'nuevo' ? 'Dar de Alta Usuario' : 'Guardar Cambios') }}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  </main>
</template>

