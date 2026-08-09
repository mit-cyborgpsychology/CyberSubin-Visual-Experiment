import { cpSync, existsSync, mkdirSync, readFile } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { defineConfig } from 'vite';

const dracoDirectory = resolve('node_modules/three/examples/jsm/libs/draco/gltf');
const dracoFiles = new Set([
  'draco_decoder.js',
  'draco_decoder.wasm',
  'draco_encoder.js',
  'draco_wasm_wrapper.js'
]);

function localDracoAssets() {
  return {
    name: 'local-draco-assets',
    configureServer(server) {
      server.middlewares.use('/draco', (request, response, next) => {
        const fileName = basename(request.url?.split('?')[0] ?? '');
        if (!dracoFiles.has(fileName)) {
          next();
          return;
        }

        readFile(resolve(dracoDirectory, fileName), (error, file) => {
          if (error) {
            next(error);
            return;
          }

          const contentTypes = {
            '.js': 'text/javascript; charset=utf-8',
            '.wasm': 'application/wasm'
          };
          response.setHeader('Content-Type', contentTypes[extname(fileName)] ?? 'application/octet-stream');
          response.end(file);
        });
      });
    },
    closeBundle() {
      if (!existsSync(dracoDirectory)) return;
      const destination = resolve('dist/draco');
      mkdirSync(destination, { recursive: true });
      for (const fileName of dracoFiles) {
        cpSync(resolve(dracoDirectory, fileName), resolve(destination, fileName));
      }
    }
  };
}

export default defineConfig({
  plugins: [localDracoAssets()],
  publicDir: 'glb-optim',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve('index.html'),
        grid: resolve('grid.html')
      }
    }
  },
  server: {
    host: '127.0.0.1'
  }
});
