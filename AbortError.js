function AbortError (message) {
  Error.call(this, message)

  this.type = 'aborted'
  this.message = message

  // hide custom error implementation details from end-users
  Error.captureStackTrace(this, this.constructor)
}

AbortError.prototype = Object.create(Error.prototype)
AbortError.prototype.constructor = AbortError
AbortError.prototype.name = 'AbortError'

module.exports = AbortError
