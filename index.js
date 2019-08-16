const getIterator = require('get-iterator')
const AbortError = require('./AbortError')

// Wrap an iterator to make it abortable, allow cleanup when aborted via onAbort
module.exports = (iterator, signal, options) => {
  return createMultiAbortable(iterator, [{ signal, options }])
}

function createMultiAbortable (iterator, signals) {
  iterator = getIterator(iterator)

  async function * abortable () {
    let nextAbortHandler
    const abortHandler = () => {
      if (nextAbortHandler) nextAbortHandler()
    }

    for (const { signal } of signals) {
      signal.addEventListener('abort', abortHandler)
    }

    while (true) {
      let result
      try {
        for (const { signal, options } of signals) {
          if (signal.aborted) {
            const { abortMessage, abortCode } = options || {}
            throw new AbortError(abortMessage, abortCode)
          }
        }

        const abort = new Promise((resolve, reject) => {
          nextAbortHandler = () => {
            const { options } = signals.find(({ signal }) => signal.aborted)
            const { abortMessage, abortCode } = options || {}
            reject(new AbortError(abortMessage, abortCode))
          }
        })

        // Race the iterator and the abort signals
        result = await Promise.race([abort, iterator.next()])
        nextAbortHandler = null
      } catch (err) {
        for (const { signal } of signals) {
          signal.removeEventListener('abort', abortHandler)
        }

        if (err.type === 'aborted') {
          // Do any custom abort handling for the iterator
          const index = signals.findIndex(({ signal }) => signal.aborted)
          if (index > -1 && signals[index].options && signals[index].options.onAbort) {
            await signals[index].options.onAbort(iterator)
          }
        }

        // End the iterator if it is a generator
        if (typeof iterator.return === 'function') {
          await iterator.return()
        }

        throw err
      }

      if (result.done) break
      yield result.value
    }

    for (const { signal } of signals) {
      signal.removeEventListener('abort', abortHandler)
    }
  }

  return abortable()
}

module.exports.multi = createMultiAbortable

module.exports.AbortError = AbortError
