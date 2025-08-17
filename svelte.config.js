import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Configure request body size limit (50MB by default, can be overridden with env var)
			bodyParser: {
				limit: process.env.MAX_REQUEST_SIZE || '50mb'
			}
		}),
		experimental: {
			remoteFunctions: true
		}
	}
};

export default config;
