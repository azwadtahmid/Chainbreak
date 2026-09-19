/* Does genBlockPool still yield exactly N valid entries on a mid-game,
   partly drained ledger?  Run: node tools/pool-test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const sandbox = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
sandbox.window = sandbox;
vm.createContext(sandbox);
['js/util.js', 'js/chain.js', 'js/generator.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f }));
const CB = sandbox.CB;

function drainedLedger(rounds) {
  const led = CB.gen.buildLedger(9);
  for (let i = 0; i < rounds; i++) {
    const tx = CB.gen.genTx(led, 'valid', null, {});
    if (led.validate(tx).ok) led.apply(tx);
  }
  return led;
}

let bad = 0, samples = 0, worst = null;
const histogram = {};
for (let r = 0; r < 3000; r++) {
  const led = drainedLedger(20 + Math.floor(Math.random() * 30));
  const busy = {};
  const names = led.accounts();
  // simulate 1-2 accounts already holding a live card
  busy[names[0]] = true;
  if (Math.random() < 0.5) busy[names[1]] = true;

  const pool = CB.gen.genBlockPool(led, 4, 2, busy);
  const valid = pool.filter(t => led.validate(t).ok).length;
  histogram[valid] = (histogram[valid] || 0) + 1;
  samples++;
  if (valid !== 4) {
    bad++;
    if (!worst) {
      worst = pool.map(t => ({
        kind: t.poolKind, from: t.from, amount: t.amount,
        avail: led.avail(t.from), verdict: led.validate(t).code
      }));
    }
  }
  const senders = new Set(pool.map(t => t.from));
  if (senders.size !== 6) { bad++; }
}

console.log('pools sampled :', samples);
console.log('valid-count histogram :', histogram);
console.log('pools not containing exactly 4 valid :', bad);
if (worst) { console.log('\nfirst bad pool:'); console.table(worst); }
process.exit(bad ? 1 : 0);
