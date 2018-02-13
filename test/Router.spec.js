import expect from 'expect'
import Router from '../src/Router'
import WindowEnv from '../src/WindowEnv'
import HistoryEnv from '../src/HistoryEnv'
import DocumentEnv from '../src/DocumentEnv'
import fns from '../src/fns'

describe('Router', () => {
  const pageTitle = 'PAGE TITLE'

  beforeEach(() => {
    sinon.stub(HistoryEnv, 'pushState')
    sinon.stub(HistoryEnv, 'replaceState')
    sinon.stub(DocumentEnv, 'getTitle').returns(pageTitle)
  })

  afterEach(() => {
    HistoryEnv.pushState.restore()
    HistoryEnv.replaceState.restore()
    DocumentEnv.getTitle.restore()
  })

  describe('construction', () => {
    beforeEach(() => {
      sinon.stub(WindowEnv, 'addEventListener')
    })

    afterEach(() => {
      WindowEnv.addEventListener.restore()
    })

    it('should create a Router instance', () => {
      let router = new Router
      expect(router instanceof Router).toBe(true)
    })
  })

  describe('navigation', () => {
    let router
    let spy1, spy2, spy3
    let asyncSpy0, asyncSpy1, asyncSpy2, asyncSpy3
    let onRouteStartSpy, onRouteCompleteSpy, redirectSpy1, redirectSpy2
    let deferred, deferred2

    beforeEach(() => {
      onRouteStartSpy = sinon.spy()
      onRouteCompleteSpy = sinon.spy()

      router = new Router({
        onRouteComplete(ctx, next) {
          onRouteCompleteSpy(ctx)
        },
        onRouteStart: onRouteStartSpy,
      })

      spy1 = sinon.spy()
      spy2 = sinon.spy()
      spy3 = sinon.spy()

      asyncSpy0 = sinon.spy()
      asyncSpy1 = sinon.spy()
      asyncSpy2 = sinon.spy()
      asyncSpy3 = sinon.spy()

      redirectSpy1 = sinon.spy()
      redirectSpy2 = sinon.spy()

      let asyncPromise = new Promise((resolve, reject) => {
        deferred = { resolve, reject }
      })
      deferred.promise = asyncPromise
      let asyncPromise2 = new Promise((resolve, reject) => {
        deferred2 = { resolve, reject }
      })
      deferred2.promise = asyncPromise2

      router.registerRoutes([
        {
          match: '/foo',
          metadata: {
            bar: 'baz',
          },
          handle: [
            (ctx, next) => {
              spy1(ctx)
              next()
            },
            (ctx, next) => {
              spy2(ctx)
              next()
            },
          ],
        },
        {
          match: '/bar/:id/baz/:baz_id?',
          handle: [
            (ctx, next) => {
              spy3(ctx)
              next()
            },
          ],
        },
        {
          match: '/async',
          handle: [
            (ctx, next) => {
              asyncSpy0()
              next()
            },

            (ctx, next) => {
              asyncPromise.then(() => {
                asyncSpy1()
                next()
              })
            },

            (ctx, next) => {
              asyncSpy2()
              next()
            },
          ],
        },
        {
          match: '/async-parallel',
          handle: [
            [
              (ctx, next) => {
                asyncPromise.then(() => {
                  asyncSpy0();
                  next();
                });
              },
              (ctx, next) => {
                asyncPromise2.then(() => {
                  asyncSpy1();
                  next();
                });
              },
              (ctx, next) => {
                asyncSpy2();
                next();
              },
            ],
            (ctx, next) => {
              asyncSpy3();
              next();
            },
          ],
        },
        {
          match: '/redirect',
          handle: [
            (ctx, next) => {
              redirectSpy1()
              next()
            },
            () => {
              router.replace('/foo')
            },
            () => {
              redirectSpy2()
            },
          ],
        },
      ])

      sinon.stub(WindowEnv, 'navigate')
    })

    afterEach(() => {
      router.reset()
      WindowEnv.navigate.restore()
    })

    it('should register routes and respond to Router#go', () => {
      router.go('/foo')

      sinon.assert.calledOnce(spy1)
      sinon.assert.calledOnce(spy2)
      sinon.assert.notCalled(spy3)

      var ctx = spy1.firstCall.args[0]

      expect(ctx.title).toBe(pageTitle)
      expect(ctx.params).toEqual({})
      expect(ctx.canonicalPath).toBe('/foo')
      expect(ctx.path).toBe('/foo')
    })

    it('should properly parse params', () => {
      router.go('/bar/123/baz?account_id=4')

      sinon.assert.calledOnce(spy3)

      var ctx = spy3.firstCall.args[0]

      expect(ctx.title).toBe(pageTitle)
      expect(ctx.params).toEqual({
        id: '123',
        baz_id: undefined
      })
      expect(ctx.queryParams).toEqual({
        account_id: '4',
      })
      expect(ctx.canonicalPath).toBe('/bar/123/baz?account_id=4')
      expect(ctx.path).toBe('/bar/123/baz')
    })

    it('should block on async handlers', (done) => {
      router.go('/async')

      sinon.assert.calledOnce(asyncSpy0)
      sinon.assert.notCalled(asyncSpy1)
      sinon.assert.notCalled(asyncSpy2)

      deferred.resolve()

      deferred.promise.then(() => {
        sinon.assert.calledOnce(asyncSpy1)
        sinon.assert.calledOnce(asyncSpy2)
        done()
      })
    })

    it('should block on completion of grouped parallel executing async handlers', (done) => {
      router.go('/async-parallel')

      sinon.assert.calledOnce(asyncSpy2)
      sinon.assert.notCalled(asyncSpy0)
      sinon.assert.notCalled(asyncSpy1)
      sinon.assert.notCalled(asyncSpy3)

      deferred.resolve()
      deferred.promise.then(() => {
        sinon.assert.calledOnce(asyncSpy0)
        sinon.assert.notCalled(asyncSpy1)
        sinon.assert.notCalled(asyncSpy3)
  
        deferred2.resolve()
        deferred2.promise.then(() => {
          sinon.assert.calledOnce(asyncSpy1)
          sinon.assert.calledOnce(asyncSpy3)
          done()
        })
      })
    })

    it('should call onRouteComplete at the end of each route', () => {
      let getNowStub = sinon.stub(fns, 'getNow')
      getNowStub.onCall(0).returns(0)
      getNowStub.onCall(1).returns(3)
      getNowStub.onCall(2).returns(1)
      getNowStub.onCall(3).returns(10)
      router.go('/foo')

      sinon.assert.calledOnce(onRouteCompleteSpy)
      sinon.assert.callOrder(spy1, spy2, onRouteCompleteSpy)
      var args = onRouteCompleteSpy.firstCall.args[0]
      expect(args.fromPath).toBe('PAGE LOAD')
      expect(args.toPath).toBe('/foo')
      expect(args.duration).toBe(3)

      router.go('/bar/1/baz/2')
      sinon.assert.calledTwice(onRouteCompleteSpy)
      sinon.assert.callOrder(spy1, spy2, onRouteCompleteSpy)
      var args = onRouteCompleteSpy.secondCall.args[0]
      expect(args.fromPath).toBe('/foo')
      expect(args.toPath).toBe('/bar/1/baz/2')
      expect(args.duration).toBe(9)

      fns.getNow.restore()
    })

    describe('onRouteStart', () => {
      beforeEach(() => {
        sinon.stub(fns, 'getNow').returns(123)
      });

      afterEach(() => {
        fns.getNow.restore()
      });

      it('should call onRouteStart at the start of each route', () => {
        router.go('/foo')
        sinon.assert.calledOnce(onRouteStartSpy)
        var options = onRouteStartSpy.firstCall.args[0]
        expect(options.fromPath).toBe('PAGE LOAD')
        expect(options.startTime).toBe(123)
        expect(options.routeMetadata).toEqual({ bar: 'baz' })
        expect(options.context.title).toBe(pageTitle)
        expect(options.context.params).toEqual({})
        expect(options.context.canonicalPath).toBe('/foo')
        expect(options.context.path).toBe('/foo')
        sinon.assert.callOrder(onRouteStartSpy, spy1, spy2)
      })

      it('should call onRouteStart only once for a route with a redirect', () => {
        router.go('/redirect')
        sinon.assert.calledOnce(onRouteStartSpy)
        var options = onRouteStartSpy.firstCall.args[0]
        expect(options.fromPath).toBe('PAGE LOAD')
        sinon.assert.calledOnce(redirectSpy1)
        sinon.assert.notCalled(redirectSpy2)
        sinon.assert.callOrder(onRouteStartSpy, redirectSpy1, spy1, spy2)
      })
    })
  })
})
