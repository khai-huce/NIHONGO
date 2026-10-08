import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const trees = ['apps/web/src', 'apps/admin/src', 'apps/api/src', 'packages/client/src', 'packages/shared/src'];
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
const owner = file => file.split('/').slice(0, 2).join('/');
const packageRoots = {
  '@nihongo/web': 'apps/web',
  '@nihongo/admin': 'apps/admin',
  '@nihongo/api': 'apps/api',
  '@nihongo/shared': 'packages/shared',
  '@nihongo/client': 'packages/client',
};
const sharedFrameworks = /^(?:react|react-dom|express|@prisma\/client)(?:\/|$)/;
const errors = [];
let checked = 0;
for (const file of trees.flatMap(walk).filter(file => /\.(?:ts|tsx|mjs|js)$/.test(file))) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const imports = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"]+)\1/g)];
  for (const [, , specifier] of imports) {
    if (owner(file) === 'packages/shared' && sharedFrameworks.test(specifier)) {
      errors.push(`${file}: shared không phụ thuộc framework (${specifier})`);
    }
    let target;
    if (specifier.startsWith('.')) {
      const resolved = path.resolve(root, path.dirname(file), specifier);
      const candidates = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}.mjs`, path.join(resolved, 'index.ts'), resolved.replace(/\.js$/, '.ts')];
      target = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!target) { errors.push(`${file}: không tìm thấy ${specifier}`); continue; }
      target = path.relative(root, target).replaceAll('\\', '/');
    } else {
      const name = specifier.split('/').slice(0, 2).join('/');
      target = packageRoots[name];
      if (!target) continue;
    }
    const from = owner(file), to = owner(target);
    if (from.startsWith('apps/') && to.startsWith('apps/') && from !== to) errors.push(`${file}: không import ứng dụng khác (${specifier})`);
    if (from.startsWith('packages/') && to.startsWith('apps/')) errors.push(`${file}: package không được phụ thuộc app (${specifier})`);
    if (from === 'apps/api' && to === 'packages/client') errors.push(`${file}: API không được import mã trình duyệt (${specifier})`);
    if (from === 'packages/shared' && to === 'packages/client') errors.push(`${file}: shared phải độc lập với trình duyệt (${specifier})`);
  }
  checked++;
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Ranh giới ứng dụng hợp lệ (${checked} file nguồn).`);
