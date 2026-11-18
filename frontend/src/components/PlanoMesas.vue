<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Pencil, Move, Plus, Trash2, Check, RotateCcw, Save, CircleDollarSign,
  Bell, Layers, LayoutGrid, Info, X, Sparkles, Sliders, CheckCircle2,
  Store, Users, AlertCircle, RefreshCw
} from 'lucide-vue-next'
import {
  calcularDistanciaCaja,
  autoNumerarMesas,
  DEFAULT_MAPA_CONFIG,
  mesasService
} from '@/services/api'

const props = defineProps({
  mesas: {
    type: Array,
    default: () => []
  },
  selectedTable: {
    type: Number,
    default: 1
  },
  esAdmin: {
    type: Boolean,
    default: false
  },
  formatPrice: {
    type: Function,
    default: (val) => `$ ${Number(val || 0).toLocaleString('es-AR')}`
  }
})

const emit = defineEmits(['seleccionar-mesa', 'actualizar-mesas', 'notificar'])

// Modo de visualización: 'plano' (arquitectónico interactivo) o 'grid' (cuadrícula clásica)
const modoVista = ref('plano')

// Modo edición (exclusivo para administradores)
const modoEdicion = ref(false)

// Cambios pendientes sin guardar (dispara popup flotante Cancelar / Guardar)
const hayCambiosPendientes = ref(false)

// Configuración local en edición
const configLocal = ref(JSON.parse(JSON.stringify(DEFAULT_MAPA_CONFIG)))

// Mesa seleccionada para inspección/edición en la barra lateral
const mesaEditandoId = ref(null)

// Contenedor del plano
const canvasRef = ref(null)

// Estado del arrastre (pointer drag)
let arrastrando = null
let recienArrastrado = false

// Selección múltiple estilo Windows (recuadro de selección + Ctrl/Shift+clic)
const mesasSeleccionadasIds = ref([])
const capacidadLote = ref(4)
const seleccionCaja = ref({ activa: false, x1: 0, y1: 0, x2: 0, y2: 0 })
let marqueeState = null

const estiloSeleccionCaja = computed(() => {
  if (!seleccionCaja.value.activa) return {}
  const left = Math.min(seleccionCaja.value.x1, seleccionCaja.value.x2)
  const top = Math.min(seleccionCaja.value.y1, seleccionCaja.value.y2)
  const width = Math.abs(seleccionCaja.value.x2 - seleccionCaja.value.x1)
  const height = Math.abs(seleccionCaja.value.y2 - seleccionCaja.value.y1)
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
  }
})

const formasLocalDisponibles = [
  { id: 'rectangular', label: 'Rectangular', desc: 'Salón clásico abierto' },
  { id: 'forma_l', label: 'Forma en L', desc: 'Salón con pasillo / ala lateral' },
  { id: 'forma_u', label: 'Forma en U', desc: 'Salón con patio o barra central' },
  { id: 'con_terraza', label: 'Salón + Terraza', desc: 'Área interior y exterior' },
]

function cargarDesdeConfigYProps(nuevasMesas = props.mesas) {
  const config = mesasService.obtenerConfigMapa()
  const baseMesas = Array.isArray(config.mesas) && config.mesas.length > 0
    ? config.mesas
    : (nuevasMesas || [])

  configLocal.value = {
    formaLocal: config.formaLocal || 'rectangular',
    caja: config.caja || { x: 12, y: 15, nombre: 'Caja / Cobro' },
    mesas: baseMesas.map((m) => {
      const propMesa = (nuevasMesas || []).find((pm) => pm.numero === m.numero || pm.id === m.id)
      return {
        id: m.id || `m_${m.numero}`,
        numero: m.numero,
        x: m.x ?? 50,
        y: m.y ?? 50,
        forma: m.forma || 'cuadrada',
        capacidad: m.capacidad || 4,
        numeroManual: m.numeroManual ?? null,
        ocupada: propMesa?.ocupada ?? m.ocupada ?? false,
        comanda: propMesa?.comanda ?? m.comanda ?? null,
      }
    })
  }
}

// Sincronizar mesas entrantes con la configuración local
watch(
  () => props.mesas,
  (nuevasMesas) => {
    if (!modoEdicion.value && !hayCambiosPendientes.value && Array.isArray(nuevasMesas) && nuevasMesas.length > 0) {
      cargarDesdeConfigYProps(nuevasMesas)
    }
  },
  { immediate: true, deep: true }
)

const mesaEditando = computed(() => {
  if (!mesaEditandoId.value) return null
  return configLocal.value.mesas.find((m) => m.id === mesaEditandoId.value) || null
})

// Lista combinada de mesas con estado de ocupación para renderizar en el plano
const mesasParaRender = computed(() => {
  return configLocal.value.mesas.map((m) => {
    // Si viene comanda de props, enlazarla
    const propMesa = props.mesas.find((pm) => pm.numero === m.numero || pm.id === m.id)
    return {
      ...m,
      ocupada: propMesa?.ocupada ?? m.ocupada ?? false,
      comanda: propMesa?.comanda ?? m.comanda ?? null,
    }
  })
})

// Distancia calculada de la mesa editando a la caja
const distanciaMesaEditando = computed(() => {
  if (!mesaEditando.value) return 0
  return Math.round(calcularDistanciaCaja(mesaEditando.value, configLocal.value.caja))
})

// Activar o desactivar modo edición (sólo para administradores)
function toggleModoEdicion() {
  if (!props.esAdmin) return
  if (!modoEdicion.value) {
    if (!hayCambiosPendientes.value) {
      cargarDesdeConfigYProps()
    }
    modoVista.value = 'plano'
    modoEdicion.value = true
    mesaEditandoId.value = configLocal.value.mesas[0]?.id || null
  } else {
    modoEdicion.value = false
    mesaEditandoId.value = null
  }
}

// Iniciar arrastre de mesa (o grupo de mesas seleccionadas) o de la caja
function iniciarArrastre(e, tipo, item) {
  if (!props.esAdmin) return
  if (e.button !== undefined && e.button !== 0) return

  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  // Si arrastra una mesa que forma parte de una selección múltiple, mueve todo el grupo
  let grupoOrig = null
  if (tipo === 'mesa' && mesasSeleccionadasIds.value.includes(item.id) && mesasSeleccionadasIds.value.length > 1) {
    grupoOrig = configLocal.value.mesas
      .filter((m) => mesasSeleccionadasIds.value.includes(m.id))
      .map((m) => ({ id: m.id, origX: Number(m.x), origY: Number(m.y) }))
  } else if (tipo === 'mesa' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
    mesasSeleccionadasIds.value = []
  }

  arrastrando = {
    tipo,
    id: item.id || 'caja',
    origX: tipo === 'caja' ? Number(configLocal.value.caja.x) : Number(item.x),
    origY: tipo === 'caja' ? Number(configLocal.value.caja.y) : Number(item.y),
    grupoOrig,
    startClientX: e.clientX,
    startClientY: e.clientY,
    seMovio: false,
    rect,
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e) {
  if (!arrastrando) return
  const { origX, origY, grupoOrig, startClientX, startClientY, rect, tipo, id } = arrastrando
  const distPx = Math.hypot(e.clientX - startClientX, e.clientY - startClientY)

  if (!arrastrando.seMovio && distPx < 5) {
    return
  }

  if (!arrastrando.seMovio) {
    arrastrando.seMovio = true
    if (tipo === 'mesa' && modoEdicion.value) {
      mesaEditandoId.value = id
    }
  }

  const deltaXPercent = ((e.clientX - startClientX) / rect.width) * 100
  const deltaYPercent = ((e.clientY - startClientY) / rect.height) * 100

  if (tipo === 'caja') {
    configLocal.value.caja.x = Math.round(Math.min(94, Math.max(6, origX + deltaXPercent)))
    configLocal.value.caja.y = Math.round(Math.min(92, Math.max(8, origY + deltaYPercent)))
  } else if (grupoOrig && grupoOrig.length > 1) {
    for (const itemOrig of grupoOrig) {
      const mesa = configLocal.value.mesas.find((m) => m.id === itemOrig.id)
      if (mesa) {
        mesa.x = Math.round(Math.min(94, Math.max(6, itemOrig.origX + deltaXPercent)))
        mesa.y = Math.round(Math.min(92, Math.max(8, itemOrig.origY + deltaYPercent)))
      }
    }
  } else {
    const mesa = configLocal.value.mesas.find((m) => m.id === id)
    if (mesa) {
      mesa.x = Math.round(Math.min(94, Math.max(6, origX + deltaXPercent)))
      mesa.y = Math.round(Math.min(92, Math.max(8, origY + deltaYPercent)))
    }
  }

  hayCambiosPendientes.value = true
  // Recalcular número de las mesas automáticas según su nueva distancia a la caja
  recalcularNumeracionAutomatica()
}

function onPointerUp() {
  if (arrastrando?.seMovio) {
    recienArrastrado = true
    setTimeout(() => {
      recienArrastrado = false
    }, 60)
  }
  arrastrando = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

// Selección por recuadro (estilo Windows) al arrastrar sobre espacio vacío del plano
function iniciarSeleccionCaja(e) {
  if (!props.esAdmin || modoEdicion.value) return
  if (e.button !== undefined && e.button !== 0) return

  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return

  const startX = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
  const startY = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))

  marqueeState = {
    startX,
    startY,
    startClientX: e.clientX,
    startClientY: e.clientY,
    rect,
    aditivo: e.ctrlKey || e.metaKey || e.shiftKey,
    prevSeleccion: [...mesasSeleccionadasIds.value],
    seMovio: false,
  }

  window.addEventListener('pointermove', onMarqueeMove)
  window.addEventListener('pointerup', onMarqueeUp)
}

function onMarqueeMove(e) {
  if (!marqueeState) return
  const { startX, startY, startClientX, startClientY, rect, aditivo, prevSeleccion } = marqueeState
  const distPx = Math.hypot(e.clientX - startClientX, e.clientY - startClientY)

  if (!marqueeState.seMovio && distPx < 5) return
  marqueeState.seMovio = true

  const curX = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
  const curY = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100))

  seleccionCaja.value = { activa: true, x1: startX, y1: startY, x2: curX, y2: curY }

  const minX = Math.min(startX, curX)
  const maxX = Math.max(startX, curX)
  const minY = Math.min(startY, curY)
  const maxY = Math.max(startY, curY)

  const dentro = configLocal.value.mesas
    .filter((m) => m.x >= minX && m.x <= maxX && m.y >= minY && m.y <= maxY)
    .map((m) => m.id)

  mesasSeleccionadasIds.value = aditivo
    ? Array.from(new Set([...prevSeleccion, ...dentro]))
    : dentro
}

function onMarqueeUp() {
  if (marqueeState && !marqueeState.seMovio && !marqueeState.aditivo) {
    mesasSeleccionadasIds.value = []
  }
  seleccionCaja.value.activa = false
  marqueeState = null
  window.removeEventListener('pointermove', onMarqueeMove)
  window.removeEventListener('pointerup', onMarqueeUp)
}

// Acciones en lote sobre las mesas seleccionadas
function aplicarCapacidadLote(cant) {
  const cap = Math.max(1, Math.min(20, Number(cant) || 4))
  capacidadLote.value = cap
  configLocal.value.mesas.forEach((m) => {
    if (mesasSeleccionadasIds.value.includes(m.id)) {
      m.capacidad = cap
    }
  })
  hayCambiosPendientes.value = true
  emit('notificar', {
    mensaje: `Capacidad actualizada a ${cap} personas en ${mesasSeleccionadasIds.value.length} mesa(s).`,
    tipo: 'info'
  })
}

function aplicarFormaLote(forma) {
  configLocal.value.mesas.forEach((m) => {
    if (mesasSeleccionadasIds.value.includes(m.id)) {
      m.forma = forma
    }
  })
  hayCambiosPendientes.value = true
}

function eliminarMesasSeleccionadas() {
  const cant = mesasSeleccionadasIds.value.length
  if (!cant) return
  configLocal.value.mesas = configLocal.value.mesas.filter((m) => !mesasSeleccionadasIds.value.includes(m.id))
  mesasSeleccionadasIds.value = []
  recalcularNumeracionAutomatica()
  hayCambiosPendientes.value = true
  emit('notificar', {
    mensaje: `${cant} mesa(s) eliminada(s).`,
    tipo: 'info'
  })
}

function limpiarSeleccion() {
  mesasSeleccionadasIds.value = []
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointermove', onMarqueeMove)
  window.removeEventListener('pointerup', onMarqueeUp)
  window.removeEventListener('pointerdown', onOutsideContextClick)
  window.removeEventListener('keydown', onContextKeyDown)
})

// Recalcular numeración automática basada en distancia euclidiana a la caja
function recalcularNumeracionAutomatica() {
  configLocal.value.mesas = autoNumerarMesas(
    configLocal.value.mesas,
    configLocal.value.caja,
    false // respeta los manuales existentes
  )
}

// Forzar auto-numerar absolutamente todas las mesas del 1 al N según distancia a caja
function autoNumerarTodasPorCercania() {
  configLocal.value.mesas = autoNumerarMesas(
    configLocal.value.mesas,
    configLocal.value.caja,
    true // forzar todas
  )
  hayCambiosPendientes.value = true
  emit('notificar', {
    mensaje: `Se renumeraron las ${configLocal.value.mesas.length} mesas por cercanía a la caja (de menor a mayor distancia).`,
    tipo: 'exito'
  })
}

// Estado del formulario desplegable para agregar una nueva mesa
const mostrarFormNuevaMesa = ref(false)
const nuevaMesaForm = ref({
  capacidad: 4,
  forma: 'cuadrada',
  numeroManual: '',
})

function abrirFormNuevaMesa() {
  nuevaMesaForm.value = {
    capacidad: 4,
    forma: 'cuadrada',
    numeroManual: '',
  }
  mostrarFormNuevaMesa.value = !mostrarFormNuevaMesa.value
}

// Agregar una nueva mesa con la configuración elegida
function confirmarAgregarMesa() {
  const nuevoId = `m_${Date.now()}`
  const capacidad = Math.max(1, Math.min(20, Number(nuevaMesaForm.value.capacidad) || 4))
  const forma = nuevaMesaForm.value.forma === 'redonda' ? 'redonda' : 'cuadrada'
  const numTxt = String(nuevaMesaForm.value.numeroManual ?? '').trim()
  const numParsed = Number(numTxt)
  const numeroManual = numTxt && Number.isInteger(numParsed) && numParsed > 0 ? numParsed : null

  // Buscar posición libre cerca del centro
  const x = Math.min(85, Math.max(20, 30 + (configLocal.value.mesas.length * 7) % 55))
  const y = Math.min(85, Math.max(25, 35 + (configLocal.value.mesas.length * 9) % 50))

  const nueva = {
    id: nuevoId,
    numero: numeroManual ?? configLocal.value.mesas.length + 1,
    x,
    y,
    forma,
    capacidad,
    numeroManual,
    ocupada: false,
    comanda: null,
  }

  configLocal.value.mesas.push(nueva)
  recalcularNumeracionAutomatica()
  mesaEditandoId.value = nuevoId
  hayCambiosPendientes.value = true
  mostrarFormNuevaMesa.value = false

  emit('notificar', {
    mensaje: `Mesa ${nueva.numero} (${capacidad} personas) agregada. Podés arrastrarla a donde gustes.`,
    tipo: 'info'
  })
}

// Eliminar una mesa
function eliminarMesa(id) {
  const index = configLocal.value.mesas.findIndex((m) => m.id === id)
  if (index === -1) return
  const eliminada = configLocal.value.mesas[index]
  configLocal.value.mesas.splice(index, 1)

  recalcularNumeracionAutomatica()
  mesaEditandoId.value = configLocal.value.mesas[0]?.id || null
  hayCambiosPendientes.value = true

  emit('notificar', {
    mensaje: `Mesa ${eliminada.numero} eliminada.`,
    tipo: 'info'
  })
}

// Actualizar número manual de la mesa activa
function actualizarNumeroManual(valor) {
  if (!mesaEditando.value) return
  const texto = String(valor || '').trim()
  if (!texto) {
    mesaEditando.value.numeroManual = null
  } else {
    const num = Number(texto)
    if (Number.isInteger(num) && num > 0) {
      mesaEditando.value.numeroManual = num
      mesaEditando.value.numero = num
    }
  }
  hayCambiosPendientes.value = true
  recalcularNumeracionAutomatica()
}

// Preset prehecho según forma seleccionada
function aplicarPresetForma(forma) {
  configLocal.value.formaLocal = forma
  if (forma === 'forma_l') {
    // Configuración optimizada en L: salón en esquina izquierda e inferior
    configLocal.value.caja = { x: 16, y: 16, nombre: 'Caja / Cobro' }
    configLocal.value.mesas = [
      { id: 'm1', numero: 1, x: 38, y: 18, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm2', numero: 2, x: 22, y: 40, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm3', numero: 3, x: 42, y: 40, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm4', numero: 4, x: 22, y: 64, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm5', numero: 5, x: 42, y: 64, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm6', numero: 6, x: 22, y: 86, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm7', numero: 7, x: 42, y: 86, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm8', numero: 8, x: 62, y: 68, forma: 'cuadrada', capacidad: 6, numeroManual: null },
      { id: 'm9', numero: 9, x: 82, y: 68, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm10', numero: 10, x: 62, y: 86, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm11', numero: 11, x: 82, y: 86, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm12', numero: 12, x: 92, y: 86, forma: 'redonda', capacidad: 2, numeroManual: null },
    ]
  } else if (forma === 'con_terraza') {
    configLocal.value.caja = { x: 14, y: 16, nombre: 'Caja / Cobro' }
    configLocal.value.mesas = [
      { id: 'm1', numero: 1, x: 28, y: 22, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm2', numero: 2, x: 48, y: 22, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm3', numero: 3, x: 28, y: 52, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm4', numero: 4, x: 48, y: 52, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm5', numero: 5, x: 28, y: 80, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm6', numero: 6, x: 48, y: 80, forma: 'redonda', capacidad: 2, numeroManual: null },
      // Terraza
      { id: 'm7', numero: 7, x: 72, y: 25, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm8', numero: 8, x: 88, y: 25, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm9', numero: 9, x: 72, y: 55, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm10', numero: 10, x: 88, y: 55, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm11', numero: 11, x: 72, y: 82, forma: 'cuadrada', capacidad: 6, numeroManual: null },
      { id: 'm12', numero: 12, x: 88, y: 82, forma: 'cuadrada', capacidad: 4, numeroManual: null },
    ]
  } else {
    configLocal.value = JSON.parse(JSON.stringify(DEFAULT_MAPA_CONFIG))
    configLocal.value.formaLocal = forma
  }
  hayCambiosPendientes.value = true
  recalcularNumeracionAutomatica()
  emit('notificar', {
    mensaje: `Se aplicó la distribución para ${formasLocalDisponibles.find(f => f.id === forma)?.label}. Podés mover las mesas donde quieras.`,
    tipo: 'exito'
  })
}

// Guardar los cambios del mapa en el almacenamiento persistente
function guardarMapa() {
  recalcularNumeracionAutomatica()
  const res = mesasService.guardarConfigMapa(configLocal.value)
  if (res.success) {
    hayCambiosPendientes.value = false
    modoEdicion.value = false
    mesaEditandoId.value = null
    mesasSeleccionadasIds.value = []
    emit('actualizar-mesas', configLocal.value)
    emit('notificar', {
      mensaje: '¡Mapa del local guardado exitosamente!',
      tipo: 'exito'
    })
  } else {
    emit('notificar', {
      mensaje: res.message || 'Error al guardar mapa.',
      tipo: 'error'
    })
  }
}

// Cancelar modificaciones pendientes y restaurar última configuración guardada
function cancelarCambios() {
  cargarDesdeConfigYProps()
  hayCambiosPendientes.value = false
  modoEdicion.value = false
  mesaEditandoId.value = null
  mesasSeleccionadasIds.value = []
  emit('notificar', {
    mensaje: 'Cambios descartados.',
    tipo: 'info'
  })
}

// Restablecer mapa a valores de fábrica
function restablecerPorDefecto() {
  if (!confirm('¿Restablecer el mapa del local al diseño predeterminado?')) return
  const res = mesasService.restablecerConfigMapa()
  if (res.success) {
    configLocal.value = JSON.parse(JSON.stringify(DEFAULT_MAPA_CONFIG))
    hayCambiosPendientes.value = false
    modoEdicion.value = false
    mesaEditandoId.value = null
    mesasSeleccionadasIds.value = []
    emit('actualizar-mesas', configLocal.value)
    emit('notificar', {
      mensaje: 'Mapa restablecido al diseño predeterminado.',
      tipo: 'info'
    })
  }
}

// Clic en mesa (soporta Ctrl/Shift+clic para selección múltiple en admin)
function manejarClicMesa(e, mesa) {
  if (recienArrastrado) return
  if (props.esAdmin && !modoEdicion.value && (e.ctrlKey || e.metaKey || e.shiftKey)) {
    const idx = mesasSeleccionadasIds.value.indexOf(mesa.id)
    if (idx === -1) {
      mesasSeleccionadasIds.value.push(mesa.id)
    } else {
      mesasSeleccionadasIds.value.splice(idx, 1)
    }
    return
  }
  mesasSeleccionadasIds.value = []
  if (modoEdicion.value) {
    mesaEditandoId.value = mesa.id
  } else {
    emit('seleccionar-mesa', mesa.numero)
  }
}

// Menú contextual flotante estilo Windows al hacer clic derecho sobre una mesa (solo admin)
const contextMenuRef = ref(null)
const menuContexto = ref({
  abierto: false,
  x: 0,
  y: 0,
  mesaId: null,
})

const mesaMenuContexto = computed(() => {
  if (!menuContexto.value.abierto || !menuContexto.value.mesaId) return null
  return configLocal.value.mesas.find((m) => m.id === menuContexto.value.mesaId) || null
})

function cerrarMenuContexto() {
  menuContexto.value.abierto = false
  window.removeEventListener('pointerdown', onOutsideContextClick)
  window.removeEventListener('keydown', onContextKeyDown)
}

function onOutsideContextClick(e) {
  if (contextMenuRef.value && !contextMenuRef.value.contains(e.target)) {
    cerrarMenuContexto()
  }
}

function onContextKeyDown(e) {
  if (e.key === 'Escape') {
    cerrarMenuContexto()
  }
}

function abrirMenuContexto(e, mesa) {
  if (!props.esAdmin) return
  const menuW = 264
  const menuH = 290
  const maxX = typeof window !== 'undefined' ? window.innerWidth - menuW - 12 : e.clientX
  const maxY = typeof window !== 'undefined' ? window.innerHeight - menuH - 12 : e.clientY

  menuContexto.value = {
    abierto: true,
    x: Math.max(12, Math.min(e.clientX, maxX)),
    y: Math.max(12, Math.min(e.clientY, maxY)),
    mesaId: mesa.id,
  }

  window.removeEventListener('pointerdown', onOutsideContextClick)
  window.removeEventListener('keydown', onContextKeyDown)
  window.addEventListener('pointerdown', onOutsideContextClick)
  window.addEventListener('keydown', onContextKeyDown)
}

function setCapacidadContexto(cant) {
  if (!mesaMenuContexto.value) return
  mesaMenuContexto.value.capacidad = Math.max(1, Math.min(20, Number(cant) || 4))
  hayCambiosPendientes.value = true
}

function setFormaContexto(forma) {
  if (!mesaMenuContexto.value) return
  mesaMenuContexto.value.forma = forma
  hayCambiosPendientes.value = true
}

function setNumeroManualContexto(valor) {
  if (!mesaMenuContexto.value) return
  const txt = String(valor ?? '').trim()
  if (!txt) {
    mesaMenuContexto.value.numeroManual = null
  } else {
    const num = Number(txt)
    if (Number.isInteger(num) && num > 0) {
      mesaMenuContexto.value.numeroManual = num
      mesaMenuContexto.value.numero = num
    }
  }
  recalcularNumeracionAutomatica()
  hayCambiosPendientes.value = true
}

function eliminarDesdeContexto() {
  if (!mesaMenuContexto.value) return
  const id = mesaMenuContexto.value.id
  cerrarMenuContexto()
  eliminarMesa(id)
}

function verComandaDesdeContexto() {
  if (!mesaMenuContexto.value) return
  const num = mesaMenuContexto.value.numero
  cerrarMenuContexto()
  emit('seleccionar-mesa', num)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header del Plano con Toggles de Vista y Botón Administrador -->
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#17120f] p-4 sm:p-5">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="font-serif text-xl sm:text-2xl font-bold text-white">
            {{ modoEdicion ? 'Editor del Salón y Mesas' : 'Plano interactivo del local' }}
          </h2>
          <span
            v-if="modoEdicion"
            class="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
            <Pencil :size="12" /> Modo Edición
          </span>
        </div>
        <p class="mt-1 text-xs text-stone-400">
          {{ modoEdicion
            ? 'Arrastrá mesas o la Caja libremente. Modificá la forma del local y los números según tu negocio.'
            : esAdmin
              ? 'Hacé clic en una mesa para ver su comanda, arrastrá para reubicar o clic derecho para editarla.'
              : 'Hacé clic sobre cualquier mesa para abrir su comanda y cobrar en caja.' }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Selector Plano vs Cuadrícula (solo en modo normal) -->
        <div v-if="!modoEdicion" class="flex rounded-xl border border-stone-800 bg-[#110d0b] p-1">
          <button
            type="button"
            @click="modoVista = 'plano'"
            :class="modoVista === 'plano' ? 'bg-[#221a15] text-[#e58a4e] font-bold shadow' : 'text-stone-400 hover:text-white'"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition">
            <Layers :size="14" />
            <span>Plano del Salón</span>
          </button>
          <button
            type="button"
            @click="modoVista = 'grid'"
            :class="modoVista === 'grid' ? 'bg-[#221a15] text-[#e58a4e] font-bold shadow' : 'text-stone-400 hover:text-white'"
            class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition">
            <LayoutGrid :size="14" />
            <span>Cuadrícula</span>
          </button>
        </div>

        <!-- Botón EXCLUSIVO para Administradores: Modificar Mapa -->
        <button
          v-if="esAdmin && !modoEdicion"
          type="button"
          @click="toggleModoEdicion"
          class="inline-flex items-center gap-2 rounded-xl border border-[#e58a4e]/50 bg-[#e58a4e]/15 px-3.5 py-2 text-xs font-bold text-[#e58a4e] transition hover:bg-[#e58a4e] hover:text-[#190d05]">
          <Pencil :size="14" />
          <span>Modificar mapa</span>
        </button>

        <!-- Botón Guardar en Modo Edición -->
        <template v-if="modoEdicion">
          <button
            type="button"
            @click="guardarMapa"
            class="inline-flex items-center gap-1.5 rounded-xl bg-[#e58a4e] px-4 py-2 text-xs font-bold text-[#190d05] shadow-lg shadow-[#e58a4e]/20 transition hover:bg-[#f09559]">
            <Save :size="14" />
            <span>Guardar cambios</span>
          </button>
          <button
            type="button"
            @click="toggleModoEdicion"
            class="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-800/80 px-3.5 py-2 text-xs font-medium text-stone-300 transition hover:bg-stone-700 hover:text-white">
            <X :size="14" />
            <span>Salir</span>
          </button>
        </template>
      </div>
    </div>

    <!-- Barra de Herramientas de Edición (visible SOLO cuando el Administrador está en modo edición) -->
    <div
      v-if="modoEdicion && esAdmin"
      class="rounded-2xl border border-amber-500/30 bg-[#1c1611] p-4 sm:p-5 shadow-xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <!-- Selector de Forma del Local -->
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-[#e58a4e]">
            1. Forma del Local
          </label>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="forma in formasLocalDisponibles"
              :key="forma.id"
              type="button"
              @click="aplicarPresetForma(forma.id)"
              :class="configLocal.formaLocal === forma.id
                ? 'border-[#e58a4e] bg-[#2d1f16] text-[#e58a4e] font-bold shadow'
                : 'border-stone-800 bg-[#14100d] text-stone-300 hover:border-stone-700'"
              class="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition">
              <span class="h-2 w-2 rounded-full" :class="configLocal.formaLocal === forma.id ? 'bg-[#e58a4e]' : 'bg-stone-600'" />
              <span>{{ forma.label }}</span>
            </button>
          </div>
        </div>

        <!-- Acciones Rápidas del Mapa -->
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-[#e58a4e]">
            2. Mesas y Distribución
          </label>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              @click="abrirFormNuevaMesa"
              :class="mostrarFormNuevaMesa ? 'bg-emerald-600 text-white border-emerald-500' : 'border-emerald-600/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/50'"
              class="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition">
              <Plus :size="14" />
              <span>Agregar mesa</span>
            </button>

            <button
              type="button"
              @click="autoNumerarTodasPorCercania"
              title="Ordena las mesas de 1 a N según su distancia a la caja"
              class="inline-flex items-center gap-1.5 rounded-xl border border-sky-600/40 bg-sky-950/30 px-3 py-2 text-xs font-bold text-sky-300 transition hover:bg-sky-900/50">
              <Sparkles :size="14" />
              <span>Auto-numerar por cercanía a caja</span>
            </button>

            <button
              type="button"
              @click="restablecerPorDefecto"
              title="Vuelve al mapa inicial"
              class="inline-flex items-center gap-1.5 rounded-xl border border-stone-800 bg-[#14100d] px-3 py-2 text-xs font-semibold text-stone-400 transition hover:text-stone-200">
              <RotateCcw :size="13" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Desplegable de configuración para nueva mesa -->
      <div
        v-if="mostrarFormNuevaMesa"
        class="rounded-xl border border-emerald-500/40 bg-[#141a15] p-4 space-y-3 text-xs">
        <div class="flex items-center justify-between gap-2">
          <p class="font-bold text-emerald-300">Configurar nueva mesa</p>
          <button
            type="button"
            @click="mostrarFormNuevaMesa = false"
            class="text-stone-400 hover:text-white">
            <X :size="14" />
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <!-- Cantidad de personas -->
          <div class="flex flex-wrap items-center gap-2">
            <label class="text-stone-300 font-semibold">Cantidad de personas:</label>
            <div class="flex items-center gap-1">
              <button
                v-for="cant in [2, 4, 6, 8]"
                :key="cant"
                type="button"
                @click="nuevaMesaForm.capacidad = cant"
                :class="nuevaMesaForm.capacidad === cant ? 'bg-emerald-500 text-[#0d1912] font-bold' : 'border border-stone-700 bg-[#110d0b] text-stone-300 hover:border-stone-500'"
                class="rounded-lg px-2.5 py-1 text-xs transition">
                {{ cant }}p
              </button>
            </div>
            <input
              v-model.number="nuevaMesaForm.capacidad"
              type="number"
              min="1"
              max="20"
              aria-label="Cantidad de personas"
              class="w-16 rounded-lg border border-stone-700 bg-[#110d0b] px-2.5 py-1 text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>

          <!-- Forma -->
          <div class="flex items-center gap-2">
            <label class="text-stone-300">Forma:</label>
            <div class="flex rounded-lg border border-stone-700 bg-[#110d0b] p-0.5">
              <button
                type="button"
                @click="nuevaMesaForm.forma = 'cuadrada'"
                :class="nuevaMesaForm.forma === 'cuadrada' ? 'bg-[#2d1f16] text-[#e58a4e] font-bold' : 'text-stone-400'"
                class="rounded-md px-2.5 py-1 text-[11px] transition">
                Cuadrada
              </button>
              <button
                type="button"
                @click="nuevaMesaForm.forma = 'redonda'"
                :class="nuevaMesaForm.forma === 'redonda' ? 'bg-[#2d1f16] text-[#e58a4e] font-bold' : 'text-stone-400'"
                class="rounded-md px-2.5 py-1 text-[11px] transition">
                Redonda
              </button>
            </div>
          </div>

          <!-- Número opcional -->
          <div class="flex items-center gap-2">
            <label class="text-stone-300">Número (opcional):</label>
            <input
              v-model="nuevaMesaForm.numeroManual"
              type="number"
              min="1"
              max="999"
              placeholder="Auto"
              class="w-20 rounded-lg border border-stone-700 bg-[#110d0b] px-2.5 py-1 text-xs text-white outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button
            type="button"
            @click="mostrarFormNuevaMesa = false"
            class="rounded-xl border border-stone-700 bg-stone-800/80 px-3 py-1.5 text-xs font-medium text-stone-300 hover:text-white">
            Cancelar
          </button>
          <button
            type="button"
            @click="confirmarAgregarMesa"
            class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-[#0d1912] transition hover:bg-emerald-400">
            <Check :size="14" />
            <span>Crear mesa</span>
          </button>
        </div>
      </div>

      <!-- Ayuda informativa de uso -->
      <div class="flex items-start gap-2.5 rounded-xl border border-white/5 bg-[#14100d] p-3 text-xs text-stone-400">
        <Info :size="16" class="mt-0.5 shrink-0 text-[#e58a4e]" />
        <p class="leading-relaxed">
          <b class="text-stone-200">¿Cómo funciona?</b> Arrastrá cualquier mesa o la Caja a la posición exacta que desees.
          Si no colocás un número manual a una mesa, el sistema le asignará automáticamente un número en base a su cercanía a la Caja (la más cercana recibe el número 1).
        </p>
      </div>
    </div>

    <!-- Inspector lateral / Panel de configuración de la mesa activa en modo edición -->
    <div
      v-if="modoEdicion && mesaEditando"
      class="space-y-4 rounded-2xl border border-[#e58a4e]/40 bg-[#1f1712] p-4 text-xs">
      <!-- Selector rápido de mesas -->
      <div>
        <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-400">
          Elegí una mesa para configurar ({{ configLocal.mesas.length }} en total)
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="m in configLocal.mesas"
            :key="m.id"
            type="button"
            @click="mesaEditandoId = m.id"
            :class="mesaEditandoId === m.id
              ? 'bg-[#e58a4e] text-[#190d05] font-bold shadow'
              : 'border border-stone-700 bg-[#14100d] text-stone-300 hover:border-stone-500'"
            class="rounded-lg px-2.5 py-1 text-xs transition">
            Mesa {{ m.numero }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-3">
        <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e58a4e] font-bold text-[#190d05]">
            {{ mesaEditando.numero }}
          </span>
          <div>
            <p class="font-bold text-white">Configuración de Mesa {{ mesaEditando.numero }}</p>
            <p class="text-[11px] text-stone-400">
              Distancia a la Caja: <b class="text-amber-300">~{{ distanciaMesaEditando }}%</b>
              <span v-if="mesaEditando.numeroManual" class="text-sky-300 ml-1.5 font-semibold">
                (Número manual fijo: {{ mesaEditando.numeroManual }})
              </span>
              <span v-else class="text-emerald-400 ml-1.5 font-semibold">
                (Automático por proximidad)
              </span>
            </p>
          </div>
        </div>

        <!-- Input de Número Personalizado -->
        <div class="flex items-center gap-2">
          <label class="text-stone-300 whitespace-nowrap">Número de mesa:</label>
          <input
            :value="mesaEditando.numeroManual ?? ''"
            @input="actualizarNumeroManual($event.target.value)"
            type="number"
            min="1"
            max="999"
            placeholder="Auto"
            class="w-24 rounded-xl border border-stone-700 bg-[#14100d] px-3 py-1.5 text-xs text-white outline-none focus:border-[#e58a4e]"
          />
          <button
            v-if="mesaEditando.numeroManual"
            type="button"
            @click="actualizarNumeroManual('')"
            class="text-[11px] text-stone-400 underline hover:text-[#e58a4e]">
            Dejar en automático
          </button>
        </div>

        <!-- Forma de la mesa -->
        <div class="flex items-center gap-2">
          <label class="text-stone-300">Forma:</label>
          <div class="flex rounded-lg border border-stone-700 bg-[#14100d] p-0.5">
            <button
              type="button"
              @click="mesaEditando.forma = 'cuadrada'; hayCambiosPendientes = true"
              :class="mesaEditando.forma === 'cuadrada' ? 'bg-[#2d1f16] text-[#e58a4e] font-bold' : 'text-stone-400'"
              class="rounded-md px-2.5 py-1 text-[11px] transition">
              Cuadrada
            </button>
            <button
              type="button"
              @click="mesaEditando.forma = 'redonda'; hayCambiosPendientes = true"
              :class="mesaEditando.forma === 'redonda' ? 'bg-[#2d1f16] text-[#e58a4e] font-bold' : 'text-stone-400'"
              class="rounded-md px-2.5 py-1 text-[11px] transition">
              Redonda
            </button>
          </div>
        </div>

        <!-- Capacidad -->
        <div class="flex items-center gap-2">
          <label class="text-stone-300">Capacidad:</label>
          <select
            v-model.number="mesaEditando.capacidad"
            @change="hayCambiosPendientes = true"
            class="rounded-xl border border-stone-700 bg-[#14100d] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#e58a4e]">
            <option :value="2">2 personas</option>
            <option :value="4">4 personas</option>
            <option :value="6">6 personas</option>
            <option :value="8">8 personas</option>
          </select>
        </div>
      </div>

      <!-- Eliminar Mesa -->
      <button
        type="button"
        @click="eliminarMesa(mesaEditando.id)"
        class="inline-flex items-center gap-1.5 rounded-xl border border-rose-900/50 bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-900/60">
        <Trash2 :size="13" />
        <span>Eliminar esta mesa</span>
      </button>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 1. VISTA PLANO DEL SALÓN (Arquitectónico con Drag & Drop y Formas)       -->
    <!-- ========================================================================= -->
    <div
      v-if="!modoEdicion && modoVista === 'plano'"
      class="relative overflow-hidden rounded-3xl border border-white/5 bg-[#120e0b] p-4 sm:p-6 shadow-2xl">
      <!-- Indicador de Referencias en la parte superior del canvas -->
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-stone-400">
        <div class="flex flex-wrap items-center gap-4">
          <span class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded-md border border-[#204933] bg-[#163223]" />
            <span>Mesa Libre</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded-md border-2 border-[#d97736] bg-[#3a1e14]" />
            <span>Mesa Ocupada</span>
          </span>
          <span class="flex items-center gap-1.5 text-amber-300">
            <CircleDollarSign :size="14" class="text-amber-400" />
            <span>Punto de Caja / Cobro</span>
          </span>
        </div>

        <div class="flex items-center gap-2 text-[11px] text-stone-500">
          <span>Forma: <b class="text-stone-300 capitalize">{{ configLocal.formaLocal.replace('_', ' ') }}</b></span>
          <span>·</span>
          <span>{{ configLocal.mesas.length }} mesas activas</span>
        </div>
      </div>

      <!-- Barra de acciones en lote cuando hay mesas seleccionadas (estilo Windows) -->
      <div
        v-if="esAdmin && mesasSeleccionadasIds.length > 0"
        class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-500/40 bg-sky-950/25 px-4 py-2.5 text-xs">
        <div class="flex flex-wrap items-center gap-3">
          <span class="rounded-lg bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-[#091521]">
            {{ mesasSeleccionadasIds.length }} {{ mesasSeleccionadasIds.length === 1 ? 'mesa seleccionada' : 'mesas seleccionadas' }}
          </span>
          <span class="text-stone-400 hidden sm:inline">Arrastrá cualquiera para moverlas juntas o editá en lote:</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Cambiar cantidad de personas a todas -->
          <div class="flex items-center gap-1 rounded-xl border border-stone-700/80 bg-[#110d0b] px-2 py-1">
            <span class="text-[11px] text-stone-400 mr-1">Personas:</span>
            <button
              v-for="cant in [2, 4, 6, 8]"
              :key="cant"
              type="button"
              @click="aplicarCapacidadLote(cant)"
              class="rounded-md px-2 py-0.5 text-[11px] font-semibold text-stone-200 transition hover:bg-sky-500 hover:text-[#091521]">
              {{ cant }}p
            </button>
            <input
              v-model.number="capacidadLote"
              type="number"
              min="1"
              max="20"
              aria-label="Personas en lote"
              class="ml-1 w-12 rounded-md border border-stone-700 bg-[#17120f] px-1.5 py-0.5 text-[11px] text-white outline-none focus:border-sky-400"
            />
            <button
              type="button"
              @click="aplicarCapacidadLote(capacidadLote)"
              class="rounded-md bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-300 transition hover:bg-sky-500 hover:text-[#091521]">
              Aplicar
            </button>
          </div>

          <!-- Cambiar forma en lote -->
          <div class="flex items-center gap-1 rounded-xl border border-stone-700/80 bg-[#110d0b] p-0.5">
            <button
              type="button"
              @click="aplicarFormaLote('cuadrada')"
              class="rounded-lg px-2 py-1 text-[11px] text-stone-300 transition hover:bg-[#2d1f16] hover:text-[#e58a4e]">
              Cuadradas
            </button>
            <button
              type="button"
              @click="aplicarFormaLote('redonda')"
              class="rounded-lg px-2 py-1 text-[11px] text-stone-300 transition hover:bg-[#2d1f16] hover:text-[#e58a4e]">
              Redondas
            </button>
          </div>

          <!-- Eliminar todas las seleccionadas -->
          <button
            type="button"
            @click="eliminarMesasSeleccionadas"
            class="inline-flex items-center gap-1 rounded-xl border border-rose-900/50 bg-rose-950/40 px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-900/70">
            <Trash2 :size="13" />
            <span>Eliminar</span>
          </button>

          <!-- Limpiar selección -->
          <button
            type="button"
            @click="limpiarSeleccion"
            title="Deseleccionar"
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-700 bg-[#110d0b] text-stone-400 transition hover:text-white">
            <X :size="14" />
          </button>
        </div>
      </div>

      <!-- CANVAS DEL PLANO -->
      <div
        ref="canvasRef"
        @pointerdown="iniciarSeleccionCaja"
        class="relative h-[560px] w-full select-none rounded-2xl border-2 border-stone-800/80 bg-[#17120f] overflow-hidden"
        :class="modoEdicion ? 'cursor-default ring-1 ring-amber-500/30' : ''">
        <!-- Recuadro de selección múltiple estilo Windows -->
        <div
          v-if="seleccionCaja.activa"
          :style="estiloSeleccionCaja"
          class="pointer-events-none absolute z-40 rounded-sm border border-sky-400 bg-sky-500/15"
        />
        <!-- Rejilla de fondo sutil estilo plano arquitectónico -->
        <div
          class="pointer-events-none absolute inset-0 opacity-[0.07]"
          style="background-size: 32px 32px; background-image: linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px);"
        />

        <!-- ================================================================= -->
        <!-- FORMA DEL LOCAL: ESTRUCTURAS Y PAREDES VISUALES                    -->
        <!-- ================================================================= -->

        <!-- CASO A: FORMA EN L (Salón en L con Ala Lateral y Área de Cocina/Depósito) -->
        <template v-if="configLocal.formaLocal === 'forma_l'">
          <!-- Área reservada / Bloque de Cocina y Barra (Sector superior derecho cortado) -->
          <div
            class="pointer-events-none absolute top-0 right-0 h-[52%] w-[42%] rounded-bl-3xl border-b-2 border-l-2 border-dashed border-stone-700/60 bg-[#0d0a08]/90 p-4 flex flex-col justify-between">
            <div class="flex items-center gap-2 text-stone-500 font-bold text-[11px] uppercase tracking-wider">
              <Store :size="14" class="text-stone-400" />
              <span>Cocina y Barra Interna</span>
            </div>
            <p class="text-[10px] text-stone-600 leading-tight">
              Área de servicio no accesible a mesas (Corte en L)
            </p>
          </div>

          <!-- Rótulo de Salón Principal (Ala izquierda) -->
          <div class="pointer-events-none absolute bottom-4 left-6 text-[11px] font-bold uppercase tracking-widest text-stone-600/70">
            Salón Principal
          </div>
          <!-- Rótulo de Ala Lateral (Parte inferior derecha) -->
          <div class="pointer-events-none absolute bottom-4 right-8 text-[11px] font-bold uppercase tracking-widest text-stone-600/70">
            Ala Lateral
          </div>
        </template>

        <!-- CASO B: FORMA EN U (Patio central / Barra en el medio) -->
        <template v-if="configLocal.formaLocal === 'forma_u'">
          <div
            class="pointer-events-none absolute top-0 left-[34%] h-[48%] w-[32%] rounded-b-3xl border-b-2 border-x-2 border-dashed border-stone-700/60 bg-[#0d0a08]/90 p-4 text-center flex flex-col items-center justify-center">
            <span class="text-[11px] font-bold uppercase tracking-wider text-stone-500">Patio Central</span>
            <p class="text-[10px] text-stone-600 mt-1">Espacio al aire libre / Barra</p>
          </div>
          <div class="pointer-events-none absolute bottom-4 left-8 text-[11px] font-bold uppercase tracking-widest text-stone-600/70">
            Ala Oeste
          </div>
          <div class="pointer-events-none absolute bottom-4 right-8 text-[11px] font-bold uppercase tracking-widest text-stone-600/70">
            Ala Este
          </div>
        </template>

        <!-- CASO C: SALÓN + TERRAZA -->
        <template v-if="configLocal.formaLocal === 'con_terraza'">
          <!-- Línea divisoria de ventanal -->
          <div class="pointer-events-none absolute top-0 bottom-0 left-[60%] border-r-2 border-dashed border-sky-700/40" />
          <div class="pointer-events-none absolute top-4 left-6 text-[11px] font-bold uppercase tracking-widest text-stone-500">
            Salón Interior Climatizado
          </div>
          <div class="pointer-events-none absolute top-4 right-6 text-[11px] font-bold uppercase tracking-widest text-sky-400/70">
            Terraza al Aire Libre
          </div>
        </template>

        <!-- CASO D: RECTANGULAR ESTÁNDAR -->
        <template v-if="configLocal.formaLocal === 'rectangular'">
          <div class="pointer-events-none absolute bottom-4 left-6 text-[11px] font-bold uppercase tracking-widest text-stone-600/70">
            Salón Principal Abierto
          </div>
        </template>

        <!-- Marcador de Entrada / Acceso Principal -->
        <div class="pointer-events-none absolute bottom-0 left-[45%] -translate-x-1/2 rounded-t-lg border-t-2 border-x-2 border-stone-700 bg-stone-900/90 px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest text-stone-400">
          Entrada Principal
        </div>

        <!-- ================================================================= -->
        <!-- PUNTO DE CAJA / COBRO (Arrastrable por el administrador)          -->
        <!-- ================================================================= -->
        <div
          :style="{
            left: `${configLocal.caja.x}%`,
            top: `${configLocal.caja.y}%`,
            transform: 'translate(-50%, -50%)',
          }"
          @pointerdown.stop="(e) => iniciarArrastre(e, 'caja', configLocal.caja)"
          :class="[
            esAdmin ? 'cursor-grab active:cursor-grabbing' : '',
            modoEdicion ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#17120f]' : ''
          ]"
          class="absolute z-20 flex items-center gap-2 rounded-2xl border-2 border-amber-500/60 bg-[#2b1f13] px-3.5 py-2 shadow-xl shadow-amber-950/40 transition-transform">
          <div class="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500 text-[#190d05]">
            <CircleDollarSign :size="16" class="stroke-[2.5]" />
          </div>
          <div>
            <span class="block text-[10px] font-extrabold uppercase tracking-widest text-amber-300">
              {{ configLocal.caja.nombre || 'Caja' }}
            </span>
            <span v-if="modoEdicion" class="block text-[9px] font-medium text-amber-200/80">
              (Arrastrar para mover)
            </span>
          </div>
        </div>

        <!-- ================================================================= -->
        <!-- MESAS INTERACTIVAS (Arrastrables por admin, seleccionables)       -->
        <!-- ================================================================= -->
        <div
          v-for="mesa in mesasParaRender"
          :key="mesa.id"
          :style="{
            left: `${mesa.x}%`,
            top: `${mesa.y}%`,
            transform: 'translate(-50%, -50%)',
            width: mesa.capacidad >= 6 ? '84px' : mesa.capacidad === 2 ? '56px' : '68px',
            height: mesa.capacidad >= 6 ? '64px' : mesa.capacidad === 2 ? '56px' : '68px',
          }"
          @pointerdown.stop="(e) => iniciarArrastre(e, 'mesa', mesa)"
          @click="manejarClicMesa($event, mesa)"
          @contextmenu.prevent="abrirMenuContexto($event, mesa)"
          :class="[
            mesa.forma === 'redonda' ? 'rounded-full' : 'rounded-2xl',
            mesasSeleccionadasIds.includes(mesa.id) ? 'ring-4 ring-sky-400 ring-offset-2 ring-offset-[#0c0a09] scale-105 z-30' : '',
            !mesasSeleccionadasIds.includes(mesa.id) && selectedTable === mesa.numero && !modoEdicion ? 'ring-4 ring-[#e58a4e] ring-offset-2 ring-offset-[#0c0a09] scale-105 z-30' : 'z-10',
            modoEdicion && mesaEditandoId === mesa.id ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-[#0c0a09] scale-105 z-30' : '',
            esAdmin ? 'cursor-grab active:cursor-grabbing hover:scale-105' : 'cursor-pointer hover:scale-105',
            mesa.ocupada
              ? 'bg-[#3a1e14] border-2 border-[#d97736] text-white shadow-lg shadow-orange-950/40'
              : 'bg-[#163223] border border-[#204933] text-[#e6f4ec] hover:border-[#32694b]'
          ]"
          class="absolute flex flex-col items-center justify-center p-2 transition-transform duration-150">
          
          <!-- Sillas decorativas alrededor de la mesa (arquitectura realista) -->
          <span
            v-if="mesa.capacidad >= 2"
            class="pointer-events-none absolute -top-1.5 h-1.5 w-6 rounded-full bg-stone-700/80"
          />
          <span
            v-if="mesa.capacidad >= 2"
            class="pointer-events-none absolute -bottom-1.5 h-1.5 w-6 rounded-full bg-stone-700/80"
          />
          <span
            v-if="mesa.capacidad >= 4"
            class="pointer-events-none absolute -left-1.5 h-6 w-1.5 rounded-full bg-stone-700/80"
          />
          <span
            v-if="mesa.capacidad >= 4"
            class="pointer-events-none absolute -right-1.5 h-6 w-1.5 rounded-full bg-stone-700/80"
          />

          <!-- Contenido de la mesa -->
          <div class="flex items-center gap-1">
            <span class="font-serif text-lg sm:text-xl font-bold leading-none">
              {{ mesa.numero }}
            </span>
            <Bell v-if="mesa.ocupada" :size="12" class="text-[#f09559] animate-bounce" />
          </div>

          <!-- Total de comanda si está ocupada -->
          <span
            v-if="mesa.ocupada && mesa.comanda"
            class="mt-0.5 block text-[9px] font-bold tabular-nums text-[#f09559] leading-none">
            {{ formatPrice(mesa.comanda.total) }}
          </span>

          <!-- Capacidad si está libre -->
          <span
            v-else
            class="mt-0.5 block text-[9px] font-semibold text-[#4ade80]/90 leading-none">
            {{ mesa.capacidad }}p
          </span>

          <!-- Badge en modo edición para ver si es manual o auto -->
          <span
            v-if="modoEdicion && mesa.numeroManual"
            class="absolute -top-2 -right-1 rounded-full bg-sky-500 px-1 text-[8px] font-bold text-white leading-none">
            M
          </span>
        </div>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 2. VISTA CUADRÍCULA CLÁSICA (Alternativa para cuando no se usa el plano)  -->
    <!-- ========================================================================= -->
    <div
      v-else-if="!modoEdicion"
      class="rounded-3xl border border-white/5 bg-[#17120f] p-4 sm:p-7">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-serif text-xl sm:text-2xl font-bold text-white">Listado de mesas</h3>
        <div class="flex gap-4 text-xs font-semibold text-stone-400">
          <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-full bg-[#4ade80]" /> Libre</span>
          <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-full bg-[#e58a4e]" /> Ocupada</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <button
          v-for="mesa in mesasParaRender"
          :key="mesa.numero"
          type="button"
          @click="manejarClicMesa($event, mesa)"
          class="group relative flex min-h-28 sm:min-h-32 flex-col justify-between rounded-2xl p-3.5 sm:p-4 text-left transition duration-200"
          :class="[
            selectedTable === mesa.numero ? 'ring-2 ring-[#e58a4e] ring-offset-2 ring-offset-[#0c0a09]' : '',
            mesa.ocupada
              ? 'bg-[#3a1e14] border-2 border-[#d97736]'
              : 'bg-[#163223] border border-[#204933] hover:border-[#32694b]'
          ]">
          <div class="flex items-center justify-between w-full">
            <span
              class="text-[10px] font-bold uppercase tracking-widest"
              :class="mesa.ocupada ? 'text-[#f09559]' : 'text-[#4ade80]'">
              {{ mesa.ocupada ? 'Ocupada' : 'Libre' }}
            </span>
            <Bell v-if="mesa.ocupada" :size="15" class="text-[#f09559]" />
          </div>

          <div class="flex items-end justify-between gap-2 w-full">
            <span
              class="font-serif text-3xl font-bold"
              :class="mesa.ocupada ? 'text-white' : 'text-[#e6f4ec]'">
              {{ mesa.numero }}
            </span>
            <div v-if="mesa.ocupada && mesa.comanda" class="text-right">
              <span class="block text-[10px] font-semibold text-[#f09559]">
                #{{ mesa.comanda.numero_pedido }}
              </span>
              <span class="block text-xs font-bold tabular-nums text-white">
                {{ formatPrice(mesa.comanda.total) }}
              </span>
            </div>
            <span v-else class="text-[11px] font-medium text-stone-400">
              {{ mesa.capacidad || 4 }} pers.
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- MENÚ CONTEXTUAL ESTILO WINDOWS (Clic derecho sobre una mesa, solo admin)  -->
    <!-- ========================================================================= -->
    <div
      v-if="menuContexto.abierto && mesaMenuContexto && esAdmin"
      ref="contextMenuRef"
      :style="{ left: `${menuContexto.x}px`, top: `${menuContexto.y}px` }"
      @contextmenu.prevent
      class="fixed z-50 w-64 rounded-xl border border-stone-700/80 bg-[#1f1b18]/95 p-1.5 text-xs text-stone-200 shadow-2xl shadow-black/70 backdrop-blur-md">
      <!-- Fila superior compacta: personas y forma -->
      <div class="px-2 py-1.5 space-y-2">
        <div class="flex items-center justify-between text-[11px] text-stone-400">
          <span class="font-semibold text-stone-200">Mesa {{ mesaMenuContexto.numero }}</span>
          <span>{{ mesaMenuContexto.capacidad }} personas</span>
        </div>

        <div class="flex items-center gap-1">
          <button
            v-for="cant in [2, 4, 6, 8]"
            :key="cant"
            type="button"
            @click="setCapacidadContexto(cant)"
            :class="mesaMenuContexto.capacidad === cant ? 'bg-[#e58a4e] text-[#190d05] font-bold' : 'bg-white/5 text-stone-300 hover:bg-white/10'"
            class="flex-1 rounded-md py-1 text-[11px] transition">
            {{ cant }}p
          </button>
          <input
            :value="mesaMenuContexto.capacidad"
            @input="setCapacidadContexto($event.target.value)"
            type="number"
            min="1"
            max="20"
            aria-label="Cantidad de personas"
            class="w-11 rounded-md border border-stone-700 bg-[#14100d] px-1.5 py-1 text-center text-[11px] text-white outline-none focus:border-[#e58a4e]"
          />
        </div>
      </div>

      <div class="my-1 border-t border-white/10" />

      <!-- Forma -->
      <div class="flex items-center justify-between px-2 py-1">
        <span class="text-[11px] text-stone-400">Forma</span>
        <div class="flex rounded-md bg-white/5 p-0.5">
          <button
            type="button"
            @click="setFormaContexto('cuadrada')"
            :class="mesaMenuContexto.forma === 'cuadrada' ? 'bg-stone-700 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'"
            class="rounded px-2 py-0.5 text-[11px] transition">
            Cuadrada
          </button>
          <button
            type="button"
            @click="setFormaContexto('redonda')"
            :class="mesaMenuContexto.forma === 'redonda' ? 'bg-stone-700 text-white font-semibold' : 'text-stone-400 hover:text-stone-200'"
            class="rounded px-2 py-0.5 text-[11px] transition">
            Redonda
          </button>
        </div>
      </div>

      <!-- Número fijo vs automático por cercanía -->
      <div class="px-2 py-1.5 space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-[11px] text-stone-400">Número de mesa</span>
          <button
            v-if="mesaMenuContexto.numeroManual"
            type="button"
            @click="setNumeroManualContexto('')"
            class="text-[10px] font-semibold text-[#e58a4e] hover:underline">
            Auto (caja)
          </button>
        </div>
        <input
          :value="mesaMenuContexto.numeroManual ?? ''"
          @input="setNumeroManualContexto($event.target.value)"
          type="number"
          min="1"
          max="999"
          placeholder="Auto por cercanía a caja"
          class="w-full rounded-md border border-stone-700 bg-[#14100d] px-2.5 py-1 text-[11px] text-white outline-none focus:border-[#e58a4e]"
        />
      </div>

      <div class="my-1 border-t border-white/10" />

      <!-- Acciones estilo lista de Windows -->
      <button
        type="button"
        @click="verComandaDesdeContexto"
        class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-stone-200 transition hover:bg-white/10">
        <CircleDollarSign :size="14" class="text-[#e58a4e]" />
        <span>Ver comanda / cobrar</span>
      </button>

      <button
        type="button"
        @click="eliminarDesdeContexto"
        class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-rose-300 transition hover:bg-rose-500/15">
        <Trash2 :size="14" />
        <span>Eliminar mesa</span>
      </button>
    </div>

    <!-- ========================================================================= -->
    <!-- POPUP FLOTANTE DE CAMBIOS SIN GUARDAR (Cancelar / Guardar cambios)        -->
    <!-- ========================================================================= -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-4 opacity-0">
      <div
        v-if="hayCambiosPendientes && esAdmin"
        class="fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-[#e58a4e]/50 bg-[#1c1510]/95 px-4 py-3 shadow-2xl shadow-black/80 backdrop-blur-md">
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#e58a4e]/15 text-[#e58a4e]">
            <Move :size="16" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-xs font-bold text-white">Mapa modificado</p>
            <p class="truncate text-[11px] text-stone-400">Tenés cambios sin guardar</p>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            @click="cancelarCambios"
            class="rounded-xl border border-stone-700 bg-stone-800/90 px-3 py-2 text-xs font-semibold text-stone-300 transition hover:bg-stone-700 hover:text-white">
            Cancelar
          </button>
          <button
            type="button"
            @click="guardarMapa"
            class="inline-flex items-center gap-1.5 rounded-xl bg-[#e58a4e] px-3.5 py-2 text-xs font-bold text-[#190d05] shadow-lg shadow-[#e58a4e]/25 transition hover:bg-[#f09559]">
            <Save :size="14" />
            <span>Guardar cambios</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

