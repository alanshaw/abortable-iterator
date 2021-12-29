const test = require('ava')
const AbortController = require('abort-controller')
const abortable = require('./')

test('should abort', async t => {
  const controller = new AbortController()
  const iterator = (async function * () {
    // Never ends!
    while (true) {
      yield new Promise((resolve, reject) => {
        setTimeout(() => resolve(Math.random()))
      })
    }
  })()

  // Abort after 10ms
  setTimeout(() => controller.abort(), 10)

  const err = await t.throwsAsync(async () => {
    for await (const value of abortable(iterator, controller.signal)) {
      t.log(value)
    }
  })

  t.is(err.type, 'aborted')
  t.is(err.code, 'ABORT_ERR')
})

test('should abort a slow iterator', async t => {
  // should finish before slow read
  t.timeout(1000)

  const controller = new AbortController()
  const iterator = (async function * () {
    // never ending read
    await new Promise(() => {})
    return 'hello world'
  }())

  // Abort after 10ms
  setTimeout(() => controller.abort(), 10)

  const err = await t.throwsAsync(async () => {
    for await (const value of abortable(iterator, controller.signal)) {
      t.log(value)
    }
  })

  t.is(err.type, 'aborted')
  t.is(err.code, 'ABORT_ERR')
})

test('should pass error to onReturnError', async t => {
  // should finish before slow read
  t.timeout(1000)

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
  setTimeout(() => controller.abort(), 10)
  let returnedErr

  const err = await t.throwsAsync(async () => {
    for await (const value of abortable(iterator, controller.signal, {
      onReturnError: (e) => {
        returnedErr = e
      }
    })) {
      t.log(value)
    }
  })

  t.is(err.type, 'aborted')
  t.is(err.code, 'ABORT_ERR')
  t.is(returnedErr, throwErr)
})

test('should swallow error when no onReturnError callback passed', async t => {
  // should finish before slow read
  t.timeout(1000)

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
  setTimeout(() => controller.abort(), 10)

  const err = await t.throwsAsync(async () => {
    for await (const value of abortable(iterator, controller.signal)) {
      t.log(value)
    }
  })

  t.is(err.type, 'aborted')
  t.is(err.code, 'ABORT_ERR')
  t.true(threw)
})

test('should multi abort', async t => {
  const controller0 = new AbortController()
  const controller1 = new AbortController()

  const iterator = (async function * () {
    // Never ends!
    while (true) {
      yield new Promise((resolve, reject) => {
        setTimeout(() => resolve(Math.random()))
      })
    }
  })()

  // Abort after 10ms
  setTimeout(() => controller1.abort(), 10)

  const err = await t.throwsAsync(async () => {
    for await (const value of abortable(iterator, [
      { signal: controller0.signal },
      { signal: controller1.signal }
    ])) {
      t.log(value)
    }
  })

  t.is(err.type, 'aborted')
  t.is(err.code, 'ABORT_ERR')
})

test('should abort with onAbort handler', async t => {
  const controller = new AbortController()

  const iterator = (async function * () {
    while (true) {
      yield new Promise(resolve => setTimeout(() => resolve(Math.random()), 1000))
    }
  })()

  // Ensure we allow async cleanup
  let onAbortCalled = false
  const onAbort = () => new Promise(resolve => {
    setTimeout(() => {
      onAbortCalled = true
      resolve()
    }, 1000)
  })

  // Abort after 10ms
  setTimeout(() => controller.abort(), 10)

  const err = await t.throwsAsync(async () => {
    for await (const value of abortable(iterator, controller.signal, { onAbort })) {
      t.log(value)
    }
  })

  t.is(err.type, 'aborted')
  t.is(err.code, 'ABORT_ERR')
  t.true(onAbortCalled)
})

test('should complete successfully', async t => {
  const controller = new AbortController()
  const iterator = (async function * () {
    yield new Promise((resolve, reject) => {
      setTimeout(() => resolve(Math.random()))
    })
  })()

  // Abort after 10ms
  setTimeout(() => controller.abort(), 10)

  await t.notThrowsAsync(async () => {
    for await (const value of abortable(iterator, controller.signal)) {
      t.log(value)
    }
  })
})

test('should throw for non iterator/iterable', t => {
  const controller = new AbortController()
  const nonIterator = {}
  const err = t.throws(() => abortable(nonIterator, controller.signal))
  t.true(err.message.includes('not an iterator'))
})

test('should abort if already aborted', async t => {
  const controller = new AbortController()
  const iterator = abortable(Array(100).fill(5), controller.signal)

  // Abort before we start consuming
  controller.abort()

  const err = await t.throwsAsync(async () => {
    for await (const value of iterator) {
      t.log(value)
    }
  })

  t.is(err.type, 'aborted')
  t.is(err.code, 'ABORT_ERR')
})
