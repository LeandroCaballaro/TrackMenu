import { reactive, computed } from 'vue'

const STORAGE_SESSION_KEY = 'trackmenu_saas_session'
const STORAGE_DATA_KEY = 'trackmenu_saas_db'

// Cuentas que entraban sin pasar por el backend. Se quitaron, y también se
// borran de los navegadores que las tengan guardadas de antes.
// 'consulta' es un rol real desde la migración 006: la app lo tiene que
// reconocer, antes lo echaba al recargar.
const ROLES_ASIGNABLES = ['admin', 'empleado', 'consulta']

const CUENTAS_DEMO = []

// Semilla inicial con productos para el negocio por defecto
const initialMockDatabase = {
  organizaciones: [
    {
      id: 'org_demo_1',
      nombre: 'Parrilla Central',
      plan: 'pro',
      estado_suscripcion: 'al_dia',
      monto_mensual: 28000,
      fecha_vencimiento: '2026-12-10T00:00:00.000Z',
      bloqueo_mora: false,
      admin_nombre: 'Carlos Admin',
      admin_email: 'admin@demo.com',
      telefono: '+54 11 4455-6677',
      notas_facturacion: 'Factura A emitida los días 10 de cada mes.',
      creado_en: '2026-10-15T10:00:00.000Z',
    },
    {
      id: 'org_demo_2',
      nombre: 'Bar & Café Palermo',
      plan: 'basico',
      estado_suscripcion: 'pendiente',
      monto_mensual: 18000,
      fecha_vencimiento: '2026-11-12T00:00:00.000Z',
      bloqueo_mora: false,
      admin_nombre: 'Martín Palermo',
      admin_email: 'martin@palermo.com',
      telefono: '+54 11 3322-1100',
      notas_facturacion: 'Aviso de vencimiento enviado por WhatsApp.',
      creado_en: '2026-10-20T11:00:00.000Z',
    },
    {
      id: 'org_demo_3',
      nombre: 'Cervecería Patagonia Norte',
      plan: 'pro',
      estado_suscripcion: 'mora',
      monto_mensual: 28000,
      fecha_vencimiento: '2026-10-28T00:00:00.000Z',
      bloqueo_mora: true,
      admin_nombre: 'Rodrigo Peña',
      admin_email: 'rodrigo@cerveceriapatagonia.com',
      telefono: '+54 11 9988-7766',
      notas_facturacion: 'No cumplió con el pago del abono mensual de octubre. Suspendido preventivamente.',
      creado_en: '2026-09-01T08:00:00.000Z',
    },
  ],
  usuarios: [
    {
      id: 'usr_superadmin_1',
      email: 'superadmin@demo.com',
      password: 'superadmin123',
      nombre: 'Super Administrador',
      telefono: '+54 11 0000-9999',
      puesto: 'Director de Plataforma',
      estado: 'activo',
      notas: 'Acceso global a todos los negocios y control de suscripciones.',
      organizacion_id: 'org_demo_1',
      rol: 'superadmin',
      creado_en: '2026-09-01T00:00:00.000Z',
      localOnly: true,
    },
    {
      id: 'usr_admin_1',
      email: 'admin@demo.com',
      password: 'admin12345',
      nombre: 'Carlos Admin',
      telefono: '+54 11 4455-6677',
      puesto: 'Gerente General',
      estado: 'activo',
      notas: 'Encargado principal y dueño del local.',
      organizacion_id: 'org_demo_1',
      rol: 'admin',
      creado_en: '2026-10-15T10:00:00.000Z',
      localOnly: true,
    },
    {
      id: 'usr_empleado_1',
      email: 'empleado@demo.com',
      password: 'empleado12345',
      nombre: 'Lucía Empleada',
      telefono: '+54 11 5566-7788',
      puesto: 'Cajera / Moza Salón',
      estado: 'activo',
      notas: 'Turno tarde y noche.',
      organizacion_id: 'org_demo_1',
      rol: 'empleado',
      creado_en: '2026-11-01T12:00:00.000Z',
      localOnly: true,
    },
    {
      id: 'usr_empleado_2',
      email: 'marcos@demo.com',
      password: 'marcos12345',
      nombre: 'Marcos Mozo',
      telefono: '+54 11 6677-8899',
      puesto: 'Mozo de Salón',
      estado: 'activo',
      notas: 'Atención sector mesas y terraza.',
      organizacion_id: 'org_demo_1',
      rol: 'empleado',
      creado_en: '2026-11-05T14:30:00.000Z',
      localOnly: true,
    },
  ],
  productos: [
    {
      id: 'prod_1',
      organizacion_id: 'org_demo_1',
      usuario_id: 'usr_admin_1',
      nombre: 'Burger Clásica',
      descripcion: 'Doble smash, cheddar, cebolla caramelizada y salsa de la casa.',
      precio: 1890,
      stock: 35,
      activo: true,
      imagen_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80',
      creado_en: '2026-11-01T12:00:00.000Z',
      actualizado_en: '2026-11-01T12:00:00.000Z',
    },
    {
      id: 'prod_2',
      organizacion_id: 'org_demo_1',
      usuario_id: 'usr_admin_1',
      nombre: 'Papas a la Piedra',
      descripcion: 'Crocantes por fuera, suaves por dentro, con romero y sal de escamas.',
      precio: 950,
      stock: 50,
      activo: true,
      imagen_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=500&q=80',
      creado_en: '2026-11-02T14:30:00.000Z',
      actualizado_en: '2026-11-02T14:30:00.000Z',
    },
    {
      id: 'prod_3',
      organizacion_id: 'org_demo_1',
      usuario_id: 'usr_admin_1',
      nombre: 'Milanesa de Pollo',
      descripcion: 'Rebozada crocante con limón y ensalada fresca.',
      precio: 1050,
      stock: 20,
      activo: true,
      imagen_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=500&q=80',
      creado_en: '2026-11-03T10:15:00.000Z',
      actualizado_en: '2026-11-03T10:15:00.000Z',
    },
    {
      id: 'prod_4',
      organizacion_id: 'org_demo_1',
      usuario_id: 'usr_admin_1',
      nombre: 'Limonada Casera',
      descripcion: 'Limón natural, menta fresca y un toque de jengibre.',
      precio: 780,
      stock: 60,
      activo: true,
      imagen_url: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=500&q=80',
      creado_en: '2026-11-04T16:00:00.000Z',
      actualizado_en: '2026-11-04T16:00:00.000Z',
    },
    {
      id: 'prod_5',
      organizacion_id: 'org_demo_1',
      usuario_id: 'usr_admin_1',
      nombre: 'Cheesecake de Frutos Rojos',
      descripcion: 'Cremoso, suave y con reducción casera de frutos rojos.',
      precio: 1200,
      stock: 12,
      activo: false,
      imagen_url: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=500&q=80',
      creado_en: '2026-11-05T18:20:00.000Z',
      actualizado_en: '2026-11-05T18:20:00.000Z',
    },
    // Producto de otra organización (para demostrar aislamiento estricto)
    {
      id: 'prod_org2_1',
      organizacion_id: 'org_demo_2',
      usuario_id: 'usr_demo_2',
      nombre: 'Café Espresso Doble (Otro Negocio)',
      descripcion: 'Granos colombianos seleccionados.',
      precio: 650,
      stock: 100,
      activo: true,
      imagen_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=500&q=80',
      creado_en: '2026-11-01T08:00:00.000Z',
      actualizado_en: '2026-11-01T08:00:00.000Z',
    },
  ],
  comandas_activas: [],
  ventas: [],
  detalle_ventas: [],
  auditoria_logs: [],
}

const DEMO_VENTA_IDS = new Set(['vnt_101', 'vnt_102', 'vnt_103', 'vnt_104'])
const DEMO_DETALLE_IDS = new Set(['det_1', 'det_2', 'det_3', 'det_4', 'det_5', 'det_6', 'det_7'])
const DEMO_AUDIT_IDS = new Set(['aud_1', 'aud_2', 'aud_3'])

// Carga o inicializa la base de datos local persistente
// Los datos que no llegan al backend quedan sólo en este navegador: decirlo,
// porque "guardado correctamente" hacía pensar que estaban en la base.
const avisoLocal = (mensaje) => `${mensaje}, pero sólo en este navegador: no hay conexión con el servidor.`
const getLocalDb = () => {
  try {
    const raw = localStorage.getItem(STORAGE_DATA_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(initialMockDatabase))
      return JSON.parse(JSON.stringify(initialMockDatabase))
    }
    const db = JSON.parse(raw)
    let updated = false

    if (!Array.isArray(db.comandas_activas)) {
      db.comandas_activas = []
      updated = true
    }

    if (Array.isArray(db.ventas)) {
      const ventasReales = db.ventas.filter((v) => !DEMO_VENTA_IDS.has(v.id))
      if (ventasReales.length !== db.ventas.length) {
        db.ventas = ventasReales
        updated = true
      }
    } else {
      db.ventas = []
      updated = true
    }

    if (Array.isArray(db.detalle_ventas)) {
      const detallesReales = db.detalle_ventas.filter((d) => !DEMO_DETALLE_IDS.has(d.id))
      if (detallesReales.length !== db.detalle_ventas.length) {
        db.detalle_ventas = detallesReales
        updated = true
      }
    } else {
      db.detalle_ventas = []
      updated = true
    }

    if (Array.isArray(db.auditoria_logs)) {
      const logsReales = db.auditoria_logs.filter((a) => !DEMO_AUDIT_IDS.has(a.id))
      if (logsReales.length !== db.auditoria_logs.length) {
        db.auditoria_logs = logsReales
        updated = true
      }
    } else {
      db.auditoria_logs = []
      updated = true
    }

    if (Array.isArray(db.usuarios)) {
      for (const seedUser of initialMockDatabase.usuarios) {
        const existing = db.usuarios.find((u) => u.email?.toLowerCase() === seedUser.email)
        if (!existing) {
          db.usuarios.push({ ...seedUser })
          updated = true
        } else {
          if (!existing.password) {
            existing.password = seedUser.password
            existing.localOnly = true
            updated = true
          }
          if (!existing.telefono && seedUser.telefono) {
            existing.telefono = seedUser.telefono
            updated = true
          }
          if (!existing.puesto && seedUser.puesto) {
            existing.puesto = seedUser.puesto
            updated = true
          }
          if (!existing.estado) {
            existing.estado = seedUser.estado || 'activo'
            updated = true
          }
          if (!existing.notas && seedUser.notas) {
            existing.notas = seedUser.notas
            updated = true
          }
          if (!existing.creado_en && seedUser.creado_en) {
            existing.creado_en = seedUser.creado_en
            updated = true
          }
        }
      }
      for (const u of db.usuarios) {
        if (u.nombre === 'Super Administrador SaaS') {
          u.nombre = 'Super Administrador'
          updated = true
        }
        if (!u.estado) {
          u.estado = 'activo'
          updated = true
        }
        if (!u.puesto) {
          u.puesto = u.rol === 'admin' ? 'Administrador' : (u.rol === 'superadmin' ? 'Director de Plataforma' : (u.rol === 'consulta' ? 'Consulta' : 'Personal'))
          updated = true
        }
      }

      if (Array.isArray(db.organizaciones)) {
        for (const seedOrg of initialMockDatabase.organizaciones) {
          const existingOrg = db.organizaciones.find((o) => o.id === seedOrg.id)
          if (!existingOrg) {
            db.organizaciones.push({ ...seedOrg })
            updated = true
          } else {
            if (!existingOrg.plan) { existingOrg.plan = seedOrg.plan; updated = true }
            if (!existingOrg.estado_suscripcion) { existingOrg.estado_suscripcion = seedOrg.estado_suscripcion; updated = true }
            if (!existingOrg.monto_mensual) { existingOrg.monto_mensual = seedOrg.monto_mensual; updated = true }
            if (!existingOrg.fecha_vencimiento) { existingOrg.fecha_vencimiento = seedOrg.fecha_vencimiento; updated = true }
            if (existingOrg.bloqueo_mora === undefined) { existingOrg.bloqueo_mora = seedOrg.bloqueo_mora; updated = true }
            if (!existingOrg.admin_email && seedOrg.admin_email) { existingOrg.admin_email = seedOrg.admin_email; updated = true }
          }
        }
      }
    }

    if (updated) saveLocalDb(db)
    return db
  } catch {
    return JSON.parse(JSON.stringify(initialMockDatabase))
  }
}

const saveLocalDb = (db) => {
  try {
    localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(db))
  } catch (err) {
    console.error('Error guardando en almacenamiento local:', err)
  }
}

// Estado reactivo global de la sesión (sin autologin si no existe sesión guardada)
let savedSession = (() => {
  try {
    const item = localStorage.getItem(STORAGE_SESSION_KEY)
    const parsed = item ? JSON.parse(item) : null
    if (parsed?.user?.nombre === 'Super Administrador SaaS') {
      parsed.user.nombre = 'Super Administrador'
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(parsed))
    }
    return parsed
  } catch {
    return null
  }
})()

// Si quedó pegada la sesión de una cuenta de demostración, se descarta.
if (savedSession && CUENTAS_DEMO.includes(savedSession.user?.email?.toLowerCase())) {
  try {
    localStorage.removeItem(STORAGE_SESSION_KEY)
  } catch {
    // navegador sin almacenamiento: alcanza con no usarla
  }
  savedSession = null
}

export const authState = reactive({
  token: savedSession?.token || null,
  user: savedSession?.user || null,
  organizacion: savedSession?.organizacion || null,
  rol: savedSession?.rol || null, // 'admin' | 'empleado' | 'consulta' | null
  backendConnected: Boolean(savedSession?.token && !String(savedSession.token).startsWith('demo_token_')),
})

const persistSession = () => {
  if (authState.user) {
    localStorage.setItem(
      STORAGE_SESSION_KEY,
      JSON.stringify({
        token: authState.token,
        user: authState.user,
        organizacion: authState.organizacion,
        rol: authState.rol,
      }),
    )
  } else {
    localStorage.removeItem(STORAGE_SESSION_KEY)
  }
}

// Validación idéntica a la del backend (validarProducto)
export const validarReglasProducto = (datos, { parcial = false } = {}) => {
  const errores = {}
  const presente = (c) => datos[c] !== undefined && datos[c] !== null && String(datos[c]).trim() !== ''

  if (presente('nombre')) {
    const nombre = String(datos.nombre).trim()
    if (nombre.length < 2 || nombre.length > 80) {
      errores.nombre = 'El nombre debe tener entre 2 y 80 caracteres'
    }
  } else if (!parcial) {
    errores.nombre = 'El nombre es obligatorio'
  }

  if (presente('precio')) {
    const precio = Number(datos.precio)
    if (!Number.isFinite(precio) || precio < 0) {
      errores.precio = 'El precio debe ser un número mayor o igual a 0'
    }
  } else if (!parcial) {
    errores.precio = 'El precio es obligatorio'
  }

  if (presente('stock')) {
    const stock = Number(datos.stock)
    if (!Number.isInteger(stock) || stock < 0) {
      errores.stock = 'El stock debe ser un número entero mayor o igual a 0'
    }
  }

  if (datos.descripcion !== undefined && datos.descripcion !== null) {
    const desc = String(datos.descripcion).trim()
    if (desc.length > 500) {
      errores.descripcion = 'La descripción no puede superar los 500 caracteres'
    }
  }

  if (presente('imagen_url')) {
    const imgStr = String(datos.imagen_url).trim()
    if (!/^(https?:\/\/|data:image\/)/i.test(imgStr)) {
      errores.imagen_url = 'La imagen debe ser una URL http(s) válida o un archivo subido desde el dispositivo'
    }
  }

  return {
    valido: Object.keys(errores).length === 0,
    errores,
  }
}

// Servicios de autenticación
export const authService = {
  isAuthenticated: computed(() => Boolean(authState.user && authState.organizacion)),
  isAdmin: computed(() => authState.rol === 'admin'),
  canEdit: computed(() => authState.rol === 'admin' || authState.rol === 'empleado'),
  canDelete: computed(() => authState.rol === 'admin'),

  // Permite simular y cambiar de rol al instante para pruebas y verificación
  cambiarRol(nuevoRol) {
    if (ROLES_ASIGNABLES.includes(nuevoRol)) {
      authState.rol = nuevoRol
      persistSession()
    }
  },

  async login({ email, password }) {
    const cleanEmail = email.trim().toLowerCase()
    const db = getLocalDb()
    const localUser = db.usuarios.find((u) => u.email?.toLowerCase() === cleanEmail)

    // Intento con backend real (Supabase)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        authState.token = json.data.session.access_token
        authState.user = json.data.user
        authState.rol = json.data.rol || 'admin'
        authState.organizacion = {
          id: json.data.organizacion_id,
          nombre: json.data.organizacion_nombre || json.data.user?.user_metadata?.organizacion || 'Mi Negocio',
        }
        authState.backendConnected = true
        persistSession()
        // Trae el plano y las reservas de la base: antes sólo existían en el
        // navegador donde se habían creado.
        await sincronizarConServidor()
        return { success: true, message: json.message }
      }

      const permiteFallbackLocal = Boolean(localUser && localUser.localOnly && localUser.password === password)
      if (res.status !== 503 && !json.success && !permiteFallbackLocal) {
        const msg = String(json.message || '')
        if (msg.toLowerCase().includes('invalid login credentials')) {
          return { success: false, message: 'Correo o contraseña incorrectos.' }
        }
        if (msg.toLowerCase().includes('email not confirmed')) {
          return { success: false, message: 'Tu correo todavía no fue confirmado. Revisá tu bandeja de entrada para activar la cuenta.' }
        }
        return { success: false, message: msg || 'No se pudo iniciar sesión.' }
      }
    } catch {
      // Backend no disponible o sin conexión
    }

    // Fallback si el backend está offline / 503: solo usuarios ya registrados localmente
    if (localUser) {
      if (localUser.password && localUser.password !== password) {
        return { success: false, message: 'Correo o contraseña incorrectos.' }
      }
      const org = db.organizaciones.find((o) => o.id === localUser.organizacion_id) || db.organizaciones[0]
      authState.token = 'demo_token_' + localUser.id
      authState.user = { id: localUser.id, email: localUser.email, nombre: localUser.nombre }
      authState.organizacion = org
      authState.rol = localUser.rol || 'admin'
      authState.backendConnected = false
      persistSession()
      return { success: true, message: 'Inicio de sesión exitoso' }
    }

    return { success: false, message: 'Correo o contraseña incorrectos.' }
  },

  logout() {
    authState.token = null
    authState.user = null
    authState.organizacion = null
    authState.rol = null
    persistSession()
  },
}

// Servicios del módulo de productos (ABM)
export const productosService = {
  async listar({ q = '', activo = null, orden = 'creado_en', dir = 'desc', pagina = 1, limite = 100 } = {}) {
    // Intento con backend si hay sesión y token real
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        if (activo !== null && activo !== '') params.set('activo', String(activo))
        if (orden) params.set('orden', orden)
        if (dir) params.set('dir', dir)
        params.set('pagina', String(pagina))
        params.set('limite', String(limite))

        const res = await fetch(`/api/productos?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success) {
          return { success: true, data: json.data, total: json.total }
        }
      } catch {
        // Fallback local
      }
    }

    // Aislamiento Multi-Tenencia estricto por organización
    const db = getLocalDb()
    const currentOrgId = authState.organizacion?.id || 'org_demo_1'

    let list = db.productos.filter((p) => p.organizacion_id === currentOrgId)

    // Búsqueda por nombre (insensible a mayúsculas)
    if (q && q.trim()) {
      const term = q.trim().toLowerCase()
      list = list.filter((p) => p.nombre.toLowerCase().includes(term))
    }

    // Filtro por estado activo / inactivo
    if (activo === true || activo === 'true') {
      list = list.filter((p) => p.activo === true)
    } else if (activo === false || activo === 'false') {
      list = list.filter((p) => p.activo === false)
    }

    // Ordenación
    list.sort((a, b) => {
      let va = a[orden]
      let vb = b[orden]
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()

      if (va < vb) return dir === 'asc' ? -1 : 1
      if (va > vb) return dir === 'asc' ? 1 : -1
      return 0
    })

    const total = list.length
    const offset = (pagina - 1) * limite
    const paginated = list.slice(offset, offset + limite)

    return {
      success: true,
      data: paginated,
      total,
      pagina,
      limite,
    }
  },

  async obtener(id) {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/productos/${id}`, {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success) return { success: true, data: json.data }
      } catch {
        // Fallback
      }
    }

    const db = getLocalDb()
    const currentOrgId = authState.organizacion?.id || 'org_demo_1'
    const item = db.productos.find((p) => p.id === id && p.organizacion_id === currentOrgId)

    if (!item) {
      return { success: false, message: 'Producto no encontrado o pertenece a otra organización' }
    }
    return { success: true, data: item }
  },

  async crear(payload) {
    // Control de roles en frontend (backend también lo valida con requireRole)
    if (!['admin', 'empleado'].includes(authState.rol)) {
      return {
        success: false,
        message: 'Acceso denegado: no tenés permisos para crear productos.',
      }
    }

    // Validación de reglas idénticas
    const { valido, errores } = validarReglasProducto(payload)
    if (!valido) {
      return { success: false, message: 'Hay campos inválidos o incompletos', errors: errores }
    }

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch('/api/productos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (res.ok && json.success) {
          return { success: true, message: json.message || 'Producto creado correctamente', data: json.data }
        }
        return { success: false, message: json.message, errors: json.errors }
      } catch {
        // Fallback
      }
    }

    const db = getLocalDb()
    const nuevo = {
      id: 'prod_' + Date.now(),
      organizacion_id: authState.organizacion?.id || 'org_demo_1',
      usuario_id: authState.user?.id || 'usr_demo',
      nombre: payload.nombre.trim(),
      descripcion: (payload.descripcion || '').trim(),
      precio: Number(payload.precio),
      stock: Number(payload.stock ?? 0),
      activo: payload.activo !== undefined ? Boolean(payload.activo) : true,
      imagen_url: payload.imagen_url?.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80',
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    }

    db.productos.unshift(nuevo)
    saveLocalDb(db)

    return {
      success: true,
      message: avisoLocal('Producto creado correctamente'),
      data: nuevo,
    }
  },

  async actualizar(id, payload) {
    if (!['admin', 'empleado'].includes(authState.rol)) {
      return {
        success: false,
        message: 'Acceso denegado: no tenés permisos para modificar productos.',
      }
    }

    // Regla de roles: el empleado NO puede modificar el stock numérico
    const datosAEnviar = { ...payload }
    if (authState.rol === 'empleado' && datosAEnviar.stock !== undefined) {
      delete datosAEnviar.stock
    }

    const { valido, errores } = validarReglasProducto(datosAEnviar, { parcial: true })
    if (!valido) {
      return { success: false, message: 'Hay campos inválidos', errors: errores }
    }

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/productos/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify(datosAEnviar),
        })
        const json = await res.json()
        if (res.ok && json.success) {
          return { success: true, message: json.message || 'Producto modificado correctamente', data: json.data }
        }
        return { success: false, message: json.message, errors: json.errors }
      } catch {
        // Fallback
      }
    }

    const db = getLocalDb()
    const currentOrgId = authState.organizacion?.id || 'org_demo_1'
    const index = db.productos.findIndex((p) => p.id === id && p.organizacion_id === currentOrgId)

    if (index === -1) {
      return { success: false, message: 'Producto no encontrado o pertenece a otra organización.' }
    }

    const actualizado = {
      ...db.productos[index],
      ...datosAEnviar,
      nombre: datosAEnviar.nombre ? datosAEnviar.nombre.trim() : db.productos[index].nombre,
      precio: datosAEnviar.precio !== undefined ? Number(datosAEnviar.precio) : db.productos[index].precio,
      actualizado_en: new Date().toISOString(),
    }
    // Solo actualiza stock si no es empleado
    if (authState.rol !== 'empleado' && datosAEnviar.stock !== undefined) {
      actualizado.stock = Number(datosAEnviar.stock)
    }

    db.productos[index] = actualizado
    saveLocalDb(db)

    return {
      success: true,
      message: avisoLocal('Producto modificado correctamente'),
      data: actualizado,
    }
  },

  async notificarFaltaStock(id, motivo = '') {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/productos/${id}/notificar-stock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({ motivo }),
        })
        const json = await res.json()
        if (res.ok && json.success) {
          return { success: true, message: json.message }
        }
      } catch {
        // Fallback local
      }
    }

    const db = getLocalDb()
    const currentOrgId = authState.organizacion?.id || 'org_demo_1'
    const prod = db.productos.find((p) => p.id === id && p.organizacion_id === currentOrgId)
    if (!prod) {
      return { success: false, message: 'Producto no encontrado' }
    }

    const nuevoLog = {
      id: 'log_' + Date.now(),
      organizacion_id: currentOrgId,
      usuario_id: authState.user?.id || 'usr_empleado_1',
      usuario_nombre: authState.user?.nombre || authState.user?.email || 'Empleado de salón/cocina',
      accion: 'alerta_stock',
      detalles: {
        producto_id: prod.id,
        producto_nombre: prod.nombre,
        stock_actual: prod.stock,
        motivo: motivo || 'Notificación urgente: falta de stock / producto agotado reportado por empleado.',
      },
      created_at: new Date().toISOString(),
    }

    if (!db.auditoria_logs) db.auditoria_logs = []
    db.auditoria_logs.unshift(nuevoLog)
    saveLocalDb(db)

    return {
      success: true,
      message: `Alerta enviada: Se notificó al administrador la falta de stock para "${prod.nombre}".`,
    }
  },

  async eliminar(id) {
    // Control estricto de roles: SOLO admin puede eliminar
    if (authState.rol !== 'admin') {
      return {
        success: false,
        message: `Acceso denegado: Tu rol (${authState.rol}) no tiene permiso para eliminar productos. Solo los administradores pueden borrar registros.`,
      }
    }

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/productos/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success) {
          return { success: true, message: json.message || 'Producto eliminado correctamente' }
        }
        return { success: false, message: json.message }
      } catch {
        // Fallback
      }
    }

    const db = getLocalDb()
    const currentOrgId = authState.organizacion?.id || 'org_demo_1'
    const index = db.productos.findIndex((p) => p.id === id && p.organizacion_id === currentOrgId)

    if (index === -1) {
      return { success: false, message: 'Producto no encontrado o pertenece a otra organización.' }
    }

    db.productos.splice(index, 1)
    saveLocalDb(db)

    return {
      success: true,
      message: avisoLocal('Producto eliminado correctamente'),
    }
  },
}

// Servicios del Módulo de Super-Administración y Métricas (Solo Admin)
export const adminService = {
  async getKpis() {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch('/api/admin/dashboard/kpis', {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success) return { success: true, data: json.data }
      } catch {
        // Fallback
      }
    }

    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'

    const ventas = (db.ventas || []).filter((v) => v.organizacion_id === orgId && v.estado === 'completada')
    const ticketsTotal = ventas.length
    const facturacionTotal = ventas.reduce((acc, v) => acc + Number(v.total || 0), 0)
    const ticketMedio = ticketsTotal > 0 ? facturacionTotal / ticketsTotal : 0

    const pagosCount = { efectivo: 0, tarjeta: 0, transferencia_qr: 0 }
    ventas.forEach((v) => {
      if (pagosCount[v.metodo_pago] !== undefined) pagosCount[v.metodo_pago]++
    })

    const pagosPorcentaje = {
      efectivo: ticketsTotal > 0 ? Math.round((pagosCount.efectivo / ticketsTotal) * 100) : 0,
      tarjeta: ticketsTotal > 0 ? Math.round((pagosCount.tarjeta / ticketsTotal) * 100) : 0,
      transferencia_qr: ticketsTotal > 0 ? Math.round((pagosCount.transferencia_qr / ticketsTotal) * 100) : 0,
    }

    const stockCritico = (db.productos || [])
      .filter((p) => p.organizacion_id === orgId && p.stock <= 5)
      .sort((a, b) => a.stock - b.stock)

    const ventasIds = new Set(ventas.map((v) => v.id))
    const productosById = new Map((db.productos || []).map((p) => [p.id, p]))
    const vendidosMap = new Map()
    for (const det of db.detalle_ventas || []) {
      if (!ventasIds.has(det.venta_id)) continue
      const prod = productosById.get(det.producto_id)
      const prev = vendidosMap.get(det.producto_id) || {
        id: det.producto_id,
        nombre: prod?.nombre || 'Producto',
        cantidad: 0,
      }
      prev.cantidad += Number(det.cantidad || 0)
      vendidosMap.set(det.producto_id, prev)
    }

    const platosMasVendidos = Array.from(vendidosMap.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5)

    return {
      success: true,
      data: {
        facturacionTotal,
        ticketsTotal,
        ticketMedio,
        pagosPorcentaje,
        pagosCount,
        stockCritico,
        platosMasVendidos,
      },
    }
  },

  async getVentas({ desde = '', hasta = '', metodo_pago = '', estado = '', pagina = 1, limite = 20 } = {}) {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const params = new URLSearchParams()
        if (desde) params.set('desde', desde)
        if (hasta) params.set('hasta', hasta)
        if (metodo_pago) params.set('metodo_pago', metodo_pago)
        if (estado) params.set('estado', estado)
        params.set('pagina', String(pagina))
        params.set('limite', String(limite))

        const res = await fetch(`/api/admin/ventas?${params.toString()}`, {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success) return { success: true, data: json.data, total: json.total }
      } catch {
        // Fallback
      }
    }

    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'

    let list = (db.ventas || []).filter((v) => v.organizacion_id === orgId)

    if (metodo_pago) list = list.filter((v) => v.metodo_pago === metodo_pago)
    if (estado) list = list.filter((v) => v.estado === estado)
    if (desde) list = list.filter((v) => new Date(v.created_at) >= new Date(desde))
    if (hasta) list = list.filter((v) => new Date(v.created_at) <= new Date(hasta))

    // Adjuntar detalle_ventas y nombre de producto
    const enriched = list.map((v) => {
      const items = (db.detalle_ventas || [])
        .filter((d) => d.venta_id === v.id)
        .map((d) => {
          const prod = (db.productos || []).find((p) => p.id === d.producto_id)
          return {
            ...d,
            productos: { id: d.producto_id, nombre: prod?.nombre || 'Producto' },
          }
        })
      return {
        ...v,
        detalle_ventas: items,
      }
    })

    enriched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const total = enriched.length
    const offset = (pagina - 1) * limite
    return {
      success: true,
      data: enriched.slice(offset, offset + limite),
      total,
      pagina,
      limite,
    }
  },

  async anularVenta(id, motivo) {
    if (!motivo || String(motivo).trim().length < 5) {
      return {
        success: false,
        message: 'Debe ingresar un motivo de anulación válido (mínimo 5 caracteres).',
      }
    }

    if (authState.rol !== 'admin') {
      return {
        success: false,
        message: 'Acceso denegado: sólo el Administrador puede anular tickets de venta.',
      }
    }

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/admin/ventas/${id}/anular`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({ motivo: motivo.trim() }),
        })
        const json = await res.json()
        if (res.ok && json.success) return { success: true, message: json.message }
        return { success: false, message: json.message }
      } catch {
        // Fallback
      }
    }

    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    const venta = (db.ventas || []).find((v) => v.id === id && v.organizacion_id === orgId)

    if (!venta) {
      return { success: false, message: 'Ticket de venta no encontrado.' }
    }
    if (venta.estado === 'anulada') {
      return { success: false, message: 'El ticket ya se encuentra anulado.' }
    }

    venta.estado = 'anulada'
    venta.anulado_en = new Date().toISOString()
    venta.anulado_por = authState.user?.id || 'usr_admin_1'
    venta.motivo_anulacion = motivo.trim()

    // Restituir stock
    const detalles = (db.detalle_ventas || []).filter((d) => d.venta_id === id)
    detalles.forEach((det) => {
      const prod = (db.productos || []).find((p) => p.id === det.producto_id)
      if (prod) prod.stock = (prod.stock || 0) + det.cantidad
    })

    // Registrar log inmutable de auditoría
    if (!db.auditoria_logs) db.auditoria_logs = []
    db.auditoria_logs.unshift({
      id: 'aud_' + Date.now(),
      organizacion_id: orgId,
      usuario_id: authState.user?.id || 'usr_admin_1',
      accion: 'anulacion_ticket',
      detalles: {
        venta_id: venta.id,
        mesa_numero: venta.mesa_numero,
        total: venta.total,
        motivo: motivo.trim(),
      },
      created_at: new Date().toISOString(),
    })

    saveLocalDb(db)

    return {
      success: true,
      message: avisoLocal('Ticket anulado y stock restituido'),
    }
  },

  async getAuditoria() {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch('/api/admin/auditoria', {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success) return { success: true, data: json.data }
      } catch {
        // Fallback
      }
    }

    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    const logs = (db.auditoria_logs || [])
      .filter((a) => a.organizacion_id === orgId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return {
      success: true,
      data: logs,
    }
  },

  async getUsuarios() {
    if (!['admin', 'superadmin'].includes(authState.rol)) {
      return { success: false, message: 'Solo el administrador puede consultar usuarios.', data: [] }
    }

    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    const locales = (db.usuarios || [])
      .filter((u) => u.organizacion_id === orgId)
      .map((u) => ({
        usuario_id: u.id,
        nombre: u.nombre || u.email,
        email: u.email,
        rol: u.rol || 'empleado',
        telefono: u.telefono || '',
        puesto: u.puesto || (u.rol === 'admin' ? 'Administrador' : 'Personal'),
        estado: u.estado || 'activo',
        notas: u.notas || '',
        creado_en: u.creado_en || null,
      }))

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch('/api/admin/usuarios', {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success && Array.isArray(json.data)) {
          const mapaLocal = new Map(locales.map((u) => [u.usuario_id, u]))
          let remotos = json.data.map((m) => {
            const localInfo = mapaLocal.get(m.usuario_id)
            return {
              usuario_id: m.usuario_id,
              nombre: m.nombre || localInfo?.nombre || (m.usuario_id === authState.user?.id ? (authState.user?.nombre || authState.user?.email?.split('@')[0]) : 'Usuario del local'),
              email: m.email || localInfo?.email || (m.usuario_id === authState.user?.id ? authState.user?.email : m.usuario_id),
              rol: m.rol || 'empleado',
              telefono: m.telefono || localInfo?.telefono || '',
              puesto: m.puesto || localInfo?.puesto || (m.rol === 'admin' ? 'Administrador' : 'Personal'),
              estado: m.estado || localInfo?.estado || 'activo',
              notas: m.notas || localInfo?.notas || '',
              creado_en: m.creado_en,
            }
          })

          // Si el usuario actual no figura, agregarlo para que siempre se vea su cuenta
          if (authState.user && !remotos.some((u) => u.usuario_id === authState.user.id)) {
            remotos.unshift({
              usuario_id: authState.user.id,
              nombre: authState.user.nombre || authState.user.email?.split('@')[0] || 'Administrador',
              email: authState.user.email,
              rol: authState.rol || 'admin',
              telefono: '',
              puesto: 'Administrador General',
              estado: 'activo',
              notas: 'Cuenta administradora activa',
              creado_en: null,
            })
          }

          return { success: true, data: remotos }
        }
      } catch {
        // Fallback local
      }
    }

    return { success: true, data: locales }
  },

  async getUsuarioById(usuarioId) {
    if (!['admin', 'superadmin'].includes(authState.rol)) {
      return { success: false, message: 'Solo el administrador puede ver perfiles de usuario.' }
    }

    const res = await this.getUsuarios()
    if (!res.success) return res

    const usuario = (res.data || []).find((u) => (u.usuario_id || u.id) === usuarioId)
    if (!usuario) {
      return { success: false, message: 'Usuario no encontrado en la organización.' }
    }

    return { success: true, data: usuario }
  },

  async crearUsuario({ nombre, email, password, rol = 'empleado', telefono = '', puesto = '', estado = 'activo', notas = '' }) {
    if (!['admin', 'superadmin'].includes(authState.rol)) {
      return { success: false, message: 'Solo el administrador puede crear nuevos usuarios.' }
    }

    const nombreLimpio = (nombre || '').trim()
    const emailLimpio = (email || '').trim().toLowerCase()
    if (!nombreLimpio || !emailLimpio || !password || password.length < 8) {
      return {
        success: false,
        message: 'Completá nombre, correo válido y contraseña de al menos 8 caracteres.',
      }
    }

    if (!ROLES_ASIGNABLES.includes(rol)) {
      return { success: false, message: 'El rol seleccionado no es válido.' }
    }

    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'

    if ((db.usuarios || []).some((u) => u.email?.toLowerCase() === emailLimpio)) {
      return { success: false, message: 'Ya existe un usuario con ese correo electrónico.' }
    }

    let creadoEnBackend = false
    let backendUsuario = null

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch('/api/admin/usuarios', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({ nombre: nombreLimpio, email: emailLimpio, password, rol, telefono, puesto, estado, notas }),
        })
        const json = await res.json()
        if (res.ok && json.success) {
          creadoEnBackend = true
          backendUsuario = json.data
        } else {
          const msg = String(json.message || '').toLowerCase()
          const fallbackable = msg.includes('rate limit') || res.status === 503
          if (!fallbackable) {
            return { success: false, message: json.message || 'No se pudo crear el usuario.' }
          }
        }
      } catch {
        // Fallback local si el servidor no responde
      }
    }

    const nuevoId = backendUsuario?.usuario_id || ('usr_' + Date.now())
    const ahora = new Date().toISOString()

    if (!db.usuarios) db.usuarios = []
    db.usuarios.push({
      id: nuevoId,
      email: emailLimpio,
      password,
      nombre: nombreLimpio,
      telefono: telefono.trim(),
      puesto: puesto.trim() || (rol === 'admin' ? 'Administrador' : 'Personal'),
      estado: estado || 'activo',
      notas: notas.trim(),
      organizacion_id: orgId,
      rol,
      creado_en: ahora,
      localOnly: !creadoEnBackend,
    })

    if (!db.auditoria_logs) db.auditoria_logs = []
    db.auditoria_logs.unshift({
      id: 'aud_' + Date.now(),
      organizacion_id: orgId,
      usuario_id: authState.user?.id || 'usr_admin_1',
      accion: 'alta_usuario',
      detalles: {
        usuario_creado: nuevoId,
        nombre: nombreLimpio,
        email: emailLimpio,
        rol,
        puesto: puesto.trim(),
        estado,
      },
      created_at: ahora,
    })

    saveLocalDb(db)

    return {
      success: true,
      message: `Usuario ${nombreLimpio} creado con éxito (${rol}).`,
      data: {
        usuario_id: nuevoId,
        nombre: nombreLimpio,
        email: emailLimpio,
        rol,
        telefono: telefono.trim(),
        puesto: puesto.trim() || (rol === 'admin' ? 'Administrador' : 'Personal'),
        estado: estado || 'activo',
        notas: notas.trim(),
        creado_en: ahora,
      },
    }
  },

  async actualizarUsuario({ id, nombre, email, rol, telefono, puesto, estado, notas, password }) {
    if (!['admin', 'superadmin'].includes(authState.rol)) {
      return { success: false, message: 'Solo el administrador puede editar información de usuarios.' }
    }

    if (!id) {
      return { success: false, message: 'ID de usuario requerido.' }
    }

    if (rol && !['admin', 'empleado'].includes(rol)) {
      return { success: false, message: 'Rol inválido.' }
    }

    if (id === authState.user?.id && rol && rol !== 'admin') {
      return { success: false, message: 'No podés revocar tu propio permiso de administrador.' }
    }

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/admin/usuarios/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({ nombre, email, rol, telefono, puesto, estado, notas, password }),
        })
        const json = await res.json()
        if (!res.ok && res.status !== 503) {
          return { success: false, message: json.message || 'No se pudo actualizar el usuario.' }
        }
      } catch {
        // Fallback local
      }
    }

    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    const usuario = (db.usuarios || []).find((u) => u.id === id && u.organizacion_id === orgId)
    if (!usuario) {
      return { success: false, message: 'Usuario no encontrado en la organización.' }
    }

    if (nombre !== undefined && nombre.trim()) usuario.nombre = nombre.trim()
    if (email !== undefined && email.trim()) usuario.email = email.trim().toLowerCase()
    if (rol) usuario.rol = rol
    if (telefono !== undefined) usuario.telefono = String(telefono).trim()
    if (puesto !== undefined) usuario.puesto = String(puesto).trim()
    if (estado !== undefined) usuario.estado = estado
    if (notas !== undefined) usuario.notas = String(notas).trim()
    if (password && password.length >= 8) usuario.password = password

    // Si es el usuario logueado actualmente, actualizar authState
    if (authState.user?.id === id) {
      if (usuario.nombre) authState.user.nombre = usuario.nombre
      if (usuario.email) authState.user.email = usuario.email
      if (usuario.rol) authState.rol = usuario.rol
      persistSession()
    }

    if (!db.auditoria_logs) db.auditoria_logs = []
    db.auditoria_logs.unshift({
      id: 'aud_' + Date.now(),
      organizacion_id: orgId,
      usuario_id: authState.user?.id || 'usr_admin_1',
      accion: 'cambio_rol',
      detalles: {
        tipo_modificacion: 'perfil_usuario',
        usuario_afectado: id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        puesto: usuario.puesto,
        estado: usuario.estado,
      },
      created_at: new Date().toISOString(),
    })

    saveLocalDb(db)
    return {
      success: true,
      message: `Información de ${usuario.nombre} actualizada correctamente.`,
      data: {
        usuario_id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        telefono: usuario.telefono,
        puesto: usuario.puesto,
        estado: usuario.estado,
        notas: usuario.notas,
        creado_en: usuario.creado_en,
      },
    }
  },

  async eliminarUsuario(usuarioId) {
    if (!['admin', 'superadmin'].includes(authState.rol)) {
      return { success: false, message: 'Solo el administrador puede eliminar usuarios.' }
    }

    if (usuarioId === authState.user?.id) {
      return { success: false, message: 'No podés eliminar tu propia cuenta de administrador.' }
    }

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/admin/usuarios/${usuarioId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (!res.ok && res.status !== 503) {
          return { success: false, message: json.message || 'No se pudo eliminar el usuario.' }
        }
      } catch {
        // Fallback local
      }
    }

    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    const index = (db.usuarios || []).findIndex((u) => u.id === usuarioId && u.organizacion_id === orgId)
    if (index === -1) {
      return { success: false, message: 'Usuario no encontrado.' }
    }

    const [eliminado] = db.usuarios.splice(index, 1)

    if (!db.auditoria_logs) db.auditoria_logs = []
    db.auditoria_logs.unshift({
      id: 'aud_' + Date.now(),
      organizacion_id: orgId,
      usuario_id: authState.user?.id || 'usr_admin_1',
      accion: 'baja_producto',
      detalles: {
        accion_real: 'baja_usuario',
        usuario_eliminado: usuarioId,
        nombre: eliminado?.nombre,
      },
      created_at: new Date().toISOString(),
    })

    saveLocalDb(db)
    return { success: true, message: `Usuario ${eliminado?.nombre || ''} eliminado correctamente.` }
  },

  async cambiarRolUsuario(usuarioId, nuevoRol) {
    if (!['admin', 'superadmin'].includes(authState.rol)) {
      return { success: false, message: 'Solo el administrador puede cambiar permisos.' }
    }

    if (!ROLES_ASIGNABLES.includes(nuevoRol)) {
      return { success: false, message: 'Rol inválido.' }
    }

    if (usuarioId === authState.user?.id && nuevoRol !== 'admin') {
      return { success: false, message: 'No podés quitar tu propio permiso de administrador.' }
    }

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        // /api/miembros acepta los tres roles; /api/admin/usuarios/rol sólo
        // admin y empleado, así que no podía dejar a nadie en sólo lectura.
        const res = await fetch(`/api/miembros/${usuarioId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify({ rol: nuevoRol }),
        })
        const json = await res.json()
        if (!res.ok && res.status !== 503) {
          return { success: false, message: json.message || 'No se pudo actualizar el rol.' }
        }
        // Sin este return seguía al respaldo local y, al no encontrar ahí al
        // usuario, avisaba "Usuario no encontrado" pese a haberlo cambiado.
        if (res.ok) {
          return { success: true, message: json.message || `Permiso actualizado a ${nuevoRol}.` }
        }
      } catch {
        // Fallback local
      }
    }

    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    const usuario = (db.usuarios || []).find((u) => u.id === usuarioId && u.organizacion_id === orgId)
    if (!usuario) {
      return { success: false, message: 'Usuario no encontrado en la organización.' }
    }

    usuario.rol = nuevoRol

    if (!db.auditoria_logs) db.auditoria_logs = []
    db.auditoria_logs.unshift({
      id: 'aud_' + Date.now(),
      organizacion_id: orgId,
      usuario_id: authState.user?.id || 'usr_admin_1',
      accion: 'cambio_rol',
      detalles: {
        usuario_afectado: usuarioId,
        nombre: usuario.nombre,
        nuevo_rol: nuevoRol,
      },
      created_at: new Date().toISOString(),
    })

    saveLocalDb(db)
    return { success: true, message: `Permiso actualizado a ${nuevoRol}.` }
  },

  exportarVentasCSV(ventas) {
    if (!ventas || !ventas.length) return false

    const encabezados = ['ID Ticket', 'Fecha', 'Mesa', 'Total', 'Metodo Pago', 'Estado', 'Motivo Anulacion']
    const filas = ventas.map((v) => [
      `"${v.id}"`,
      `"${new Date(v.created_at).toLocaleString('es-AR')}"`,
      `"Mesa ${v.mesa_numero}"`,
      `"${v.total}"`,
      `"${v.metodo_pago}"`,
      `"${v.estado}"`,
      `"${(v.motivo_anulacion || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `ventas_trackmenu_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
  },
}

export const superAdminService = {
  async getKpis() {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch('/api/superadmin/kpis', {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success) return { success: true, data: json.data }
      } catch {}
    }

    const db = getLocalDb()
    const orgs = db.organizaciones || []
    const ahora = new Date()

    let totalAlDia = 0
    let totalEnMora = 0
    let totalBloqueados = 0
    let mrrTotal = 0
    let deudaEnMora = 0

    orgs.forEach((o) => {
      const monto = Number(o.monto_mensual || 20000)
      mrrTotal += monto
      const vencido = o.fecha_vencimiento && new Date(o.fecha_vencimiento) < ahora
      const esMora = o.estado_suscripcion === 'mora' || o.estado_suscripcion === 'pendiente' || vencido

      if (esMora) {
        totalEnMora++
        deudaEnMora += monto
      } else {
        totalAlDia++
      }

      if (o.bloqueo_mora) totalBloqueados++
    })

    return {
      success: true,
      data: {
        total_organizaciones: orgs.length,
        organizaciones_al_dia: totalAlDia,
        organizaciones_en_mora: totalEnMora,
        organizaciones_bloqueadas: totalBloqueados,
        mrr_total: mrrTotal,
        deuda_en_mora: deudaEnMora,
        total_productos: (db.productos || []).length,
        total_usuarios: (db.usuarios || []).length,
      },
    }
  },

  async getOrganizaciones() {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch('/api/superadmin/organizaciones', {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success && Array.isArray(json.data) && json.data.length > 0) {
          return { success: true, data: json.data }
        }
      } catch {}
    }

    const db = getLocalDb()
    const ahora = new Date()
    const lista = (db.organizaciones || []).map((o) => {
      const fechaVenc = o.fecha_vencimiento || null
      const vencido = fechaVenc && new Date(fechaVenc) < ahora
      let estado = o.estado_suscripcion || 'al_dia'
      if (vencido && estado === 'al_dia') estado = 'pendiente'

      let diasMora = 0
      if (fechaVenc && (estado === 'mora' || estado === 'pendiente' || vencido)) {
        const diff = ahora.getTime() - new Date(fechaVenc).getTime()
        if (diff > 0) diasMora = Math.floor(diff / (1000 * 60 * 60 * 24))
      }

      const totalProds = (db.productos || []).filter((p) => p.organizacion_id === o.id).length
      const totalUsers = (db.usuarios || []).filter((u) => u.organizacion_id === o.id).length

      return {
        id: o.id,
        nombre: o.nombre,
        plan: o.plan || 'pro',
        estado_suscripcion: estado,
        monto_mensual: Number(o.monto_mensual || 20000),
        fecha_vencimiento: fechaVenc,
        dias_mora: diasMora,
        bloqueo_mora: Boolean(o.bloqueo_mora),
        notas_facturacion: o.notas_facturacion || '',
        admin_nombre: o.admin_nombre || 'Administrador',
        admin_email: o.admin_email || '',
        telefono: o.telefono || '',
        total_productos: totalProds,
        total_usuarios: totalUsers,
        creado_en: o.creado_en || null,
      }
    })

    return { success: true, data: lista }
  },

  async getOrganizacionById(id) {
    if (!id) return { success: false, message: 'ID de organización requerido.' }

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/superadmin/organizaciones/${id}`, {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success && json.data) {
          return { success: true, data: json.data }
        }
      } catch {}
    }

    const res = await this.getOrganizaciones()
    if (!res.success) return res
    const org = (res.data || []).find((o) => o.id === id)
    if (!org) {
      return { success: false, message: 'Organización no encontrada.' }
    }
    return { success: true, data: org }
  },

  async crearOrganizacion(datos) {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch('/api/superadmin/organizaciones', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify(datos),
        })
        const json = await res.json()
        if (res.ok && json.success) return json
      } catch {}
    }

    const db = getLocalDb()
    const nuevoId = 'org_' + Date.now()
    const nueva = {
      id: nuevoId,
      nombre: datos.nombre.trim(),
      plan: datos.plan || 'pro',
      estado_suscripcion: datos.estado_suscripcion || 'al_dia',
      monto_mensual: Number(datos.monto_mensual) || 20000,
      fecha_vencimiento: datos.fecha_vencimiento || new Date(Date.now() + 30 * 86400000).toISOString(),
      bloqueo_mora: Boolean(datos.bloqueo_mora),
      notas_facturacion: (datos.notas_facturacion || '').trim(),
      admin_nombre: datos.admin_nombre || 'Administrador',
      admin_email: datos.admin_email || '',
      telefono: datos.telefono || '',
      creado_en: new Date().toISOString(),
    }

    if (!db.organizaciones) db.organizaciones = []
    db.organizaciones.unshift(nueva)

    if (datos.admin_email && datos.admin_password) {
      if (!db.usuarios) db.usuarios = []
      db.usuarios.push({
        id: 'usr_' + Date.now(),
        email: datos.admin_email.trim().toLowerCase(),
        password: datos.admin_password,
        nombre: datos.admin_nombre || 'Administrador',
        organizacion_id: nuevoId,
        rol: 'admin',
        estado: 'activo',
        puesto: 'Gerente General',
        creado_en: new Date().toISOString(),
        localOnly: true,
      })
    }

    saveLocalDb(db)
    return { success: true, message: `Negocio "${nueva.nombre}" creado exitosamente.`, data: nueva }
  },

  async actualizarOrganizacion(id, datos) {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/superadmin/organizaciones/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authState.token}`,
          },
          body: JSON.stringify(datos),
        })
        const json = await res.json()
        if (res.ok && json.success) return json
      } catch {}
    }

    const db = getLocalDb()
    const org = (db.organizaciones || []).find((o) => o.id === id)
    if (!org) return { success: false, message: 'Organización no encontrada.' }

    if (datos.nombre !== undefined) org.nombre = datos.nombre.trim()
    if (datos.plan !== undefined) org.plan = datos.plan
    if (datos.estado_suscripcion !== undefined) {
      org.estado_suscripcion = datos.estado_suscripcion
      if (datos.estado_suscripcion === 'al_dia') org.bloqueo_mora = false
    }
    if (datos.monto_mensual !== undefined) org.monto_mensual = Number(datos.monto_mensual)
    if (datos.fecha_vencimiento !== undefined) org.fecha_vencimiento = datos.fecha_vencimiento
    if (datos.bloqueo_mora !== undefined) org.bloqueo_mora = Boolean(datos.bloqueo_mora)
    if (datos.notas_facturacion !== undefined) org.notas_facturacion = datos.notas_facturacion.trim()

    saveLocalDb(db)
    return { success: true, message: 'Negocio y suscripción actualizados.', data: org }
  },

  async registrarPago(id) {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/superadmin/organizaciones/${id}/pago`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success) return json
      } catch {}
    }

    const db = getLocalDb()
    const org = (db.organizaciones || []).find((o) => o.id === id)
    if (!org) return { success: false, message: 'Organización no encontrada.' }

    org.estado_suscripcion = 'al_dia'
    org.bloqueo_mora = false
    org.fecha_vencimiento = new Date(Date.now() + 30 * 86400000).toISOString()

    saveLocalDb(db)
    return { success: true, message: `Pago registrado. ${org.nombre} quedó al día por 30 días.`, data: org }
  },

  async suspenderPorMora(id) {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/superadmin/organizaciones/${id}/suspender-mora`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success) return json
      } catch {}
    }

    const db = getLocalDb()
    const org = (db.organizaciones || []).find((o) => o.id === id)
    if (!org) return { success: false, message: 'Organización no encontrada.' }

    org.estado_suscripcion = 'mora'
    org.bloqueo_mora = true

    saveLocalDb(db)
    return { success: true, message: `Acceso de ${org.nombre} suspendido por falta de pago.`, data: org }
  },

  async eliminarOrganizacion(id) {
    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch(`/api/superadmin/organizaciones/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success) return json
      } catch {}
    }

    const db = getLocalDb()
    const idx = (db.organizaciones || []).findIndex((o) => o.id === id)
    if (idx === -1) return { success: false, message: 'Organización no encontrada.' }

    const [eliminada] = db.organizaciones.splice(idx, 1)
    saveLocalDb(db)
    return { success: true, message: `Organización ${eliminada.nombre} eliminada.` }
  },

  cambiarNegocioActivo(organizacion) {
    authState.organizacion = {
      id: organizacion.id,
      nombre: organizacion.nombre,
    }
    persistSession()
    return { success: true, message: `Cambiaste al negocio ${organizacion.nombre}.` }
  },
}

export const DEFAULT_MAPA_CONFIG = {
  formaLocal: 'rectangular', // 'rectangular' | 'cuadrada' | 'circular' | 'triangular' | 'forma_l' | 'forma_u' | 'con_terraza' | 'personalizada'
  dibujoPersonalizado: [],
  caja: { x: 12, y: 15, nombre: 'Caja / Cobro' },
  entrada: { x: 45, y: 96, nombre: 'Entrada Principal' },
  mesas: [
    { id: 'm1', numero: 1, x: 26, y: 22, forma: 'cuadrada', capacidad: 4, numeroManual: null },
    { id: 'm2', numero: 2, x: 48, y: 22, forma: 'cuadrada', capacidad: 4, numeroManual: null },
    { id: 'm3', numero: 3, x: 70, y: 22, forma: 'cuadrada', capacidad: 4, numeroManual: null },
    { id: 'm4', numero: 4, x: 26, y: 48, forma: 'cuadrada', capacidad: 4, numeroManual: null },
    { id: 'm5', numero: 5, x: 48, y: 48, forma: 'redonda', capacidad: 2, numeroManual: null },
    { id: 'm6', numero: 6, x: 70, y: 48, forma: 'redonda', capacidad: 2, numeroManual: null },
    { id: 'm7', numero: 7, x: 26, y: 74, forma: 'cuadrada', capacidad: 6, numeroManual: null },
    { id: 'm8', numero: 8, x: 48, y: 74, forma: 'cuadrada', capacidad: 4, numeroManual: null },
    { id: 'm9', numero: 9, x: 70, y: 74, forma: 'cuadrada', capacidad: 4, numeroManual: null },
    { id: 'm10', numero: 10, x: 88, y: 28, forma: 'redonda', capacidad: 2, numeroManual: null },
    { id: 'm11', numero: 11, x: 88, y: 52, forma: 'redonda', capacidad: 2, numeroManual: null },
    { id: 'm12', numero: 12, x: 88, y: 76, forma: 'redonda', capacidad: 2, numeroManual: null },
  ],
}

export const calcularDistanciaCaja = (mesa, caja) => {
  const cx = Number(caja?.x ?? 12)
  const cy = Number(caja?.y ?? 15)
  const mx = Number(mesa?.x ?? 50)
  const my = Number(mesa?.y ?? 50)
  return Math.sqrt(Math.pow(mx - cx, 2) + Math.pow(my - cy, 2))
}

export const autoNumerarMesas = (mesas = [], caja = { x: 12, y: 15 }, forzarTodas = false) => {
  if (!Array.isArray(mesas) || mesas.length === 0) return []

  if (forzarTodas) {
    const ordenadas = [...mesas].sort((a, b) => calcularDistanciaCaja(a, caja) - calcularDistanciaCaja(b, caja))
    return ordenadas.map((m, index) => ({
      ...m,
      numero: index + 1,
      numeroManual: null,
    }))
  }

  const numerosOcupados = new Set()
  mesas.forEach((m) => {
    if (m.numeroManual !== null && m.numeroManual !== undefined && String(m.numeroManual).trim() !== '') {
      const num = Number(m.numeroManual)
      if (Number.isInteger(num) && num > 0) {
        numerosOcupados.add(num)
      }
    }
  })

  const mesasSinManual = mesas
    .filter((m) => m.numeroManual === null || m.numeroManual === undefined || String(m.numeroManual).trim() === '')
    .sort((a, b) => calcularDistanciaCaja(a, caja) - calcularDistanciaCaja(b, caja))

  let proximo = 1
  const asignados = new Map()

  for (const m of mesasSinManual) {
    while (numerosOcupados.has(proximo)) {
      proximo++
    }
    asignados.set(m.id, proximo)
    numerosOcupados.add(proximo)
    proximo++
  }

  return mesas.map((m) => {
    if (m.numeroManual !== null && m.numeroManual !== undefined && String(m.numeroManual).trim() !== '') {
      const num = Number(m.numeroManual)
      return { ...m, numero: Number.isInteger(num) && num > 0 ? num : m.numero }
    }
    return { ...m, numero: asignados.get(m.id) || m.numero }
  })
}

const TOTAL_MESAS = 12

const normalizarMetodoPago = (metodoPago = 'efectivo') => {
  const texto = String(metodoPago || '').toLowerCase()
  if (texto.includes('transf') || texto.includes('qr')) return 'transferencia_qr'
  if (texto.includes('tarj')) return 'tarjeta'
  return 'efectivo'
}

const claveOpcionesItem = (opciones = []) =>
  JSON.stringify(Array.isArray(opciones) ? [...opciones].map((o) => String(o).trim()).filter(Boolean).sort() : [])

const calcularTotalComanda = (items = []) =>
  items.reduce((sum, item) => sum + Number(item.precio_unitario || 0) * Number(item.cantidad || 1), 0)

const headersConAuth = (conJson = false) => {
  const headers = {}
  if (conJson) headers['Content-Type'] = 'application/json'
  if (authState.token && !authState.token.startsWith('demo_token_')) {
    headers.Authorization = `Bearer ${authState.token}`
  }
  return headers
}

// Servicio real de Mesas y Pedidos Activos (sincronizado con catálogo, stock y ventas)
const conBackend = () => Boolean(authState.token) && !String(authState.token).startsWith('demo_token_')

const guardarMapaEnServidor = async (config) => {
  if (!conBackend()) return
  try {
    await fetch('/api/mapa', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authState.token}` },
      body: JSON.stringify({ config }),
    })
  } catch {
    // sin servidor queda la copia local y se reintenta al volver a guardar
  }
}

// Trae de la base el plano y las reservas y los deja en la caché local que
// usan las pantallas. Se llama al entrar y al abrir el salón.
export const sincronizarConServidor = async () => {
  if (!conBackend()) return { success: false }
  const orgId = authState.organizacion?.id || 'org_demo_1'
  const cabeceras = { Authorization: `Bearer ${authState.token}` }

  try {
    const [mapa, reservas] = await Promise.all([
      fetch('/api/mapa', { headers: cabeceras }).then((r) => r.json()),
      fetch('/api/reservas', { headers: cabeceras }).then((r) => r.json()),
    ])

    if (mapa?.success && mapa.data) {
      localStorage.setItem(`trackmenu_mapa_mesas_${orgId}`, JSON.stringify(mapa.data))
    }
    if (reservas?.success && Array.isArray(reservas.data)) {
      localStorage.setItem(`trackmenu_reservas_${orgId}`, JSON.stringify(reservas.data))
    }
    return { success: true }
  } catch {
    return { success: false }
  }
}

// Las reservas se guardan en la base además de la caché local. Las firmas de
// reservasService son síncronas (las usan muchas pantallas), así que el envío
// al servidor va por detrás y el id/código local se reemplaza por el real.
// El negocio del cliente sin sesión viene por la URL (?negocio=...), igual que
// en la carta del QR.
const organizacionDelCliente = () => {
  if (authState.organizacion?.id) return authState.organizacion.id
  try {
    return new URLSearchParams(location.search).get('negocio') || ''
  } catch {
    return ''
  }
}

// Devuelve el código real de la reserva, o null si no se pudo guardar. Quien
// la crea tiene que avisar el fallo: confirmarle al cliente una reserva que el
// local nunca va a ver es peor que no tomarla.
const reservaAlServidor = async (reserva) => {
  const cuerpo = {
    fecha: reserva.fecha,
    hora: reserva.hora,
    personas: reserva.personas,
    mesa_numero: reserva.mesa_numero,
    mesa_capacidad: reserva.mesa_capacidad,
    nombre_cliente: reserva.nombre_cliente,
    telefono: reserva.telefono,
    notas: reserva.notas,
    sena_pagada: true,
    sena_metodo: reserva.sena_metodo,
    sena_comprobante: reserva.sena_comprobante,
  }

  const org = organizacionDelCliente()
  const conSesion = conBackend()
  if (!conSesion && !org) return { success: false, message: 'Para reservar entrá por el enlace o el QR del local.' }

  try {
    const res = await fetch(conSesion ? '/api/reservas' : `/api/publico/reservas/${org}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(conSesion ? { Authorization: `Bearer ${authState.token}` } : {}),
      },
      body: JSON.stringify(cuerpo),
    })
    const json = await res.json()
    if (!json?.success) return { success: false, message: json?.message }

    // El código que vale es el que generó el servidor: si el cliente se queda
    // con el local, consulta su reserva y no la encuentra.
    try {
      localStorage.setItem('trackmenu_cliente_reserva_codigo', json.data.codigo_confirmacion)
    } catch {
      // sin almacenamiento el código igual se le muestra en pantalla
    }
    if (conSesion) await sincronizarConServidor()
    return { success: true, codigo: json.data.codigo_confirmacion, sena: json.data.sena_monto }
  } catch {
    return { success: false, message: 'No se pudo conectar con el servidor del local.' }
  }
}


const reservaCerradaEnServidor = async (reserva, accion) => {
  if (!conBackend() || !reserva?.id) return
  try {
    await fetch(`/api/reservas/${reserva.id}${accion === 'asistencia' ? '/asistencia' : ''}`, {
      method: accion === 'asistencia' ? 'PATCH' : 'DELETE',
      headers: { Authorization: `Bearer ${authState.token}` },
    })
  } catch {
    // idem
  }
}

export const mesasService = {
  obtenerConfigMapa() {
    const orgId = authState.organizacion?.id || 'org_demo_1'
    try {
      const key = `trackmenu_mapa_mesas_${orgId}`
      const guardado = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      if (guardado) {
        const parsed = JSON.parse(guardado)
        if (parsed && Array.isArray(parsed.mesas) && parsed.mesas.length > 0) {
          return {
            formaLocal: parsed.formaLocal || 'rectangular',
            dibujoPersonalizado: Array.isArray(parsed.dibujoPersonalizado) ? parsed.dibujoPersonalizado : [],
            caja: parsed.caja || { x: 12, y: 15, nombre: 'Caja / Cobro' },
            entrada: parsed.entrada || { x: 45, y: 96, nombre: 'Entrada Principal' },
            mesas: parsed.mesas,
          }
        }
      }
    } catch {
      // fallback
    }
    return JSON.parse(JSON.stringify(DEFAULT_MAPA_CONFIG))
  },

  guardarConfigMapa(config) {
    const orgId = authState.organizacion?.id || 'org_demo_1'
    try {
      const key = `trackmenu_mapa_mesas_${orgId}`
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(config))
      }
    } catch {
      return { success: false, message: 'No se pudo guardar la configuración del mapa.' }
    }

    // El plano tiene que quedar en la base: en el navegador lo veía una sola
    // máquina. La firma sigue siendo síncrona para no tocar los componentes,
    // así que el guardado remoto va por detrás.
    guardarMapaEnServidor(config)
    return { success: true }
  },

  restablecerConfigMapa() {
    const orgId = authState.organizacion?.id || 'org_demo_1'
    try {
      const key = `trackmenu_mapa_mesas_${orgId}`
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key)
      }
      return { success: true, data: JSON.parse(JSON.stringify(DEFAULT_MAPA_CONFIG)) }
    } catch {
      return { success: false }
    }
  },

  async listarMesas() {
    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    const mapaLocal = new Map()

    for (const comanda of db.comandas_activas || []) {
      if (comanda.organizacion_id === orgId && Array.isArray(comanda.items) && comanda.items.length > 0) {
        mapaLocal.set(Number(comanda.mesa_numero), comanda)
      }
    }

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch('/api/tables', { headers: headersConAuth() })
        const json = await res.json()
        if (res.ok && json.success && Array.isArray(json.data)) {
          for (const remote of json.data) {
            const num = Number(remote.number)
            const order = remote.current_order || remote.currentOrder
            if (!mapaLocal.has(num) && remote.status === 'ocupada' && order && Array.isArray(order.items) && order.items.length > 0) {
              const itemsNorm = order.items.map((i) => {
                const precio = Number(i.precio_unitario ?? i.price ?? 0)
                const cant = Number(i.cantidad ?? i.quantity ?? 1)
                return {
                  producto_id: i.producto_id ?? i.id ?? null,
                  nombre: i.nombre ?? i.name ?? 'Producto',
                  precio_unitario: precio,
                  cantidad: cant,
                  opciones: Array.isArray(i.opciones) ? i.opciones : [],
                  subtotal: precio * cant,
                }
              })
              mapaLocal.set(num, {
                id: String(order.id || `cmd_${num}`),
                numero_pedido: Number(order.id || num),
                organizacion_id: orgId,
                mesa_numero: num,
                hora_ingreso: order.time || '',
                items: itemsNorm,
                total: Number(order.total ?? calcularTotalComanda(itemsNorm)),
                creado_en: remote.created_at || new Date().toISOString(),
              })
            }
          }
        }
      } catch {
        // Fallback local
      }
    }

    const configMapa = this.obtenerConfigMapa()
    const mesasConfig = Array.isArray(configMapa.mesas) && configMapa.mesas.length > 0
      ? configMapa.mesas
      : DEFAULT_MAPA_CONFIG.mesas

    const mesas = mesasConfig.map((mConfig) => {
      const numero = Number(mConfig.numero)
      const comanda = mapaLocal.get(numero) || null
      return {
        id: mConfig.id || `m_${numero}`,
        numero,
        ocupada: Boolean(comanda && comanda.items?.length > 0),
        comanda,
        x: Number(mConfig.x ?? 50),
        y: Number(mConfig.y ?? 50),
        forma: mConfig.forma || 'cuadrada',
        capacidad: Number(mConfig.capacidad || 4),
        numeroManual: mConfig.numeroManual ?? null,
      }
    })

    return { success: true, data: mesas, configMapa }
  },

  async enviarPedido({ mesaNumero, items }) {
    const mesaNum = Number(mesaNumero)
    if (!Number.isInteger(mesaNum) || mesaNum < 1) {
      return { success: false, message: 'Número de mesa inválido.' }
    }
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, message: 'Agregá al menos un plato del catálogo antes de enviar el pedido.' }
    }

    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    const productosMap = new Map(
      (db.productos || [])
        .filter((p) => p.organizacion_id === orgId)
        .map((p) => [String(p.id), p]),
    )

    if (!Array.isArray(db.comandas_activas)) db.comandas_activas = []
    const comandaExistente = db.comandas_activas.find(
      (c) => c.organizacion_id === orgId && Number(c.mesa_numero) === mesaNum,
    )

    // Sumar cantidades ya cargadas en la mesa para validar contra stock real
    const cantidadesPorProducto = new Map()
    for (const prev of comandaExistente?.items || []) {
      const key = String(prev.producto_id)
      cantidadesPorProducto.set(key, (cantidadesPorProducto.get(key) || 0) + Number(prev.cantidad || 0))
    }

    const itemsNormalizados = []
    for (const raw of items) {
      const prodId = String(raw.producto_id ?? raw.id ?? '')
      const cant = Math.max(1, Number(raw.cantidad ?? raw.quantity ?? 1))
      const prodLocal = productosMap.get(prodId)

      if (prodLocal && prodLocal.activo === false) {
        return { success: false, message: `"${prodLocal.nombre}" no se encuentra disponible en la carta.` }
      }

      const nombre = prodLocal?.nombre || String(raw.nombre || raw.name || '').trim()
      const precioUnitario = prodLocal ? Number(prodLocal.precio) : Number(raw.precio_unitario ?? raw.precio ?? raw.price ?? 0)
      const stockDisponible = prodLocal ? Number(prodLocal.stock ?? 0) : Number(raw.stock_disponible ?? Infinity)
      const acumulado = (cantidadesPorProducto.get(prodId) || 0) + cant

      if (Number.isFinite(stockDisponible) && acumulado > stockDisponible) {
        return {
          success: false,
          message: `Stock insuficiente de "${nombre || 'producto'}" (disponible: ${stockDisponible} un.).`,
        }
      }

      cantidadesPorProducto.set(prodId, acumulado)
      const opciones = Array.isArray(raw.opciones) ? raw.opciones.map((o) => String(o).trim()).filter(Boolean) : []
      itemsNormalizados.push({
        producto_id: prodId,
        nombre,
        precio_unitario: precioUnitario,
        cantidad: cant,
        opciones,
        subtotal: precioUnitario * cant,
      })
    }

    let comandaFinal = comandaExistente
    if (!comandaFinal) {
      db.ultimo_pedido = (Number(db.ultimo_pedido) || 100) + 1
      comandaFinal = {
        id: 'cmd_' + Date.now(),
        numero_pedido: db.ultimo_pedido,
        organizacion_id: orgId,
        mesa_numero: mesaNum,
        hora_ingreso: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        items: [],
        total: 0,
        creado_en: new Date().toISOString(),
      }
      db.comandas_activas.push(comandaFinal)
    }

    for (const nuevoItem of itemsNormalizados) {
      const keyNuevo = claveOpcionesItem(nuevoItem.opciones)
      const existente = comandaFinal.items.find(
        (it) => String(it.producto_id) === String(nuevoItem.producto_id) && claveOpcionesItem(it.opciones) === keyNuevo,
      )
      if (existente) {
        existente.cantidad += nuevoItem.cantidad
        existente.subtotal = existente.precio_unitario * existente.cantidad
      } else {
        comandaFinal.items.push(nuevoItem)
      }
    }

    comandaFinal.total = calcularTotalComanda(comandaFinal.items)
    saveLocalDb(db)

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        await fetch('/api/orders', {
          method: 'POST',
          headers: headersConAuth(true),
          body: JSON.stringify({ tableNumber: mesaNum, items: itemsNormalizados }),
        })
        await fetch(`/api/tables/${mesaNum}/ocupar`, {
          method: 'POST',
          headers: headersConAuth(true),
          body: JSON.stringify({
            order: {
              id: comandaFinal.numero_pedido,
              time: comandaFinal.hora_ingreso,
              items: comandaFinal.items,
              total: comandaFinal.total,
            },
          }),
        })
      } catch {
        // Ya quedó persistido localmente
      }
    }

    return {
      success: true,
      message: `Pedido #${comandaFinal.numero_pedido} enviado a cocina para Mesa ${mesaNum}.`,
      data: comandaFinal,
    }
  },

  async quitarItemMesa({ mesaNumero, index }) {
    const mesaNum = Number(mesaNumero)
    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    if (!Array.isArray(db.comandas_activas)) db.comandas_activas = []

    const cmdIdx = db.comandas_activas.findIndex(
      (c) => c.organizacion_id === orgId && Number(c.mesa_numero) === mesaNum,
    )
    if (cmdIdx === -1) {
      return { success: false, message: 'La mesa no tiene una comanda activa.' }
    }

    const comanda = db.comandas_activas[cmdIdx]
    if (index < 0 || index >= comanda.items.length) {
      return { success: false, message: 'Ítem no encontrado en la comanda.' }
    }

    comanda.items.splice(index, 1)
    if (comanda.items.length === 0) {
      db.comandas_activas.splice(cmdIdx, 1)
      saveLocalDb(db)
      if (authState.token && !authState.token.startsWith('demo_token_')) {
        fetch(`/api/tables/${mesaNum}/liberar`, {
          method: 'POST',
          headers: headersConAuth(true),
          body: JSON.stringify({ cancelar: true }),
        }).catch(() => {})
      }
      return { success: true, mesaLiberada: true, message: `Mesa ${mesaNum} quedó sin ítems y se liberó.` }
    }

    comanda.total = calcularTotalComanda(comanda.items)
    saveLocalDb(db)
    return { success: true, mesaLiberada: false, data: comanda, message: 'Ítem quitado de la comanda.' }
  },

  async cancelarComandaMesa({ mesaNumero }) {
    const mesaNum = Number(mesaNumero)
    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    if (!Array.isArray(db.comandas_activas)) db.comandas_activas = []

    const idx = db.comandas_activas.findIndex(
      (c) => c.organizacion_id === orgId && Number(c.mesa_numero) === mesaNum,
    )
    if (idx === -1) {
      return { success: false, message: 'La mesa ya se encuentra libre.' }
    }

    db.comandas_activas.splice(idx, 1)
    saveLocalDb(db)

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      fetch(`/api/tables/${mesaNum}/liberar`, {
        method: 'POST',
        headers: headersConAuth(true),
        body: JSON.stringify({ cancelar: true }),
      }).catch(() => {})
    }

    return { success: true, message: `Comanda de Mesa ${mesaNum} cancelada.` }
  },

  async cobrarYLiberarMesa({ mesaNumero, metodoPago = 'efectivo' }) {
    const mesaNum = Number(mesaNumero)
    const db = getLocalDb()
    const orgId = authState.organizacion?.id || 'org_demo_1'
    if (!Array.isArray(db.comandas_activas)) db.comandas_activas = []

    const cmdIdx = db.comandas_activas.findIndex(
      (c) => c.organizacion_id === orgId && Number(c.mesa_numero) === mesaNum,
    )
    if (cmdIdx === -1) {
      return { success: false, message: `La Mesa ${mesaNum} no tiene un pedido activo para cobrar.` }
    }

    const comanda = db.comandas_activas[cmdIdx]
    if (!Array.isArray(comanda.items) || comanda.items.length === 0) {
      return { success: false, message: 'La comanda no tiene ítems registrados.' }
    }

    const metodo = normalizarMetodoPago(metodoPago)
    const totalVenta = calcularTotalComanda(comanda.items)
    const ventaId = 'vnt_' + Date.now()
    const nuevaVenta = {
      id: ventaId,
      organizacion_id: orgId,
      mesa_numero: mesaNum,
      total: totalVenta,
      metodo_pago: metodo,
      estado: 'completada',
      usuario_id: authState.user?.id || 'usr_empleado_1',
      created_at: new Date().toISOString(),
      anulado_en: null,
      anulado_por: null,
      motivo_anulacion: null,
    }

    if (!Array.isArray(db.ventas)) db.ventas = []
    db.ventas.unshift(nuevaVenta)

    if (!Array.isArray(db.detalle_ventas)) db.detalle_ventas = []
    comanda.items.forEach((item, idx) => {
      const cantidad = Number(item.cantidad || 1)
      const precioUnitario = Number(item.precio_unitario || 0)
      db.detalle_ventas.push({
        id: `det_${Date.now()}_${idx}`,
        venta_id: ventaId,
        producto_id: item.producto_id,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal: precioUnitario * cantidad,
      })

      const prod = (db.productos || []).find((p) => p.id === item.producto_id && p.organizacion_id === orgId)
      if (prod) {
        prod.stock = Math.max(0, Number(prod.stock || 0) - cantidad)
      }
    })

    db.comandas_activas.splice(cmdIdx, 1)
    saveLocalDb(db)

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        await fetch(`/api/tables/${mesaNum}/liberar`, {
          method: 'POST',
          headers: headersConAuth(true),
          body: JSON.stringify({
            metodo_pago: metodo,
            organizacion_id: orgId,
            usuario_id: authState.user?.id,
          }),
        })
      } catch {
        // Ya quedó registrado localmente
      }
    }

    return {
      success: true,
      message: `Mesa ${mesaNum} cobrada (${totalVenta.toLocaleString('es-AR')}) y liberada.`,
      data: { venta: nuevaVenta, comanda },
    }
  },
}




// Cobro de mesa. El respaldo local existe sólo para no perder la comanda si el
// servidor no responde; el aviso de "sin conexión" ya lo muestra la pantalla.
export const ventasService = {
  async cobrarMesa({ mesa_numero, metodo_pago, items }) {
    if (!['admin', 'empleado'].includes(authState.rol)) {
      return { success: false, message: 'Acceso denegado: tu rol no puede cobrar mesas.' }
    }

    // La pantalla ofrece "Transferencia"; la base guarda 'transferencia_qr'.
    const metodo = String(metodo_pago || '').toLowerCase().includes('transf')
      ? 'transferencia_qr'
      : String(metodo_pago || '').toLowerCase()

    if (!authState.token || authState.token.startsWith('demo_token_')) {
      return { success: false, message: avisoLocal('La venta no se pudo registrar') }
    }

    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ mesa_numero, metodo_pago: metodo, items }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        return { success: true, message: json.message, data: json.data }
      }
      return { success: false, message: json.message, errors: json.errors }
    } catch {
      return { success: false, message: avisoLocal('La venta no se pudo registrar') }
    }
  },
}

// Comandas abiertas por mesa. Sin backend no hay respaldo local: una comanda
// que sólo existe en un navegador no le sirve a nadie del equipo.
export const comandasService = {
  async listar() {
    if (!authState.token || authState.token.startsWith('demo_token_')) {
      return { success: false, message: avisoLocal('No se pudieron leer las comandas'), data: [] }
    }
    try {
      const res = await fetch('/api/comandas', {
        headers: { Authorization: `Bearer ${authState.token}` },
      })
      const json = await res.json()
      if (res.ok && json.success) return { success: true, data: json.data }
      return { success: false, message: json.message, data: [] }
    } catch {
      return { success: false, message: avisoLocal('No se pudieron leer las comandas'), data: [] }
    }
  },

  async enviarPedido({ mesa_numero, items }) {
    if (!['admin', 'empleado'].includes(authState.rol)) {
      return { success: false, message: 'Acceso denegado: tu rol no puede tomar pedidos.' }
    }
    if (!authState.token || authState.token.startsWith('demo_token_')) {
      return { success: false, message: avisoLocal('El pedido no se pudo enviar') }
    }
    try {
      const res = await fetch('/api/comandas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.token}`,
        },
        body: JSON.stringify({ mesa_numero, items }),
      })
      const json = await res.json()
      if (res.ok && json.success) return { success: true, message: json.message, data: json.data }
      return { success: false, message: json.message, errors: json.errors }
    } catch {
      return { success: false, message: avisoLocal('El pedido no se pudo enviar') }
    }
  },
}

export const obtenerFechaHoyLocal = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const horaAMinutos = (horaStr = '') => {
  const [h, m] = String(horaStr).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1
  return h * 60 + m
}

export const HORARIOS_RESERVA = [
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00', '23:30',
]

const DURACION_RESERVA_MIN = 90
export const SENA_POR_PERSONA = 2500
export const calcularMontoSena = (personas = 1) => Math.max(1, Number(personas) || 1) * SENA_POR_PERSONA

export const generarCodigoReserva = (longitud = 8) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let codigo = ''
  for (let i = 0; i < longitud; i++) {
    codigo += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return codigo.toUpperCase()
}

export const reservasService = {
  _storageKey() {
    const orgId = authState.organizacion?.id || 'org_demo_1'
    return `trackmenu_reservas_${orgId}`
  },

  listarReservas() {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(this._storageKey()) : null
      const lista = raw ? JSON.parse(raw) : []
      if (!Array.isArray(lista)) return []
      return lista
        .filter((r) => r && r.estado !== 'cancelada')
        .sort((a, b) => {
          if (a.fecha !== b.fecha) return String(a.fecha).localeCompare(String(b.fecha))
          return horaAMinutos(a.hora) - horaAMinutos(b.hora)
        })
    } catch {
      return []
    }
  },

  _guardarLista(lista) {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this._storageKey(), JSON.stringify(lista))
      }
      return true
    } catch {
      return false
    }
  },

  obtenerReservasPorFecha(fecha = obtenerFechaHoyLocal()) {
    return this.listarReservas().filter((r) => r.fecha === fecha)
  },

  verificarDisponibilidad({ fecha, hora, personas }) {
    if (!fecha || !hora || !personas) {
      return {
        disponible: false,
        mesasDisponibles: [],
        mesaSugerida: null,
        totalAdecuadas: 0,
        mensaje: 'Seleccioná día, horario y cantidad de personas para consultar disponibilidad.',
      }
    }

    const cantPersonas = Math.max(1, Number(personas) || 1)
    const minSolicitado = horaAMinutos(hora)
    if (minSolicitado < 0) {
      return {
        disponible: false,
        mesasDisponibles: [],
        mesaSugerida: null,
        totalAdecuadas: 0,
        mensaje: 'El horario seleccionado no es válido.',
      }
    }

    const hoy = obtenerFechaHoyLocal()
    if (fecha < hoy) {
      return {
        disponible: false,
        mesasDisponibles: [],
        mesaSugerida: null,
        totalAdecuadas: 0,
        mensaje: 'No es posible reservar en una fecha pasada.',
      }
    }

    if (fecha === hoy) {
      const ahora = new Date()
      const minAhora = ahora.getHours() * 60 + ahora.getMinutes()
      if (minSolicitado < minAhora - 15) {
        return {
          disponible: false,
          mesasDisponibles: [],
          mesaSugerida: null,
          totalAdecuadas: 0,
          mensaje: 'Ese horario de hoy ya pasó. Elegí un horario posterior.',
        }
      }
    }

    const configMapa = mesasService.obtenerConfigMapa()
    const mesasConfig = Array.isArray(configMapa.mesas) && configMapa.mesas.length > 0
      ? configMapa.mesas
      : DEFAULT_MAPA_CONFIG.mesas

    // Ordenar mesas adecuadas de menor capacidad suficiente a mayor (optimiza espacio)
    const adecuadas = [...mesasConfig]
      .filter((m) => Number(m.capacidad || 4) >= cantPersonas)
      .sort((a, b) => {
        const capDiff = Number(a.capacidad || 4) - Number(b.capacidad || 4)
        if (capDiff !== 0) return capDiff
        return Number(a.numero) - Number(b.numero)
      })

    if (adecuadas.length === 0) {
      return {
        disponible: false,
        mesasDisponibles: [],
        mesaSugerida: null,
        totalAdecuadas: 0,
        mensaje: `No contamos con mesas de capacidad para ${cantPersonas} personas en un solo grupo.`,
      }
    }

    const reservasDelDia = this.obtenerReservasPorFecha(fecha)
    const db = getLocalDb()
    const comandasActivas = Array.isArray(db.comandasActivas) ? db.comandasActivas : []
    const ahora = new Date()
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes()
    const esInmediata = fecha === hoy && Math.abs(minSolicitado - minAhora) <= 45

    const mesasDisponibles = adecuadas.filter((mesa) => {
      const num = Number(mesa.numero)
      // Si la reserva es inmediata y la mesa está ocupada actualmente con comanda abierta, no está disponible
      if (esInmediata && comandasActivas.some((c) => Number(c.mesa_numero) === num)) {
        return false
      }
      // Verificar conflicto horario con otras reservas de la misma mesa
      const hayConflicto = reservasDelDia.some((r) => {
        if (Number(r.mesa_numero) !== num) return false
        const minRes = horaAMinutos(r.hora)
        return Math.abs(minRes - minSolicitado) < DURACION_RESERVA_MIN
      })
      return !hayConflicto
    })

    const mesaSugerida = mesasDisponibles[0] || null
    const disponible = mesasDisponibles.length > 0

    return {
      disponible,
      mesasDisponibles,
      mesaSugerida,
      totalAdecuadas: adecuadas.length,
      mensaje: disponible
        ? `¡Hay disponibilidad! ${mesasDisponibles.length} ${mesasDisponibles.length === 1 ? 'mesa libre' : 'mesas libres'} (Mesa ${mesaSugerida.numero} para ${mesaSugerida.capacidad} pers.).`
        : `Sin disponibilidad para ${cantPersonas} personas a las ${hora} hs. Probá con otro horario.`,
    }
  },

  horariosAlternativosDisponibles({ fecha, personas }) {
    if (!fecha || !personas) return []
    return HORARIOS_RESERVA.filter((h) => this.verificarDisponibilidad({ fecha, hora: h, personas }).disponible)
  },

  async crearReserva({
    fecha,
    hora,
    personas,
    nombre_cliente,
    telefono = '',
    notas = '',
    sena_pagada = false,
    sena_metodo = 'mercadopago',
    sena_comprobante = '',
  }) {
    const nombreLimpio = String(nombre_cliente || '').trim()
    if (!nombreLimpio) {
      return { success: false, message: 'Ingresá tu nombre para confirmar la reserva.' }
    }

    if (!sena_pagada) {
      return {
        success: false,
        message: 'Debés confirmar el pago de la seña con Mercado Pago antes de confirmar la reserva.',
      }
    }

    const comprobanteLimpio = String(sena_comprobante || '').trim().toUpperCase() || `MP-${generarCodigoReserva(6)}`

    const check = this.verificarDisponibilidad({ fecha, hora, personas })
    if (!check.disponible || !check.mesaSugerida) {
      return { success: false, message: check.mensaje || 'No hay disponibilidad en ese horario.' }
    }

    const cantPersonas = Number(personas)
    const senaMonto = calcularMontoSena(cantPersonas)
    const codigoConfirmacion = generarCodigoReserva(8)

    const nueva = {
      id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      codigo_confirmacion: codigoConfirmacion,
      fecha,
      hora,
      personas: cantPersonas,
      mesa_numero: Number(check.mesaSugerida.numero),
      mesa_capacidad: Number(check.mesaSugerida.capacidad || 4),
      nombre_cliente: nombreLimpio,
      telefono: String(telefono || '').trim(),
      notas: String(notas || '').trim(),
      sena_monto: senaMonto,
      sena_pagada: true,
      sena_metodo: String(sena_metodo || 'mercadopago'),
      sena_comprobante: comprobanteLimpio,
      asistencia_confirmada: false,
      asistencia_confirmada_en: null,
      estado: 'confirmada',
      creada_en: new Date().toISOString(),
    }

    const todas = this.listarReservas()
    todas.push(nueva)
    if (!this._guardarLista(todas)) {
      return { success: false, message: 'No se pudo guardar la reserva.' }
    }

    const enServidor = await reservaAlServidor(nueva)
    if (!enServidor.success) {
      // Se deshace la copia local: una reserva que no llegó al local no existe.
      this._guardarLista(this.listarReservas().filter((r) => r.id !== nueva.id))
      return {
        success: false,
        message: enServidor.message || 'No se pudo registrar la reserva en el local. Probá de nuevo.',
      }
    }

    nueva.codigo_confirmacion = enServidor.codigo
    nueva.sena_monto = enServidor.sena ?? nueva.sena_monto
    this._guardarLista(this.listarReservas().map((r) => (r.id === nueva.id ? nueva : r)))
    this.guardarCodigoReservaCliente(nueva.codigo_confirmacion)

    return {
      success: true,
      data: nueva,
      message: `Reserva confirmada (${nueva.codigo_confirmacion}) para ${nueva.personas} personas el ${nueva.fecha} a las ${nueva.hora} hs (Mesa ${nueva.mesa_numero}).`,
    }
  },

  obtenerReservaPorCodigo(codigo) {
    const codigoLimpio = String(codigo || '').trim().toUpperCase()
    if (!codigoLimpio) return null
    return this.listarReservas().find(
      (r) => String(r.codigo_confirmacion || '').toUpperCase() === codigoLimpio
    ) || null
  },

  guardarCodigoReservaCliente(codigo) {
    try {
      if (typeof window !== 'undefined' && codigo) {
        localStorage.setItem('trackmenu_cliente_reserva_codigo', String(codigo).trim().toUpperCase())
      }
    } catch {
      // ignore
    }
  },

  obtenerCodigoReservaCliente() {
    try {
      return typeof window !== 'undefined'
        ? localStorage.getItem('trackmenu_cliente_reserva_codigo') || ''
        : ''
    } catch {
      return ''
    }
  },

  confirmarLlegadaPorCodigo(codigo, mesaNumero = null) {
    const codigoLimpio = String(codigo || '').trim().toUpperCase()
    if (!codigoLimpio) {
      return { success: false, message: 'Ingresá el código de reserva del cliente.' }
    }

    const todas = this.listarReservas()
    const idx = todas.findIndex((r) => {
      if (String(r.codigo_confirmacion || '').toUpperCase() !== codigoLimpio) return false
      if (mesaNumero !== null && Number(r.mesa_numero) !== Number(mesaNumero)) return false
      return true
    })

    if (idx === -1) {
      return {
        success: false,
        message: mesaNumero !== null
          ? `El código ${codigoLimpio} no coincide con ninguna reserva de la Mesa ${mesaNumero}.`
          : `No se encontró ninguna reserva activa con el código ${codigoLimpio}.`,
      }
    }

    if (todas[idx].asistencia_confirmada) {
      return {
        success: false,
        message: `La reserva ${codigoLimpio} (Mesa ${todas[idx].mesa_numero}) ya fue confirmada en el local.`,
      }
    }

    todas[idx] = {
      ...todas[idx],
      asistencia_confirmada: true,
      asistencia_confirmada_en: new Date().toISOString(),
    }

    if (!this._guardarLista(todas)) {
      return { success: false, message: 'No se pudo actualizar la reserva.' }
    }

    reservaCerradaEnServidor(todas[idx], 'asistencia')

    return {
      success: true,
      data: todas[idx],
      message: `¡Llegada confirmada! Mesa ${todas[idx].mesa_numero} (${todas[idx].nombre_cliente}) habilitada.`,
    }
  },

  cancelarReserva(id) {
    const reserva = this.listarReservas().find((r) => r.id === id)
    const todas = this.listarReservas().filter((r) => r.id !== id)
    const ok = this._guardarLista(todas)
    if (ok) reservaCerradaEnServidor(reserva, 'cancelar')
    return { success: ok }
  },
}
