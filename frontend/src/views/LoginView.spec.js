import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { falso } from '@/tests/supabaseFalso'

vi.mock('@/supabase', async () => {
  const { falso: instancia } = await import('@/tests/supabaseFalso')
  return { supabase: instancia.supabase }
})

const empujar = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: empujar }),
}))

const { default: LoginView } = await import('./LoginView.vue')

const montar = () =>
  mount(LoginView, {
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  })

const ingresar = async (wrapper, correo, clave) => {
  await wrapper.find('input[type="email"]').setValue(correo)
  await wrapper.find('input[type="password"]').setValue(clave)
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  falso.reiniciar()
  empujar.mockClear()
})

describe('LoginView', () => {
  it('normaliza el correo y lleva al ABM al iniciar sesión', async () => {
    const wrapper = montar()
    await ingresar(wrapper, '  Lean@Test.COM ', 'clave-segura')

    expect(falso.buscar('signIn')[0].credenciales).toEqual({
      email: 'lean@test.com',
      password: 'clave-segura',
    })
    expect(empujar).toHaveBeenCalledWith('/productos')
  })

  it('muestra un error y no navega cuando las credenciales son inválidas', async () => {
    falso.estado.errores.login = { message: 'Invalid login credentials' }
    const wrapper = montar()
    await ingresar(wrapper, 'lean@test.com', 'incorrecta')

    expect(wrapper.find('[role="alert"]').text()).toBe('Correo o contraseña incorrectos.')
    expect(empujar).not.toHaveBeenCalled()
  })
})
