<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavigationHeader from '@/components/NavigationHeader.vue'

const route = useRoute()
const mostrarHeader = computed(() => route.path !== '/' && route.path !== '/login')
</script>

<template>
  <div class="min-h-dvh bg-[#0c0a09] text-[#f5f2eb]">
    <NavigationHeader v-if="mostrarHeader" />
    <RouterView />
  </div>
</template>
