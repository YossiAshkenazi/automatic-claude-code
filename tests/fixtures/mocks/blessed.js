// Mock for blessed module
module.exports = {
  screen: jest.fn(() => ({
    render: jest.fn(),
    destroy: jest.fn(),
    key: jest.fn(),
    append: jest.fn()
  })),
  box: jest.fn(() => ({
    setContent: jest.fn(),
    render: jest.fn()
  })),
  list: jest.fn(() => ({
    setItems: jest.fn(),
    render: jest.fn()
  }))
};
