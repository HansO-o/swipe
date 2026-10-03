// Bundles the example (React included) into app.js, so the page runs on any static host.
//   npm install && npm run build
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStamp } from '../build-stamp.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const stamp = buildStamp();
await build({
  absWorkingDir: dir,
  entryPoints: ['main.jsx'],
  outfile: 'app.js',
  bundle: true,
  minify: true,
  format: 'esm',
  jsx: 'automatic',
  target: 'es2022',
  nodePaths: [path.join(dir, 'node_modules')], // ../react.js resolves 'react' from here too
  define: { 'process.env.NODE_ENV': '"production"', __BUILD__: JSON.stringify(stamp) },
  legalComments: 'none',
});
console.log('built app.js', stamp);
