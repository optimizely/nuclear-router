# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.0] - May 4th, 2020

- feat (Go): Support passing the mode to router.go (See #20)

## [2.1.0] - April 28th, 2020

- feat (popstate): Support higher fidelity popstate event handling (See #19)

### Breaking Changes

- Require explicit initialization via `initialize` before using. (See #17)

### Fixes

- Ensure that `reset` cleans up the `onpopstate` listener. (See #17)
- Only navigate to the `catchAll` path if one has been provided. (See #17)


## [1.4.7] - April 5th, 2019

