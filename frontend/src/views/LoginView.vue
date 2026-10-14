<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { LogIn } from 'lucide-vue-next'
import logoIcono from '@/assets/2.png'
import { supabase } from '@/supabase'

const router = useRouter()
const email = ref('')
const password = ref('')
const cargando = ref(false)
const errorMensaje = ref('')

async function iniciarSesion() {
  errorMensaje.value = ''
  cargando.value = true

  const { error } = await supabase.auth.signInWithPassword({
    email: email.value.trim().toLowerCase(),
    password: password.value,
  })

  cargando.value = false

  if (error) {
    errorMensaje.value = 'Correo o contraseña incorrectos.'
    return
  }

  router.push('/productos')
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-[#f6f1e8] px-3 py-8 text-[#17120e]">
    <section class="w-full max-w-md rounded-3xl bg-[#fffaf2] p-5 shadow-2xl sm:p-7" aria-labelledby="login-title">
      <div class="flex items-center gap-3">
        <img :src="logoIcono" alt="TrackMenú" class="h-12 w-12 shrink-0 rounded-xl object-contain" />
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a18262]">Cuenta TrackMenú</p>
          <h1 id="login-title" class="mt-0.5 font-serif text-2xl font-bold">Iniciar sesión</h1>
        </div>
      </div>

      <form class="mt-6 space-y-4" @submit.prevent="iniciarSesion">
        <label class="block text-xs font-bold text-[#806f5d]">
          Correo electrónico
          <input v-model="email" type="email" autocomplete="email" required class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
        </label>
        <label class="block text-xs font-bold text-[#806f5d]">
          Contraseña
          <input v-model="password" type="password" autocomplete="current-password" required class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
        </label>

        <p v-if="errorMensaje" role="alert" class="text-sm text-[#b83d14]">{{ errorMensaje }}</p>

        <button type="submit" :disabled="cargando" class="flex w-full items-center justify-center gap-2 rounded-full bg-[#d65d2a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#b94b1e] disabled:opacity-60">
          <LogIn :size="16" />
          {{ cargando ? 'Ingresando...' : 'Iniciar sesión' }}
        </button>
      </form>

      <div class="mt-4 flex flex-col gap-1 text-center text-sm font-semibold text-[#806f5d]">
        <RouterLink to="/registro" class="py-1 hover:text-[#20160f]">¿No tenés cuenta? · Registrarme</RouterLink>
        <RouterLink to="/inicio" class="py-1 hover:text-[#20160f]">Volver al menú</RouterLink>
      </div>
    </section>
  </main>
</template>
