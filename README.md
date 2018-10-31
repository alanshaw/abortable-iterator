# abortable-iterator

[![Build Status](https://travis-ci.org/alanshaw/abortable-iterator.svg?branch=master)](https://travis-ci.org/alanshaw/abortable-iterator) [![dependencies Status](https://david-dm.org/alanshaw/abortable-iterator/status.svg)](https://david-dm.org/alanshaw/abortable-iterator)

> Make any iterator or iterable abortable via an AbortSignal

The [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) is used in the fetch API to abort in flight requests from, for example, a timeout or user action. The same concept is used here to halt iteration of an async iterator.

## Install

```sh
npm install abortable-iterator
```

## Usage

```js
const abortable = require('abortable-iterator')
const AbortController = require('abort-controller')

// An example function that creates an async iterator that yields an increasing
// number every x milliseconds
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
const abortableEverySecond = abortable(everySecond, controller.signal)

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
const abortable = require('abortable-iterator')
```

### `abortable(iterator, signal, [options])`

Make any iterator or iterable abortable via an `AbortSignal`.


#### Parameters

| Name | Type | Description |
|------|------|-------------|
| iterator | [`Iterable`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#The_iterable_protocol)\|[`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#The_iterator_protocol) | The iterator or iterable object to make abortable |
| signal | [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) | Signal obtained from `AbortController.signal` which is used to abort the iterator. |
| options | `Object` | (optional) options |
| options.onAbort | `Function` | An (async) function called when the iterator is being aborted, before the abort error is thrown. |
| options.abortMessage | `String` | The message that the error will have if the iterator is aborted. |
| options.abortCode | `String`\|`Number` | The value assigned to the `code` property of the error that is thrown if the iterator is aborted. |

#### Returns

| Type | Description |
|------|-------------|
| [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#The_iterator_protocol) | An iterator that wraps the passed `iterator` parameter that makes it abortable via the passed `signal` parameter. |

The returned iterator will `throw` an `Error` when it is aborted that has a `code` property with the value `ERR_ABORTED` by default.

## Contribute

Feel free to dive in! [Open an issue](https://github.com/alanshaw/abortable-iterator/issues/new) or submit PRs.

## License

[MIT](LICENSE) © Alan Shaw
