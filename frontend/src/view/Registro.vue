<script setup>
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import logoIcono from '../assets/2.png'

defineProps({
  error: { type: String, default: '' },
})

const emit = defineEmits(['submit', 'login', 'close'])
const name = ref('')
const email = ref('')
const password = ref('')

const submit = () => emit('submit', { name: name.value, email: email.value, password: password.value })
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-end justify-center bg-[#20160f]/50 p-3 sm:items-center sm:p-5" @click.self="emit('close')">
    <section class="w-full max-w-md rounded-3xl bg-[#fffaf2] p-5 shadow-2xl sm:p-7" aria-labelledby="register-title">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <img :src="logoIcono" alt="TrackMenú" class="h-10 w-10 shrink-0 rounded-xl object-contain" />
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#a18262]">Cuenta TrackMenú</p>
            <h2 id="register-title" class="mt-0.5 font-serif text-2xl font-bold">Crear cuenta</h2>
          </div>
        </div>
        <button type="button" @click="emit('close')" aria-label="Cerrar" class="rounded-full p-2 text-[#806f5d] hover:bg-[#f0e5d5]"><X :size="18" /></button>
      </div>
      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <label class="block text-xs font-bold text-[#806f5d]">
          Nombre
          <input v-model="name" type="text" autocomplete="name" required class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
        </label>
        <label class="block text-xs font-bold text-[#806f5d]">
          Correo electrónico
          <input v-model="email" type="email" autocomplete="email" required class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
        </label>
        <label class="block text-xs font-bold text-[#806f5d]">
          Contraseña
          <input v-model="password" type="password" autocomplete="new-password" minlength="8" required class="mt-2 w-full rounded-xl border border-[#dfd1bd] bg-white px-3 py-3 text-sm text-[#17120e] outline-none focus:border-[#d65d2a]" />
        </label>
        <p v-if="error" role="alert" class="text-sm text-[#b83d14]">{{ error }}</p>
        <button type="submit" class="w-full rounded-full bg-[#d65d2a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#b94b1e]">Crear cuenta</button>
        <button type="button" @click="emit('login')" class="w-full py-2 text-sm font-semibold text-[#806f5d] hover:text-[#20160f]">Ya tengo una cuenta · Iniciar sesión</button>
      </form>
      <p class="mt-3 text-center text-[11px] leading-relaxed text-[#9b8874]">Cuenta de demostración guardada en este navegador.</p>
    </section>
  </div>
</template>