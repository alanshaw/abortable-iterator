/**
 * @packageDocumentation
 *
 * @example
 *
 * ```js
 * import { abortableSource } from 'abortable-iterator'
 *
 * async function main () {
 *   // An example function that creates an async iterator that yields an increasing
 *   // number every x milliseconds and NEVER ENDS!
 *   const asyncCounter = async function * (start, delay) {
 *     let i = start
 *     while (true) {
 *       yield new Promise(resolve => setTimeout(() => resolve(i++), delay))
 *     }
 *   }
 *
 *   // Create a counter that'll yield numbers from 0 upwards every second
 *   const everySecond = asyncCounter(0, 1000)
 *
 *   // Make everySecond abortable!
 *   const controller = new AbortController()
 *   const abortableEverySecond = abortableSource(everySecond, controller.signal)
 *
 *   // Abort after 5 seconds
 *   setTimeout(() => controller.abort(), 5000)
 *
 *   try {
 *     // Start the iteration, which will throw after 5 seconds when it is aborted
 *     for await (const n of abortableEverySecond) {
 *       console.log(n)
 *     }
 *   } catch (err) {
 *     if (err.code === 'ERR_ABORTED') {
 *       // Expected - all ok :D
 *     } else {
 *       throw err
 *     }
 *   }
 * }
 *
 * main()
 * ```
 */

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

/**
 * Wrap an iterator to make it abortable, allow cleanup when aborted via onAbort
 */
export function abortableSource <T> (source: Source<T>, signal: AbortSignal, options?: Options<T>): AsyncGenerator<T> {
  const opts: Options<T> = options ?? {}
  const iterator = getIterator<T>(source)

  async function * abortable (): AsyncGenerator<Awaited<T>, void, unknown> {
    let nextAbortHandler: (() => void) | null
    const abortHandler = (): void => {
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
          opts.onAbort(source)
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

export function abortableSink <T, R = Promise<void>> (sink: Sink<AsyncIterable<T>, R>, signal: AbortSignal, options?: Options<T>): Sink<Source<T>, R> {
  return (source: Source<T>) => sink(abortableSource(source, signal, options))
}

export function abortableDuplex <TSource, TSink = TSource, RSink = Promise<void>> (duplex: Duplex<AsyncIterable<TSource>, Source<TSink>, RSink>, signal: AbortSignal, options?: Options<TSource>): Duplex<AsyncGenerator<TSource>, Source<TSink>, RSink> {
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
