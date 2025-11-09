import { defineConfig } from 'vite';
import path from 'node:path';

// Configure Vite for Electron preload (Node context)
export default defineConfig({
	build: {
		outDir: '.vite/build',
		sourcemap: true,
		target: 'node18',
		lib: {
			entry: path.resolve(__dirname, 'src/preload.ts'),
			formats: ['cjs'],
			fileName: () => 'preload.js',
		},
		rollupOptions: {
			external: ['electron'],
			output: {
				exports: 'auto',
			},
		},
	},
});
