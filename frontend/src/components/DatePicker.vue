<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X
} from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: String, // 'YYYY-MM-DD' o ''
    default: '',
  },
  placeholder: {
    type: String,
    default: 'DD/MM/AAAA',
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
  required: {
    type: Boolean,
    default: false,
  },
  min: {
    type: String,
    default: '',
  },
  max: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const placement = ref('bottom') // 'bottom' | 'top'
const rootRef = ref(null)
const dropdownRef = ref(null)

// Nombres de meses y días en español
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]
const DIAS_SEMANA = ['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO']

// Estado del mes y año que se está visualizando en el calendario
const hoy = new Date()
const viewYear = ref(hoy.getFullYear())
const viewMonth = ref(hoy.getMonth()) // 0 a 11

// Sincronizar el mes visualizado con el modelValue cuando se abre o cambia
function sincronizarConValor() {
  if (props.modelValue && typeof props.modelValue === 'string') {
    const partes = props.modelValue.split('-').map(Number)
    if (partes.length === 3 && partes[0] && partes[1] && partes[2]) {
      viewYear.value = partes[0]
      viewMonth.value = partes[1] - 1
      return
    }
  }
  const actual = new Date()
  viewYear.value = actual.getFullYear()
  viewMonth.value = actual.getMonth()
}

watch(() => props.modelValue, () => {
  if (!isOpen.value) {
    sincronizarConValor()
  }
}, { immediate: true })

// Formato visual DD/MM/AAAA para el input
const displayText = computed(() => {
  if (!props.modelValue) return ''
  const partes = String(props.modelValue).slice(0, 10).split('-')
  if (partes.length !== 3) return props.modelValue
  return `${partes[2]}/${partes[1]}/${partes[0]}`
})

const tituloMesAno = computed(() => {
  const nombreMes = MESES[viewMonth.value] || ''
  return `${nombreMes} de ${viewYear.value}`
})

// Días a pintar en la cuadrícula de 7 columnas
const diasCalendario = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value

  // Primer día del mes
  const primerDiaMes = new Date(year, month, 1)
  // getDay(): 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  // Convertimos a índice 0 = Lunes, 6 = Domingo
  const diaSemanaInicio = (primerDiaMes.getDay() + 6) % 7

  const diasEnMesActual = new Date(year, month + 1, 0).getDate()
  const diasEnMesAnterior = new Date(year, month, 0).getDate()

  const dias = []

  // 1. Días del mes anterior (de relleno previo)
  for (let i = diaSemanaInicio - 1; i >= 0; i--) {
    const diaNum = diasEnMesAnterior - i
    const mesPrev = month === 0 ? 11 : month - 1
    const anoPrev = month === 0 ? year - 1 : year
    const str = `${anoPrev}-${String(mesPrev + 1).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`
    dias.push({
      dia: diaNum,
      esMesActual: false,
      dateString: str,
      esHoy: esMismoDia(str, fechaHoyStr()),
      esSeleccionado: str === props.modelValue,
    })
  }

  // 2. Días del mes actual
  for (let d = 1; d <= diasEnMesActual; d++) {
    const str = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    dias.push({
      dia: d,
      esMesActual: true,
      dateString: str,
      esHoy: esMismoDia(str, fechaHoyStr()),
      esSeleccionado: str === props.modelValue,
    })
  }

  // 3. Días del mes siguiente (para completar filas de 7 hasta 35 o 42 celdas)
  const celdasTotales = dias.length <= 35 ? 35 : 42
  const restantes = celdasTotales - dias.length
  for (let d = 1; d <= restantes; d++) {
    const mesNext = month === 11 ? 0 : month + 1
    const anoNext = month === 11 ? year + 1 : year
    const str = `${anoNext}-${String(mesNext + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    dias.push({
      dia: d,
      esMesActual: false,
      dateString: str,
      esHoy: esMismoDia(str, fechaHoyStr()),
      esSeleccionado: str === props.modelValue,
    })
  }

  return dias
})

function fechaHoyStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function esMismoDia(str1, str2) {
  return Boolean(str1 && str2 && str1 === str2)
}

function mesAnterior() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function mesSiguiente() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

function anoAnterior() {
  viewYear.value--
}

function anoSiguiente() {
  viewYear.value++
}

function seleccionarDia(celda) {
  emit('update:modelValue', celda.dateString)
  emit('change', celda.dateString)
  isOpen.value = false
}

function seleccionarHoy() {
  const hoyStr = fechaHoyStr()
  emit('update:modelValue', hoyStr)
  emit('change', hoyStr)
  sincronizarConValor()
  isOpen.value = false
}

function borrarFecha() {
  emit('update:modelValue', '')
  emit('change', '')
  isOpen.value = false
}

// Posicionamiento inteligente del popover (arriba o abajo)
function updatePlacement() {
  if (!rootRef.value) return

  const rect = rootRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top

  const menuHeight = dropdownRef.value?.offsetHeight || 320

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
    sincronizarConValor()
    updatePlacement()
    nextTick(() => {
      updatePlacement()
    })
  }
}

function handleClickOutside(event) {
  if (rootRef.value && !rootRef.value.contains(event.target)) {
    isOpen.value = false
  }
}

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
    <label v-if="label" class="block text-xs font-semibold text-stone-300 mb-1.5">
      {{ label }}
    </label>

    <!-- Disparador del DatePicker (simula un input con estilo idéntico) -->
    <button
      type="button"
      @click="toggleDropdown"
      :disabled="disabled"
      class="group relative flex w-full items-center justify-between rounded-2xl border bg-[#110d0b] text-white transition duration-200 outline-none"
      :class="[
        size === 'sm' ? 'px-3 py-2 text-xs font-medium' : 'px-4 py-3 text-sm font-medium',
        isOpen ? 'border-[#e58a4e] ring-1 ring-[#e58a4e]/40' : 'border-stone-800 hover:border-stone-700',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ]"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
    >
      <span class="truncate" :class="!displayText ? 'text-stone-500' : 'text-stone-100 font-medium'">
        {{ displayText || placeholder }}
      </span>

      <span class="flex items-center gap-1.5 shrink-0 ml-2">
        <button
          v-if="displayText && !disabled && !required"
          type="button"
          @click.stop="borrarFecha"
          class="rounded p-0.5 text-stone-500 hover:text-stone-300 transition"
          title="Borrar fecha"
          aria-label="Borrar fecha"
        >
          <X :size="14" />
        </button>
        <CalendarIcon
          :size="size === 'sm' ? 14 : 16"
          class="text-stone-400 transition-colors duration-200"
          :class="isOpen ? 'text-[#e58a4e]' : 'group-hover:text-stone-300'"
        />
      </span>
    </button>

    <!-- Popover Calendario -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      :enter-from-class="placement === 'top' ? 'transform scale-95 opacity-0 translate-y-1' : 'transform scale-95 opacity-0 -translate-y-1'"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      :leave-to-class="placement === 'top' ? 'transform scale-95 opacity-0 translate-y-1' : 'transform scale-95 opacity-0 -translate-y-1'"
    >
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="absolute left-0 z-50 w-72 sm:w-80 rounded-3xl border border-stone-800 bg-[#17120f] p-4 text-white shadow-2xl backdrop-blur-md"
        :class="placement === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'"
        role="dialog"
        aria-modal="true"
        aria-label="Selector de fecha"
      >
        <!-- Encabezado del calendario: navegación de mes y año -->
        <div class="flex items-center justify-between border-b border-stone-800/80 pb-3 mb-3">
          <div class="flex items-center gap-0.5">
            <button
              type="button"
              @click="anoAnterior"
              class="rounded-xl p-1 text-stone-400 hover:bg-[#201814] hover:text-white transition"
              title="Año anterior"
              aria-label="Año anterior"
            >
              <ChevronsLeft :size="15" />
            </button>
            <button
              type="button"
              @click="mesAnterior"
              class="rounded-xl p-1 text-stone-400 hover:bg-[#201814] hover:text-white transition"
              title="Mes anterior"
              aria-label="Mes anterior"
            >
              <ChevronLeft :size="15" />
            </button>
          </div>

          <span class="font-girassol text-base sm:text-lg capitalize text-white tracking-wide">
            {{ tituloMesAno }}
          </span>

          <div class="flex items-center gap-0.5">
            <button
              type="button"
              @click="mesSiguiente"
              class="rounded-xl p-1 text-stone-400 hover:bg-[#201814] hover:text-white transition"
              title="Mes siguiente"
              aria-label="Mes siguiente"
            >
              <ChevronRight :size="15" />
            </button>
            <button
              type="button"
              @click="anoSiguiente"
              class="rounded-xl p-1 text-stone-400 hover:bg-[#201814] hover:text-white transition"
              title="Año siguiente"
              aria-label="Año siguiente"
            >
              <ChevronsRight :size="15" />
            </button>
          </div>
        </div>

        <!-- Días de la semana -->
        <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-stone-400 mb-1">
          <span v-for="d in DIAS_SEMANA" :key="d" class="py-1">
            {{ d }}
          </span>
        </div>

        <!-- Cuadrícula de días -->
        <div class="grid grid-cols-7 gap-1">
          <button
            v-for="(celda, idx) in diasCalendario"
            :key="idx"
            type="button"
            @click="seleccionarDia(celda)"
            class="relative flex h-8 w-8 sm:h-9 sm:w-9 mx-auto items-center justify-center rounded-xl text-xs font-semibold transition duration-150"
            :class="[
              celda.esSeleccionado
                ? 'bg-[#e58a4e] text-[#190d05] font-bold shadow-md scale-105'
                : celda.esMesActual
                  ? 'text-stone-200 hover:bg-[#231b16] hover:text-[#e58a4e]'
                  : 'text-stone-600 hover:bg-[#1a1410] hover:text-stone-400',
              celda.esHoy && !celda.esSeleccionado ? 'ring-1 ring-[#e58a4e]/50 font-bold text-[#e58a4e]' : '',
            ]"
            :title="celda.dateString"
          >
            <span>{{ celda.dia }}</span>
            <span
              v-if="celda.esHoy && !celda.esSeleccionado"
              class="absolute bottom-1 h-1 w-1 rounded-full bg-[#e58a4e]"
            />
          </button>
        </div>

        <!-- Barra inferior: Borrar / Hoy -->
        <div class="flex items-center justify-between border-t border-stone-800/80 pt-3 mt-3 text-xs">
          <button
            type="button"
            @click="borrarFecha"
            class="text-stone-400 hover:text-stone-200 font-semibold px-2 py-1 rounded-lg hover:bg-stone-800/40 transition"
          >
            Borrar
          </button>

          <button
            type="button"
            @click="seleccionarHoy"
            class="text-[#e58a4e] hover:text-[#ee975e] font-bold px-2 py-1 rounded-lg hover:bg-[#e58a4e]/10 transition"
          >
            Hoy
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

