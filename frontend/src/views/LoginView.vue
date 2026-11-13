<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { LogIn } from 'lucide-vue-next'
import logoIcono from '@/assets/3.png'
import { authService } from '@/services/api'

const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const cargando = ref(false)
const errorMensaje = ref('')

async function iniciarSesion() {
  errorMensaje.value = ''
  cargando.value = true

  const res = await authService.login({
    email: email.value,
    password: password.value,
  })

  cargando.value = false

  if (!res.success) {
    errorMensaje.value = res.message || 'Correo o contraseña incorrectos.'
    return
  }

  const destino = route.query.redirect || '/productos'
  router.push(destino)
}
</script>

<template>
  <main class="relative flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#0c0a09] px-4 py-8 text-[#f5f2eb]">
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-25">
      <div class="absolute -top-[20%] left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#e58a4e]/20 via-[#e58a4e]/5 to-transparent blur-3xl"></div>
    </div>

    <section class="relative z-10 w-full max-w-md rounded-3xl border border-stone-800/80 bg-[#17120f] p-6 text-white sm:p-8" aria-labelledby="login-title">
      <div class="flex items-center gap-3">
        <img :src="logoIcono" alt="TrackMenú" class="h-12 w-12 shrink-0 object-contain" />
        <div>
          <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Acceso al Sistema</p>
          <h1 id="login-title" class="font-girassol text-3xl font-normal text-white">Iniciar sesión</h1>
        </div>
      </div>

      <form class="mt-6 space-y-4" @submit.prevent="iniciarSesion">
        <label class="block text-xs font-bold text-stone-400">
          Correo electrónico
          <input v-model="email" type="email" autocomplete="email" required placeholder="ejemplo@restaurante.com"
            class="mt-2 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-4 py-3 text-sm text-white outline-none focus:border-[#e58a4e] transition" />
        </label>
        <label class="block text-xs font-bold text-stone-400">
          Contraseña
          <input v-model="password" type="password" autocomplete="current-password" required placeholder="••••••••"
            class="mt-2 w-full rounded-xl border border-stone-800 bg-[#110d0b] px-4 py-3 text-sm text-white outline-none focus:border-[#e58a4e] transition" />
        </label>

        <p v-if="errorMensaje" role="alert" class="rounded-xl border border-rose-500/30 bg-rose-950/20 px-3.5 py-2.5 text-xs font-medium text-rose-300">
          {{ errorMensaje }}
        </p>

        <button type="submit" :disabled="cargando"
          class="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e58a4e] px-4 py-3.5 text-sm font-bold text-[#190d05] transition hover:bg-[#ee975e] active:scale-[0.99] disabled:opacity-50">
          <LogIn :size="16" />
          <span>{{ cargando ? 'Iniciando...' : 'Entrar al Menú' }}</span>
        </button>
      </form>

      <div class="mt-5 flex flex-col gap-1.5 text-center text-sm font-semibold text-stone-400">
        <p class="text-[11px] font-normal text-stone-500">Acceso exclusivo para personal autorizado.</p>
        <RouterLink to="/inicio" class="py-1 text-xs text-stone-400 hover:text-[#e58a4e] transition">Volver a la carta digital</RouterLink>
      </div>
    </section>
  </main>
</template>
