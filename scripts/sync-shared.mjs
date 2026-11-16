// Copies the shared code into both websites (they deploy as separate
// Firebase Hosting sites, so each needs its own copy).
//   node scripts/sync-shared.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const copyDir = (from, to) => {
  mkdirSync(to, { recursive: true });
  for (const f of readdirSync(from)) writeFileSync(join(to, f), readFileSync(join(from, f)));
};
for (const site of ['inbound', 'outbound']) {
  copyDir(join(root, 'shared/js'), join(root, site, 'assets/js'));
  copyDir(join(root, 'shared/css'), join(root, site, 'assets/css'));
  console.log('synced shared →', site);
}
