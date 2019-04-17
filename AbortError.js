module.exports = class AbortError extends Error {
  constructor (message) {
    super(message)
    this.type = 'aborted'
  }
}
