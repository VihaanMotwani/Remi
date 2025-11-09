import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

// Vite config for Electron renderer (React)
export default defineConfig({
	root: '.',
	plugins: [react()],
	resolve: {
		alias: {
			src: path.resolve(__dirname, 'src'),
		},
	},
	build: {
		outDir: 'out/renderer',
		sourcemap: true,
	},
});
