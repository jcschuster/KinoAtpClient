import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss()],
	build: {
		outDir: '../../lib/assets/backend_config',
		emptyOutDir: true,
		lib: {
			entry: 'js/main.js',
			name: 'BackendConfig',
			formats: ['es'],
			fileName: () => 'main.js',
		},
	},
});
