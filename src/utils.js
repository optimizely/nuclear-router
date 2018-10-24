
/**
 * Variant of Promise.race(iterable)
 *
 * Given a list of Promises, return a Promise which resolves
 * with the index of the first Promise in the list which resolves
 * AND doesnt explicitly return false,
 * ensuring that all Promises before it have been settled.
 *
 * E.g.:
 *
 *   When the structure of promiseList is:
 *
 *   //   [<rejects in 1s>, <resolves in 1s>, <resolved>]
 *   // => Resolves with #2 after 1s
 *
 *   //   [<resolved>, <resolves in 1s>, <resolved>]
 *   // => Resolves with #1 immediately
 *
 *   //   [<rejects in 1s>, <rejected>, <resolved>]
 *   // => Resolves with #3 after 1s
 *
 *   //   [<rejected>, <resolves in 1s>, <resolved>]
 *   // => Resolves with #2 after 1s
 *
 *   //   [<resolves in 2s>, <resolves in 1s>, <resolved>]
 *   // => Resolves with #1 after 2s
 *
 * @param {Promise[]} promiseList
 * @returns {Promise}
 */
export const PromiseOrderedFirst = function(promiseList) {
  return new Promise((resolve, reject) => {
    const promiseToStateMap = [];
    const compute = () => {
      for (const { state, res, index } of promiseToStateMap) {
        if (state === "pending") {
          return;
        } else if (state === "resolved" && res !== false) {
          resolve({res, index});
        }
      }
      reject();
    };
    promiseList.forEach((promiseLike, index) => {
      promiseToStateMap[index] = { state: "pending" };
      promiseLike
        .then(res => {
          promiseToStateMap[index] = { state: "resolved", res, index };
        })
        .catch(res => {
          promiseToStateMap[index] = { state: "rejected", res, index };
        })
        .then(compute, compute);
    });
    compute();
  });
};

export default {
  PromiseOrderedFirst,
}
