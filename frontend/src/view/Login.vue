<script setup>
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import logoIcono from '../assets/2.png'

defineProps({
  error: { type: String, default: '' },
})

const emit = defineEmits(['submit', 'register', 'close'])
const email = ref('')
const password = ref('')

const submit = () => emit('submit', { email: email.value, password: password.value })
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-end justify-center bg-[#20160f]/50 p-3 sm:items-center sm:p-5" @click.self="emit('close')">
    <section class="w-full max-w-md rounded-3xl bg-[#fffaf2] p-5 shadow-2xl sm:p-7" aria-labelledby="login-title">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <img :src="logoIcono" alt="TrackMenú" class="h-10 w-10 shrink-0 rounded-xl object-contain" />
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a18262]">Cuenta TrackMenú</p>
            <h2 id="login-title" class="mt-0.5 font-serif text-2xl font-bold">Bienvenido</h2>
          </div>
        </div>
        <button type="button" @click="emit('close')" aria-label="Cerrar" class="rounded-full p-2 text-[#806f5d] hover:bg-[#f0e5d5]"><X :size="18" /></button>
      </div>
      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <label class="block text-xs font-bold text-[#806f5d]">
          Correo electrónico
          <input v-model="email" type="email" autocomplete="email" required class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
        </label>
        <label class="block text-xs font-bold text-[#806f5d]">
          Contraseña
          <input v-model="password" type="password" autocomplete="current-password" required class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
        </label>
        <p v-if="error" role="alert" class="text-sm text-[#b83d14]">{{ error }}</p>
        <button type="submit" class="w-full rounded-full bg-[#d65d2a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#b94b1e]">Iniciar sesión</button>
        <button type="button" @click="emit('register')" class="w-full py-2 text-sm font-semibold text-[#806f5d] hover:text-[#20160f]">¿No tenés cuenta? · Registrarme</button>
      </form>
      <p class="mt-3 text-center text-[11px] leading-relaxed text-[#9b8874]">Cuenta de demostración guardada en este navegador.</p>
    </section>
  </div>
</template>