import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss()],
	build: {
		outDir: '../../lib/assets/system_on_tptp',
		emptyOutDir: true,
		lib: {
			entry: 'js/main.js',
			name: 'SystemOnTPTP',
			formats: ['es'],
			fileName: () => 'main.js',
		},
		rollupOptions: {
			external: [],
		},
	},
});
