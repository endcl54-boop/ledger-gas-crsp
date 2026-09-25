import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['src/server/Code.ts'],
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  target: 'es2019',
  outfile: 'dist/Code.js',
  sourcemap: false,
});

const clientBundle = 'dist/.client.bundle.js';
await build({
  entryPoints: ['src/client/app.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2019',
  outfile: clientBundle,
  sourcemap: false,
});

const [template, client] = await Promise.all([
  readFile('src/client/Index.html', 'utf8'),
  readFile(clientBundle, 'utf8'),
]);

if (!template.includes('/* __CLIENT_BUNDLE__ */')) {
  throw new Error('Index.html is missing the client bundle marker');
}

await writeFile('dist/Index.html', template.replace('/* __CLIENT_BUNDLE__ */', client));
await copyFile('src/appsscript.json', 'dist/appsscript.json');
await rm(clientBundle, { force: true });

console.log('Built Apps Script files in dist/');
