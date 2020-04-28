import fns from './fns'

export default class Context {
  /**
   * @param {Object} opts
   * @param {String} opts.path
   * @param {String} opts.canonicalPath
   * @param {String} opts.title
   * @param {Object} opts.params
   * @param {Number} opts.dispatchId
   */
  constructor({ path, canonicalPath, title, params, dispatchId}) {
    this.path = path
    this.canonicalPath = canonicalPath
    this.title = title
    this.params = params
    this.dispatchId = dispatchId

    // computeds
    this.queryString = fns.extractQueryString(canonicalPath)
    this.queryParams = fns.extractQueryParams(canonicalPath)
  }

  /**
   * Gets arguments that can be applied to history.pushState / history.replaceState
   * @return {String[]}
   */
  getHistoryArgs() {
    let state = {
      path: this.canonicalPath,
      nuclearDispatchId: this.dispatchId,
    }
    let url = this.canonicalPath

    return [
      state,
      this.title,
      url,
    ]
  }
}
