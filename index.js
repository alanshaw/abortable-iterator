const getIterator = require('get-iterator')
const AbortError = require('./AbortError')

// Wrap an iterator to make it abortable, allow cleanup when aborted via onAbort
const toAbortableSource = (source, signal, options) => (
  toMultiAbortableSource(source, [{ signal, options }])
)

const toMultiAbortableSource = (source, signals) => {
  source = getIterator(source)

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
        result = await Promise.race([abort, source.next()])
        nextAbortHandler = null
      } catch (err) {
        for (const { signal } of signals) {
          signal.removeEventListener('abort', abortHandler)
        }

        if (err.type === 'aborted') {
          // Do any custom abort handling for the iterator
          const index = signals.findIndex(({ signal }) => signal.aborted)
          if (index > -1 && signals[index].options && signals[index].options.onAbort) {
            await signals[index].options.onAbort(source)
          }
        }

        // End the iterator if it is a generator
        if (typeof source.return === 'function') {
          await source.return()
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

const toAbortableSink = (sink, signal, options) => (
  toMultiAbortableSink(sink, [{ signal, options }])
)

const toMultiAbortableSink = (sink, signals) => source => (
  sink(toMultiAbortableSource(source, signals))
)

const toAbortableDuplex = (sink, signal, options) => (
  toMultiAbortableDuplex(sink, [{ signal, options }])
)

const toMultiAbortableDuplex = (duplex, signals) => ({
  sink: toMultiAbortableSink(duplex.sink),
  source: toMultiAbortableSource(duplex.source)
})

module.exports = toAbortableSource
module.exports.AbortError = AbortError

module.exports.source = toAbortableSource
module.exports.source.multi = toMultiAbortableSource

module.exports.sink = toAbortableSink
module.exports.sink.multi = toMultiAbortableSink

module.exports.transform = toAbortableSink
module.exports.transform.multi = toMultiAbortableSink

module.exports.duplex = toAbortableDuplex
module.exports.duplex.multi = toMultiAbortableDuplex
