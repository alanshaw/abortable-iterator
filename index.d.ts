/**
 * An [[Error]] with additional `type` and `code` properties. `type` is always "aborted" and `code` by default is "ABORT_ERR".
 * 
 * It is thrown when the iterable is aborted.
 */
export class AbortError extends Error {
  /**
   * @param message The human-readable description of the error. Default: "The operation was aborted".
   * @param code The machine-readable code for the error. Default: "ABORT_ERR"
   */
  constructor (message?: string, code?: string)
  type: 'aborted'
  /**
   * The machine-readable code for the error. Default: "ABORT_ERR".
   */
  code: string
}

type Options<T> = {
  onAbort?: (source: Source<T>) => void
  abortMessage?: string
  abortCode?: string
  returnOnAbort?: boolean
}

/**
 * A list of [[AbortSignal]]s and their corresponding options for allowing a single iterable to be aborted by multiple signals.
 */
type Signals<T> = {
  /**
   * The [[AbortSignal]] that will abort the request.
   */
  signal: AbortSignal,
  /**
   * [[Options]] for this signal.
   */
  options?: Options<T>
}[]

type Source<T> = AsyncIterable<T> | Iterable<T>
type Sink<TSource, TReturn = void> = (source: Source<TSource>) => TReturn
type Transform<TSourceIn, TSourceOut> = (source: Source<TSourceIn>) => Source<TSourceOut>
type Duplex<TSource, TSinkSource, TSinkReturn = void> = { sink: Sink<TSinkSource, TSinkReturn>, source: Source<TSource> }

declare function source<T> (
  source: Source<T>,
  signal?: AbortSignal,
  options?: Options<T>
): AsyncIterable<T>

declare function source<T> (
  source: Source<T>,
  signals: Signals<T>
): AsyncIterable<T>

declare function sink<TSource, TReturn = void> (
  sink: Sink<TSource, TReturn>,
  signal?: AbortSignal,
  options?: Options<TSource>
): Sink<TSource, TReturn>

declare function sink<TSource, TReturn = void> (
  sink: Sink<TSource, TReturn>,
  signals: Signals<TSource>
): Sink<TSource, TReturn>

declare function transform<TSourceIn, TSourceOut> (
  transform: Transform<TSourceIn, TSourceOut>,
  signal?: AbortSignal,
  options?: Options<TSourceIn>
): Transform<TSourceIn, TSourceOut>

declare function transform<TSourceIn, TSourceOut> (
  transform: Transform<TSourceIn, TSourceOut>,
  signals: Signals<TSourceIn>
): Transform<TSourceIn, TSourceOut>

declare function duplex<TSource, TSinkSource, TSinkReturn = void> (
  duplex: Duplex<TSource, TSinkSource, TSinkReturn>,
  signal?: AbortSignal,
  options?: Options<TSource>
): Duplex<TSource, TSinkSource, TSinkReturn>

declare function duplex<TSource, TSinkSource, TSinkReturn = void> (
  duplex: Duplex<TSource, TSinkSource, TSinkReturn>,
  signals: Signals<TSource>
): Duplex<TSource, TSinkSource, TSinkReturn>

// https://github.com/TypeStrong/typedoc/issues/1050
export { source, sink, transform, duplex }
export default source
