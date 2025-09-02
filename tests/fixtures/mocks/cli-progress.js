// Mock for cli-progress module
const Bar = function() {
  return {
    start: jest.fn(),
    update: jest.fn(),
    stop: jest.fn(),
    increment: jest.fn()
  };
};

const MultiBar = function() {
  return {
    create: jest.fn().mockReturnValue(new Bar()),
    stop: jest.fn(),
    remove: jest.fn()
  };
};

module.exports = {
  SingleBar: Bar,
  MultiBar,
  Presets: {
    shades_classic: {},
    rect: {},
    legacy: {}
  }
};
