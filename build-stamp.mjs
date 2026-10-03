// What a build was made from, shown in the apps so a deploy can be told apart at a glance:
// the package version, a hash of swipe.js itself, and when the bundle was built (Beijing time).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export function buildStamp() {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lib = createHash('sha256').update(readFileSync(path.join(root, 'swipe.js'))).digest('hex').slice(0, 7);
  const time = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return { version: pkg.version, lib, time };
}
