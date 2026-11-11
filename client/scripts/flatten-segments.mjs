// Next.js 16 static export writes route-segment data as nested folders
// (out/wishes/__next.!KGFwcCk/wishes/__PAGE__.txt), but the browser requests flat file names
// (out/wishes/__next.!KGFwcCk.wishes.__PAGE__.txt). A static host can't map one to the other,
// so after the build we also write a copy under the flat name. Without this, page-to-page
// navigation still works, but as full reloads with 404s in the console.
import { copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = new URL('../out/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
let copied = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith('.txt')) {
      const parts = relative(OUT, full).split(sep);
      const i = parts.findIndex((p) => p.startsWith('__next.'));
      // Only files nested below a "__next.*" folder need a flat twin.
      if (i === -1 || i === parts.length - 1) continue;
      const flat = join(OUT, ...parts.slice(0, i), parts.slice(i).join('.'));
      copyFileSync(full, flat);
      copied++;
    }
  }
}

walk(OUT);
console.log(`flatten-segments: wrote ${copied} flat segment files`);
