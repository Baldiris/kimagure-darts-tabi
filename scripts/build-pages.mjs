import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = join(root, 'docs');
const references = html => [...html.matchAll(/\.\/assets\/(index-[^"<>/]+\.(?:js|css))/g)].map(match => match[1]);
const read = async path => {try {return await readFile(path);} catch (error) {if (error.code === 'ENOENT') return null; throw error;}};
const previousHtml = await read(join(docs, 'index.html'));
const previous = previousHtml ? references(previousHtml.toString()) : [];
const historyBytes = await read(join(docs, 'asset-history.json'));
const history = historyBytes ? JSON.parse(historyBytes.toString()) : [];
const candidates = [previous, ...history]
 .filter((names,index,all) => names.length && all.findIndex(other => JSON.stringify(other) === JSON.stringify(names)) === index)
 .slice(0,3);
const retained = new Map();
for (const name of new Set(candidates.flat())) {
 if (!/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(name)) throw new Error('Unexpected build asset name');
 const bytes = await read(join(docs, 'assets', name));
 if (bytes) retained.set(name,bytes);
}
await new Promise((resolve,reject) => {
 const child = spawn(process.execPath, [join(root,'node_modules/vite/bin/vite.js'),'build'], {cwd:root,stdio:'inherit'});
 child.once('error',reject);
 child.once('exit',code => code === 0 ? resolve() : reject(new Error(`Vite exited with ${code}`)));
});
const currentNames = references((await readFile(join(docs,'index.html'))).toString());
const current = new Set(currentNames);
const generations = candidates.filter(names => JSON.stringify(names) !== JSON.stringify(currentNames)).slice(0,2);
const retainedNames = new Set(generations.flat());
await mkdir(join(docs,'assets'),{recursive:true});
for (const [name,bytes] of retained) if (retainedNames.has(name) && !current.has(name)) await writeFile(join(docs,'assets',name),bytes);
await writeFile(join(docs,'asset-history.json'),JSON.stringify(generations,null,1)+'\n');
console.log(`Retained ${[...retainedNames].filter(name => !current.has(name)).length} previous assets for cached pages.`);
