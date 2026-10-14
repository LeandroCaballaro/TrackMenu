import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { crearArchivo, producto } from '@/tests/supabaseMock'
import { falso } from '@/tests/supabaseFalso'

vi.mock('@/supabase', async () => {
  const { falso: instancia } = await import('@/tests/supabaseFalso')
  return { supabase: instancia.supabase }
})

const empujar = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: empujar }),
}))

const { default: ProductosView } = await import('./ProductosView.vue')

const montar = async () => {
  const wrapper = mount(ProductosView, {
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })
  await flushPromises()
  return wrapper
}

const completarFormulario = async (wrapper, { nombre, descripcion, precio, stock }) => {
  const campos = wrapper.findAll('input, textarea')
  if (nombre !== undefined) await wrapper.find('input[type="text"]').setValue(nombre)
  if (descripcion !== undefined) await wrapper.find('textarea').setValue(descripcion)
  if (precio !== undefined) await wrapper.findAll('input[type="number"]')[0].setValue(precio)
  if (stock !== undefined) await wrapper.findAll('input[type="number"]')[1].setValue(stock)
  return campos
}

const elegirImagen = async (wrapper, archivo) => {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [archivo], configurable: true })
  await input.trigger('change')
}

const enviar = async (wrapper) => {
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

const error = (wrapper) => wrapper.find('[role="alert"]').text()

beforeEach(() => {
  falso.reiniciar()
  empujar.mockClear()
  window.confirm.mockReturnValue(true)
})

describe('ProductosView · listado', () => {
  it('consulta los productos del usuario ordenados por fecha descendente', async () => {
    await montar()

    expect(falso.buscar('select')).toEqual([
      { op: 'select', tabla: 'productos', columna: 'creado_en', opciones: { ascending: false } },
    ])
  })

  it('muestra un estado vacío cuando no hay productos', async () => {
    const wrapper = await montar()

    expect(wrapper.text()).toContain('Todavía no creaste productos')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('renderiza cada producto con precio, stock, estado e imagen', async () => {
    falso.estado.productos = [producto(), producto({ id: 'producto-2', nombre: 'Limonada', activo: false, stock: 0 })]
    const wrapper = await montar()

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(2)
    expect(filas[0].text()).toContain('Burger clásica')
    expect(filas[0].text()).toContain('1.890,00')
    expect(filas[0].text()).toContain('Activo')
    expect(filas[0].find('img').attributes('src')).toBe('https://cdn.test/productos/burger.png')
    expect(filas[1].text()).toContain('Inactivo')
  })

  it('informa el error cuando la consulta falla', async () => {
    falso.estado.errores.select = { message: 'JWT expirado' }
    const wrapper = await montar()

    expect(error(wrapper)).toBe('JWT expirado')
  })

  it('avisa cuando un producto no tiene imagen', async () => {
    falso.estado.productos = [producto({ imagen_url: null })]
    const wrapper = await montar()

    expect(wrapper.find('tbody tr').text()).toContain('Sin imagen')
  })
})

describe('ProductosView · validaciones', () => {
  it('exige el nombre', async () => {
    const wrapper = await montar()
    await completarFormulario(wrapper, { precio: '100', stock: 1 })
    await elegirImagen(wrapper, crearArchivo())
    await enviar(wrapper)

    expect(error(wrapper)).toBe('El nombre es obligatorio.')
    expect(falso.buscar('insert')).toHaveLength(0)
  })

  it('rechaza un precio negativo', async () => {
    const wrapper = await montar()
    await completarFormulario(wrapper, { nombre: 'Burger', precio: '-5', stock: 1 })
    await elegirImagen(wrapper, crearArchivo())
    await enviar(wrapper)

    expect(error(wrapper)).toBe('Ingresá un precio válido.')
    expect(falso.buscar('insert')).toHaveLength(0)
  })

  it('rechaza un stock negativo', async () => {
    const wrapper = await montar()
    await completarFormulario(wrapper, { nombre: 'Burger', precio: '100', stock: '-2' })
    await elegirImagen(wrapper, crearArchivo())
    await enviar(wrapper)

    expect(error(wrapper)).toBe('El stock no puede ser negativo.')
  })

  it('exige una imagen en el alta', async () => {
    const wrapper = await montar()
    await completarFormulario(wrapper, { nombre: 'Burger', precio: '100', stock: 1 })
    await enviar(wrapper)

    expect(error(wrapper)).toBe('Seleccioná una imagen para el producto.')
    expect(falso.buscar('upload')).toHaveLength(0)
  })

  it('rechaza un formato de imagen no permitido', async () => {
    const wrapper = await montar()
    await elegirImagen(wrapper, crearArchivo({ nombre: 'menu.pdf', tipo: 'application/pdf' }))

    expect(error(wrapper)).toBe('La imagen debe ser JPG, PNG o WEBP.')
    expect(wrapper.find('img[alt="Vista previa del producto"]').exists()).toBe(false)
  })

  it('rechaza una imagen de más de 5 MB', async () => {
    const wrapper = await montar()
    await elegirImagen(wrapper, crearArchivo({ peso: 5 * 1024 * 1024 + 1 }))

    expect(error(wrapper)).toBe('La imagen no puede superar los 5 MB.')
  })

  it('muestra la vista previa de una imagen válida', async () => {
    const wrapper = await montar()
    await elegirImagen(wrapper, crearArchivo({ tipo: 'image/webp' }))

    expect(wrapper.find('img[alt="Vista previa del producto"]').attributes('src')).toBe('blob:vista-previa')
    expect(wrapper.text()).toContain('Nueva imagen seleccionada')
  })
})

describe('ProductosView · alta', () => {
  it('sube la imagen a la carpeta del usuario e inserta el producto', async () => {
    const wrapper = await montar()
    await completarFormulario(wrapper, {
      nombre: '  Burger clásica  ',
      descripcion: 'Doble smash',
      precio: '1890.5',
      stock: '7',
    })
    await elegirImagen(wrapper, crearArchivo({ nombre: 'Burger.PNG' }))
    await enviar(wrapper)

    const [subida] = falso.buscar('upload')
    expect(subida.bucket).toBe('productos')
    expect(subida.ruta).toMatch(/^usuario-1\/[0-9a-f-]{36}\.png$/)
    expect(subida.opciones).toEqual({ cacheControl: '3600', upsert: false })

    const [alta] = falso.buscar('insert')
    expect(alta.datos).toEqual({
      nombre: 'Burger clásica',
      descripcion: 'Doble smash',
      precio: 1890.5,
      stock: 7,
      activo: true,
      imagen_url: 'https://cdn.test/productos/foto.png',
      imagen_ruta: subida.ruta,
    })
  })

  it('guarda la descripción vacía como null y respeta el producto inactivo', async () => {
    const wrapper = await montar()
    await completarFormulario(wrapper, { nombre: 'Burger', precio: '100', stock: '0' })
    await wrapper.find('input[type="checkbox"]').setValue(false)
    await elegirImagen(wrapper, crearArchivo())
    await enviar(wrapper)

    const [alta] = falso.buscar('insert')
    expect(alta.datos.descripcion).toBeNull()
    expect(alta.datos.activo).toBe(false)
  })

  it('limpia el formulario y recarga el listado tras un alta exitosa', async () => {
    const wrapper = await montar()
    await completarFormulario(wrapper, { nombre: 'Burger', precio: '100', stock: '3' })
    await elegirImagen(wrapper, crearArchivo())
    await enviar(wrapper)

    expect(wrapper.text()).toContain('Producto creado correctamente')
    expect(wrapper.find('input[type="text"]').element.value).toBe('')
    expect(wrapper.findAll('input[type="number"]')[0].element.value).toBe('')
    expect(wrapper.findAll('input[type="number"]')[1].element.value).toBe('0')
    expect(wrapper.find('input[type="checkbox"]').element.checked).toBe(true)
    expect(falso.buscar('select')).toHaveLength(2)
  })

  it('borra la imagen subida si el insert falla', async () => {
    falso.estado.errores.insert = { message: 'new row violates row-level security policy' }
    const wrapper = await montar()
    await completarFormulario(wrapper, { nombre: 'Burger', precio: '100', stock: '1' })
    await elegirImagen(wrapper, crearArchivo())
    await enviar(wrapper)

    const [subida] = falso.buscar('upload')
    expect(falso.buscar('remove')).toEqual([
      { op: 'remove', bucket: 'productos', rutas: [subida.ruta] },
    ])
    expect(error(wrapper)).toBe('new row violates row-level security policy')
  })

  it('corta el alta cuando no hay usuario autenticado', async () => {
    falso.estado.errores.usuario = { message: 'Auth session missing' }
    const wrapper = await montar()
    await completarFormulario(wrapper, { nombre: 'Burger', precio: '100', stock: '1' })
    await elegirImagen(wrapper, crearArchivo())
    await enviar(wrapper)

    expect(error(wrapper)).toBe('No hay un usuario autenticado.')
    expect(falso.buscar('insert')).toHaveLength(0)
  })
})

describe('ProductosView · modificación', () => {
  const abrirEdicion = async () => {
    falso.estado.productos = [producto()]
    const wrapper = await montar()
    await wrapper.findAll('tbody button')[0].trigger('click')
    await flushPromises()
    return wrapper
  }

  it('carga los datos del producto en el formulario', async () => {
    const wrapper = await abrirEdicion()

    expect(wrapper.find('h1').text()).toBe('Editar producto')
    expect(wrapper.find('input[type="text"]').element.value).toBe('Burger clásica')
    expect(wrapper.find('textarea').element.value).toBe('Doble smash con cheddar')
    expect(wrapper.findAll('input[type="number"]')[0].element.value).toBe('1890.00')
    expect(wrapper.find('img[alt="Vista previa del producto"]').attributes('src')).toBe(
      'https://cdn.test/productos/burger.png',
    )
    expect(wrapper.text()).toContain('Imagen actual')
  })

  it('actualiza por id conservando la imagen cuando no se elige una nueva', async () => {
    const wrapper = await abrirEdicion()
    await completarFormulario(wrapper, { nombre: 'Burger doble', stock: '20' })
    await enviar(wrapper)

    expect(falso.buscar('upload')).toHaveLength(0)
    expect(falso.buscar('update')).toEqual([
      {
        op: 'update',
        tabla: 'productos',
        campo: 'id',
        valor: 'producto-1',
        datos: {
          nombre: 'Burger doble',
          descripcion: 'Doble smash con cheddar',
          precio: 1890,
          stock: 20,
          activo: true,
          imagen_url: 'https://cdn.test/productos/burger.png',
          imagen_ruta: 'usuario-1/burger.png',
        },
      },
    ])
    expect(wrapper.text()).toContain('Producto actualizado correctamente')
  })

  it('reemplaza la imagen y borra la anterior del storage', async () => {
    const wrapper = await abrirEdicion()
    await elegirImagen(wrapper, crearArchivo({ nombre: 'nueva.webp', tipo: 'image/webp' }))
    await enviar(wrapper)

    const [subida] = falso.buscar('upload')
    expect(subida.ruta).toMatch(/\.webp$/)
    expect(falso.buscar('update')[0].datos.imagen_ruta).toBe(subida.ruta)
    expect(falso.buscar('remove')).toEqual([
      { op: 'remove', bucket: 'productos', rutas: ['usuario-1/burger.png'] },
    ])
  })

  it('conserva la imagen anterior si el update falla', async () => {
    falso.estado.errores.update = { message: 'permiso denegado' }
    const wrapper = await abrirEdicion()
    await elegirImagen(wrapper, crearArchivo())
    await enviar(wrapper)

    const [subida] = falso.buscar('upload')
    expect(falso.buscar('remove')).toEqual([
      { op: 'remove', bucket: 'productos', rutas: [subida.ruta] },
    ])
    expect(error(wrapper)).toBe('permiso denegado')
  })

  it('vuelve al alta al cancelar la edición', async () => {
    const wrapper = await abrirEdicion()
    const cancelar = wrapper.findAll('form button').find((boton) => boton.text() === 'Cancelar')
    await cancelar.trigger('click')

    expect(wrapper.find('h1').text()).toBe('Nuevo producto')
    expect(wrapper.find('input[type="text"]').element.value).toBe('')
    expect(wrapper.find('img[alt="Vista previa del producto"]').exists()).toBe(false)
  })
})

describe('ProductosView · baja', () => {
  const montarConProducto = async () => {
    falso.estado.productos = [producto()]
    return montar()
  }

  const eliminar = async (wrapper) => {
    await wrapper.findAll('tbody button')[1].trigger('click')
    await flushPromises()
  }

  it('pide confirmación y no elimina si el usuario cancela', async () => {
    window.confirm.mockReturnValue(false)
    const wrapper = await montarConProducto()
    await eliminar(wrapper)

    expect(window.confirm).toHaveBeenCalledWith('¿Querés eliminar el producto "Burger clásica"?')
    expect(falso.buscar('delete')).toHaveLength(0)
  })

  it('elimina el producto y su imagen', async () => {
    const wrapper = await montarConProducto()
    await eliminar(wrapper)

    expect(falso.buscar('delete')).toEqual([
      { op: 'delete', tabla: 'productos', campo: 'id', valor: 'producto-1' },
    ])
    expect(falso.buscar('remove')).toEqual([
      { op: 'remove', bucket: 'productos', rutas: ['usuario-1/burger.png'] },
    ])
    expect(wrapper.text()).toContain('Producto eliminado correctamente')
  })

  it('no intenta borrar la imagen si la baja falla', async () => {
    falso.estado.errores.delete = { message: 'conflicto de clave foránea' }
    const wrapper = await montarConProducto()
    await eliminar(wrapper)

    expect(falso.buscar('remove')).toHaveLength(0)
    expect(error(wrapper)).toBe('conflicto de clave foránea')
  })

  it('avisa cuando el producto se borró pero la imagen quedó en el storage', async () => {
    falso.estado.errores.remove = { message: 'object not found' }
    const wrapper = await montarConProducto()
    await eliminar(wrapper)

    expect(error(wrapper)).toBe('El producto se eliminó, pero no se pudo borrar su imagen.')
  })
})

describe('ProductosView · sesión', () => {
  it('cierra la sesión y vuelve al login', async () => {
    const wrapper = await montar()
    await wrapper.find('header button').trigger('click')
    await flushPromises()

    expect(falso.buscar('signOut')).toHaveLength(1)
    expect(empujar).toHaveBeenCalledWith('/login')
  })
})
