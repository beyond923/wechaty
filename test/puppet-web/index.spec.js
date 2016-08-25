const co    = require('co')
const util  = require('util')
const test  = require('tape')
const retryPromise = require('retry-promise').default

const log = require('../../src/npmlog-env')

const PROFILE = 'unit-test-session.wechaty.json'

const PuppetWeb = require('../../src/puppet-web')
const Message = require('../../src/message')

test('Puppet Web Self Message Identification', function(t) {
  const p = new PuppetWeb({profile: PROFILE})
  t.ok(p, 'should instantiated a PuppetWeb')

  const EXPECTED_USER_ID = 'zixia'
  const m = new Message()
  m.set('from', EXPECTED_USER_ID)
  p.userId = EXPECTED_USER_ID
  t.ok(p.self(m), 'should identified self for message which from is self')

  t.end()
})

test('PuppetWeb smoke testing', function(t) {
  let pw = new PuppetWeb({profile: PROFILE})
  t.ok(pw, 'should instantiated a PuppetWeb')

  co(function* () {
    yield pw.init()
    t.pass('should be inited')
    t.equal(pw.logined() , false  , 'should be not logined')

    // XXX find a better way to mock...
    pw.bridge.getUserName = function() { return Promise.resolve('mockedUserName') }
    pw.getContact = function() { return Promise.resolve('dummy') }

    const p1 = new Promise((resolve) => {
      pw.once('login', r => {
        t.equal(pw.logined() , true   , 'should be logined after emit login event')
        resolve()
      })
    })
    pw.server.emit('login')
    yield p1

    const p2 = new Promise((resolve) => {
      pw.once('logout', r => process.nextTick(() => { // wait to next tick for pw clean logined user status
        // log.verbose('TestPuppetWeb', 'on(logout) received %s, islogined: %s', r, pw.logined())
        t.equal(pw.logined() , false  , 'should be logouted after logout event')
        resolve()
      }))
    })
    pw.server.emit('logout')
    yield p2
  })
  .catch(e => t.fail(e))  // Reject
  .then(r => {            // Finally
    // log.warn('TestPuppetWeb', 'finally()')
    pw.quit()
    .then(_ => t.end())
  })
  .catch(e => t.fail(e))  // Exception
})

test('PuppetWeb server/browser communication', function(t) {
  let pw = new PuppetWeb({profile: PROFILE})
  t.ok(pw, 'should instantiated a PuppetWeb')

  const EXPECTED_DING_DATA = 'dingdong'

  co(function* () {
    yield pw.init()
    t.pass('should be inited')

    const ret = yield dingSocket(pw.server)
    t.equal(ret,  EXPECTED_DING_DATA, 'should got EXPECTED_DING_DATA after resolved dingSocket()')
  })
  .catch(e => { // Reject
    log.warn('TestPuppetWeb', 'error: %s', e)
    t.fail(e)
  })
  .then(r => {  // Finally
    pw.quit()
    .then(_ => t.end())
  })
  .catch(e => t.fail(e))  // Exception

  return
  /////////////////////////////////////////////////////////////////////////////
  function dingSocket(server) {
    const maxTime   = 60000 // 60s
    const waitTime  = 3000
    let   totalTime = 0
    return new Promise((resolve, reject) => {
      log.verbose('TestPuppetWeb', 'dingSocket()')

      setTimeout(_ => {
        reject('no response timeout after ' + 2 * maxTime)
      }, 2 * maxTime)
      .unref()

      return testDing()

      function testDing() {
        log.silly('TestPuppetWeb', 'dingSocket() server.socketServer: %s', server.socketServer)
        if (!server.socketClient) {
          totalTime += waitTime
          if (totalTime > maxTime) {
            return reject('timeout after ' + totalTime + 'ms')
          }

          log.silly('TestPuppetWeb', 'waiting socketClient to connect for ' + totalTime + '/' + maxTime + ' ms...')
          setTimeout(testDing, waitTime)
          return
        }
        log.silly('TestPuppetWeb', 'dingSocket() server.socketClient: %s', server.socketClient)
        server.socketClient.once('dong', data => {
          log.verbose('TestPuppetWeb', 'socket recv event dong: ' + data)
          return resolve(data)
        })
        server.socketClient.emit('ding', EXPECTED_DING_DATA)
      }
    })
  }
})
