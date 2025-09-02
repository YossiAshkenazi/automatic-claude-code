// Mock for chalk module with chainable methods
const createChainableMethod = (baseFunc) => {
  const func = baseFunc;
  
  // Add chainable methods
  func.red = (str) => str;
  func.green = (str) => str;
  func.blue = (str) => str;
  func.yellow = (str) => str;
  func.magenta = (str) => str;
  func.cyan = (str) => str;
  func.white = (str) => str;
  func.gray = (str) => str;
  func.bold = createChainableMethod((str) => str);
  func.dim = createChainableMethod((str) => str);
  func.italic = createChainableMethod((str) => str);
  func.underline = createChainableMethod((str) => str);
  
  return func;
};

const chalk = {
  red: createChainableMethod((str) => str),
  green: createChainableMethod((str) => str),
  blue: createChainableMethod((str) => str),
  yellow: createChainableMethod((str) => str),
  magenta: createChainableMethod((str) => str),
  cyan: createChainableMethod((str) => str),
  white: createChainableMethod((str) => str),
  gray: createChainableMethod((str) => str),
  bold: createChainableMethod((str) => str),
  dim: createChainableMethod((str) => str),
  italic: createChainableMethod((str) => str),
  underline: createChainableMethod((str) => str)
};

module.exports = chalk;
module.exports.default = chalk;
