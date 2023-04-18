import { expect } from 'aegir/chai'
import { abortableDuplex, abortableSink, abortableSource, abortableTransform } from '../src/index.js'
import drain from 'it-drain'
import delay from 'delay'
import { pipe } from 'it-pipe'
import type { Sink, Transform, Duplex, Source } from 'it-stream-types'

async function * forever (interval = 1): AsyncGenerator<number, void, unknown> {
  // Never ends!
  while (true) {
    if (interval > 0) {
      await delay(interval)
    }
    yield Math.random()
  }
}

describe('abortable-iterator', () => {
  it('should abort', async () => {
    const controller = new AbortController()

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)

    await expect(drain(abortableSource(forever(), controller.signal)))
      .to.eventually.be.rejected.with.property('type', 'aborted')
  })

  it('should abort a slow iterator', async () => {
    const controller = new AbortController()

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)

    await expect(drain(abortableSource(forever(6000), controller.signal)))
      .to.eventually.be.rejected.with.property('type', 'aborted')
  })

  it('should pass error to onReturnError', async () => {
    const throwErr = new Error('Kaboom!')
    const controller = new AbortController()
    const iterator = {
      next: async () => {
        // never ending read
        await new Promise(() => {})
        return 'hello world'
      },
      return: async () => {
        throw throwErr
      }
    }

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)
    let returnedErr

    // @ts-expect-error wat
    await expect(drain(abortableSource(iterator, controller.signal, {
      onReturnError: (e) => {
        returnedErr = e
      }
    })))
      .to.eventually.be.rejected.with.property('type', 'aborted')

    expect(returnedErr).to.equal(throwErr)
  })

  it('should swallow error when no onReturnError callback passed', async () => {
    let threw = false
    const controller = new AbortController()
    const iterator = {
      next: async () => {
        // never ending read
        await new Promise(() => {})
      },
      return: async () => {
        threw = true
        throw new Error('Kaboom!')
      }
    }

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)

    // @ts-expect-error wat
    await expect(drain(abortableSource(iterator, controller.signal)))
      .to.eventually.be.rejected.with.property('type', 'aborted')

    expect(threw).to.be.true()
  })

  it('should abort with onAbort handler', async () => {
    const controller = new AbortController()

    // Ensure we allow async cleanup
    let onAbortCalled = false
    const onAbort = (): void => {
      onAbortCalled = true
    }

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)

    await expect(drain(abortableSource(forever(1000), controller.signal, { onAbort })))
      .to.eventually.be.rejected.with.property('type', 'aborted')

    expect(onAbortCalled).to.be.true()
  })

  it('should complete successfully when aborted after iterator finishes', async () => {
    const controller = new AbortController()
    const iterator = (async function * () {
      yield new Promise((resolve, reject) => {
        setTimeout(() => { resolve(Math.random()) })
      })
    })()

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)

    await expect(drain(abortableSource(iterator, controller.signal)))
      .to.eventually.be.undefined()
  })

  it('should throw for non iterator/iterable', async () => {
    const controller = new AbortController()
    const nonIterator = {}

    // @ts-expect-error not an iterator
    expect(() => drain(abortableSource(nonIterator, controller.signal))) // eslint-disable-line @typescript-eslint/promise-function-async
      .to.throw().with.property('message', 'argument is not an iterator or iterable')
  })

  it('should abort if already aborted', async () => {
    const controller = new AbortController()
    // Abort before we start consuming
    controller.abort()

    await expect(drain(abortableSource(forever(), controller.signal)))
      .to.eventually.be.rejected.with.property('type', 'aborted')
  })

  it('should abort a sink', async () => {
    const controller = new AbortController()
    const sink: Sink<AsyncIterable<number>, Promise<void>> = async (source) => {
      await drain(source)
    }

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)

    await expect(pipe(
      forever(),
      async (source) => { await abortableSink(sink, controller.signal)(source) }
    ))
      .to.eventually.be.rejected.with.property('type', 'aborted')
  })

  it('should abort a transform', async () => {
    const controller = new AbortController()
    const transform: Transform<Source<number>, Source<number>> = async function * (source) {
      yield * source
    }

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)

    await expect(pipe(
      forever(),
      abortableTransform(transform, controller.signal),
      drain
    ))
      .to.eventually.be.rejected.with.property('type', 'aborted')
  })

  it('should abort a duplex used as a source', async () => {
    const controller = new AbortController()
    const duplex: Duplex<AsyncIterable<number>> = {
      source: forever(),
      sink: async (source) => { await drain(source) }
    }

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)

    await expect(pipe(
      abortableDuplex(duplex, controller.signal),
      drain
    ))
      .to.eventually.be.rejected.with.property('type', 'aborted')
  })

  it('should abort a duplex used as a transform', async () => {
    const controller = new AbortController()
    const duplex: Duplex<AsyncIterable<number>> = {
      source: forever(),
      sink: drain
    }

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)

    await expect(pipe(
      forever(),
      abortableDuplex(duplex, controller.signal),
      drain
    ))
      .to.eventually.be.rejected.with.property('type', 'aborted')
  })

  it('should abort a duplex used as a sink', async () => {
    const controller = new AbortController()
    const duplex: Duplex<AsyncIterable<number>> = {
      source: forever(),
      sink: drain
    }

    // Abort after 10ms
    setTimeout(() => { controller.abort() }, 10)

    await expect(pipe(
      forever(),
      abortableDuplex(duplex, controller.signal)
    ))
      .to.eventually.be.rejected.with.property('type', 'aborted')
  })

  it('should abort a synchronous generator', async () => {
    const controller = new AbortController()
    const iterator = abortableSource((function * () {
      while (true) {
        yield Math.random()
      }
    })(), controller.signal)

    await expect((async () => {
      for await (const _ of iterator) { // eslint-disable-line @typescript-eslint/no-unused-vars
        controller.abort()
      }
    })())
      .to.eventually.be.rejected.with.property('type', 'aborted')
  })
})
