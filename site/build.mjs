// Builds the site into dist/: the app bundle (React and ../react.js included), the static
// files in public/, and the library itself under /lib so it can be imported from the site.
//   npm install && npm run build
//
// --preview <file>: instead, one self-contained HTML fragment (CSS and JS inline, hash URLs,
// library links to GitHub) for hosts that serve a single page, such as a claude.ai Artifact.
import { build, transform } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildStamp } from '../build-stamp.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');
const out = path.join(dir, 'dist');
const LIB = ['swipe', 'history', 'react', 'nozoom'];
const pi = process.argv.indexOf('--preview');
const preview = pi > 0 ? path.resolve(process.argv[pi + 1]) : null;

if (!preview) {
  await rm(out, { recursive: true, force: true });
  await mkdir(path.join(out, 'lib'), { recursive: true });
}

// Minified + gzipped size of each library file, shown in the app.
const sizes = {};
for (const name of LIB) {
  const src = await readFile(path.join(root, `${name}.js`), 'utf8');
  const { code } = await transform(src, { minify: true, format: 'esm', target: 'es2022' });
  sizes[name] = gzipSync(code).length;
  if (preview) continue;
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
    __BUILD__: JSON.stringify(buildStamp()),
    __HASH__: JSON.stringify(!!preview),
    __LIB__: JSON.stringify(preview ? 'https://github.com/HansO-o/swipe/blob/main/' : '/lib/'),
    __ORIGIN__: JSON.stringify(preview ? 'https://swipe.<你的子域>.workers.dev' : null),
  },
  legalComments: 'none',
});
const js = result.outputFiles[0].contents;
const html = await readFile(path.join(dir, 'index.html'), 'utf8');

if (preview) {
  const icon = await readFile(path.join(dir, 'public', 'icon.svg'), 'utf8');
  const code = Buffer.from(js).toString('utf8').replace(/<\/script/gi, '<\\/script');
  const page = html
    .replace(/<!doctype html>\s*<html[^>]*>\s*<head>\s*/i, '')
    .replace(/<meta [^>]*>\s*/g, '')
    .replace(/<link [^>]*>\s*/g, '')
    .replace(/<title>[^<]*<\/title>/, '<title>swipe.js</title>')
    .replace(/<\/head>\s*<body>\s*/, '')
    .replace(/\s*<\/body>\s*<\/html>\s*$/, '\n')
    .replace('src="/icon.svg"', `src="data:image/svg+xml,${encodeURIComponent(icon)}"`)
    .replace('href="/lib/swipe.js"', 'href="https://github.com/HansO-o/swipe/blob/main/swipe.js"')
    .replace('<script type="module" src="/app.js"></script>', () => `<script type="module">${code}</script>`);
  await mkdir(path.dirname(preview), { recursive: true });
  await writeFile(preview, page);
  console.log(`built ${preview} (${(page.length / 1024).toFixed(1)} KB)`);
  process.exit(0);
}

const name = `app.${createHash('sha256').update(js).digest('hex').slice(0, 10)}.js`;
await writeFile(path.join(out, name), js);

await cp(path.join(dir, 'public'), out, { recursive: true });
await writeFile(path.join(out, 'index.html'), html.replace('/app.js', `/${name}`));

console.log(`built dist/${name} (${(js.length / 1024).toFixed(1)} KB)`, sizes);
