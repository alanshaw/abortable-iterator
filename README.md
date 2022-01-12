# abortable-iterator

[![Build Status](https://github.com/alanshaw/abortable-iterator/actions/workflows/js-test-and-release.yml/badge.svg?branch=master)](https://github.com/alanshaw/abortable-iterator/actions/workflows/js-test-and-release.yml)
[![Dependencies Status](https://status.david-dm.org/gh/alanshaw/abortable-iterator.svg)](https://david-dm.org/alanshaw/abortable-iterator)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

> Make any iterator or iterable abortable via an AbortSignal

The [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) is used in the fetch API to abort in flight requests from, for example, a timeout or user action. The same concept is used here to halt iteration of an async iterator.

## Install

```sh
npm install abortable-iterator
```

## Usage

```js
import { abortableSource } from 'abortable-iterator'

// An example function that creates an async iterator that yields an increasing
// number every x milliseconds and NEVER ENDS!
const asyncCounter = async function * (start, delay) {
  let i = start
  while (true) {
    yield new Promise(resolve => setTimeout(() => resolve(i++), delay))
  }
}

// Create a counter that'll yield numbers from 0 upwards every second
const everySecond = asyncCounter(0, 1000)

// Make everySecond abortable!
const controller = new AbortController()
const abortableEverySecond = abortableSource(everySecond, controller.signal)

// Abort after 5 seconds
setTimeout(() => controller.abort(), 5000)

try {
  // Start the iteration, which will throw after 5 seconds when it is aborted
  for await (const n of abortableEverySecond) {
    console.log(n)
  }
} catch (err) {
  if (err.code === 'ERR_ABORTED') {
    // Expected - all ok :D
  } else {
    throw err
  }
}
```

## API

```js
import {
  abortableSource,
  abortableSink,
  abortableTransform,
  abortableDuplex
} from 'abortable-iterator'
```

* [`abortableSource(source, signal, [options])`](#abortablesource-signal-options)
* [`abortableSink(sink, signal, [options])`](#abortablesinksink-signal-options)
* [`abortableTransform(transform, signal, [options])`](#abortabletransformtransform-signal-options)
* [`abortableDuplex(duplex, signal, [options])`](#abortableduplexduplex-signal-options)

### `abortableSource(source, signal, [options])`
**(alias for `abortable.source(source, signal, [options])`)**

Make any iterator or iterable abortable via an `AbortSignal`.

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| source | [`Iterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#The_iterable_protocol)\|[`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#The_iterator_protocol) | The iterator or iterable object to make abortable |
| signal | [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) | Signal obtained from `AbortController.signal` which is used to abort the iterator. |
| options | `Object` | (optional) options |
| options.onAbort | `Function` | An (async) function called when the iterator is being aborted, before the abort error is thrown. Default `null` |
| options.abortMessage | `String` | The message that the error will have if the iterator is aborted. Default "The operation was aborted" |
| options.abortCode | `String`\|`Number` | The value assigned to the `code` property of the error that is thrown if the iterator is aborted. Default "ABORT_ERR" |
| options.returnOnAbort | `Boolean` | Instead of throwing the abort error, just return from iterating over the source stream. |
| options.onReturnError | `Function` | When a generator is aborted, we call `.return` on it - if this function errors the error value will be passed to the `.onReturnError` callback if passed. Default `null` |

#### Returns

| Type | Description |
|------|-------------|
| [`Iterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#The_iterator_protocol) | An iterator that wraps the passed `source` parameter that makes it abortable via the passed `signal` parameter. |

The returned iterator will `throw` an `AbortError` when it is aborted that has a `type` with the value `aborted` and `code` property with the value `ABORT_ERR` by default.

### `abortableSink(sink, signal, [options])`

The same as [`abortable.source`](#abortablesource-signal-options) except this makes the passed [`sink`](https://gist.github.com/alanshaw/591dc7dd54e4f99338a347ef568d6ee9#sink-it) abortable. Returns a new sink that wraps the passed `sink` and makes it abortable via the passed `signal` parameter.

### `abortableTransform(transform, signal, [options])`

The same as [`abortable.source`](#abortablesource-signal-options) except this makes the passed [`transform`](https://gist.github.com/alanshaw/591dc7dd54e4f99338a347ef568d6ee9#transform-it) abortable. Returns a new transform that wraps the passed `transform` and makes it abortable via the passed `signal` parameter.

### `abortableDuplex(duplex, signal, [options])`

The same as [`abortable.source`](#abortablesource-signal-options) except this makes the passed [`duplex`](https://gist.github.com/alanshaw/591dc7dd54e4f99338a347ef568d6ee9#duplex-it) abortable. Returns a new duplex that wraps the passed `duplex` and makes it abortable via the passed `signal` parameter.

Note that this will abort _both_ sides of the duplex. Use `duplex.sink = abortable.sink(duplex.sink)` or `duplex.source = abortable.source(duplex.source)` to abort just the sink or the source.

## Related

* [`it-pipe`](https://www.npmjs.com/package/it-pipe) Utility to "pipe" async iterables together

## Contribute

Feel free to dive in! [Open an issue](https://github.com/alanshaw/abortable-iterator/issues/new) or submit PRs.

## License

[MIT](LICENSE) © Alan Shaw
