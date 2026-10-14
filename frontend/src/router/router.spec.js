import { beforeEach, describe, expect, it, vi } from 'vitest'
import { falso } from '@/tests/supabaseFalso'

vi.mock('@/supabase', async () => {
  const { falso: instancia } = await import('@/tests/supabaseFalso')
  return { supabase: instancia.supabase }
})

const { default: router } = await import('./index')

const ir = async (ruta) => {
  await router.push(ruta)
  await router.isReady()
  return router.currentRoute.value
}

beforeEach(async () => {
  falso.reiniciar()
  await router.push('/login')
})

describe('router', () => {
  it('redirige la raíz al inicio', async () => {
    expect((await ir('/')).path).toBe('/inicio')
  })

  it('deja entrar a las rutas públicas sin sesión', async () => {
    expect((await ir('/inicio')).path).toBe('/inicio')
    expect((await ir('/registro')).path).toBe('/registro')
  })

  it('manda al login cuando se pide /productos sin sesión', async () => {
    expect((await ir('/productos')).path).toBe('/login')
  })

  it('permite /productos con una sesión activa', async () => {
    falso.estado.sesion = { user: { id: 'usuario-1' } }

    expect((await ir('/productos')).path).toBe('/productos')
  })

  it('marca /productos como ruta protegida', () => {
    const ruta = router.getRoutes().find((item) => item.path === '/productos')

    expect(ruta.meta.requiereAutenticacion).toBe(true)
  })
})
