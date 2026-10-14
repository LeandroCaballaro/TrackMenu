import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ANCHO = 2800
const ALTO = 1900
const FONDO = '#0b0b0f'
const TRAZO = '#f4f1ec'
const ACENTO = '#d65d2a'
const ANCHO_ENTIDAD = 320
const ALTO_ENTIDAD = 120

const entidades = {
  usuarios: { x: 360, y: 330, etiqueta: 'auth.users', externa: true },
  organizacion: { x: 1300, y: 330, etiqueta: 'organizacion' },
  categoria: { x: 2300, y: 330, etiqueta: 'categoria' },
  producto: { x: 2300, y: 950, etiqueta: 'producto' },
  mesa: { x: 420, y: 990, etiqueta: 'mesa' },
  pedido: { x: 1300, y: 1490, etiqueta: 'pedido' },
}

const atributos = [
  ['usuarios', 'id', { dx: -260, dy: -140, pk: true }],
  ['usuarios', 'email', { dx: -20, dy: -175 }],

  ['organizacion', 'id', { dx: -180, dy: -165, pk: true }],
  ['organizacion', 'nombre', { dx: 30, dy: -180 }],
  ['organizacion', 'slug', { dx: 230, dy: -160 }],
  ['organizacion', 'cuit', { dx: 400, dy: -130 }],
  ['organizacion', 'direccion', { dx: -400, dy: -130 }],
  ['organizacion', 'telefono', { dx: -330, dy: 130 }],
  ['organizacion', 'activo', { dx: 120, dy: 185 }],
  ['organizacion', 'creado_en', { dx: 330, dy: 150 }],

  ['categoria', 'id', { dx: 250, dy: -130, pk: true }],
  ['categoria', 'nombre', { dx: 330, dy: -20 }],
  ['categoria', 'orden', { dx: 300, dy: 90 }],
  ['categoria', 'activa', { dx: 60, dy: 170 }],
  ['categoria', 'organizacion_id', { dx: -170, dy: 165, fk: true }],

  ['producto', 'id', { dx: 300, dy: -140, pk: true }],
  ['producto', 'nombre', { dx: 350, dy: -30 }],
  ['producto', 'descripcion', { dx: 360, dy: 80 }],
  ['producto', 'precio', { dx: 300, dy: 180 }],
  ['producto', 'stock', { dx: 130, dy: 215 }],
  ['producto', 'activo', { dx: -110, dy: 215 }],
  ['producto', 'imagen_url', { dx: -330, dy: 140 }],
  ['producto', 'imagen_ruta', { dx: -360, dy: 30 }],
  ['producto', 'organizacion_id', { dx: -340, dy: -90, fk: true }],
  ['producto', 'categoria_id', { dx: -60, dy: -180, fk: true }],

  ['mesa', 'id', { dx: -250, dy: -145, pk: true }],
  ['mesa', 'numero', { dx: -300, dy: -40 }],
  ['mesa', 'capacidad', { dx: -300, dy: 70 }],
  ['mesa', 'estado', { dx: -230, dy: 165 }],
  ['mesa', 'organizacion_id', { dx: 250, dy: 160, fk: true }],

  ['pedido', 'id', { dx: -260, dy: -170, pk: true }],
  ['pedido', 'estado', { dx: -60, dy: -190 }],
  ['pedido', 'medio_pago', { dx: 150, dy: -175 }],
  ['pedido', 'total', { dx: 340, dy: -120 }],
  ['pedido', 'atendido_por', { dx: -420, dy: 60, fk: true }],
  ['pedido', 'creado_en', { dx: -330, dy: 150 }],
  ['pedido', 'cerrado_en', { dx: -110, dy: 195 }],
  ['pedido', 'organizacion_id', { dx: 120, dy: 200, fk: true }],
  ['pedido', 'mesa_id', { dx: 330, dy: 150, fk: true }],
]

const relaciones = [
  { desde: 'usuarios', hasta: 'organizacion', etiqueta: 'Pertenece', card: ['N', 'M'], atributos: ['rol', 'activo'] },
  { desde: 'organizacion', hasta: 'categoria', etiqueta: 'Define', card: ['1', 'N'] },
  { desde: 'categoria', hasta: 'producto', etiqueta: 'Agrupa', card: ['1', 'N'] },
  { desde: 'organizacion', hasta: 'mesa', etiqueta: 'Dispone', card: ['1', 'N'], quiebre: { x: 800, y: 990 } },
  { desde: 'mesa', hasta: 'pedido', etiqueta: 'Recibe', card: ['1', 'N'], quiebre: { x: 420, y: 1490 } },
  {
    desde: 'producto',
    hasta: 'pedido',
    etiqueta: 'Detalle',
    card: ['N', 'M'],
    atributos: ['cantidad', 'precio_unitario', 'subtotal'],
    quiebre: { x: 2300, y: 1490 },
  },
]

const anchoTexto = (texto, tamano) => texto.length * tamano * 0.56

const partes = []
const cajas = []

const linea = (x1, y1, x2, y2, extra = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${TRAZO}" stroke-width="2" ${extra} />`

const texto = (x, y, contenido, { tamano = 26, peso = 600, color = TRAZO, decoracion = 'none' } = {}) =>
  `<text x="${x}" y="${y}" fill="${color}" font-family="Segoe UI, Arial, sans-serif" font-size="${tamano}" font-weight="${peso}" text-anchor="middle" dominant-baseline="middle" text-decoration="${decoracion}">${contenido}</text>`

const elipse = (cx, cy, nombre, { tamano = 23, pk = false, fk = false } = {}) => {
  const rx = Math.max(74, anchoTexto(nombre, tamano) / 2 + 26)
  const ry = 38
  cajas.push({ nombre, x: cx, y: cy, w: rx * 2, h: ry * 2 })
  partes.push(
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${FONDO}" stroke="${fk ? ACENTO : TRAZO}" stroke-width="2" />`,
  )
  partes.push(
    texto(cx, cy, nombre, {
      tamano,
      peso: pk ? 700 : 500,
      color: fk ? ACENTO : TRAZO,
      decoracion: pk ? 'underline' : 'none',
    }),
  )
}

for (const [claveEntidad, nombre, opciones] of atributos) {
  const entidad = entidades[claveEntidad]
  const cx = entidad.x + opciones.dx
  const cy = entidad.y + opciones.dy
  const norma = Math.hypot(opciones.dx, opciones.dy) || 1
  const anclaX = entidad.x + Math.max(-ANCHO_ENTIDAD / 2, Math.min(ANCHO_ENTIDAD / 2, opciones.dx))
  const anclaY = entidad.y + Math.max(-ALTO_ENTIDAD / 2, Math.min(ALTO_ENTIDAD / 2, opciones.dy))
  const rxEstimado = Math.max(74, anchoTexto(nombre, 23) / 2 + 26)

  partes.push(
    linea(anclaX, anclaY, cx - (opciones.dx / norma) * rxEstimado, cy - (opciones.dy / norma) * 38, 'opacity="0.7"'),
  )
  elipse(cx, cy, nombre, { pk: opciones.pk, fk: opciones.fk })
}

for (const relacion of relaciones) {
  const a = entidades[relacion.desde]
  const b = entidades[relacion.hasta]
  const centro = relacion.quiebre ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const rx = Math.max(140, anchoTexto(relacion.etiqueta, 26) / 2 + 42)
  const ry = 74

  partes.push(linea(a.x, a.y, centro.x, centro.y))
  partes.push(linea(centro.x, centro.y, b.x, b.y))

  const rombo = [
    `${centro.x},${centro.y - ry}`,
    `${centro.x + rx},${centro.y}`,
    `${centro.x},${centro.y + ry}`,
    `${centro.x - rx},${centro.y}`,
  ].join(' ')

  partes.push(`<polygon points="${rombo}" fill="${FONDO}" stroke="${TRAZO}" stroke-width="2.5" />`)
  partes.push(texto(centro.x, centro.y, relacion.etiqueta, { tamano: 26, peso: 700 }))
  cajas.push({ nombre: `rombo ${relacion.etiqueta}`, x: centro.x, y: centro.y, w: rx * 2, h: ry * 2 })

  const cardA = { x: a.x + (centro.x - a.x) * 0.3, y: a.y + (centro.y - a.y) * 0.3 }
  const cardB = { x: b.x + (centro.x - b.x) * 0.3, y: b.y + (centro.y - b.y) * 0.3 }

  partes.push(texto(cardA.x, cardA.y - 26, relacion.card[0], { tamano: 30, peso: 700, color: ACENTO }))
  partes.push(texto(cardB.x, cardB.y - 26, relacion.card[1], { tamano: 30, peso: 700, color: ACENTO }))

  ;(relacion.atributos ?? []).forEach((nombre, indice) => {
    const cx = centro.x + (indice - (relacion.atributos.length - 1) / 2) * 250
    const cy = centro.y + ry + 170

    partes.push(linea(centro.x, centro.y + ry, cx, cy - 38, 'opacity="0.7"'))
    elipse(cx, cy, nombre, { tamano: 22 })
  })
}

for (const entidad of Object.values(entidades)) {
  partes.push(
    `<rect x="${entidad.x - ANCHO_ENTIDAD / 2}" y="${entidad.y - ALTO_ENTIDAD / 2}" width="${ANCHO_ENTIDAD}" height="${ALTO_ENTIDAD}" fill="${FONDO}" stroke="${TRAZO}" stroke-width="${entidad.externa ? 2 : 3}" stroke-dasharray="${entidad.externa ? '10 7' : 'none'}" />`,
  )
  partes.push(texto(entidad.x, entidad.y, entidad.etiqueta, { tamano: 32, peso: 700 }))
  cajas.push({ nombre: `entidad ${entidad.etiqueta}`, x: entidad.x, y: entidad.y, w: ANCHO_ENTIDAD, h: ALTO_ENTIDAD })
}

const colisiones = []
for (let i = 0; i < cajas.length; i += 1) {
  for (let j = i + 1; j < cajas.length; j += 1) {
    const a = cajas[i]
    const b = cajas[j]
    if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 10 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 10) {
      colisiones.push(`${a.nombre} <-> ${b.nombre}`)
    }
  }
}

const leyenda = [
  `<rect x="60" y="${ALTO - 230}" width="640" height="170" fill="${FONDO}" stroke="${TRAZO}" stroke-width="1.5" />`,
  `<text x="95" y="${ALTO - 185}" fill="${TRAZO}" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="700">Referencias</text>`,
  `<text x="95" y="${ALTO - 145}" fill="${TRAZO}" font-family="Segoe UI, Arial, sans-serif" font-size="22"><tspan text-decoration="underline">atributo</tspan> = clave primaria</text>`,
  `<text x="95" y="${ALTO - 108}" fill="${ACENTO}" font-family="Segoe UI, Arial, sans-serif" font-size="22">atributo = clave foranea</text>`,
  `<text x="95" y="${ALTO - 71}" fill="${TRAZO}" font-family="Segoe UI, Arial, sans-serif" font-size="22">borde punteado = tabla de Supabase Auth</text>`,
].join('\n')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ANCHO} ${ALTO}" width="100%" role="img" aria-label="Diagrama entidad-relacion de TrackMenu">
<rect width="${ANCHO}" height="${ALTO}" fill="${FONDO}" />
<text x="${ANCHO / 2}" y="70" fill="${TRAZO}" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="700" text-anchor="middle">TrackMenu — Diagrama entidad-relacion</text>
${partes.join('\n')}
${leyenda}
</svg>
`

const destino = join(dirname(fileURLToPath(import.meta.url)), 'der-trackmenu.svg')
writeFileSync(destino, svg)

if (colisiones.length) {
  console.log(`${colisiones.length} colision(es):`)
  colisiones.forEach((colision) => console.log(`  ${colision}`))
} else {
  console.log('Sin colisiones')
}
console.log(`DER generado en ${destino}`)
