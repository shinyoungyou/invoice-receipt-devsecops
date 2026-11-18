import { execFileSync } from 'node:child_process';
import { globSync } from 'node:fs';

const files = globSync('**/*.js', { exclude: ['node_modules', 'coverage', 'data'] });
for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
console.log(`Syntax checked ${files.length} JavaScript files.`);
