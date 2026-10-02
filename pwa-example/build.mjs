// Bundles the example (React included) into app.js and stamps sw.js with a version
// derived from the sources, so every change ships as a service-worker update.
//   npm install && npm run build
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const at = (f) => path.join(dir, f);

const inputs = [
  'main.jsx', 'pwa.js', 'notes.js', 'index.html', 'manifest.webmanifest', 'icons/icon.svg',
  '../swipe.js', '../history.js', '../react.js', '../nozoom.js', 'package-lock.json',
];
const VERSION_LINE = /^const VERSION = '.*';$/m;
const hash = createHash('sha256');
for (const f of inputs) hash.update(readFileSync(at(f)));
hash.update(readFileSync(at('sw.js'), 'utf8').replace(VERSION_LINE, '')); // its own logic, not its stamp
const version = hash.digest('hex').slice(0, 10);

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
  define: { 'process.env.NODE_ENV': '"production"', __VERSION__: JSON.stringify(version) },
  legalComments: 'none',
});

const sw = readFileSync(at('sw.js'), 'utf8');
writeFileSync(at('sw.js'), sw.replace(VERSION_LINE, `const VERSION = '${version}';`));
console.log(`built app.js, sw.js @ ${version}`);
