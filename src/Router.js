/**
 * @module
 */

/**
 * Input to Client Decision Engine
 *
 * @typedef Route
 * @property {String|RegExp} match
 * @property {RouterHandler[]} handlers
 */

/**
 * @callback RouteHandler
 * @param {Context} ctx
 * @param {Function} nextFn
 */

import assign from 'object-assign'
import Context from './Context'
import fns from './fns'
import Route from './Route'
import WindowEnv from './WindowEnv'
import HistoryEnv from './HistoryEnv'
import DocumentEnv from './DocumentEnv'

export default class Router {
  constructor(opts) {
    this.opts = opts || {};

    this.opts = assign({
      pushstate: true,
      base: '',
    }, opts)

    this.setInitialState();

    this.onRouteStart = this.opts.onRouteStart;
    this.onRouteComplete = this.opts.onRouteComplete

    WindowEnv.addEventListener('popstate', this.__onpopstate.bind(this))
  }

  setInitialState() {
    this.__fromPath = null;
    this.__routes = [];
    this.__currentCanonicalPath = null;
    this.__catchallPath = null;
    this.__dispatchId = 0;
    this.__startTime = null;
  }

  /**
   * Registers Routes for the application
   *
   * ```
   * var router = new Router(reactor)
   * router.registerRoutes([
   *   {
   *     match: '/foo',
   *     handlers: [
   *       (ctx, next) => {
   *         fetchDataForFoo()
   *         next()
   *       }
   *     ]
   *   }
   * ```
   *
   * @param {Route[]} routes
   */
  registerRoutes(routes) {
    if (!Array.isArray(routes)) {
      throw new Error('Router#registerRoutes must be passed an array of Routes')
    }
    routes.forEach(route => {
      this.__routes.push(new Route(route));
    })
  }

  /**
   * @param {String} path
   */
  registerCatchallPath(path) {
    this.__catchallPath = path;
  }

  /**
   * @param {String} canonicalPath
   */
  go(canonicalPath) {
    this.__dispatch(canonicalPath, 'push')
  }

  /**
   * @param {String} canonicalPath
   */
  replace(canonicalPath) {
    this.__dispatch(canonicalPath, 'replace')
  }

  reset() {
    this.setInitialState();
    WindowEnv.removeEventListener('popstate', this.__onpopstate)
  }

  catchall() {
    WindowEnv.navigate(this.__catchallPath)
  }

  /**
   * Execute a single route, which consists of:
   *   - Updating the url via pushstate/replacestate (if specified)
   *   - Running the routes handlers
   *   - Invoking the onstart and oncomplete handlers (if specified)
   * @param path
   * @param canonicalPath
   * @param mode
   * @param route
   * @param params
   * @private
   */
  __executeRoute(path, canonicalPath, mode, {route, params}) {
    const title = DocumentEnv.getTitle()
    const ctx = new Context({ canonicalPath, path, title, params, dispatchId: this.__dispatchId })
    if (mode === 'replace') {
      HistoryEnv.replaceState.apply(null, ctx.getHistoryArgs())
    } else if (mode === 'push') {
      HistoryEnv.pushState.apply(null, ctx.getHistoryArgs())
    }

    this.__currentCanonicalPath = canonicalPath
    const routeMetadata = route.metadata || {};

    if (this.onRouteStart && mode !== 'replace') {
      this.onRouteStart({
        routeMetadata,
        fromPath: this.__fromPath || 'PAGE LOAD',
        startTime: this.__startTime,
        context: ctx,
      });
    }

    this.__runHandlers(route.handlers, ctx, () => {
      const startTime = this.__startTime;
      const endTime = fns.getNow();
      const duration = endTime - startTime;
      const fromPath = this.__fromPath || 'PAGE LOAD';
      const toPath = canonicalPath;

      if (this.onRouteComplete) {
        this.onRouteComplete({
          fromPath,
          toPath,
          duration,
          startTime,
          endTime,
          routeMetadata,
        });
      }

      this.__fromPath = canonicalPath;
    })
  };


  /**
   * @param {RouterHandler[]} handlers
   * @param {Context} ctx
   */
  __runHandlers(handlers, ctx, callback) {
    let index = 0;

    let next = () => {
      if (this.__dispatchId !== ctx.dispatchId) {
        return;
      }
      let handlerFnOrArray = handlers[index];
      index++;
      // capture handler index in closure since index could be modified by another thread
      const handlerIndex = index;

      if (handlerFnOrArray) {
        if (Array.isArray(handlerFnOrArray)) {
          let parallelHandlersComplete = 0;

          // for parallel handlers we use a custom next callback that tracks completion of all handlers in the group
          const parallelNext = () => {
            parallelHandlersComplete++;
            if (parallelHandlersComplete === handlerFnOrArray.length) {
              next(); // all grouped parallel handlers complete, so invoke the next top-level handler or handler array
            }
          }
          // execute all handlers in parallel group
          handlerFnOrArray.map(handlerFn => handlerFn(ctx, parallelNext));
        } else {
          handlerFnOrArray(ctx, next);
          if (callback && handlerIndex === handlers.length && this.__dispatchId === ctx.dispatchId) {
            callback();
          }
        }
      }
    }

    next();
  }

  /**
   * @param {String} canonicalPath
   * @param {String} mode One of 'pop', 'push', 'replace'
   */
  __dispatch(canonicalPath, mode = 'push') {
    this.__dispatchId++;
    if (mode !== 'replace') {
      this.__startTime = fns.getNow();
    }

    let path = fns.extractPath(this.opts.base, canonicalPath)
    let matches = fns.matchRoute(this.__routes, path)

    fns.filterMatches(matches)
      .then(
        match => this.__executeRoute(path, canonicalPath, mode, match),
        this.catchall
      )
  }

  __onpopstate(e) {
    if (e.state) {
      this.__dispatch(e.state.path, 'pop');
    }
  }
}

