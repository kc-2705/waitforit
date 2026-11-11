// Jest for component tests. next/jest compiles TypeScript/JSX with Next's own SWC compiler
// and loads next.config, so tests see the app the way Next builds it.
const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

const config = createJestConfig({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  collectCoverageFrom: ['src/components/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}'],
});

// Ant Design's helper packages ship ES modules only, so let SWC compile them too.
module.exports = async () => {
  const resolved = await config();
  resolved.transformIgnorePatterns = ['/node_modules/(?!(antd|@ant-design|rc-[^/]+|@rc-component|@babel/runtime)/)'];
  return resolved;
};
