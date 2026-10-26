// Benchmark for large phext documents (not shipped: bench/ is outside "files").
// Usage: node bench/bench.ts <file.phext> [ops]
//   ops: comma-separated subset of explode,implode,textmap,index,fetch (default: all)
// Runs against src/index.ts directly (Node >= 23.6 strips TypeScript types natively).
import { Phext } from '../src/index.ts';
import * as fs from 'fs';

const file = process.argv[2];
if (!file) { console.error('usage: node bench/bench.ts <file.phext> [ops]'); process.exit(2); }
const ops = (process.argv[3] ?? 'explode,implode,textmap,index,fetch').split(',');

const phext = new Phext();
const text = fs.readFileSync(file, 'utf8');

function time<T>(label: string, fn: () => T): T {
    const t0 = performance.now();
    const out = fn();
    const ms = performance.now() - t0;
    console.log(`${label.padEnd(8)} ${ms.toFixed(1).padStart(10)} ms`);
    return out;
}

console.log(`${file}: ${text.length} UTF-16 code units`);
let phokens = phext.phokenize(text);
console.log(`scrolls: ${phokens.length}`);
const last = phokens.length > 0 ? phokens[phokens.length - 1].coord : phext.default_coordinate();

for (const op of ops) {
    switch (op) {
        case 'explode': time('explode', () => phext.phokenize(text)); break;
        case 'implode': {
            const out = time('implode', () => phext.dephokenize(phokens));
            console.log(`         roundtrip ${out === phext.normalize(text) ? 'OK' : 'MISMATCH'}`);
            break;
        }
        case 'textmap': time('textmap', () => phext.textmap(text)); break;
        case 'index':   time('index', () => phext.index(text)); break;
        case 'fetch': {
            const out = time('fetch', () => phext.fetch(text, last));
            console.log(`         fetch ${last.to_string()} -> ${out.length} code units`);
            break;
        }
        default: console.error(`unknown op ${op}`); process.exit(2);
    }
}
