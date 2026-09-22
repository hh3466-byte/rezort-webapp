import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

const buildTime = Date.now();

function versionPlugin() {
  return {
    name: 'version-generator-plugin',
    buildStart() {
      try {
        const publicDir = path.resolve(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.writeFileSync(
          path.join(publicDir, 'version.json'),
          JSON.stringify({ buildTime, version: '2.1.0' }, null, 2)
        );
      } catch (err) {
        console.warn('Error writing version.json:', err);
      }
    }
  };
}

export default defineConfig(() => {
  return {
    define: {
      __APP_BUILD_TIME__: JSON.stringify(buildTime),
    },
    plugins: [react(), tailwindcss(), versionPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
