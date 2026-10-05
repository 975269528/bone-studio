import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node22',
    outDir: 'dist-mcp',
    emptyOutDir: false,
    lib: { entry: 'electron/mcp.cjs', formats: ['cjs'], fileName: () => 'mcp-adapter.cjs' },
    rolldownOptions: {
      external: id => id.startsWith('node:') || builtinModules.includes(id),
    },
  },
});
