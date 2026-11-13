<script setup>
import { UtensilsCrossed, ArrowRight } from 'lucide-vue-next'
import logoIcono from '@/assets/3.png'
import { authState } from '@/services/api'
</script>

<template>
  <main class="relative flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#0c0a09] px-4 py-8 text-[#f5f2eb]">
    <!-- Resplandor ambiental sutil -->
    <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-25">
      <div class="absolute -top-[20%] left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#e58a4e]/20 via-[#e58a4e]/5 to-transparent blur-3xl"></div>
    </div>

    <section
      class="relative z-10 w-full max-w-md rounded-3xl border border-stone-800/80 bg-[#17120f] p-6 text-white shadow-2xl sm:p-8"
      aria-labelledby="welcome-title"
    >
      <!-- Encabezado de marca -->
      <div class="flex items-center gap-3.5">
        <img :src="logoIcono" alt="TrackMenú" class="h-12 w-12 shrink-0 object-contain" />
        <div class="min-w-0">
          <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-[#e58a4e]">Bienvenido a TrackMenú</p>
          <h1 id="welcome-title" class="font-girassol text-3xl font-normal leading-tight text-white">
            Carta Digital
          </h1>
        </div>
      </div>

      <!-- Mensaje de bienvenida -->
      <p class="mt-5 text-sm leading-relaxed text-stone-300">
        Explorá nuestro catálogo actualizado, elegí tus platos favoritos y armá tu pedido directo desde la mesa.
      </p>

      <!-- Acceso principal destacado al catálogo -->
      <RouterLink
        to="/inicio"
        class="mt-6 flex min-h-[54px] w-full items-center justify-between gap-3 rounded-2xl bg-[#e58a4e] px-5 py-4 text-[#190d05] shadow-lg transition hover:bg-[#ee975e] active:scale-[0.98]"
      >
        <span class="flex items-center gap-3">
          <UtensilsCrossed :size="20" class="shrink-0" />
          <span class="flex flex-col text-left">
            <span class="text-base font-extrabold leading-tight">Ver Catálogo</span>
            <span class="text-[11px] font-semibold text-[#190d05]/80">Abrir menú digital y pedir</span>
          </span>
        </span>
        <ArrowRight :size="18" class="shrink-0" />
      </RouterLink>

      <!-- Acceso secundario en letra chica para administrador o empleado -->
      <div class="mt-6 border-t border-stone-800/70 pt-4 text-center text-[11px] leading-relaxed text-stone-500">
        <template v-if="!authState.user">
          <span>¿Sos administrador o empleado? </span>
          <RouterLink
            to="/login"
            class="inline-block py-1 font-medium text-stone-400 underline decoration-stone-700 underline-offset-4 transition hover:text-[#e58a4e] hover:decoration-[#e58a4e]/60"
          >
            Ingresar al sistema
          </RouterLink>
        </template>
        <template v-else>
          <span>Sesión activa ({{ authState.rol }}) · </span>
          <RouterLink
            :to="authState.rol === 'admin' ? '/dashboard' : '/productos'"
            class="inline-block py-1 font-medium text-[#e58a4e] underline decoration-[#e58a4e]/50 underline-offset-4 transition hover:text-[#f09559]"
          >
            Ir al panel de gestión
          </RouterLink>
        </template>
      </div>
    </section>
  </main>
</template>

