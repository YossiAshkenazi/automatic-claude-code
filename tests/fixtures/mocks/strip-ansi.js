// Mock for strip-ansi module
module.exports = function stripAnsi(str) {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
};

module.exports.default = module.exports;
