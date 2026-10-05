import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const packageDirectory = path.dirname(require.resolve('maplibre-gl/package.json'));
const sourceDirectory = path.join(packageDirectory, 'dist');
const destinationDirectory = path.join(process.cwd(), 'public', 'maplibre');

mkdirSync(destinationDirectory, { recursive: true });

for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  const source = path.join(sourceDirectory, file);
  const destination = path.join(destinationDirectory, file);
  if (!existsSync(destination) || !readFileSync(source).equals(readFileSync(destination))) {
    copyFileSync(source, destination);
  }
}