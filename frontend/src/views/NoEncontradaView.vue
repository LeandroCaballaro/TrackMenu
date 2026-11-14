<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fff6ea] px-6 text-center text-[#3d2f22]">
    <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a18262]">Error 404</p>
    <h1 class="font-serif text-3xl font-bold sm:text-4xl">Esta página no existe</h1>
    <p class="max-w-md text-sm text-[#6b5844]">
      Puede que el enlace esté mal escrito o que la página se haya movido.
    </p>
    <RouterLink
      to="/inicio"
      class="mt-2 rounded-full bg-[#d65d2a] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#b94b1e]">
      Volver al menú
    </RouterLink>
  </main>
</template>
