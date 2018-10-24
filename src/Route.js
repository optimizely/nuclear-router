import pathToRegexp from 'path-to-regexp'

export default class Route {
  constructor({ match, handle, shouldHandle, metadata }) {
    this.match = (match === '*') ? '(.*)' : match;
    this.shouldHandle = shouldHandle;
    this.handlers = handle
    this.keys = []
    this.metadata = metadata;

    this.matchRegexp = pathToRegexp(this.match, this.keys)
  }
}
