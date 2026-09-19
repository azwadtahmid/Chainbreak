/* Headless check of the blockchain model. Run: node tools/logic-test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  document: { createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }) }
};
sandbox.window = sandbox;
vm.createContext(sandbox);

['js/util.js', 'js/chain.js', 'js/generator.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
});

const CB = sandbox.CB;
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  ->  ' + extra : '')); }
}

console.log('\n-- hashing --');
const h1 = CB.util.digest('BLK|1|ABC|x');
ok('digest is 6 hex chars', /^[0-9A-F]{6}$/.test(h1), h1);
ok('digest is deterministic', CB.util.digest('BLK|1|ABC|x') === h1);
ok('one changed byte changes the digest', CB.util.digest('BLK|1|ABC|y') !== h1);
{
  const seen = new Set();
  for (let i = 0; i < 20000; i++) seen.add(CB.util.digest('t' + i));
  ok('collision rate under 1% over 20k inputs', (20000 - seen.size) / 20000 < 0.01,
     (20000 - seen.size) + ' collisions');
}

console.log('\n-- signatures --');
{
  const led = CB.gen.buildLedger(6);
  const good = CB.gen.genTx(led, 'valid', 0);
  const bad = CB.gen.genTx(led, 'sig', 0);
  ok('honest tx verifies', CB.chain.sigValid(good));
  ok('forged tx fails verification', !CB.chain.sigValid(bad));
  ok('forged tx is otherwise affordable', led.avail(bad.from) >= bad.amount,
     `avail ${led.avail(bad.from)} vs amt ${bad.amount}`);
  const tampered = Object.assign({}, good, { amount: good.amount + 10 });
  ok('editing the amount invalidates the signature', !CB.chain.sigValid(tampered));
}

console.log('\n-- ledger rules --');
{
  const led = new CB.chain.Ledger();
  led.open('ALICE', 100); led.open('BOB', 50); led.open('CARA', 50);
  const t1 = CB.chain.createTx({ from: 'ALICE', to: 'BOB', amount: 60, nonce: 7 });
  ok('affordable tx is valid', led.validate(t1).ok);
  led.apply(t1);
  ok('balance moved', led.avail('ALICE') === 40 && led.avail('BOB') === 110);

  const t2 = CB.chain.createTx({ from: 'ALICE', to: 'CARA', amount: 60, nonce: 7 });
  const v2 = led.validate(t2);
  ok('replayed nonce is a DOUBLE SPEND', v2.code === 'DOUBLE', v2.code);

  const t3 = CB.chain.createTx({ from: 'ALICE', to: 'CARA', amount: 60, nonce: 8 });
  ok('overspend is INSUFFICIENT FUNDS', led.validate(t3).code === 'FUNDS');

  const t4 = CB.chain.createTx({ from: 'ALICE', to: 'CARA', amount: 40, nonce: 9 });
  ok('remaining balance still spendable', led.validate(t4).ok);
}

console.log('\n-- double-spend generation --');
for (let i = 0; i < 300; i++) {
  const led = CB.gen.buildLedger(8);
  const [a, b] = CB.gen.genDoubleSpend(led, 0, 1);
  if (!led.validate(a).ok) { ok('first half of pair is valid', false, JSON.stringify(led.validate(a))); break; }
  if (a.nonce !== b.nonce || a.from !== b.from) { ok('pair shares sender + nonce', false); break; }
  if (a.to === b.to) { ok('pair has different recipients', false); break; }
  led.apply(a);
  const vb = led.validate(b);
  if (vb.code !== 'DOUBLE') { ok('second half becomes a double spend', false, vb.code); break; }
  if (i === 299) {
    ok('first half of pair is valid', true);
    ok('pair shares sender + nonce', true);
    ok('pair has different recipients', true);
    ok('second half becomes a double spend', true);
  }
}
{
  // the other ordering must also resolve cleanly: reject A, then B stands alone
  const led = CB.gen.buildLedger(8);
  const [a, b] = CB.gen.genDoubleSpend(led, 0, 1);
  ok('if the first is rejected the second is valid', led.validate(b).ok);
}

console.log('\n-- generated cards are never ambiguous --');
{
  let bad = 0;
  for (let i = 0; i < 4000; i++) {
    const led = CB.gen.buildLedger(9);
    const kind = ['valid', 'sig', 'funds'][i % 3];
    const tx = CB.gen.genTx(led, kind, 0);
    const v = led.validate(tx);
    if (kind === 'valid' && !v.ok) bad++;
    if (kind === 'sig' && v.code !== 'SIG') bad++;
    if (kind === 'funds' && v.code !== 'FUNDS') bad++;
    if (tx.amount <= 0) bad++;
    if (kind === 'funds' && tx.amount - led.avail(tx.from) < 30) bad++;  // never a marginal call
  }
  ok('4000 generated transactions all match their intended verdict', bad === 0, bad + ' mismatches');
}

console.log('\n-- block pool --');
{
  let bad = 0;
  for (let i = 0; i < 800; i++) {
    const led = CB.gen.buildLedger(9);
    const pool = CB.gen.genBlockPool(led, 4, 2);
    const valid = pool.filter(t => led.validate(t).ok);
    if (pool.length !== 6) bad++;
    if (valid.length !== 4) bad++;
    const senders = new Set(pool.map(t => t.from));
    if (senders.size !== 6) bad++;
  }
  ok('800 pools each contain exactly 4 valid of 6, all distinct senders', bad === 0, bad + ' bad pools');
}

console.log('\n-- chain + tampering --');
{
  const led = CB.gen.buildLedger(9);
  const chain = new CB.chain.Chain();
  const seed = [];
  for (let i = 0; i < 3; i++) { const t = CB.gen.genTx(led, 'valid', 0); led.apply(t); seed.push(t); }
  chain.createGenesis(seed);
  for (let b = 0; b < 4; b++) {
    const txs = [];
    for (let i = 0; i < 3; i++) { const t = CB.gen.genTx(led, 'valid', 0); led.apply(t); txs.push(t); }
    chain.addBlock(txs);
  }
  ok('chain height is 5', chain.height() === 5);
  ok('fresh chain audits clean', chain.audit().every(a => a.valid));
  ok('every block commits to its parent hash',
     chain.blocks.slice(1).every((b, i) => b.previousHash === chain.blocks[i].hash));

  const target = 2;
  const before = chain.blocks[target].hash;
  chain.tamperBlock(target);
  const audit = chain.audit();
  ok('stored hash was left untouched by the attacker', chain.blocks[target].hash === before);
  ok('recomputed hash no longer matches the stored hash', !audit[target].hashOk,
     audit[target].stored + ' vs ' + audit[target].recalc);
  ok('findBroken points at the tampered block', chain.findBroken() === target, String(chain.findBroken()));
  ok('exactly one block fails the audit', audit.filter(a => !a.valid).length === 1);
  ok('the child still links to the stale hash (the visible break)',
     chain.blocks[target + 1].previousHash === audit[target].stored);

  chain.restoreBlock(target);
  ok('restore makes the chain audit clean again', chain.audit().every(a => a.valid));
}

console.log('\n-- tamper is always detectable, 1000 runs --');
{
  let bad = 0;
  for (let r = 0; r < 1000; r++) {
    const led = CB.gen.buildLedger(9);
    const chain = new CB.chain.Chain();
    const seed = [];
    for (let i = 0; i < 3; i++) { const t = CB.gen.genTx(led, 'valid', 0); led.apply(t); seed.push(t); }
    chain.createGenesis(seed);
    for (let b = 0; b < 4; b++) {
      const txs = [];
      for (let i = 0; i < 3; i++) { const t = CB.gen.genTx(led, 'valid', 0); led.apply(t); txs.push(t); }
      chain.addBlock(txs);
    }
    const target = 1 + Math.floor(Math.random() * 3);
    chain.tamperBlock(target);
    const a = chain.audit();
    if (chain.findBroken() !== target) bad++;
    if (a.filter(x => !x.valid).length !== 1) bad++;
    if (a[target].stored === a[target].recalc) bad++;
  }
  ok('1000 tampered chains each expose exactly one guilty block', bad === 0, bad + ' failures');
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
