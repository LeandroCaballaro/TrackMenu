import { reactive, computed } from 'vue'

const STORAGE_SESSION_KEY = 'trackmenu_saas_session'
const STORAGE_DATA_KEY = 'trackmenu_saas_db'

// Cuentas que entraban sin pasar por el backend. Se quitaron, y también se
// borran de los navegadores que las tengan guardadas de antes.
// 'consulta' es un rol real desde la migración 006: la app lo tiene que
// reconocer, antes lo echaba al recargar.
const ROLES_ASIGNABLES = ['admin', 'empleado', 'consulta']

const CUENTAS_DEMO = ['admin@demo.com', 'empleado@demo.com']

// Semilla inicial con productos para el negocio por defecto
const initialMockDatabase = {
  organizaciones: [
    { id: 'org_demo_1', nombre: 'Parrilla Central' },
    { id: 'org_demo_2', nombre: 'Bar & Café Palermo' },
  ],
  // Sin cuentas de demostración: antes había dos (@demo.com) que entraban sin
  // tocar el backend, así que todo lo que se cargaba con ellas quedaba en este
  // navegador y no llegaba nunca a la base.
  usuarios: [],
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
  ventas: [
    {
      id: 'vnt_101',
      organizacion_id: 'org_demo_1',
      mesa_numero: 4,
      total: 2840,
      metodo_pago: 'efectivo',
      estado: 'completada',
      usuario_id: 'usr_empleado_1',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      anulado_en: null,
      anulado_por: null,
      motivo_anulacion: null,
    },
    {
      id: 'vnt_102',
      organizacion_id: 'org_demo_1',
      mesa_numero: 7,
      total: 4120,
      metodo_pago: 'transferencia_qr',
      estado: 'completada',
      usuario_id: 'usr_admin_1',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      anulado_en: null,
      anulado_por: null,
      motivo_anulacion: null,
    },
    {
      id: 'vnt_103',
      organizacion_id: 'org_demo_1',
      mesa_numero: 2,
      total: 1890,
      metodo_pago: 'tarjeta',
      estado: 'completada',
      usuario_id: 'usr_empleado_1',
      created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
      anulado_en: null,
      anulado_por: null,
      motivo_anulacion: null,
    },
    {
      id: 'vnt_104',
      organizacion_id: 'org_demo_1',
      mesa_numero: 9,
      total: 3500,
      metodo_pago: 'efectivo',
      estado: 'anulada',
      usuario_id: 'usr_empleado_1',
      created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
      anulado_en: new Date(Date.now() - 3600000 * 7).toISOString(),
      anulado_por: 'usr_admin_1',
      motivo_anulacion: 'Error en la comanda digitada por el mozo.',
    },
  ],
  detalle_ventas: [
    { id: 'det_1', venta_id: 'vnt_101', producto_id: 'prod_1', cantidad: 1, precio_unitario: 1890, subtotal: 1890 },
    { id: 'det_2', venta_id: 'vnt_101', producto_id: 'prod_2', cantidad: 1, precio_unitario: 950, subtotal: 950 },
    { id: 'det_3', venta_id: 'vnt_102', producto_id: 'prod_1', cantidad: 2, precio_unitario: 1890, subtotal: 3780 },
    { id: 'det_4', venta_id: 'vnt_102', producto_id: 'prod_4', cantidad: 1, precio_unitario: 340, subtotal: 340 },
    { id: 'det_5', venta_id: 'vnt_103', producto_id: 'prod_1', cantidad: 1, precio_unitario: 1890, subtotal: 1890 },
    { id: 'det_6', venta_id: 'vnt_104', producto_id: 'prod_3', cantidad: 2, precio_unitario: 1050, subtotal: 2100 },
    { id: 'det_7', venta_id: 'vnt_104', producto_id: 'prod_5', cantidad: 1, precio_unitario: 1400, subtotal: 1400 },
  ],
  auditoria_logs: [
    {
      id: 'aud_1',
      organizacion_id: 'org_demo_1',
      usuario_id: 'usr_admin_1',
      accion: 'anulacion_ticket',
      detalles: { venta_id: 'vnt_104', mesa_numero: 9, total: 3500, motivo: 'Error en la comanda digitada por el mozo.' },
      created_at: new Date(Date.now() - 3600000 * 7).toISOString(),
    },
    {
      id: 'aud_2',
      organizacion_id: 'org_demo_1',
      usuario_id: 'usr_admin_1',
      accion: 'cambio_precio',
      detalles: { producto: 'Burger Clásica', precio_anterior: 1650, precio_nuevo: 1890 },
      created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
      id: 'aud_3',
      organizacion_id: 'org_demo_1',
      usuario_id: 'usr_admin_1',
      accion: 'ajuste_stock',
      detalles: { producto: 'Milanesa de Pollo', tipo: 'ingreso', cantidad: 25 },
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
  ],
}

// Carga o inicializa la base de datos simulada
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
    if (Array.isArray(db.usuarios)) {
      let updated = false

      const sinDemo = db.usuarios.filter((u) => !CUENTAS_DEMO.includes(u.email?.toLowerCase()))
      if (sinDemo.length !== db.usuarios.length) {
        db.usuarios = sinDemo
        updated = true
      }
      if (updated) saveLocalDb(db)
    }
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
    return item ? JSON.parse(item) : null
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
        return { success: true, message: json.message }
      }

      if (res.status !== 503 && !json.success) {
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

    const platosMasVendidos = [
      { id: 'prod_1', nombre: 'Burger Clásica', cantidad: 4 },
      { id: 'prod_3', nombre: 'Milanesa de Pollo', cantidad: 2 },
      { id: 'prod_2', nombre: 'Papas a la Piedra', cantidad: 1 },
      { id: 'prod_4', nombre: 'Limonada Casera', cantidad: 1 },
    ]

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
    if (authState.rol !== 'admin') {
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
        creado_en: u.creado_en || null,
      }))

    if (authState.token && !authState.token.startsWith('demo_token_')) {
      try {
        const res = await fetch('/api/admin/usuarios', {
          headers: { Authorization: `Bearer ${authState.token}` },
        })
        const json = await res.json()
        if (res.ok && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const mapaLocal = new Map(locales.map((u) => [u.usuario_id, u]))
          const remotos = json.data.map((m) => {
            const localInfo = mapaLocal.get(m.usuario_id)
            return {
              usuario_id: m.usuario_id,
              nombre: m.nombre || localInfo?.nombre || 'Usuario del local',
              email: m.email || localInfo?.email || m.usuario_id,
              rol: m.rol,
              creado_en: m.creado_en,
            }
          })
          return { success: true, data: remotos }
        }
      } catch {
        // Fallback local
      }
    }

    return { success: true, data: locales }
  },

  async crearUsuario({ nombre, email, password, rol = 'empleado' }) {
    if (authState.rol !== 'admin') {
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
          body: JSON.stringify({ nombre: nombreLimpio, email: emailLimpio, password, rol }),
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
        creado_en: ahora,
      },
    }
  },

  async cambiarRolUsuario(usuarioId, nuevoRol) {
    if (authState.rol !== 'admin') {
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
