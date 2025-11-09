import { defineConfig } from 'vite';
import path from 'node:path';

// Configure Vite for Electron main process
export default defineConfig({
	build: {
		outDir: '.vite/build',
		sourcemap: true,
		target: 'node18',
		lib: {
			entry: path.resolve(__dirname, 'src/main.ts'),
			formats: ['cjs'],
			fileName: () => 'main.js',
		},
		rollupOptions: {
			external: ['electron'],
			output: {
				exports: 'auto',
			},
		},
	},
});
