import { defineConfig } from 'vitest/config';
import { join } from 'path';
import { homedir } from 'os';

export default defineConfig({
  esbuild: { target: 'es2022'},
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // Увеличиваем таймаут для блокчейн операций
    env: {
      PATH: `${join(homedir(), '.fuelup/bin')}:${process.env.PATH}`,
    }
  },
});
