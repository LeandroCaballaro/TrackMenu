import { vi } from 'vitest'

URL.createObjectURL = vi.fn(() => 'blob:vista-previa')
URL.revokeObjectURL = vi.fn()
window.scrollTo = vi.fn()
window.confirm = vi.fn(() => true)
