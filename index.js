const getIterator = require('get-iterator')
const AbortError = require('./AbortError')

// Wrap an iterator to make it abortable, allow cleanup when aborted via onAbort
module.exports = function createAbortable (iterator, signal, options) {
  iterator = getIterator(iterator)
  options = options || {}

  const { onAbort } = options
  const abortMessage = options.abortMessage || 'Operation aborted'
  const abortCode = options.abortCode || 'ERR_ABORTED'
  const errAborted = () => Object.assign(new AbortError(abortMessage), { code: abortCode })

  async function * abortable () {
    while (true) {
      let result, abortHandler
      try {
        if (signal.aborted) throw errAborted()

        const abort = new Promise((resolve, reject) => {
          abortHandler = () => reject(errAborted())
          signal.addEventListener('abort', abortHandler)
        })

        // Race the iterator and the abort signal
        result = await Promise.race([abort, iterator.next()])
      } catch (err) {
        if (err.type === 'aborted') {
          // Do any custom abort handling for the iterator
          if (onAbort) {
            await onAbort(iterator)
          }

          // End the iterator if it is a generator
          if (typeof iterator.return === 'function') {
            await iterator.return()
          }
        }
        throw err
      } finally {
        if (abortHandler) signal.removeEventListener('abort', abortHandler)
      }
      if (result.done) return
      yield result.value
    }
  }

  return abortable()
}

module.exports.AbortError = AbortError
