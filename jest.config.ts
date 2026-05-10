import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          paths: {
            '@config/*': ['./src/config/*'],
            '@middleware/*': ['./src/middleware/*'],
            '@modules/*': ['./src/modules/*'],
            '@services/*': ['./src/services/*'],
            '@utils/*': ['./src/utils/*'],
            '@types/*': ['./src/types/*'],
          },
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/app.ts',
    '!src/**/*.d.ts',
    '!src/config/index.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 80,
      functions: 80,
      statements: 80,
    },
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      moduleNameMapper: {
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@services/(.*)$': '<rootDir>/src/services/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@types/(.*)$': '<rootDir>/src/types/$1',
      },
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      testEnvironment: 'node',
      preset: 'ts-jest',
      moduleNameMapper: {
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@services/(.*)$': '<rootDir>/src/services/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@types/(.*)$': '<rootDir>/src/types/$1',
      },
    },
  ],
}

export default config
