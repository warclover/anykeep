/**
 * Mock for remark-gfm ESM module
 * Used in Jest tests to avoid ESM transformation issues
 */

function remarkGfm() {
  return function (tree) {
    return tree;
  };
}

module.exports = remarkGfm;
module.exports.default = remarkGfm;
