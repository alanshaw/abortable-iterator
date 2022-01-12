import { AbortError } from './abort-error.js'
import { getIterator } from 'get-iterator'
import type { Duplex, Source, Sink } from 'it-stream-types'

export interface Options<T> {
  onReturnError?: (err: Error) => void
  onAbort?: (source: Source<T>) => void
  abortMessage?: string
  abortCode?: string
  returnOnAbort?: boolean
}

// Wrap an iterator to make it abortable, allow cleanup when aborted via onAbort
export function abortableSource <T> (source: Source<T>, signal: AbortSignal, options?: Options<T>) {
  const opts: Options<T> = options ?? {}
  const iterator = getIterator<T>(source)

  async function * abortable () {
    let nextAbortHandler: (() => void) | null
    const abortHandler = () => {
      if (nextAbortHandler != null) nextAbortHandler()
    }

    signal.addEventListener('abort', abortHandler)

    while (true) {
      let result: IteratorResult<T, any>
      try {
        if (signal.aborted) {
          const { abortMessage, abortCode } = opts
          throw new AbortError(abortMessage, abortCode)
        }

        const abort = new Promise<any>((resolve, reject) => { // eslint-disable-line no-loop-func
          nextAbortHandler = () => {
            const { abortMessage, abortCode } = opts
            reject(new AbortError(abortMessage, abortCode))
          }
        })

        // Race the iterator and the abort signals
        result = await Promise.race([abort, iterator.next()])
        nextAbortHandler = null
      } catch (err: any) {
        signal.removeEventListener('abort', abortHandler)

        // Might not have been aborted by a known signal
        const isKnownAborter = err.type === 'aborted' && signal.aborted

        if (isKnownAborter && (opts.onAbort != null)) {
          // Do any custom abort handling for the iterator
          await opts.onAbort(source)
        }

        // End the iterator if it is a generator
        if (typeof iterator.return === 'function') {
          try {
            const p = iterator.return()

            if (p instanceof Promise) { // eslint-disable-line max-depth
              p.catch(err => {
                if (opts.onReturnError != null) {
                  opts.onReturnError(err)
                }
              })
            }
          } catch (err: any) {
            if (opts.onReturnError != null) { // eslint-disable-line max-depth
              opts.onReturnError(err)
            }
          }
        }

        if (isKnownAborter && opts.returnOnAbort === true) {
          return
        }

        throw err
      }

      if (result.done === true) {
        break
      }

      yield result.value
    }

    signal.removeEventListener('abort', abortHandler)
  }

  return abortable()
}

export function abortableSink <T, R> (sink: Sink<T, R>, signal: AbortSignal, options?: Options<T>): Sink<T, R> {
  return (source: Source<T>) => sink(abortableSource(source, signal, options))
}

export function abortableDuplex <TSource, TSink = TSource, RSink = Promise<void>> (duplex: Duplex<TSource, TSink, RSink>, signal: AbortSignal, options?: Options<TSource>) {
  return {
    sink: abortableSink(duplex.sink, signal, {
      ...options,
      onAbort: undefined
    }),
    source: abortableSource(duplex.source, signal, options)
  }
}

export { AbortError }
export { abortableSink as abortableTransform }
