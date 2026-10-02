// Builds the site into dist/: the app bundle (React and ../react.js included), the static
// files in public/, and the library itself under /lib so it can be imported from the site.
//   npm install && npm run build
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');
const out = path.join(dir, 'dist');
const LIB = ['swipe', 'history', 'react', 'nozoom'];

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'lib'), { recursive: true });

// Minified + gzipped size of each library file, shown in the app.
const sizes = {};
for (const name of LIB) {
  const src = await readFile(path.join(root, `${name}.js`), 'utf8');
  const { code } = await transform(src, { minify: true, format: 'esm', target: 'es2022' });
  sizes[name] = gzipSync(code).length;
  await cp(path.join(root, `${name}.js`), path.join(out, 'lib', `${name}.js`));
  await cp(path.join(root, `${name}.d.ts`), path.join(out, 'lib', `${name}.d.ts`));
}
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

const result = await build({
  absWorkingDir: dir,
  entryPoints: ['src/main.jsx'],
  bundle: true,
  minify: true,
  write: false,
  format: 'esm',
  jsx: 'automatic',
  target: 'es2022',
  nodePaths: [path.join(dir, 'node_modules')], // ../react.js resolves 'react' from here too
  define: {
    'process.env.NODE_ENV': '"production"',
    __SIZES__: JSON.stringify(sizes),
    __VERSION__: JSON.stringify(pkg.version),
  },
  legalComments: 'none',
});
const js = result.outputFiles[0].contents;
const name = `app.${createHash('sha256').update(js).digest('hex').slice(0, 10)}.js`;
await writeFile(path.join(out, name), js);

await cp(path.join(dir, 'public'), out, { recursive: true });
const html = await readFile(path.join(dir, 'index.html'), 'utf8');
await writeFile(path.join(out, 'index.html'), html.replace('/app.js', `/${name}`));

console.log(`built dist/${name} (${(js.length / 1024).toFixed(1)} KB)`, sizes);
