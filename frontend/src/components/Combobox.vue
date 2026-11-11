<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean],
    default: '',
  },
  options: {
    type: Array,
    required: true,
  },
  placeholder: {
    type: String,
    default: 'Seleccionar...',
  },
  label: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: 'md', // 'sm' | 'md'
    validator: (v) => ['sm', 'md'].includes(v),
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const placement = ref('bottom') // 'bottom' | 'top'
const rootRef = ref(null)
const dropdownRef = ref(null)

// Normaliza las opciones a formato { value, label, icon, description }
const normalizedOptions = computed(() => {
  return props.options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value !== undefined ? opt.value : opt.label,
        label: opt.label !== undefined ? opt.label : String(opt.value),
        icon: opt.icon || null,
        description: opt.description || '',
      }
    }
    return {
      value: opt,
      label: String(opt),
      icon: null,
      description: '',
    }
  })
})

// Encuentra la opción seleccionada actualmente
const selectedOption = computed(() => {
  return normalizedOptions.value.find((opt) => opt.value === props.modelValue) || null
})

const displayText = computed(() => {
  return selectedOption.value ? selectedOption.value.label : props.placeholder
})

// Calcula si debe desplegarse hacia arriba o hacia abajo según el espacio en pantalla
function updatePlacement() {
  if (!rootRef.value) return

  const rect = rootRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top

  // Altura aproximada del menú desplegable con padding
  const menuHeight = dropdownRef.value?.offsetHeight || 190

  // Si no hay suficiente espacio abajo (menos de menuHeight + 15px de margen)
  // y hay más espacio arriba que abajo, se posiciona arriba
  if (spaceBelow < menuHeight + 15 && spaceAbove > spaceBelow) {
    placement.value = 'top'
  } else {
    placement.value = 'bottom'
  }
}

function toggleDropdown() {
  if (props.disabled) return
  isOpen.value = !isOpen.value

  if (isOpen.value) {
    updatePlacement()
    nextTick(() => {
      updatePlacement()
    })
  }
}

function selectOption(option) {
  emit('update:modelValue', option.value)
  emit('change', option.value)
  isOpen.value = false
}

// Cierre al hacer clic fuera del componente
function handleClickOutside(event) {
  if (rootRef.value && !rootRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

// Cierre con la tecla Escape
function handleKeydown(event) {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

function handleScrollOrResize() {
  if (isOpen.value) {
    updatePlacement()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleScrollOrResize, { passive: true })
  window.addEventListener('scroll', handleScrollOrResize, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleScrollOrResize)
  window.removeEventListener('scroll', handleScrollOrResize)
})
</script>

<template>
  <div ref="rootRef" class="relative w-full text-left font-sans select-none">
    <!-- Etiqueta superior opcional -->
    <label v-if="label" class="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
      {{ label }}
    </label>

    <!-- Botón / Disparador del Combobox -->
    <button
      type="button"
      @click="toggleDropdown"
      :disabled="disabled"
      class="group relative flex w-full items-center justify-between rounded-xl border bg-[#110d0b] text-white transition duration-200 outline-none"
      :class="[
        size === 'sm' ? 'px-3 py-2 text-xs font-semibold' : 'px-4 py-3 text-sm font-semibold',
        isOpen ? 'border-[#e58a4e] ring-1 ring-[#e58a4e]/40' : 'border-stone-800 hover:border-stone-700',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ]"
      aria-haspopup="listbox"
      :aria-expanded="isOpen">
      <span class="flex items-center gap-2 truncate" :class="!selectedOption ? 'text-stone-500' : 'text-stone-100'">
        <component v-if="selectedOption?.icon" :is="selectedOption.icon" :size="size === 'sm' ? 14 : 16" class="text-[#e58a4e] shrink-0" />
        <span class="truncate">{{ displayText }}</span>
      </span>

      <ChevronDown
        :size="size === 'sm' ? 14 : 16"
        class="shrink-0 text-stone-400 transition-transform duration-200"
        :class="isOpen ? 'rotate-180 text-[#e58a4e]' : 'group-hover:text-stone-300'" />
    </button>

    <!-- Menú desplegable flotante con posicionamiento inteligente (arriba o abajo) -->
    <transition
      enter-active-class="transition duration-150 ease-out"
      :enter-from-class="placement === 'top' ? 'transform scale-95 opacity-0 translate-y-1' : 'transform scale-95 opacity-0 -translate-y-1'"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      :leave-to-class="placement === 'top' ? 'transform scale-95 opacity-0 translate-y-1' : 'transform scale-95 opacity-0 -translate-y-1'">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="absolute left-0 z-50 w-full rounded-2xl border border-stone-800 bg-[#17120f] p-1.5 shadow-2xl backdrop-blur-md"
        :class="placement === 'top' ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'"
        role="listbox">
        <div class="max-h-60 overflow-y-auto space-y-0.5">
          <div
            v-for="option in normalizedOptions"
            :key="option.value"
            @click="selectOption(option)"
            role="option"
            :aria-selected="option.value === modelValue"
            class="group/item flex items-center justify-between rounded-xl px-3 py-2.5 transition duration-150 cursor-pointer"
            :class="[
              size === 'sm' ? 'text-xs' : 'text-sm',
              option.value === modelValue
                ? 'bg-[#221a15] text-[#e58a4e] font-bold'
                : 'text-stone-300 hover:bg-[#201814] hover:text-white',
            ]">
            <div class="flex items-center gap-2.5 min-w-0">
              <component
                v-if="option.icon"
                :is="option.icon"
                :size="size === 'sm' ? 14 : 16"
                :class="option.value === modelValue ? 'text-[#e58a4e]' : 'text-stone-400 group-hover/item:text-stone-200'"
                class="shrink-0" />
              <div class="min-w-0">
                <span class="block truncate">{{ option.label }}</span>
                <span v-if="option.description" class="block text-[10px] text-stone-500 font-normal truncate">
                  {{ option.description }}
                </span>
              </div>
            </div>

            <!-- Icono de check si está seleccionado -->
            <Check
              v-if="option.value === modelValue"
              :size="size === 'sm' ? 13 : 15"
              class="text-[#e58a4e] shrink-0 ml-2" />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>
