<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Pencil, Move, Plus, Trash2, Check, RotateCcw, Save, CircleDollarSign,
  Bell, Layers, LayoutGrid, Info, X, Sparkles, Sliders, CheckCircle2,
  Store, Users, AlertCircle, RefreshCw, Circle, Square, Triangle,
  PenTool, Undo2, Redo2, Eraser, Hand, Minus, Clock, CalendarCheck
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
  reservas: {
    type: Array,
    default: () => []
  },
  formatPrice: {
    type: Function,
    default: (val) => `$ ${Number(val || 0).toLocaleString('es-AR')}`
  }
})

const emit = defineEmits(['seleccionar-mesa', 'actualizar-mesas', 'notificar', 'modo-edicion'])

// Modo de visualización: 'plano' (arquitectónico interactivo) o 'grid' (cuadrícula clásica)
const modoVista = ref('plano')

// Modo edición (exclusivo para administradores)
const modoEdicion = ref(false)

watch(modoEdicion, (val) => {
  emit('modo-edicion', val)
})

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
  { id: 'cuadrada', label: 'Cuadrada', desc: 'Salón simétrico cuadrado' },
  { id: 'circular', label: 'Circular', desc: 'Salón redondo con mesas radiales' },
  { id: 'triangular', label: 'Triangular', desc: 'Salón en triángulo / esquina' },
  { id: 'forma_l', label: 'Forma en L', desc: 'Salón con pasillo / ala lateral' },
  { id: 'forma_u', label: 'Forma en U', desc: 'Salón con patio o barra central' },
  { id: 'con_terraza', label: 'Salón + Terraza', desc: 'Área interior y exterior' },
  { id: 'personalizada', label: 'Dibujar mapa', desc: 'Dibujá el plano a tu gusto' },
]

// Estado para dibujo geométrico del mapa (cuando formaLocal === 'personalizada')
const herramientaDibujo = ref('linea') // 'linea' | 'circulo' | 'mover'
const trazoEnCurso = ref(null) // { tipo: 'linea', x1, y1, x2, y2 } | { tipo: 'circulo', cx, cy, r, startClientX, startClientY, rect }
const historialDeshacer = ref([])
const historialRehacer = ref([])
const canvasAspect = ref(1.5)
let canvasResizeObserver = null

const estaDibujandoMapa = computed(
  () => modoEdicion.value && configLocal.value.formaLocal === 'personalizada' && (herramientaDibujo.value === 'linea' || herramientaDibujo.value === 'circulo')
)

function actualizarCanvasAspect() {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (rect && rect.width > 0 && rect.height > 0) {
    canvasAspect.value = rect.width / rect.height
  }
}

watch(canvasRef, (el) => {
  if (canvasResizeObserver) {
    canvasResizeObserver.disconnect()
    canvasResizeObserver = null
  }
  if (el && typeof ResizeObserver !== 'undefined') {
    actualizarCanvasAspect()
    canvasResizeObserver = new ResizeObserver(() => actualizarCanvasAspect())
    canvasResizeObserver.observe(el)
  }
})

function puntosASvgPath(puntos = [], cerrado = false) {
  if (!Array.isArray(puntos) || puntos.length === 0) return ''
  const comandos = puntos.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${Number(p.x).toFixed(2)} ${Number(p.y).toFixed(2)}`)
  return cerrado && puntos.length >= 3 ? `${comandos.join(' ')} Z` : comandos.join(' ')
}

function obtenerCoordPorcentaje(e) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !rect.width || !rect.height) return null
  const x = Math.min(99, Math.max(1, ((e.clientX - rect.left) / rect.width) * 100))
  const y = Math.min(99, Math.max(1, ((e.clientY - rect.top) / rect.height) * 100))
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }
}

function buscarSnapVertice(pt, umbral = 2.2) {
  const trazos = configLocal.value.dibujoPersonalizado || []
  let mejor = null
  let mejorDist = umbral
  for (const t of trazos) {
    if (t.tipo !== 'linea') continue
    const extremos = [
      { x: t.x1, y: t.y1 },
      { x: t.x2, y: t.y2 },
    ]
    for (const ext of extremos) {
      const d = Math.hypot(pt.x - ext.x, pt.y - ext.y)
      if (d < mejorDist) {
        mejorDist = d
        mejor = ext
      }
    }
  }
  return mejor ? { x: mejor.x, y: mejor.y } : pt
}

function calcularLineaRectaConSnap(x1, y1, ptRaw, rect, forzar45 = false) {
  // Primero intentar encajar con vértice existente para unir paredes perfectamente
  const snapVert = buscarSnapVertice(ptRaw)
  if (snapVert !== ptRaw && (snapVert.x !== x1 || snapVert.y !== y1)) {
    return snapVert
  }

  const dxPx = ((ptRaw.x - x1) / 100) * rect.width
  const dyPx = ((ptRaw.y - y1) / 100) * rect.height
  const absDx = Math.abs(dxPx)
  const absDy = Math.abs(dyPx)

  if (absDx < 1 && absDy < 1) {
    return ptRaw
  }

  // Encaje automático a horizontal o vertical perfecto (tolerancia ~6 grados)
  const tan6 = 0.1051
  if (absDy <= absDx * tan6) {
    return { x: ptRaw.x, y: y1 }
  }
  if (absDx <= absDy * tan6) {
    return { x: x1, y: ptRaw.y }
  }

  // Con Shift presionado, encajar a ángulos de 45 grados exactos
  if (forzar45) {
    const angulo = Math.atan2(dyPx, dxPx)
    const paso = Math.PI / 4
    const anguloSnap = Math.round(angulo / paso) * paso
    const distPx = Math.hypot(dxPx, dyPx)
    const nx = x1 + ((Math.cos(anguloSnap) * distPx) / rect.width) * 100
    const ny = y1 + ((Math.sin(anguloSnap) * distPx) / rect.height) * 100
    return {
      x: Number(Math.min(99, Math.max(1, nx)).toFixed(2)),
      y: Number(Math.min(99, Math.max(1, ny)).toFixed(2)),
    }
  }

  return ptRaw
}

function guardarSnapshotHistorial() {
  const copia = JSON.parse(JSON.stringify(configLocal.value.dibujoPersonalizado || []))
  historialDeshacer.value.push(copia)
  if (historialDeshacer.value.length > 50) {
    historialDeshacer.value.shift()
  }
  historialRehacer.value = []
}

function iniciarDibujoTrazo(e) {
  if (!estaDibujandoMapa.value) return
  if (e.button !== undefined && e.button !== 0) return
  const rect = canvasRef.value?.getBoundingClientRect()
  const pt = obtenerCoordPorcentaje(e)
  if (!rect || !pt) return
  actualizarCanvasAspect()

  if (herramientaDibujo.value === 'linea') {
    const inicio = buscarSnapVertice(pt)
    trazoEnCurso.value = {
      tipo: 'linea',
      x1: inicio.x,
      y1: inicio.y,
      x2: inicio.x,
      y2: inicio.y,
      rect,
    }
  } else if (herramientaDibujo.value === 'circulo') {
    trazoEnCurso.value = {
      tipo: 'circulo',
      cx: pt.x,
      cy: pt.y,
      r: 0,
      startClientX: e.clientX,
      startClientY: e.clientY,
      rect,
    }
  }

  window.addEventListener('pointermove', onDibujoMove)
  window.addEventListener('pointerup', onDibujoUp)
}

function onDibujoMove(e) {
  if (!trazoEnCurso.value) return
  const actual = trazoEnCurso.value

  if (actual.tipo === 'linea') {
    const pt = obtenerCoordPorcentaje(e)
    if (!pt) return
    const p2 = calcularLineaRectaConSnap(actual.x1, actual.y1, pt, actual.rect, e.shiftKey)
    actual.x2 = p2.x
    actual.y2 = p2.y
  } else if (actual.tipo === 'circulo') {
    const distPx = Math.hypot(e.clientX - actual.startClientX, e.clientY - actual.startClientY)
    const r = (distPx / actual.rect.height) * 100
    actual.r = Number(Math.min(48, Math.max(0, r)).toFixed(2))
  }
}

function onDibujoUp() {
  if (trazoEnCurso.value) {
    const actual = trazoEnCurso.value
    let nuevoElemento = null

    if (actual.tipo === 'linea') {
      const largo = Math.hypot(actual.x2 - actual.x1, actual.y2 - actual.y1)
      if (largo >= 1.5) {
        nuevoElemento = {
          tipo: 'linea',
          x1: actual.x1,
          y1: actual.y1,
          x2: actual.x2,
          y2: actual.y2,
        }
      }
    } else if (actual.tipo === 'circulo') {
      if (actual.r >= 2) {
        nuevoElemento = {
          tipo: 'circulo',
          cx: actual.cx,
          cy: actual.cy,
          r: actual.r,
        }
      }
    }

    if (nuevoElemento) {
      if (!Array.isArray(configLocal.value.dibujoPersonalizado)) {
        configLocal.value.dibujoPersonalizado = []
      }
      guardarSnapshotHistorial()
      configLocal.value.dibujoPersonalizado.push(nuevoElemento)
      hayCambiosPendientes.value = true

      // Si cerró un polígono o dibujó un círculo, adaptar mesas automáticamente dentro del lugar
      if (nuevoElemento.tipo === 'circulo') {
        adaptarMesasAlDibujo(true)
      } else if (nuevoElemento.tipo === 'linea') {
        const { poligonos } = extraerRegionesDibujo()
        if (poligonos.length > 0 && verificarSiCerroPoligono(nuevoElemento)) {
          adaptarMesasAlDibujo(true)
        }
      }
    }
  }
  trazoEnCurso.value = null
  window.removeEventListener('pointermove', onDibujoMove)
  window.removeEventListener('pointerup', onDibujoUp)
}

function deshacerUltimoTrazo() {
  if (historialDeshacer.value.length > 0) {
    const actual = JSON.parse(JSON.stringify(configLocal.value.dibujoPersonalizado || []))
    historialRehacer.value.push(actual)
    configLocal.value.dibujoPersonalizado = historialDeshacer.value.pop()
    hayCambiosPendientes.value = true
    return
  }
  if (Array.isArray(configLocal.value.dibujoPersonalizado) && configLocal.value.dibujoPersonalizado.length > 0) {
    const actual = JSON.parse(JSON.stringify(configLocal.value.dibujoPersonalizado))
    historialRehacer.value.push(actual)
    configLocal.value.dibujoPersonalizado.pop()
    hayCambiosPendientes.value = true
  }
}

function rehacerTrazo() {
  if (historialRehacer.value.length === 0) return
  const actual = JSON.parse(JSON.stringify(configLocal.value.dibujoPersonalizado || []))
  historialDeshacer.value.push(actual)
  configLocal.value.dibujoPersonalizado = historialRehacer.value.pop()
  hayCambiosPendientes.value = true
}

function limpiarDibujoPersonalizado() {
  if (!Array.isArray(configLocal.value.dibujoPersonalizado) || configLocal.value.dibujoPersonalizado.length === 0) return
  guardarSnapshotHistorial()
  configLocal.value.dibujoPersonalizado = []
  hayCambiosPendientes.value = true
}

function distanciaPuntoASegmento(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function puntoEnPoligono(x, y, poly) {
  let dentro = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const intersecta = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi
    if (intersecta) dentro = !dentro
  }
  return dentro
}

function extraerRegionesDibujo(trazos = configLocal.value.dibujoPersonalizado) {
  const lista = Array.isArray(trazos) ? trazos : []
  const poligonos = []
  const circulos = []
  const segmentos = []

  for (const t of lista) {
    if (t.tipo === 'circulo' && t.r > 0) {
      circulos.push({
        cx: t.cx,
        cy: t.cy,
        rx: t.r / (canvasAspect.value || 1.5),
        ry: t.r,
      })
    } else if (t.tipo === 'linea') {
      segmentos.push({ x1: t.x1, y1: t.y1, x2: t.x2, y2: t.y2 })
    } else if (Array.isArray(t.puntos) && t.puntos.length >= 3) {
      poligonos.push(t.puntos)
    }
  }

  // Encadenar segmentos de línea conectados (tolerancia 3.5% para cerrar pequeñas brechas)
  const usados = new Array(segmentos.length).fill(false)
  const tol = 3.5
  for (let i = 0; i < segmentos.length; i++) {
    if (usados[i]) continue
    usados[i] = true
    const cadena = [
      { x: segmentos[i].x1, y: segmentos[i].y1 },
      { x: segmentos[i].x2, y: segmentos[i].y2 },
    ]

    let progreso = true
    while (progreso) {
      progreso = false
      const fin = cadena[cadena.length - 1]
      for (let j = 0; j < segmentos.length; j++) {
        if (usados[j]) continue
        const s = segmentos[j]
        if (Math.hypot(fin.x - s.x1, fin.y - s.y1) <= tol) {
          usados[j] = true
          cadena.push({ x: s.x2, y: s.y2 })
          progreso = true
          break
        }
        if (Math.hypot(fin.x - s.x2, fin.y - s.y2) <= tol) {
          usados[j] = true
          cadena.push({ x: s.x1, y: s.y1 })
          progreso = true
          break
        }
      }
    }

    if (cadena.length >= 3) {
      // Quitar último punto si coincide con el primero para evitar vértice duplicado
      const primero = cadena[0]
      const ultimo = cadena[cadena.length - 1]
      if (Math.hypot(primero.x - ultimo.x, primero.y - ultimo.y) <= tol && cadena.length > 3) {
        cadena.pop()
      }
      if (cadena.length >= 3) {
        poligonos.push(cadena)
      }
    }
  }

  return { poligonos, circulos }
}

const poligonosRellenoSvg = computed(() => {
  if (configLocal.value.formaLocal !== 'personalizada') return []
  const { poligonos } = extraerRegionesDibujo()
  return poligonos.map((poly) => poly.map((p) => `${p.x},${p.y}`).join(' '))
})

const circulosRellenoSvg = computed(() => {
  if (configLocal.value.formaLocal !== 'personalizada') return []
  const { circulos } = extraerRegionesDibujo()
  return circulos
})

const formaTieneContornoPropio = computed(() => {
  if (['cuadrada', 'circular', 'triangular'].includes(configLocal.value.formaLocal)) {
    return true
  }
  if (configLocal.value.formaLocal === 'personalizada') {
    return poligonosRellenoSvg.value.length > 0 || circulosRellenoSvg.value.length > 0
  }
  return false
})

function escalarDibujoAlLienzo() {
  const trazos = configLocal.value.dibujoPersonalizado || []
  if (trazos.length === 0) return

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const aspect = canvasAspect.value || 1.5

  for (const t of trazos) {
    if (t.tipo === 'linea') {
      minX = Math.min(minX, t.x1, t.x2)
      maxX = Math.max(maxX, t.x1, t.x2)
      minY = Math.min(minY, t.y1, t.y2)
      maxY = Math.max(maxY, t.y1, t.y2)
    } else if (t.tipo === 'circulo') {
      const rx = t.r / aspect
      minX = Math.min(minX, t.cx - rx)
      maxX = Math.max(maxX, t.cx + rx)
      minY = Math.min(minY, t.cy - t.r)
      maxY = Math.max(maxY, t.cy + t.r)
    } else if (Array.isArray(t.puntos)) {
      for (const p of t.puntos) {
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minY = Math.min(minY, p.y)
        maxY = Math.max(maxY, p.y)
      }
    }
  }

  const w = maxX - minX
  const h = maxY - minY
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 2 || h < 2) return

  // Si el dibujo ya ocupa casi todo el lienzo, no reescalar innecesariamente
  if (w >= 86 && h >= 84) return

  const tieneCirculos = trazos.some((t) => t.tipo === 'circulo')
  const margenX = 3
  const margenY = 4
  const targetW = 100 - margenX * 2
  const targetH = 100 - margenY * 2

  let tx
  let ty
  let scaleCirc = 1

  if (tieneCirculos) {
    const scale = Math.min(targetW / w, targetH / h)
    scaleCirc = scale
    const cxOrig = (minX + maxX) / 2
    const cyOrig = (minY + maxY) / 2
    tx = (x) => Number(Math.min(98, Math.max(2, 50 + (x - cxOrig) * scale)).toFixed(2))
    ty = (y) => Number(Math.min(98, Math.max(2, 50 + (y - cyOrig) * scale)).toFixed(2))
  } else {
    // Escalar polígonos para aprovechar todo el ancho y alto del mapa original
    const scaleX = targetW / w
    const scaleY = targetH / h
    tx = (x) => Number(Math.min(98, Math.max(2, margenX + (x - minX) * scaleX)).toFixed(2))
    ty = (y) => Number(Math.min(98, Math.max(2, margenY + (y - minY) * scaleY)).toFixed(2))
  }

  configLocal.value.dibujoPersonalizado = trazos.map((t) => {
    if (t.tipo === 'linea') {
      return { ...t, x1: tx(t.x1), y1: ty(t.y1), x2: tx(t.x2), y2: ty(t.y2) }
    }
    if (t.tipo === 'circulo') {
      return {
        ...t,
        cx: tx(t.cx),
        cy: ty(t.cy),
        r: Number(Math.min(46, t.r * scaleCirc).toFixed(2)),
      }
    }
    if (Array.isArray(t.puntos)) {
      return { ...t, puntos: t.puntos.map((p) => ({ x: tx(p.x), y: ty(p.y) })) }
    }
    return t
  })
}

function verificarSiCerroPoligono(nuevaLinea) {
  const trazos = configLocal.value.dibujoPersonalizado || []
  const otros = trazos.filter((t) => t !== nuevaLinea && t.tipo === 'linea')
  if (otros.length < 2) return false
  const tol = 3.5
  let tocaInicio = false
  let tocaFin = false
  for (const t of otros) {
    if (
      Math.hypot(nuevaLinea.x1 - t.x1, nuevaLinea.y1 - t.y1) <= tol ||
      Math.hypot(nuevaLinea.x1 - t.x2, nuevaLinea.y1 - t.y2) <= tol
    ) {
      tocaInicio = true
    }
    if (
      Math.hypot(nuevaLinea.x2 - t.x1, nuevaLinea.y2 - t.y1) <= tol ||
      Math.hypot(nuevaLinea.x2 - t.x2, nuevaLinea.y2 - t.y2) <= tol
    ) {
      tocaFin = true
    }
  }
  return tocaInicio && tocaFin
}

function estaDentroRegiones(x, y, regiones, margenPct = 5.5) {
  for (const c of regiones.circulos) {
    const mx = margenPct / (canvasAspect.value || 1.5)
    const rx = Math.max(1, c.rx - mx)
    const ry = Math.max(1, c.ry - margenPct)
    const val = Math.pow(x - c.cx, 2) / (rx * rx) + Math.pow(y - c.cy, 2) / (ry * ry)
    if (val <= 1) return true
  }

  for (const poly of regiones.poligonos) {
    if (!puntoEnPoligono(x, y, poly)) continue
    let minDist = Infinity
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]
      const b = poly[(i + 1) % poly.length]
      const d = distanciaPuntoASegmento(x, y, a.x, a.y, b.x, b.y)
      if (d < minDist) minDist = d
    }
    if (minDist >= margenPct) return true
  }

  return false
}

function adaptarMesasAlDibujo(silencioso = false, marcarPendiente = true) {
  let regiones = extraerRegionesDibujo()
  if (regiones.poligonos.length === 0 && regiones.circulos.length === 0) {
    if (!silencioso) {
      emit('notificar', {
        mensaje: 'Dibujá primero una figura cerrada (líneas conectadas o un círculo) para convertirla en el mapa.',
        tipo: 'info',
      })
    }
    return false
  }

  escalarDibujoAlLienzo()
  regiones = extraerRegionesDibujo()

  const totalMesas = configLocal.value.mesas.length
  const margenes = [5.5, 3.8, 2.0, 0.5]
  let candidatos = []

  for (const margen of margenes) {
    const pts = []
    for (let y = 4; y <= 96; y += 2.5) {
      for (let x = 4; x <= 96; x += 2.5) {
        if (estaDentroRegiones(x, y, regiones, margen)) {
          pts.push({ x: Math.round(x), y: Math.round(y) })
        }
      }
    }
    if (pts.length >= totalMesas + 1 || margen === 0.5) {
      candidatos = pts
      break
    }
  }

  if (candidatos.length === 0) {
    if (!silencioso) {
      emit('notificar', {
        mensaje: 'El área dibujada es demasiado pequeña para ubicar las mesas adentro.',
        tipo: 'error',
      })
    }
    return false
  }

  // Ubicar Caja dentro si está afuera
  const cajaActual = configLocal.value.caja
  const cajaAdentro = estaDentroRegiones(cajaActual.x, cajaActual.y, regiones, 4.5)
  if (!cajaAdentro) {
    const mejorCaja = [...candidatos].sort((a, b) => a.x * 0.65 + a.y - (b.x * 0.65 + b.y))[0]
    configLocal.value.caja.x = mejorCaja.x
    configLocal.value.caja.y = mejorCaja.y
  }

  // Filtrar candidatos alejados de la Caja
  const cx = configLocal.value.caja.x
  const cy = configLocal.value.caja.y
  const aspect = canvasAspect.value || 1.5
  let disponibles = candidatos.filter((p) => Math.hypot((p.x - cx) * aspect, p.y - cy) >= 13)
  if (disponibles.length < totalMesas) {
    disponibles = candidatos.filter((p) => Math.hypot((p.x - cx) * aspect, p.y - cy) >= 8)
  }
  if (disponibles.length === 0) {
    disponibles = candidatos
  }

  // Distribución uniforme por muestreo de punto más lejano (evita superposición)
  const elegidos = []
  if (totalMesas > 0 && disponibles.length > 0) {
    const primero = [...disponibles].sort((a, b) => a.x + a.y - (b.x + b.y))[0]
    elegidos.push(primero)

    while (elegidos.length < totalMesas) {
      let mejorPt = null
      let mejorMinDist = -1
      for (const cand of disponibles) {
        let minDist = Infinity
        for (const el of elegidos) {
          const d = Math.hypot((cand.x - el.x) * aspect, cand.y - el.y)
          if (d < minDist) minDist = d
        }
        if (minDist > mejorMinDist) {
          mejorMinDist = minDist
          mejorPt = cand
        }
      }
      if (!mejorPt) break
      elegidos.push(mejorPt)
    }
  }

  configLocal.value.mesas.forEach((mesa, idx) => {
    const pos = elegidos[idx % elegidos.length]
    if (pos) {
      mesa.x = pos.x
      mesa.y = pos.y
    }
  })

  // Ubicar Entrada dentro/en el borde inferior si está afuera
  if (!configLocal.value.entrada) {
    configLocal.value.entrada = { x: 45, y: 96, nombre: 'Entrada Principal' }
  }
  const entActual = configLocal.value.entrada
  if (!estaDentroRegiones(entActual.x, entActual.y, regiones, 1.5)) {
    const mejorEntrada = [...candidatos].sort((a, b) => {
      if (b.y !== a.y) return b.y - a.y
      return Math.abs(a.x - 50) - Math.abs(b.x - 50)
    })[0]
    configLocal.value.entrada.x = mejorEntrada.x
    configLocal.value.entrada.y = Math.min(97, mejorEntrada.y + 2)
  }

  recalcularNumeracionAutomatica()
  if (marcarPendiente) {
    hayCambiosPendientes.value = true
  }

  if (!silencioso) {
    emit('notificar', {
      mensaje: `Se adaptaron la Caja y las ${totalMesas} mesas dentro del mapa dibujado.`,
      tipo: 'exito',
    })
  }
  return true
}

function seleccionarHerramientaMover() {
  herramientaDibujo.value = 'mover'
  const regiones = extraerRegionesDibujo()
  if (regiones.poligonos.length === 0 && regiones.circulos.length === 0) return

  const algunaAfuera =
    !estaDentroRegiones(configLocal.value.caja.x, configLocal.value.caja.y, regiones, 3.5) ||
    configLocal.value.mesas.some((m) => !estaDentroRegiones(m.x, m.y, regiones, 3.5))

  if (algunaAfuera) {
    adaptarMesasAlDibujo(true)
  }
}

function onGlobalKeyDown(e) {
  if (!modoEdicion.value) return
  const tag = e.target?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl) return

  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    if (historialDeshacer.value.length > 0 || (configLocal.value.dibujoPersonalizado?.length ?? 0) > 0) {
      e.preventDefault()
      deshacerUltimoTrazo()
    }
  } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
    if (historialRehacer.value.length > 0) {
      e.preventDefault()
      rehacerTrazo()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeyDown)
})

function cargarDesdeConfigYProps(nuevasMesas = props.mesas) {
  const config = mesasService.obtenerConfigMapa()
  const baseMesas = Array.isArray(config.mesas) && config.mesas.length > 0
    ? config.mesas
    : (nuevasMesas || [])

  historialDeshacer.value = []
  historialRehacer.value = []

  configLocal.value = {
    formaLocal: config.formaLocal || 'rectangular',
    dibujoPersonalizado: Array.isArray(config.dibujoPersonalizado)
      ? JSON.parse(JSON.stringify(config.dibujoPersonalizado))
      : [],
    caja: config.caja || { x: 12, y: 15, nombre: 'Caja / Cobro' },
    entrada: config.entrada || { x: 45, y: 96, nombre: 'Entrada Principal' },
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

  if (configLocal.value.formaLocal === 'personalizada') {
    const regiones = extraerRegionesDibujo()
    if (regiones.poligonos.length > 0 || regiones.circulos.length > 0) {
      const algunaAfuera =
        !estaDentroRegiones(configLocal.value.caja.x, configLocal.value.caja.y, regiones, 3.5) ||
        configLocal.value.mesas.some((m) => !estaDentroRegiones(m.x, m.y, regiones, 3.5))
      if (algunaAfuera) {
        adaptarMesasAlDibujo(true, false)
      }
    }
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

// Lista combinada de mesas con estado de ocupación y reserva activa para renderizar en el plano
const mesasParaRender = computed(() => {
  const ahora = new Date()
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes()

  return configLocal.value.mesas.map((m) => {
    // Si viene comanda de props, enlazarla
    const propMesa = props.mesas.find((pm) => pm.numero === m.numero || pm.id === m.id)
    const reservasMesa = (props.reservas || []).filter(
      (r) => Number(r.mesa_numero) === Number(m.numero) && r.estado !== 'cancelada'
    )

    // Priorizar reserva en curso o próxima (que no haya vencido hace más de 90 min)
    let reservaActiva = null
    if (reservasMesa.length > 0) {
      const vigentes = reservasMesa.filter((r) => {
        const [hh, mm] = String(r.hora || '').split(':').map(Number)
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return true
        return hh * 60 + mm >= minAhora - 90
      })
      reservaActiva = vigentes[0] || reservasMesa[0]
    }

    return {
      ...m,
      ocupada: propMesa?.ocupada ?? m.ocupada ?? false,
      comanda: propMesa?.comanda ?? m.comanda ?? null,
      reservaActiva,
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
    herramientaDibujo.value =
      configLocal.value.formaLocal === 'personalizada' &&
      (!configLocal.value.dibujoPersonalizado || configLocal.value.dibujoPersonalizado.length === 0)
        ? 'linea'
        : 'mover'
  } else {
    modoEdicion.value = false
    mesaEditandoId.value = null
    trazoEnCurso.value = null
  }
}

// Iniciar arrastre de mesa (o grupo de mesas seleccionadas) o de la caja
function iniciarArrastre(e, tipo, item) {
  if (!props.esAdmin || estaDibujandoMapa.value) return
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
    id: item?.id || tipo,
    origX:
      tipo === 'caja'
        ? Number(configLocal.value.caja.x)
        : tipo === 'entrada'
          ? Number(configLocal.value.entrada?.x ?? 45)
          : Number(item.x),
    origY:
      tipo === 'caja'
        ? Number(configLocal.value.caja.y)
        : tipo === 'entrada'
          ? Number(configLocal.value.entrada?.y ?? 96)
          : Number(item.y),
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
  } else if (tipo === 'entrada') {
    if (!configLocal.value.entrada) {
      configLocal.value.entrada = { x: 45, y: 96, nombre: 'Entrada Principal' }
    }
    configLocal.value.entrada.x = Math.round(Math.min(94, Math.max(6, origX + deltaXPercent)))
    configLocal.value.entrada.y = Math.round(Math.min(97, Math.max(4, origY + deltaYPercent)))
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
  if (estaDibujandoMapa.value) {
    iniciarDibujoTrazo(e)
    return
  }
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
  if (canvasResizeObserver) {
    canvasResizeObserver.disconnect()
    canvasResizeObserver = null
  }
  window.removeEventListener('keydown', onGlobalKeyDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointermove', onMarqueeMove)
  window.removeEventListener('pointerup', onMarqueeUp)
  window.removeEventListener('pointermove', onDibujoMove)
  window.removeEventListener('pointerup', onDibujoUp)
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
  if (forma === 'personalizada') {
    if (!Array.isArray(configLocal.value.dibujoPersonalizado)) {
      configLocal.value.dibujoPersonalizado = []
    }
    herramientaDibujo.value = 'linea'
    hayCambiosPendientes.value = true
    emit('notificar', {
      mensaje: 'Modo dibujo geométrico activado. Estirá líneas rectas o círculos sobre el plano y luego ubicá las mesas.',
      tipo: 'info'
    })
    return
  }

  herramientaDibujo.value = 'mover'
  if (forma === 'cuadrada') {
    configLocal.value.caja = { x: 26, y: 18, nombre: 'Caja / Cobro' }
    configLocal.value.mesas = [
      { id: 'm1', numero: 1, x: 42, y: 22, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm2', numero: 2, x: 58, y: 22, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm3', numero: 3, x: 72, y: 22, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm4', numero: 4, x: 28, y: 42, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm5', numero: 5, x: 44, y: 42, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm6', numero: 6, x: 58, y: 42, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm7', numero: 7, x: 72, y: 42, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm8', numero: 8, x: 28, y: 62, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm9', numero: 9, x: 44, y: 62, forma: 'cuadrada', capacidad: 6, numeroManual: null },
      { id: 'm10', numero: 10, x: 60, y: 62, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm11', numero: 11, x: 72, y: 62, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm12', numero: 12, x: 50, y: 80, forma: 'cuadrada', capacidad: 6, numeroManual: null },
    ]
  } else if (forma === 'circular') {
    configLocal.value.caja = { x: 50, y: 18, nombre: 'Caja / Cobro' }
    configLocal.value.mesas = [
      { id: 'm1', numero: 1, x: 35, y: 26, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm2', numero: 2, x: 65, y: 26, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm3', numero: 3, x: 24, y: 44, forma: 'redonda', capacidad: 4, numeroManual: null },
      { id: 'm4', numero: 4, x: 50, y: 40, forma: 'redonda', capacidad: 4, numeroManual: null },
      { id: 'm5', numero: 5, x: 76, y: 44, forma: 'redonda', capacidad: 4, numeroManual: null },
      { id: 'm6', numero: 6, x: 24, y: 64, forma: 'redonda', capacidad: 4, numeroManual: null },
      { id: 'm7', numero: 7, x: 44, y: 60, forma: 'redonda', capacidad: 4, numeroManual: null },
      { id: 'm8', numero: 8, x: 58, y: 60, forma: 'redonda', capacidad: 4, numeroManual: null },
      { id: 'm9', numero: 9, x: 76, y: 64, forma: 'redonda', capacidad: 4, numeroManual: null },
      { id: 'm10', numero: 10, x: 36, y: 80, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm11', numero: 11, x: 50, y: 84, forma: 'redonda', capacidad: 6, numeroManual: null },
      { id: 'm12', numero: 12, x: 64, y: 80, forma: 'redonda', capacidad: 2, numeroManual: null },
    ]
  } else if (forma === 'triangular') {
    configLocal.value.caja = { x: 50, y: 20, nombre: 'Caja / Cobro' }
    configLocal.value.mesas = [
      { id: 'm1', numero: 1, x: 50, y: 36, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm2', numero: 2, x: 39, y: 50, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm3', numero: 3, x: 61, y: 50, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm4', numero: 4, x: 31, y: 67, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm5', numero: 5, x: 50, y: 67, forma: 'redonda', capacidad: 4, numeroManual: null },
      { id: 'm6', numero: 6, x: 69, y: 67, forma: 'cuadrada', capacidad: 4, numeroManual: null },
      { id: 'm7', numero: 7, x: 22, y: 83, forma: 'redonda', capacidad: 2, numeroManual: null },
      { id: 'm8', numero: 8, x: 40, y: 83, forma: 'cuadrada', capacidad: 6, numeroManual: null },
      { id: 'm9', numero: 9, x: 60, y: 83, forma: 'cuadrada', capacidad: 6, numeroManual: null },
      { id: 'm10', numero: 10, x: 78, y: 83, forma: 'redonda', capacidad: 2, numeroManual: null },
    ]
  } else if (forma === 'forma_l') {
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
  if (configLocal.value.formaLocal === 'personalizada') {
    const regiones = extraerRegionesDibujo()
    if (regiones.poligonos.length > 0 || regiones.circulos.length > 0) {
      const algunaAfuera =
        !estaDentroRegiones(configLocal.value.caja.x, configLocal.value.caja.y, regiones, 3.5) ||
        configLocal.value.mesas.some((m) => !estaDentroRegiones(m.x, m.y, regiones, 3.5))
      if (algunaAfuera) {
        adaptarMesasAlDibujo(true)
      }
    }
  }
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
  <div :class="modoEdicion && esAdmin ? 'grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_400px] items-start' : 'space-y-4'">
    <div class="space-y-4 min-w-0">
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


    <!-- ========================================================================= -->
    <!-- 1. VISTA PLANO DEL SALÓN (Arquitectónico con Drag & Drop y Formas)       -->
    <!-- ========================================================================= -->
    <div
      v-if="modoEdicion || modoVista === 'plano'"
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
          <span class="flex items-center gap-1.5">
            <span class="h-3 w-3 rounded-md border-2 border-violet-400 bg-[#22193a]" />
            <span>Mesa Reservada</span>
          </span>
          <span class="flex items-center gap-1.5 text-amber-300">
            <CircleDollarSign :size="14" class="text-amber-400" />
            <span>Punto de Caja / Cobro</span>
          </span>
        </div>

        <div class="flex items-center gap-2 text-[11px] text-stone-500">
          <span>Forma: <b class="text-stone-300">{{ formasLocalDisponibles.find(f => f.id === configLocal.formaLocal)?.label || configLocal.formaLocal.replace('_', ' ') }}</b></span>
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
        class="relative h-[560px] w-full select-none rounded-2xl overflow-hidden"
        :class="[
          !formaTieneContornoPropio
            ? 'border-2 border-stone-800/80 bg-[#17120f]'
            : (modoEdicion && estaDibujandoMapa ? 'border border-dashed border-stone-800/60 bg-transparent' : 'bg-transparent'),
          modoEdicion && !formaTieneContornoPropio ? 'ring-1 ring-amber-500/30' : '',
          estaDibujandoMapa ? 'cursor-crosshair touch-none' : (modoEdicion ? 'cursor-default' : '')
        ]">
        <!-- Recuadro de selección múltiple estilo Windows -->
        <div
          v-if="seleccionCaja.activa"
          :style="estiloSeleccionCaja"
          class="pointer-events-none absolute z-40 rounded-sm border border-sky-400 bg-sky-500/15"
        />
        <!-- Rejilla de fondo sutil estilo plano arquitectónico (solo para formas rectangulares) -->
        <div
          v-if="!formaTieneContornoPropio"
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

        <!-- CASO E: CUADRADA -->
        <template v-if="configLocal.formaLocal === 'cuadrada'">
          <div class="pointer-events-none absolute left-1/2 top-1/2 h-[88%] aspect-square max-w-[92%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-2 border-[#e58a4e]/55 bg-[#17120f] shadow-xl">
            <div
              class="absolute inset-0 opacity-[0.07]"
              style="background-size: 32px 32px; background-image: linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px);"
            />
            <span class="absolute bottom-3 left-4 text-[11px] font-bold uppercase tracking-widest text-stone-500/80">
              Salón Cuadrado
            </span>
          </div>
        </template>

        <!-- CASO F: CIRCULAR -->
        <template v-if="configLocal.formaLocal === 'circular'">
          <div class="pointer-events-none absolute left-1/2 top-1/2 h-[92%] aspect-square max-w-[94%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border-2 border-[#e58a4e]/55 bg-[#17120f] shadow-xl flex items-end justify-center pb-4">
            <div
              class="absolute inset-0 opacity-[0.07]"
              style="background-size: 32px 32px; background-image: linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px);"
            />
            <span class="relative text-[11px] font-bold uppercase tracking-widest text-stone-500/80">
              Salón Circular
            </span>
          </div>
        </template>

        <!-- CASO G: TRIANGULAR -->
        <template v-if="configLocal.formaLocal === 'triangular'">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            class="pointer-events-none absolute inset-0 h-full w-full z-0">
            <defs>
              <pattern id="gridTriangular" width="4" height="5.5" patternUnits="userSpaceOnUse">
                <path d="M 4 0 L 0 0 0 5.5" fill="none" stroke="#ffffff" stroke-width="0.18" />
              </pattern>
              <clipPath id="clipTriangular">
                <polygon points="50,6 92,92 8,92" />
              </clipPath>
            </defs>
            <g clip-path="url(#clipTriangular)">
              <rect x="0" y="0" width="100" height="100" fill="#17120f" />
              <rect x="0" y="0" width="100" height="100" fill="url(#gridTriangular)" opacity="0.08" />
            </g>
            <polygon
              points="50,6 92,92 8,92"
              fill="none"
              stroke="rgba(229, 138, 78, 0.65)"
              stroke-width="0.6"
              stroke-linejoin="round"
            />
          </svg>
          <div class="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 text-[11px] font-bold uppercase tracking-widest text-stone-500/80">
            Salón Triangular
          </div>
        </template>

        <!-- CASO H: DIBUJO GEOMÉTRICO / PERSONALIZADA -->
        <template v-if="configLocal.formaLocal === 'personalizada'">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            class="pointer-events-none absolute inset-0 h-full w-full z-0">
            <defs>
              <pattern id="gridPersonalizada" width="4" height="5.5" patternUnits="userSpaceOnUse">
                <path d="M 4 0 L 0 0 0 5.5" fill="none" stroke="#ffffff" stroke-width="0.18" />
              </pattern>
              <clipPath id="clipPersonalizada">
                <polygon
                  v-for="(pts, idx) in poligonosRellenoSvg"
                  :key="`clip_poly_${idx}`"
                  :points="pts"
                />
                <ellipse
                  v-for="(c, idx) in circulosRellenoSvg"
                  :key="`clip_circ_${idx}`"
                  :cx="c.cx"
                  :cy="c.cy"
                  :rx="c.rx"
                  :ry="c.ry"
                />
              </clipPath>
            </defs>

            <!-- Piso y rejilla recortados exclusivamente dentro de la forma dibujada -->
            <g
              v-if="poligonosRellenoSvg.length > 0 || circulosRellenoSvg.length > 0"
              clip-path="url(#clipPersonalizada)">
              <rect x="0" y="0" width="100" height="100" fill="#17120f" />
              <rect x="0" y="0" width="100" height="100" fill="url(#gridPersonalizada)" opacity="0.08" />
            </g>

            <template v-for="(trazo, idx) in (configLocal.dibujoPersonalizado || [])" :key="idx">
              <line
                v-if="trazo.tipo === 'linea'"
                :x1="trazo.x1"
                :y1="trazo.y1"
                :x2="trazo.x2"
                :y2="trazo.y2"
                stroke="#e58a4e"
                stroke-width="0.65"
                stroke-linecap="round"
              />
              <ellipse
                v-else-if="trazo.tipo === 'circulo'"
                :cx="trazo.cx"
                :cy="trazo.cy"
                :rx="trazo.r / canvasAspect"
                :ry="trazo.r"
                fill="none"
                stroke="#e58a4e"
                stroke-width="0.65"
              />
              <path
                v-else-if="trazo.puntos"
                :d="puntosASvgPath(trazo.puntos, trazo.cerrado)"
                fill="none"
                stroke="#e58a4e"
                stroke-width="0.65"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </template>

            <!-- Vista previa en vivo mientras estira línea o círculo -->
            <line
              v-if="trazoEnCurso && trazoEnCurso.tipo === 'linea'"
              :x1="trazoEnCurso.x1"
              :y1="trazoEnCurso.y1"
              :x2="trazoEnCurso.x2"
              :y2="trazoEnCurso.y2"
              stroke="#fbbf24"
              stroke-width="0.7"
              stroke-dasharray="1.5 1"
              stroke-linecap="round"
            />
            <ellipse
              v-else-if="trazoEnCurso && trazoEnCurso.tipo === 'circulo' && trazoEnCurso.r > 0"
              :cx="trazoEnCurso.cx"
              :cy="trazoEnCurso.cy"
              :rx="trazoEnCurso.r / canvasAspect"
              :ry="trazoEnCurso.r"
              fill="rgba(251, 191, 36, 0.08)"
              stroke="#fbbf24"
              stroke-width="0.7"
              stroke-dasharray="1.5 1"
            />
          </svg>

          <div
            v-if="modoEdicion && (!configLocal.dibujoPersonalizado || configLocal.dibujoPersonalizado.length === 0) && !trazoEnCurso"
            class="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
            <div class="rounded-2xl border border-dashed border-[#e58a4e]/40 bg-[#14100d]/85 px-5 py-3 text-xs text-stone-300 shadow-lg">
              <p class="font-bold text-[#e58a4e]">Dibujá tu mapa con líneas rectas y círculos</p>
              <p class="mt-1 text-[11px] text-stone-400">
                Hacé clic y estirá para trazar paredes rectas (se enderezan y unen automáticamente) o círculos. Al cerrar la figura, el mapa tomará esa forma y ubicará las mesas adentro.
              </p>
            </div>
          </div>
        </template>

        <!-- Marcador de Entrada / Acceso Principal (Arrastrable por el administrador) -->
        <div
          :style="{
            left: `${configLocal.entrada?.x ?? 45}%`,
            top: `${configLocal.entrada?.y ?? 96}%`,
            transform: 'translate(-50%, -50%)',
          }"
          @pointerdown.stop="(e) => iniciarArrastre(e, 'entrada', configLocal.entrada)"
          :class="[
            estaDibujandoMapa ? 'pointer-events-none opacity-75' : '',
            esAdmin && !estaDibujandoMapa ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none',
            modoEdicion ? 'ring-1 ring-amber-400/70' : ''
          ]"
          class="absolute z-20 rounded-lg border-2 border-stone-600 bg-stone-900/95 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-stone-300 shadow-lg">
          {{ configLocal.entrada?.nombre || 'Entrada Principal' }}
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
            estaDibujandoMapa ? 'pointer-events-none opacity-80' : '',
            esAdmin && !estaDibujandoMapa ? 'cursor-grab active:cursor-grabbing' : '',
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
            estaDibujandoMapa ? 'pointer-events-none opacity-80' : '',
            mesa.forma === 'redonda' ? 'rounded-full' : 'rounded-2xl',
            mesasSeleccionadasIds.includes(mesa.id) ? 'ring-4 ring-sky-400 ring-offset-2 ring-offset-[#0c0a09] scale-105 z-30' : '',
            !mesasSeleccionadasIds.includes(mesa.id) && selectedTable === mesa.numero && !modoEdicion ? 'ring-4 ring-[#e58a4e] ring-offset-2 ring-offset-[#0c0a09] scale-105 z-30' : 'z-10',
            modoEdicion && mesaEditandoId === mesa.id ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-[#0c0a09] scale-105 z-30' : '',
            esAdmin ? 'cursor-grab active:cursor-grabbing hover:scale-105' : 'cursor-pointer hover:scale-105',
            mesa.ocupada
              ? 'bg-[#3a1e14] border-2 border-[#d97736] text-white shadow-lg shadow-orange-950/40'
              : mesa.reservaActiva
                ? 'bg-[#22193a] border-2 border-violet-400 text-violet-50 shadow-lg shadow-violet-950/40'
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
            <Clock v-else-if="mesa.reservaActiva" :size="11" class="text-violet-300" />
          </div>

          <!-- Total de comanda si está ocupada -->
          <span
            v-if="mesa.ocupada && mesa.comanda"
            class="mt-0.5 block text-[9px] font-bold tabular-nums text-[#f09559] leading-none">
            {{ formatPrice(mesa.comanda.total) }}
          </span>

          <!-- Horario de reserva si está reservada -->
          <span
            v-else-if="mesa.reservaActiva"
            class="mt-0.5 block text-[9px] font-bold tabular-nums text-violet-300 leading-none">
            {{ mesa.reservaActiva.hora }}hs
          </span>

          <!-- Capacidad si está libre -->
          <span
            v-else
            class="mt-0.5 block text-[9px] font-semibold text-[#4ade80]/90 leading-none">
            {{ mesa.capacidad }}p
          </span>

          <!-- Badge de próxima reserva si además está ocupada -->
          <span
            v-if="mesa.ocupada && mesa.reservaActiva"
            class="absolute -bottom-2.5 rounded-full border border-violet-400/60 bg-[#22193a] px-1.5 py-0.5 text-[8px] font-bold text-violet-200 leading-none shadow">
            {{ mesa.reservaActiva.hora }}hs
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
          <span class="flex items-center gap-1.5"><i class="h-2.5 w-2.5 rounded-full bg-violet-400" /> Reservada</span>
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
              : mesa.reservaActiva
                ? 'bg-[#22193a] border-2 border-violet-400'
                : 'bg-[#163223] border border-[#204933] hover:border-[#32694b]'
          ]">
          <div class="flex items-center justify-between w-full">
            <span
              class="text-[10px] font-bold uppercase tracking-widest"
              :class="mesa.ocupada ? 'text-[#f09559]' : mesa.reservaActiva ? 'text-violet-300' : 'text-[#4ade80]'">
              {{ mesa.ocupada ? 'Ocupada' : mesa.reservaActiva ? 'Reservada' : 'Libre' }}
            </span>
            <Bell v-if="mesa.ocupada" :size="15" class="text-[#f09559]" />
            <Clock v-else-if="mesa.reservaActiva" :size="15" class="text-violet-300" />
          </div>

          <div class="flex items-end justify-between gap-2 w-full">
            <span
              class="font-serif text-3xl font-bold"
              :class="mesa.ocupada || mesa.reservaActiva ? 'text-white' : 'text-[#e6f4ec]'">
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
            <div v-else-if="mesa.reservaActiva" class="text-right">
              <span class="block text-xs font-bold tabular-nums text-violet-300">
                {{ mesa.reservaActiva.hora }} hs
              </span>
              <span class="block max-w-[90px] truncate text-[10px] font-medium text-stone-300">
                {{ mesa.reservaActiva.nombre_cliente }}
              </span>
            </div>
            <span v-else class="text-[11px] font-medium text-stone-400">
              {{ mesa.capacidad || 4 }} pers.
            </span>
          </div>
        </button>
      </div>
    </div>
    </div>

    <!-- Barra lateral derecha exclusiva para editar el mapa (oculta comanda activa) -->
    <aside v-if="modoEdicion && esAdmin" class="space-y-4">
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
              <Circle v-if="forma.id === 'circular'" :size="13" />
              <Square v-else-if="forma.id === 'cuadrada'" :size="13" />
              <Triangle v-else-if="forma.id === 'triangular'" :size="13" />
              <PenTool v-else-if="forma.id === 'personalizada'" :size="13" />
              <span v-else class="h-2 w-2 rounded-full" :class="configLocal.formaLocal === forma.id ? 'bg-[#e58a4e]' : 'bg-stone-600'" />
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

      <!-- Barra de herramientas de dibujo geométrico (visible al elegir "Dibujar mapa") -->
      <div
        v-if="configLocal.formaLocal === 'personalizada'"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e58a4e]/35 bg-[#14100d] p-3 text-xs">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-bold uppercase tracking-wider text-[11px] text-[#e58a4e] mr-1">
            Herramienta:
          </span>
          <button
            type="button"
            @click="herramientaDibujo = 'linea'"
            :class="herramientaDibujo === 'linea'
              ? 'bg-[#e58a4e] text-[#190d05] font-bold shadow'
              : 'border border-stone-700 bg-[#1b1511] text-stone-300 hover:border-stone-500'"
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition">
            <Minus :size="13" />
            <span>Línea recta</span>
          </button>
          <button
            type="button"
            @click="herramientaDibujo = 'circulo'"
            :class="herramientaDibujo === 'circulo'
              ? 'bg-[#e58a4e] text-[#190d05] font-bold shadow'
              : 'border border-stone-700 bg-[#1b1511] text-stone-300 hover:border-stone-500'"
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition">
            <Circle :size="13" />
            <span>Círculo</span>
          </button>
          <button
            type="button"
            @click="seleccionarHerramientaMover"
            :class="herramientaDibujo === 'mover'
              ? 'bg-[#e58a4e] text-[#190d05] font-bold shadow'
              : 'border border-stone-700 bg-[#1b1511] text-stone-300 hover:border-stone-500'"
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition">
            <Hand :size="13" />
            <span>Mover mesas / caja</span>
          </button>
          <button
            type="button"
            @click="adaptarMesasAlDibujo(false)"
            :disabled="!configLocal.dibujoPersonalizado?.length"
            title="Acomoda automáticamente la Caja y todas las mesas dentro del área dibujada"
            class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-900/50 disabled:opacity-40 disabled:cursor-not-allowed">
            <Sparkles :size="13" />
            <span>Adaptar mesas adentro</span>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            @click="deshacerUltimoTrazo"
            title="Deshacer (Ctrl+Z)"
            :disabled="!historialDeshacer.length && !configLocal.dibujoPersonalizado?.length"
            class="inline-flex items-center gap-1 rounded-lg border border-stone-700 bg-[#1b1511] px-2.5 py-1.5 text-[11px] font-semibold text-stone-300 transition hover:border-stone-500 disabled:opacity-40 disabled:cursor-not-allowed">
            <Undo2 :size="13" />
            <span>Deshacer</span>
          </button>
          <button
            type="button"
            @click="rehacerTrazo"
            title="Rehacer (Ctrl+Y)"
            :disabled="!historialRehacer.length"
            class="inline-flex items-center gap-1 rounded-lg border border-stone-700 bg-[#1b1511] px-2.5 py-1.5 text-[11px] font-semibold text-stone-300 transition hover:border-stone-500 disabled:opacity-40 disabled:cursor-not-allowed">
            <Redo2 :size="13" />
            <span>Rehacer</span>
          </button>
          <button
            type="button"
            @click="limpiarDibujoPersonalizado"
            :disabled="!configLocal.dibujoPersonalizado?.length"
            class="inline-flex items-center gap-1 rounded-lg border border-rose-900/50 bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-900/60 disabled:opacity-40 disabled:cursor-not-allowed">
            <Eraser :size="13" />
            <span>Limpiar dibujo</span>
          </button>
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
    </aside>


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

