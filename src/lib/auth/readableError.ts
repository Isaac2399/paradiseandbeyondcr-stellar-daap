export function readableError(err: unknown): string {
  if (err instanceof Error && err.message && err.message !== '[object Object]') {
    return err.message
  }
  if (err && typeof err === 'object') {
    try {
      return JSON.stringify(err)
    } catch {
      return 'No se pudo completar'
    }
  }
  return 'No se pudo completar'
}
