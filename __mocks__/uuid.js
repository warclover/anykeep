// Mock for uuid package
module.exports = {
  v4: jest.fn(() => 'mocked-uuid-v4'),
  v1: jest.fn(() => 'mocked-uuid-v1'),
  v3: jest.fn(() => 'mocked-uuid-v3'),
  v5: jest.fn(() => 'mocked-uuid-v5'),
  NIL: '00000000-0000-0000-0000-000000000000',
  MAX: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  version: jest.fn(() => 4),
  validate: jest.fn(() => true),
  stringify: jest.fn((arr) => 'mocked-uuid'),
  parse: jest.fn(() => new Uint8Array(16)),
};
