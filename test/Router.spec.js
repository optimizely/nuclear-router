import expect from 'expect'
import Router from '../src/Router'
import WindowEnv from '../src/WindowEnv'
import HistoryEnv from '../src/HistoryEnv'
import DocumentEnv from '../src/DocumentEnv'
import fns from '../src/fns'

/**
 * Helper function to generate a Promise that is resolved
 * after a setTimeout (macro-task timing).
 * This is useful to control test timing where our
 * router resolves routes using Promises (micro-task timing)
 * More on micro-tasks vs macro-tasks:
 *   https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/
 * @returns {Promise}
 */
function getMacroTaskResolvedPromise() {
  return new Promise(r => setTimeout(r));
}

describe('Router', () => {
  const pageTitle = 'PAGE TITLE'

  beforeEach(() => {
    sinon.stub(HistoryEnv, 'pushState')
    sinon.stub(HistoryEnv, 'replaceState')
    sinon.stub(DocumentEnv, 'getTitle').returns(pageTitle)
    sinon.stub(WindowEnv, 'addEventListener')
    sinon.stub(WindowEnv, 'removeEventListener')
  })

  afterEach(() => {
    HistoryEnv.pushState.restore()
    HistoryEnv.replaceState.restore()
    DocumentEnv.getTitle.restore()
    WindowEnv.addEventListener.restore()
    WindowEnv.removeEventListener.restore()
  })

  describe('construction', () => {
    it('should create a Router instance', () => {
      let router = new Router
      expect(router instanceof Router).toBe(true)
    })
  })

  describe('initialization and reset', function() {
    let emptyRouter;
    beforeEach(function() {
      emptyRouter = new Router({});
    });

    context('initialize', function() {
      it('should not define state before initialization', function() {
        expect(emptyRouter.__fromPath).toBe(undefined);
        expect(emptyRouter.__routes).toBe(undefined);
        expect(emptyRouter.__currentCanonicalPath).toBe(undefined);
        sinon.assert.notCalled(WindowEnv.addEventListener);
      });

      it('should set initial state and add popstate listener upon initialization', function() {
        emptyRouter.initialize();
        expect(emptyRouter.__fromPath).toBe(null);
        expect(emptyRouter.__routes.length).toBe(0);
        expect(emptyRouter.__currentCanonicalPath).toBe(null);
        sinon.assert.calledOnce(WindowEnv.addEventListener);
        sinon.assert.calledWith(WindowEnv.addEventListener, 'popstate');
      });
    })

    context('reset', function() {
      beforeEach(function() {
        emptyRouter.initialize();
        emptyRouter.registerRoutes([
          {
            match: '/the_route',
            handle: [
              (ctx, next) => {
                next()
              },
            ],
          },
        ]);
        emptyRouter.go('/the_route');
        return getMacroTaskResolvedPromise();
      })
      it('should reset initial state and remove popstate listener', function() {
        expect(emptyRouter.__routes.length).toBe(1);
        sinon.assert.notCalled(WindowEnv.removeEventListener);
        emptyRouter.reset();
        expect(emptyRouter.__fromPath).toBe(null);
        expect(emptyRouter.__routes.length).toBe(0);
        expect(emptyRouter.__currentCanonicalPath).toBe(null);
        sinon.assert.calledOnce(WindowEnv.removeEventListener);
        sinon.assert.calledWith(WindowEnv.removeEventListener, 'popstate');
      });
    })
  });

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
      router.initialize();

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

      router.registerCatchallPath('/404');
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
      router.reset();
      WindowEnv.navigate.restore();
    });

    describe('when no route matches', function() {
      it('should execute the catchall route', () => {
        router.go('/abcdefg');

        return getMacroTaskResolvedPromise()
          .then(() => {
            sinon.assert.calledOnce(WindowEnv.navigate);
            sinon.assert.calledWithExactly(WindowEnv.navigate, '/404');
          })
      });

      it('should not window navigate if the catchall route is not set', () => {
        router.__catchallPath = null;
        router.go('/abcdefg');

        return getMacroTaskResolvedPromise()
          .then(() => {
            sinon.assert.notCalled(WindowEnv.navigate);
          })
      });
    });

    describe('when a single route matches', function() {
      let handlerSpy1;
      let shouldHandleSpy1;

      beforeEach(function () {
        handlerSpy1 = sinon.spy();
        shouldHandleSpy1 = sinon.spy();
      });

      describe('when shouldHandle resolves', function() {
        beforeEach(function() {
          router.registerRoutes([
            {
              match: '/the_route',
              shouldHandle: () => {
                shouldHandleSpy1();
                return Promise.resolve();
              },
              handle: [
                (ctx, next) => {
                  handlerSpy1(ctx);
                  next()
                },
              ],
            },
          ]);
        });

        it('should execute the route', () => {
          router.go('/the_route');

          return getMacroTaskResolvedPromise()
            .then(() => {
              sinon.assert.calledOnce(handlerSpy1)
              sinon.assert.calledOnce(shouldHandleSpy1)
            })
        });
      });

      describe('when shouldHandle rejects', function() {
        beforeEach(function() {
          router.registerRoutes([
            {
              match: '/the_route',
              shouldHandle: () => {
                shouldHandleSpy1();
                return Promise.reject();
              },
              handle: [
                (ctx, next) => {
                  handlerSpy1(ctx);
                  next()
                },
              ],
            },
          ]);
        });

        it('should execute the catchall instead of the route', () => {
          router.go('/the_route');

          return getMacroTaskResolvedPromise()
            .then(() => {
              sinon.assert.notCalled(handlerSpy1)
              sinon.assert.calledOnce(shouldHandleSpy1)
              sinon.assert.calledOnce(WindowEnv.navigate);
              sinon.assert.calledWithExactly(WindowEnv.navigate, '/404');
            })
        });
      });
    });

    describe('when multiple routes match', function() {
      let handlerSpy1;
      let handlerSpy2;
      let shouldHandleSpy1;
      let shouldHandleSpy2;

      beforeEach(function() {
        handlerSpy1 = sinon.spy()
        handlerSpy2 = sinon.spy()
        shouldHandleSpy1 = sinon.spy()
        shouldHandleSpy2 = sinon.spy()
      })

      describe('when none have a shouldHandle property', function() {
        beforeEach(function() {
          router.registerRoutes([
            {
              match: '/shared_route',
              handle: [
                (ctx, next) => {
                  handlerSpy1(ctx)
                  next()
                },
              ],
            },
            {
              match: '/shared_route',
              handle: [
                (ctx, next) => {
                  handlerSpy2(ctx)
                  next()
                },
              ],
            }
          ]);
        });

        it('should execute the first route in the list', () => {
          router.go('/shared_route')

          return getMacroTaskResolvedPromise()
            .then(() => {
              sinon.assert.calledOnce(handlerSpy1)
              sinon.assert.notCalled(handlerSpy2)
            })
        });
      })

      describe('when one shouldHandle resolves and another rejects', function() {
        beforeEach(function() {
          router.registerRoutes([
            {
              match: '/shared_route',
              shouldHandle: () => Promise.reject(),
              handle: [
                (ctx, next) => {
                  handlerSpy1(ctx)
                  next()
                },
              ],
            },
            {
              match: '/shared_route',
              shouldHandle: () => Promise.resolve(),
              handle: [
                (ctx, next) => {
                  handlerSpy2(ctx)
                  next()
                },
              ],
            }
          ]);
        });

        it('should execute the second route in the list', () => {
          router.go('/shared_route')

          return getMacroTaskResolvedPromise()
            .then(() => {
              sinon.assert.calledOnce(handlerSpy2)
              sinon.assert.notCalled(handlerSpy1)
            })
        });
      });

      describe('when the first shouldHandle rejects after a delay and the latter resolves immediately', function() {
        beforeEach(function() {
          router.registerRoutes([
            {
              match: '/shared_route',
              shouldHandle: () => {
                setTimeout(() => {
                  deferred.reject('not my route')
                  shouldHandleSpy1();
                }, 100);
                return deferred.promise;
              },
              handle: [
                (ctx, next) => {
                  handlerSpy1(ctx)
                  next()
                },
              ],
            },
            {
              match: '/shared_route',
              shouldHandle: () => {
                deferred2.resolve();
                shouldHandleSpy2();
                return deferred2.promise;
              },
              handle: [
                (ctx, next) => {
                  handlerSpy2(ctx)
                  next()
                },
              ],
            }
          ]);
        });

        it('should wait for the first shouldHandle to reject before executing the second route', () => {
          router.go('/shared_route')

          return deferred.promise
            .then(null, () => getMacroTaskResolvedPromise())
            .then(() => {
              sinon.assert.calledOnce(handlerSpy2)
              sinon.assert.notCalled(handlerSpy1)
              sinon.assert.callOrder(shouldHandleSpy2, shouldHandleSpy1, handlerSpy2)
            });
        });
      })

      describe('when the first shouldHandle resolves after a delay and the latter resolves immediately', function() {
        beforeEach(function() {
          router.registerRoutes([
            {
              match: '/shared_route',
              shouldHandle: () => {
                setTimeout(() => {
                  deferred.resolve('this is my route')
                  shouldHandleSpy1();
                }, 100);
                return deferred.promise;
              },
              handle: [
                (ctx, next) => {
                  handlerSpy1(ctx)
                  next()
                },
              ],
            },
            {
              match: '/shared_route',
              shouldHandle: () => {
                deferred2.resolve();
                shouldHandleSpy2();
                return deferred2.promise;
              },
              handle: [
                (ctx, next) => {
                  handlerSpy2(ctx)
                  next()
                },
              ],
            }
          ]);
        });

        it('should wait for the first shouldHandle to resolve then execute it', () => {
          router.go('/shared_route')

          return Promise.all([deferred.promise, deferred2.promise])
            .then(() => getMacroTaskResolvedPromise())
            .then(() => {
              sinon.assert.calledOnce(handlerSpy1)
              sinon.assert.notCalled(handlerSpy2)
              sinon.assert.callOrder(shouldHandleSpy2, shouldHandleSpy1, handlerSpy1)
            }
          );
        });
      })
    });

    it('should register routes and respond to Router#go', () => {
      router.go('/foo')

      return getMacroTaskResolvedPromise().then(() => {
        sinon.assert.calledOnce(spy1)
        sinon.assert.calledOnce(spy2)
        sinon.assert.notCalled(spy3)

        const ctx = spy1.firstCall.args[0]

        expect(ctx.title).toBe(pageTitle)
        expect(ctx.params).toEqual({})
        expect(ctx.canonicalPath).toBe('/foo')
        expect(ctx.path).toBe('/foo')
      })
    })

    it('should properly parse params', () => {
      router.go('/bar/123/baz?account_id=4')

      return getMacroTaskResolvedPromise().then(() => {
        sinon.assert.calledOnce(spy3)

        const ctx = spy3.firstCall.args[0]

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
      });
    })

    it('should block on async handlers', () => {
      router.go('/async')

      return getMacroTaskResolvedPromise().then(() => {

        sinon.assert.calledOnce(asyncSpy0)
        sinon.assert.notCalled(asyncSpy1)
        sinon.assert.notCalled(asyncSpy2)

        deferred.resolve()

        return deferred.promise.then(() => {
          sinon.assert.calledOnce(asyncSpy1)
          sinon.assert.calledOnce(asyncSpy2)
        })
      });
    })

    it('should block on completion of grouped parallel executing async handlers', () => {
      router.go('/async-parallel')

      return getMacroTaskResolvedPromise().then(() => {

        sinon.assert.calledOnce(asyncSpy2)
        sinon.assert.notCalled(asyncSpy0)
        sinon.assert.notCalled(asyncSpy1)
        sinon.assert.notCalled(asyncSpy3)

        deferred.resolve()
        return deferred.promise.then(() => {
          sinon.assert.calledOnce(asyncSpy0)
          sinon.assert.notCalled(asyncSpy1)
          sinon.assert.notCalled(asyncSpy3)

          deferred2.resolve()
          return deferred2.promise.then(() => {
            sinon.assert.calledOnce(asyncSpy1)
            sinon.assert.calledOnce(asyncSpy3)
          })
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

      return getMacroTaskResolvedPromise().then(() => {
          sinon.assert.calledOnce(onRouteCompleteSpy)
          sinon.assert.callOrder(spy1, spy2, onRouteCompleteSpy)
          const args = onRouteCompleteSpy.firstCall.args[0]
          expect(args.fromPath).toBe('PAGE LOAD')
          expect(args.toPath).toBe('/foo')
          expect(args.duration).toBe(3)
          expect(args.routeMetadata).toEqual({bar: 'baz'})

          router.go('/bar/1/baz/2')
        })
        .then(() => getMacroTaskResolvedPromise())
        .then(() => {
          sinon.assert.calledTwice(onRouteCompleteSpy)
          sinon.assert.callOrder(spy1, spy2, onRouteCompleteSpy)
          const args = onRouteCompleteSpy.secondCall.args[0]
          expect(args.fromPath).toBe('/foo')
          expect(args.toPath).toBe('/bar/1/baz/2')
          expect(args.duration).toBe(9)
          expect(args.routeMetadata).toEqual({})
        })
        .then(() => {
          fns.getNow.restore()
        })
    })

    describe('when handling a popstate event', () => {
      let dispatchStub;
      let popstateSpy;

      beforeEach(() => {
        dispatchStub = sinon.stub(router, '__dispatch');
        popstateSpy = sinon.spy(router, '__onpopstate');
      });

      it('should not dispatch a route if the popstate listener is disabled', () => {
        // Wrap popstate emitter to disable the popstate listener
        return router.executeWithoutPopstateListener(() => {
          // Simulate a popstate event
          router.__onpopstate({ state: {} });
          return Promise.resolve();
        })
          .then(() => {
            // Expect that the popstate handler is called
            sinon.assert.calledOnce(popstateSpy);

            // Expect that the popstate listener does not trigger a dispatch
            sinon.assert.notCalled(dispatchStub);
          });
      });

      it('should dispatch a route if the popstate listener is enabled', () => {
        // Simulate a popstate event w/o disabling popstate listener
        router.__onpopstate({ state: {} });
        
        // Expect that the popstate handler is called
        sinon.assert.calledOnce(popstateSpy);

        // Expect that the popstate listener does trigger a dispatch
        sinon.assert.calledOnce(dispatchStub);
      });
    });

    describe('onRouteStart', () => {
      beforeEach(() => {
        sinon.stub(fns, 'getNow').returns(123)
      });

      afterEach(() => {
        fns.getNow.restore()
      });

      it('should call onRouteStart at the start of each route', () => {
        router.go('/foo')
        return getMacroTaskResolvedPromise().then(() => {
          sinon.assert.calledOnce(onRouteStartSpy)
          const options = onRouteStartSpy.firstCall.args[0]
          expect(options.fromPath).toBe('PAGE LOAD')
          expect(options.startTime).toBe(123)
          expect(options.routeMetadata).toEqual({bar: 'baz'})
          expect(options.context.title).toBe(pageTitle)
          expect(options.context.params).toEqual({})
          expect(options.context.canonicalPath).toBe('/foo')
          expect(options.context.path).toBe('/foo')
          sinon.assert.callOrder(onRouteStartSpy, spy1, spy2)
        });
      })

      it('should call onRouteStart only once for a route with a redirect', () => {
        router.go('/redirect')
        return getMacroTaskResolvedPromise()
          .then(() => {
            sinon.assert.calledOnce(onRouteStartSpy)
            const options = onRouteStartSpy.firstCall.args[0]
            expect(options.fromPath).toBe('PAGE LOAD')
            sinon.assert.calledOnce(redirectSpy1)
            sinon.assert.notCalled(redirectSpy2)
            sinon.assert.callOrder(onRouteStartSpy, redirectSpy1, spy1, spy2)
          });
      })
    })
  })
})
