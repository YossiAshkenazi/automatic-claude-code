// Mock for chalk module with chainable methods
const createColorMethod = (colorName) => {
  const colorFunc = (str) => str; // Just return the string unchanged for tests
  
  // Add chainable color methods
  colorFunc.red = (str) => str;
  colorFunc.green = (str) => str;
  colorFunc.blue = (str) => str;
  colorFunc.yellow = (str) => str;
  colorFunc.magenta = (str) => str;
  colorFunc.cyan = (str) => str;
  colorFunc.white = (str) => str;
  colorFunc.gray = (str) => str;
  colorFunc.grey = (str) => str;
  
  // Add chainable style methods
  colorFunc.bold = (str) => str;
  colorFunc.dim = (str) => str;
  colorFunc.italic = (str) => str;
  colorFunc.underline = (str) => str;
  colorFunc.strikethrough = (str) => str;
  colorFunc.inverse = (str) => str;
  
  return colorFunc;
};

const chalk = {
  // Color methods
  red: createColorMethod('red'),
  green: createColorMethod('green'),
  blue: createColorMethod('blue'),
  yellow: createColorMethod('yellow'),
  magenta: createColorMethod('magenta'),
  cyan: createColorMethod('cyan'),
  white: createColorMethod('white'),
  gray: createColorMethod('gray'),
  grey: createColorMethod('grey'),
  black: createColorMethod('black'),
  
  // Style methods  
  bold: createColorMethod('bold'),
  dim: createColorMethod('dim'),
  italic: createColorMethod('italic'),
  underline: createColorMethod('underline'),
  strikethrough: createColorMethod('strikethrough'),
  inverse: createColorMethod('inverse'),
  
  // Background colors
  bgRed: createColorMethod('bgRed'),
  bgGreen: createColorMethod('bgGreen'),
  bgBlue: createColorMethod('bgBlue'),
  bgYellow: createColorMethod('bgYellow'),
  bgMagenta: createColorMethod('bgMagenta'),
  bgCyan: createColorMethod('bgCyan'),
  bgWhite: createColorMethod('bgWhite'),
  bgBlack: createColorMethod('bgBlack'),
  
  // Bright colors
  redBright: createColorMethod('redBright'),
  greenBright: createColorMethod('greenBright'),
  blueBright: createColorMethod('blueBright'),
  yellowBright: createColorMethod('yellowBright'),
  magentaBright: createColorMethod('magentaBright'),
  cyanBright: createColorMethod('cyanBright'),
  whiteBright: createColorMethod('whiteBright'),
  grayBright: createColorMethod('grayBright')
};

module.exports = chalk;
module.exports.default = chalk;
