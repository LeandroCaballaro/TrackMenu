<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { UserRound } from 'lucide-vue-next'
import logoIcono from '@/assets/2.png'
import { supabase } from '@/supabase'

const router = useRouter()
const nombre = ref('')
const email = ref('')
const password = ref('')
const cargando = ref(false)
const mensaje = ref('')
const errorMensaje = ref('')

async function registrarse() {
  errorMensaje.value = ''
  mensaje.value = ''

  if (password.value.length < 8) {
    errorMensaje.value = 'La contraseña debe tener al menos 8 caracteres.'
    return
  }

  cargando.value = true

  const { data, error } = await supabase.auth.signUp({
    email: email.value.trim().toLowerCase(),
    password: password.value,
    options: { data: { nombre: nombre.value.trim() } },
  })

  cargando.value = false

  if (error) {
    errorMensaje.value = error.message
    return
  }

  if (!data.session) {
    mensaje.value = 'Revisá tu correo para confirmar la cuenta y después iniciá sesión.'
    return
  }

  router.push('/productos')
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-3 py-8 text-[#17120e]">
    <section class="w-full max-w-md rounded-3xl bg-[#fffaf2] p-5 shadow-2xl sm:p-7" aria-labelledby="registro-title">
      <div class="flex items-center gap-3">
        <img :src="logoIcono" alt="TrackMenú" class="h-12 w-12 shrink-0 rounded-xl object-contain" />
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a18262]">Cuenta TrackMenú</p>
          <h1 id="registro-title" class="mt-0.5 font-serif text-2xl font-bold">Crear cuenta</h1>
        </div>
      </div>

      <form class="mt-6 space-y-4" @submit.prevent="registrarse">
        <label class="block text-xs font-bold text-[#806f5d]">
          Nombre
          <input v-model="nombre" type="text" autocomplete="name" required class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
        </label>
        <label class="block text-xs font-bold text-[#806f5d]">
          Correo electrónico
          <input v-model="email" type="email" autocomplete="email" required class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
        </label>
        <label class="block text-xs font-bold text-[#806f5d]">
          Contraseña
          <input v-model="password" type="password" autocomplete="new-password" minlength="8" required class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
        </label>

        <p v-if="errorMensaje" role="alert" class="text-sm text-[#b83d14]">{{ errorMensaje }}</p>
        <p v-if="mensaje" class="text-sm text-[#2f6f4f]">{{ mensaje }}</p>

        <button type="submit" :disabled="cargando" class="flex w-full items-center justify-center gap-2 rounded-full bg-[#d65d2a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#b94b1e] disabled:opacity-60">
          <UserRound :size="16" />
          {{ cargando ? 'Creando...' : 'Crear cuenta' }}
        </button>
      </form>

      <div class="mt-4 flex flex-col gap-1 text-center text-sm font-semibold text-[#806f5d]">
        <RouterLink to="/login" class="py-1 hover:text-[#20160f]">Ya tengo una cuenta · Iniciar sesión</RouterLink>
        <RouterLink to="/inicio" class="py-1 hover:text-[#20160f]">Volver al menú</RouterLink>
      </div>
    </section>
  </main>
</template>
