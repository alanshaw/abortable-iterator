export class AbortError extends Error {
  type: string
  code: string

  constructor (message?: string, code?: string, name?: string) {
    super(message ?? 'The operation was aborted')
    this.type = 'aborted'
    this.code = code ?? 'ABORT_ERR'
    this.name = name ?? 'AbortError'
  }
}
