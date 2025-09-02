// Mock for blessed-contrib module
module.exports = {
  line: jest.fn(() => ({
    setData: jest.fn(),
    render: jest.fn()
  })),
  bar: jest.fn(() => ({
    setData: jest.fn(),
    render: jest.fn()
  })),
  table: jest.fn(() => ({
    setData: jest.fn(),
    render: jest.fn()
  }))
};
