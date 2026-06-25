import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss()],
	build: {
		outDir: '../../lib/assets/atp_solver',
		emptyOutDir: true,
		lib: {
			entry: 'js/main.js',
			name: 'AtpSolver',
			formats: ['es'],
			fileName: () => 'main.js',
		},
		rollupOptions: {
			external: [],
		},
	},
});
