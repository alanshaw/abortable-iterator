const getIterator = require('get-iterator')

// Wrap an iterator to make it abortable, allow cleanup when aborted via onAbort
module.exports = function createAbortable (iterator, signal, options) {
  iterator = getIterator(iterator)
  options = options || {}

  const onAbort = options.onAbort || (() => {})
  const abortMessage = options.abortMessage || 'operation aborted'
  const abortCode = options.abortCode || 'ERR_ABORTED'
  const errAborted = () => Object.assign(new Error(abortMessage), { code: abortCode })

  async function * abortable () {
    while (true) {
      let result
      try {
        if (signal.aborted) throw errAborted()

        const abort = new Promise((resolve, reject) => {
          signal.onabort = () => reject(errAborted())
        })

        // Race the iterator and the abort signal
        result = await Promise.race([abort, iterator.next()])
      } catch (err) {
        if (err.code === abortCode) {
          // Do any custom abort handling for the iterator
          await onAbort(iterator)

          // End the iterator if it is a generator
          if (typeof iterator.return === 'function') {
            iterator.return()
          }
        }

        throw err
      }
      if (result.done) return
      yield result.value
    }
  }

  return abortable()
}
