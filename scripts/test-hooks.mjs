import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && (specifier.startsWith('.') || specifier.startsWith('/'))) {
      const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
      const dir = path.dirname(parent);
      for (const ext of ['.ts', '.tsx', '.js', '/index.ts', '/index.js']) {
        const candidate = path.resolve(dir, specifier + ext);
        if (fs.existsSync(candidate)) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    throw err;
  }
}
