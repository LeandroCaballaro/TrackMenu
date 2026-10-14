export function crearSupabaseFalso() {
  const estado = {
    usuario: { id: 'usuario-1' },
    sesion: null,
    productos: [],
    errores: {},
    llamadas: [],
    urlPublica: 'https://cdn.test/productos/foto.png',
  }

  const registrar = (llamada) => {
    estado.llamadas.push(llamada)
    return llamada
  }

  const tabla = (nombre) => {
    const api = {
      select: () => api,
      order: (columna, opciones) => {
        registrar({ op: 'select', tabla: nombre, columna, opciones })
        return Promise.resolve({ data: estado.productos, error: estado.errores.select ?? null })
      },
      insert: (datos) => {
        registrar({ op: 'insert', tabla: nombre, datos })
        return Promise.resolve({ error: estado.errores.insert ?? null })
      },
      update: (datos) => ({
        eq: (campo, valor) => {
          registrar({ op: 'update', tabla: nombre, datos, campo, valor })
          return Promise.resolve({ error: estado.errores.update ?? null })
        },
      }),
      delete: () => ({
        eq: (campo, valor) => {
          registrar({ op: 'delete', tabla: nombre, campo, valor })
          return Promise.resolve({ error: estado.errores.delete ?? null })
        },
      }),
    }
    return api
  }

  const bucket = (nombre) => ({
    upload: (ruta, archivo, opciones) => {
      registrar({ op: 'upload', bucket: nombre, ruta, archivo, opciones })
      return Promise.resolve({ error: estado.errores.upload ?? null })
    },
    getPublicUrl: (ruta) => {
      registrar({ op: 'getPublicUrl', bucket: nombre, ruta })
      return { data: { publicUrl: estado.urlPublica } }
    },
    remove: (rutas) => {
      registrar({ op: 'remove', bucket: nombre, rutas })
      return Promise.resolve({ error: estado.errores.remove ?? null })
    },
  })

  const supabase = {
    from: tabla,
    storage: { from: bucket },
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: estado.errores.usuario ? null : estado.usuario },
          error: estado.errores.usuario ?? null,
        }),
      getSession: () => Promise.resolve({ data: { session: estado.sesion } }),
      signOut: () => {
        registrar({ op: 'signOut' })
        estado.sesion = null
        return Promise.resolve({ error: null })
      },
      signInWithPassword: (credenciales) => {
        registrar({ op: 'signIn', credenciales })
        return Promise.resolve({
          data: { session: estado.errores.login ? null : { user: estado.usuario } },
          error: estado.errores.login ?? null,
        })
      },
    },
  }

  const reiniciar = () => {
    estado.productos = []
    estado.errores = {}
    estado.llamadas = []
    estado.sesion = null
  }

  const buscar = (op) => estado.llamadas.filter((llamada) => llamada.op === op)

  return { estado, supabase, reiniciar, buscar }
}

export function crearArchivo({ nombre = 'foto.png', tipo = 'image/png', peso = 1024 } = {}) {
  const archivo = new File(['imagen'], nombre, { type: tipo })
  Object.defineProperty(archivo, 'size', { value: peso })
  return archivo
}

export function producto(parcial = {}) {
  return {
    id: 'producto-1',
    nombre: 'Burger clásica',
    descripcion: 'Doble smash con cheddar',
    precio: '1890.00',
    stock: 12,
    activo: true,
    imagen_url: 'https://cdn.test/productos/burger.png',
    imagen_ruta: 'usuario-1/burger.png',
    creado_en: '2026-10-01T12:00:00Z',
    ...parcial,
  }
}
