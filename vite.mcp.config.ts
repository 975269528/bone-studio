import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist-mcp',
    lib: { entry: 'src/core/commands.ts', formats: ['cjs'], fileName: () => 'commands.cjs' },
    rolldownOptions: { external: ['zod'] },
  },
});
