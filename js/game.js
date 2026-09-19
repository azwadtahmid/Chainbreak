/* ============================================================
   CHAINBREAK — game.js
   Phase engine, rules, scoring, event handling.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB = root.CB || {};
  var U = CB.util;
  var UI = CB.ui;
  var A = CB.audio;

  /* ---------- tuning ---------- */
  var TX_WINDOW = {
    validate: 3.5, double: 3.1, build: 3.1, tamper: 3.1, nodes: 2.8, attack: 2.1
  };
  var PTS = {
    tx: 75, speed: 20, doubleSpend: 200, blockTx: 100, blockPerfect: 300,
    tamper: 350, node: 400, survive: 500
  };
  var DMG = {
    txWrong: 8, doubleAccepted: 14, timeout: 3,
    blockBadTx: 6, tamperWrong: 10, tamperMissed: 12, nodeWrong: 8,
    majorityDrain: 2.6
  };

  var Game = {
    state: null,
    net: null,
    mode: 'idle',           // idle | stream | build | audit
    raf: 0,
    last: 0,
    builder: null,
    audit: null,
    hunt: null,
    onOver: null
  };

  /* ============================================================
     LIFECYCLE
     ============================================================ */

  Game.boot = function () {
    this.state = new CB.State();
    this.net = new CB.Network();
    UI.bind();
  };

  Game.start = function () {
    var s = this.state;
    s.reset();

    // Genesis block seeded from real, valid transfers.
    var seed = [], i;
    for (i = 0; i < 3; i++) {
      var t = CB.gen.genTx(s.ledger, 'valid', null);
      s.ledger.apply(t);
      seed.push(t);
    }
    s.chain.createGenesis(seed);

    this.net.init(U.$('#net-canvas'), U.$('#node-layer'), s);
    this.net.setSelectable(false, null);

    UI.resetHud();
    UI.renderChain(s.chain, {});
    UI.scrollChainEnd(false);
    UI.nodeMeta('5 ONLINE · CONSENSUS STABLE', 'good');
    UI.netAlert(null);
    UI.log('NETWORK ONLINE · GENESIS BLOCK SEALED', 'info');

    s.running = true;
    s.over = false;
    this.mode = 'stream';
    this.builder = null;
    this.audit = null;
    this.hunt = null;

    this.setPhase(0);
    this.ensureQueue();
    this.pullNext();

    // The round clock runs on wall time, not on accumulated frame deltas,
    // so a dropped frame or a slow laptop never distorts the pacing.
    this.t0 = now();
    this.pausedFor = 0;
    this.hiddenAt = 0;
    this.last = 0;

    var self = this;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(function (ts) { self.loop(ts); });
  };

  Game.stop = function () {
    this.state.running = false;
    cancelAnimationFrame(this.raf);
  };

  /* ============================================================
     TUTORIAL
     The same network view and the same UI, but driven by the
     tutorial script instead of the phase engine: no round clock,
     no card timer, no scoring, no integrity loss.
     ============================================================ */

  Game.runTutorial = function (onDone) {
    var self = this;
    var s = this.state;

    cancelAnimationFrame(this.raf);
    this.mode = 'demo';
    s.running = false;
    s.over = false;

    CB.Tutorial.run(s, this.net, function () {
      self.demoRunning = false;
      cancelAnimationFrame(self.raf);
      if (onDone) onDone();
    });

    s.demo = true;
    this.demoRunning = true;
    this.last = 0;

    // Keeps the mesh alive while the player reads; nothing else ticks.
    function frame(ts) {
      if (!self.demoRunning) return;
      var dt = self.last ? Math.min(0.06, (ts - self.last) / 1000) : 0.016;
      self.last = ts;
      UI.hud(s, dt);
      self.net.update(dt);
      self.net.draw();
      self.raf = requestAnimationFrame(frame);
    }
    this.raf = requestAnimationFrame(frame);
  };

  Game.stopTutorial = function () {
    this.demoRunning = false;
    cancelAnimationFrame(this.raf);
    this.state.demo = false;
  };

  function now() {
    return (root.performance && root.performance.now) ? root.performance.now() : Date.now();
  }

  /** Hiding the tab freezes the round rather than fast-forwarding it. */
  Game.setHidden = function (hidden) {
    if (!this.state || !this.state.running) return;
    if (hidden) {
      if (!this.hiddenAt) this.hiddenAt = now();
    } else if (this.hiddenAt) {
      this.pausedFor += now() - this.hiddenAt;
      this.hiddenAt = 0;
      this.last = 0;
      var self = this;
      cancelAnimationFrame(this.raf);
      this.raf = requestAnimationFrame(function (ts) { self.loop(ts); });
    }
  };

  Game.loop = function (ts) {
    var self = this;
    var s = this.state;
    if (!s.running) return;
    if (this.hiddenAt) { return; }   // frozen until the tab comes back

    var dt = this.last ? Math.min(0.06, (ts - this.last) / 1000) : 0.016;
    this.last = ts;

    s.elapsed = (now() - this.t0 - this.pausedFor) / 1000;
    s.timeLeft = Math.max(0, CB.ROUND_SECONDS - s.elapsed);

    this.tickPhase();
    this.tickIsolation();
    this.tickMode(dt);
    this.tickAttack(dt);

    s.updateThreat();
    UI.hud(s, dt);

    this.net.update(dt);
    this.net.draw();

    if (s.integrity <= 0) { this.end('collapsed'); return; }
    if (s.timeLeft <= 0) { this.end('survived'); return; }

    this.raf = requestAnimationFrame(function (t2) { self.loop(t2); });
  };

  Game.end = function (reason) {
    var s = this.state;
    if (s.over) return;
    s.over = true;
    s.running = false;
    cancelAnimationFrame(this.raf);
    this.net.setSelectable(false, null);

    if (reason === 'survived') {
      var bonus = PTS.survive + Math.round(s.integrity * 10);
      s.score += bonus;
      A.play('success');
    } else {
      A.play('fail');
    }
    UI.hud(s, 1);
    if (this.onOver) this.onOver(reason);
  };

  /* ============================================================
     PHASES
     ============================================================ */

  Game.tickPhase = function () {
    var s = this.state, i, p;
    for (i = CB.PHASES.length - 1; i >= 0; i--) {
      p = CB.PHASES[i];
      if (s.elapsed >= p.from) {
        if (s.phaseIndex !== i) this.setPhase(i);
        return;
      }
    }
  };

  Game.setPhase = function (i) {
    var s = this.state;
    var p = CB.PHASES[i];
    s.phaseIndex = i;
    s.phase = p;

    UI.banner(p.kicker, p.title, p.sub, p.danger);
    UI.log(p.kicker + ' · ' + p.title, p.danger ? 'warn' : 'info');
    if (p.danger) A.play('warn'); else A.play('ui');

    switch (p.id) {
      case 'validate':
        this.mode = 'stream';
        UI.panelHead('INCOMING TRANSACTIONS', 'PHASE 01 · VALIDATE');
        this.streamRules();
        break;
      case 'double':
        this.mode = 'stream';
        UI.panelHead('INCOMING TRANSACTIONS', 'PHASE 02 · CONFLICT WATCH');
        this.streamRules();
        break;
      case 'build':
        this.enterBuild();
        break;
      case 'tamper':
        this.enterTamper();
        break;
      case 'nodes':
        this.enterNodeHunt();
        break;
      case 'attack':
        this.enterAttack();
        break;
    }
  };

  Game.streamRules = function () {
    UI.setRules({
      title: 'ACCEPT ONLY IF',
      items: ['<b>SIG</b> VALID', '<b>AMT</b> &le; AVAIL', '<b>NONCE</b> UNUSED']
    });
  };

  /* ============================================================
     MODE: TRANSACTION STREAM
     ============================================================ */

  Game.txWindow = function () {
    var id = this.state.phase ? this.state.phase.id : 'validate';
    return TX_WINDOW[id] || 3.2;
  };

  /** Decide what kind of transaction the network should emit next. */
  Game.nextTxKind = function () {
    var id = this.state.phase ? this.state.phase.id : 'validate';
    var r = Math.random();
    if (id === 'validate') return r < 0.55 ? 'valid' : (r < 0.8 ? 'sig' : 'funds');
    if (id === 'double')   return r < 0.5 ? 'valid' : (r < 0.75 ? 'sig' : 'funds');
    if (id === 'nodes')    return r < 0.5 ? 'valid' : (r < 0.78 ? 'sig' : 'funds');
    if (id === 'attack')   return r < 0.45 ? 'valid' : (r < 0.75 ? 'sig' : 'funds');
    return r < 0.6 ? 'valid' : (r < 0.82 ? 'sig' : 'funds');
  };

  Game.wantsDoubleSpend = function () {
    var s = this.state;
    var id = s.phase ? s.phase.id : 'validate';
    if (s.queue.some(function (t) { return t.conflictsWith; })) return false;
    if (id === 'double') return U.chance(0.75);
    if (id === 'nodes' || id === 'attack') return U.chance(0.28);
    return false;
  };

  /**
   * Which peer relays this transaction, and does that peer lie?
   * During a hunt every invalid broadcast comes from the culprit, and the
   * culprit still relays honest traffic too — so the record dots identify
   * it, but "the node that ever sent one bad tx" is not a free giveaway.
   */
  Game.assignNode = function (kind) {
    var s = this.state;
    var bad = kind !== 'valid';
    var hunting = this.hunt && this.hunt.active && this.hunt.node.status !== 'ISOLATED';

    if (bad) {
      var hostile = s.hostileNodes();
      if (hostile.length) return U.pick(hostile);
      if (hunting) return this.hunt.node;
    } else if (hunting && U.chance(0.25)) {
      return this.hunt.node;
    }

    var clean = s.liveNodes().filter(function (n) {
      if (n.status === 'HOSTILE') return false;
      if (hunting && n === Game.hunt.node) return false;
      return true;
    });
    if (!clean.length) clean = s.liveNodes();
    return clean.length ? U.pick(clean) : s.nodes[0];
  };

  /**
   * Reputation is earned, not assigned: a peer is flagged SUSPICIOUS only
   * once its own broadcast record shows repeated invalid data.
   */
  Game.evaluateSuspicion = function () {
    var s = this.state;
    var flagged = false;
    // Reputation only becomes a live signal while peers are actually under
    // audit. Otherwise ordinary bad traffic paints half the mesh amber, and
    // a fresh suspect appears right after the real culprit has been caught.
    var id = s.phase ? s.phase.id : 'validate';
    var hunting = this.hunt && this.hunt.active;
    if (id !== 'attack' && !hunting) return false;

    s.nodes.forEach(function (n) {
      if (n.status === 'ISOLATED' || n.status === 'HOSTILE') return;
      var bad = n.record.filter(function (r) { return !r; }).length;
      if (bad >= 2) { n.status = 'SUSPECT'; flagged = true; }
      else if (n.status === 'SUSPECT' && bad === 0) { n.status = 'HONEST'; }
    });

    if (this.hunt && this.hunt.active && !this.hunt.armed) {
      var badCount = this.hunt.node.record.filter(function (r) { return !r; }).length;
      if (badCount >= 2) {
        this.hunt.armed = true;
        this.net.setSelectable(true, function (id) { Game.isolate(id); });
        UI.netAlert('⚠ ' + this.hunt.node.name + ' IS BROADCASTING INVALID DATA · ISOLATE IT');
        UI.nodeMeta('PEER REPUTATION BREACH · ISOLATION AUTHORISED', 'alert');
        UI.log('EVIDENCE THRESHOLD MET · ISOLATION AUTHORISED', 'warn');
        A.play('warn');
      }
    }
    return flagged;
  };

  /** Senders that already have something the player hasn't ruled on yet. */
  Game.busySenders = function () {
    var s = this.state, busy = {};
    if (s.active) busy[s.active.from] = true;
    s.queue.forEach(function (t) { busy[t.from] = true; });
    return busy;
  };

  Game.spawnTx = function () {
    var s = this.state;
    var busy = this.busySenders();

    if (this.wantsDoubleSpend()) {
      var nA = this.assignNode('valid');
      var nB = this.assignNode('funds');
      var pair = CB.gen.genDoubleSpend(s.ledger, nA ? nA.id : null, nB ? nB.id : null, busy);
      s.queue.push(pair[0]);
      s.queue.push(pair[1]);
      this.net.emitPacket(pair[0].node, 'tx');
      this.net.emitPacket(pair[1].node, 'bad');
      A.play('warn');
      UI.log('CONFLICTING BROADCAST · NONCE ' + U.pad2(pair[0].nonce) + ' CLAIMED TWICE', 'warn');
      return;
    }

    var kind = this.nextTxKind();
    var node = this.assignNode(kind);
    var tx = CB.gen.genTx(s.ledger, kind, node ? node.id : null, busy);
    s.queue.push(tx);
    this.net.emitPacket(tx.node, kind === 'valid' ? 'tx' : 'bad');
    A.play('incoming');
  };

  Game.ensureQueue = function () {
    var guard = 0;
    while (this.state.queue.length < 3 && guard++ < 8) this.spawnTx();
  };

  Game.pullNext = function () {
    var s = this.state;
    this.ensureQueue();
    s.active = s.queue.shift();
    if (!s.active) return;

    s.activeWindow = this.txWindow();
    s.activeDeadline = s.activeWindow;

    var partner = s.active.conflictsWith
      ? (s.queue.filter(function (t) { return t.id === s.active.conflictsWith; })[0] || null)
      : null;
    var flaggedConflict = !!(s.active.conflictsWith &&
      (partner || s.ledger.isSpent(s.active.from, s.active.nonce)));

    UI.renderTxCard(s.active, s.ledger, flaggedConflict);
    UI.renderQueue(s.queue, s.active);
    UI.setActions([
      { label: 'REJECT', key: 'R', cls: 'act-reject', onClick: function () { Game.decide(false); } },
      { label: 'ACCEPT', key: 'A', cls: 'act-accept', onClick: function () { Game.decide(true); } }
    ]);
    if (s.phase && s.phase.id === 'attack') this.renderPower();
  };

  Game.tickMode = function (dt) {
    var s = this.state;
    if (this.mode === 'stream' && s.active) {
      s.activeDeadline -= dt;
      var frac = s.activeDeadline / s.activeWindow;
      UI.setTxTimer(frac, frac < 0.3);
      if (s.activeDeadline <= 0) this.timeoutTx();
    }
    if (this.mode === 'audit' && this.audit && !this.audit.done) {
      this.audit.left -= dt;
      UI.setPromptTimer(this.audit.left / this.audit.total);
      if (this.audit.left <= 0) this.resolveAudit(-1);
    }
  };

  /* ---------- decisions ---------- */

  Game.decide = function (accept) {
    var s = this.state;
    if (this.mode !== 'stream' || !s.active) return;

    var tx = s.active;
    var verdict = s.ledger.validate(tx);
    var correct = accept ? verdict.ok : !verdict.ok;
    var wasDouble = verdict.code === 'DOUBLE';

    s.active = null;

    if (correct) {
      this.goodTx(tx, verdict, accept, wasDouble);
    } else {
      this.badTx(tx, verdict, accept, wasDouble);
    }

    // The peer that relayed it earns or loses reputation.
    s.recordBroadcast(s.nodes[tx.node], verdict.ok);
    this.evaluateSuspicion();
    this.net.syncNodes();

    UI.dismissTxCard(correct);
    var self = this;
    setTimeout(function () { if (self.mode === 'stream' && !self.state.over) self.pullNext(); }, 160);
  };

  Game.goodTx = function (tx, verdict, accepted, wasDouble) {
    var s = this.state;
    var speedy = s.activeDeadline / s.activeWindow > 0.55;
    var base = (wasDouble ? PTS.doubleSpend : PTS.tx) + (speedy ? PTS.speed : 0);
    var changed = s.goodAction();
    var pts = s.award(base);
    s.repair(0.6);

    if (accepted) {
      s.ledger.apply(tx);
      s.pendingMined.push(tx);
      s.stats.txAccepted++;
      A.play('accept');
      UI.toast('TRANSACTION ACCEPTED', tx.from + ' → ' + tx.to + '  ' + U.money(tx.amount), 'ok', pts);
      UI.log('TX ' + tx.id + ' ACCEPTED · ' + U.money(tx.amount), 'ok');
      this.maybeSealBlock();
    } else {
      s.stats.txRejected++;
      s.stats.threatsStopped++;
      A.play('reject');
      if (wasDouble) {
        s.stats.doubleSpendsCaught++;
        UI.toast('TRANSACTION REJECTED', 'NETWORK SECURED · DOUBLE SPEND BLOCKED', 'ok', pts);
        UI.log('DOUBLE SPEND BLOCKED · NONCE ' + U.pad2(tx.nonce), 'ok');
        this.net.burst(tx.node, 'ok');
      } else {
        UI.toast('TRANSACTION REJECTED', verdict.reason, 'ok', pts);
        UI.log('TX ' + tx.id + ' REJECTED · ' + verdict.reason, 'ok');
      }
    }

    if (changed && s.multiplier > 1) {
      A.play('combo', s.multiplier);
      UI.popCombo();
      UI.toast(s.comboLabel(), 'KEEP THE CHAIN CLEAN', 'info');
    }
  };

  Game.badTx = function (tx, verdict, accepted, wasDouble) {
    var s = this.state;
    s.badAction();
    var dmg = accepted && wasDouble ? DMG.doubleAccepted : DMG.txWrong;
    s.damage(dmg);
    s.hit(40);
    A.play('error');
    this.net.shake(0.7);
    this.net.burst(tx.node, 'bad');

    if (accepted) {
      if (wasDouble) {
        UI.toast('DOUBLE SPEND', 'THE SAME FUNDS WERE SPENT TWICE.', 'bad', -dmg * 10);
        UI.log('DOUBLE SPEND ADMITTED · INTEGRITY −' + dmg + '%', 'bad');
      } else {
        UI.toast('INVALID TRANSACTION ADMITTED', verdict.detail || verdict.reason, 'bad', -dmg * 10);
        UI.log('BAD TX ADMITTED · ' + verdict.reason, 'bad');
      }
    } else {
      UI.toast('HONEST TRANSACTION BLOCKED', 'THAT PAYMENT WAS VALID.', 'bad', -dmg * 10);
      UI.log('VALID TX REJECTED · ' + tx.id, 'bad');
    }
  };

  Game.timeoutTx = function () {
    var s = this.state;
    if (!s.active) return;
    var tx = s.active;
    s.active = null;
    s.badAction();
    s.damage(DMG.timeout);
    A.play('error');
    UI.dismissTxCard(false);
    UI.toast('MEMPOOL TIMEOUT', 'THE NETWORK STALLED WAITING FOR YOU.', 'warn');
    UI.log('TX ' + tx.id + ' TIMED OUT', 'warn');
    var self = this;
    setTimeout(function () { if (self.mode === 'stream' && !self.state.over) self.pullNext(); }, 160);
  };

  /* ---------- automatic block sealing ---------- */

  Game.maybeSealBlock = function () {
    var s = this.state;
    if (s.pendingMined.length < 3) return;
    var txs = s.pendingMined.splice(0, 3);
    var minerId = txs[0].node;
    var b = s.chain.addBlock(txs, {
      minedBy: minerId != null ? 'NODE ' + U.pad2(minerId + 1) : 'CONSENSUS'
    });
    s.stats.blocksVerified++;
    A.play('block');
    UI.renderChain(s.chain, {});
    UI.markBlock(b.index, 'new');
    UI.flashBlock(b.index, 'verified', 1200);
    UI.scrollChainEnd(true);
    UI.log('BLOCK ' + U.pad2(b.index) + ' SEALED · HASH ' + b.hash, 'ok');
    if (minerId != null) this.net.burst(minerId, 'ok');
  };

  /* ============================================================
     PHASE 3 — BLOCK BUILDER
     ============================================================ */

  Game.enterBuild = function () {
    var s = this.state;
    this.mode = 'build';
    s.active = null;

    var prev = s.chain.head();
    this.builder = {
      pool: CB.gen.genBlockPool(s.ledger, 4, 2, this.busySenders()),
      capacity: 4,
      selected: [],
      byId: {},
      ledger: s.ledger,
      nextIndex: prev.index + 1,
      previousHash: prev.hash,
      draftHash: '——————',
      nonce: U.randInt(1000, 9999),
      done: false
    };
    this.builder.pool.forEach(function (t) { Game.builder.byId[t.id] = t; });

    UI.panelHead('BUILD BLOCK ' + U.pad2(this.builder.nextIndex), 'PHASE 03 · CONSTRUCT');
    UI.setRules({
      title: 'A BLOCK IS SEALED BY ITS CONTENTS',
      items: ['CHANGE A TX', '&rarr; CHANGE THE HASH']
    });
    UI.log('MEMPOOL SNAPSHOT · SELECT TRANSACTIONS TO SEAL', 'info');
    this.refreshBuilder();
  };

  Game.refreshBuilder = function (focusTxId) {
    var m = this.builder;
    if (!m) return;
    var txs = m.selected.map(function (id) { return m.byId[id]; });
    // The draft hash is computed from the real contents, so it visibly
    // changes every time the player adds or removes a transaction.
    m.draftHash = txs.length
      ? CB.chain.blockHash({ index: m.nextIndex, previousHash: m.previousHash, transactions: txs, nonce: m.nonce })
      : '——————';

    UI.renderBuilder(m, function (id) { Game.toggleChip(id); }, focusTxId);
    UI.setActions([{
      id: 'btn-mine',
      label: 'MINE / ADD BLOCK',
      key: 'SPACE',
      cls: 'act-primary',
      disabled: m.selected.length !== m.capacity,
      onClick: function () { Game.mineBlock(); }
    }]);
  };

  Game.toggleChip = function (id) {
    var m = this.builder;
    if (!m || m.done) return;
    var i = m.selected.indexOf(id);
    if (i >= 0) m.selected.splice(i, 1);
    else if (m.selected.length < m.capacity) m.selected.push(id);
    A.play('ui');
    this.refreshBuilder(id);
  };

  Game.mineBlock = function () {
    var s = this.state, m = this.builder;
    if (!m || m.done || m.selected.length !== m.capacity) return;
    m.done = true;

    var included = [], rejected = [], pts = 0, dmg = 0;

    m.selected.forEach(function (id) {
      var tx = m.byId[id];
      var v = s.ledger.validate(tx);
      if (v.ok) {
        s.ledger.apply(tx);
        included.push(tx);
        pts += PTS.blockTx;
      } else {
        rejected.push({ tx: tx, v: v });
        dmg += DMG.blockBadTx;
      }
    });

    var perfect = rejected.length === 0;
    if (perfect) { pts += PTS.blockPerfect; s.goodAction(); }
    else { s.badAction(); s.hit(100 * rejected.length); }

    var gained = s.award(pts);
    if (dmg) s.damage(dmg);

    var b = s.chain.addBlock(included.length ? included : [m.byId[m.selected[0]]], { minedBy: 'YOU' });
    s.stats.blocksVerified++;
    if (perfect) s.stats.threatsStopped++;

    A.play('block');
    UI.renderChain(s.chain, {});
    UI.markBlock(b.index, 'new');
    UI.flashBlock(b.index, 'verified', 1600);
    UI.scrollChainEnd(true);

    if (perfect) {
      UI.toast('BLOCK VERIFIED', 'CONSENSUS ACHIEVED · BLOCK ' + U.pad2(b.index) + ' ADDED', 'ok', gained);
      UI.log('BLOCK ' + U.pad2(b.index) + ' ADDED · HASH ' + b.hash, 'ok');
    } else {
      A.play('error');
      this.net.shake(0.6);
      UI.toast('BLOCK REJECTED BY PEERS', rejected.length + ' INVALID TX · ' + rejected[0].v.reason, 'bad', -100 * rejected.length);
      UI.log('INVALID TX IN BLOCK · ' + rejected[0].v.reason, 'bad');
    }

    // back to live traffic for the rest of the phase
    var self = this;
    setTimeout(function () {
      if (self.state.over) return;
      if (self.state.phase && self.state.phase.id === 'build') {
        self.mode = 'stream';
        UI.panelHead('INCOMING TRANSACTIONS', 'PHASE 03 · LIVE TRAFFIC');
        self.streamRules();
        self.pullNext();
      }
    }, 1500);
  };

  /* ============================================================
     PHASE 4 — TAMPERED BLOCK
     ============================================================ */

  Game.enterTamper = function () {
    var s = this.state;
    this.mode = 'audit';
    s.active = null;

    // Leaving the block unsealed stalls the network.
    if (this.builder && !this.builder.done) {
      this.builder.done = true;
      s.badAction();
      s.damage(DMG.blockBadTx);
      A.play('error');
      UI.toast('BLOCK NEVER SEALED', 'THE MEMPOOL BACKED UP.', 'warn');
      UI.log('BLOCK ' + U.pad2(this.builder.nextIndex) + ' ABANDONED', 'warn');
    }

    // Only tamper with a block the player can actually see, and never the
    // tip — the successor is what makes the broken link visible.
    var last = s.chain.height() - 1;
    var window_ = UI.visibleBlockCount();
    var lo = Math.max(1, s.chain.height() - window_);
    var hi = Math.max(lo, last - 1);
    var target = U.randInt(lo, hi);
    var b = s.chain.tamperBlock(target);
    if (!b) { this.mode = 'stream'; this.pullNext(); return; }

    this.audit = { target: target, left: 10, total: 10, done: false, tries: 0 };

    A.play('warn');
    this.net.shake(1);
    UI.panelHead('CHAIN AUDIT', 'PHASE 04 · HASH VERIFICATION');
    UI.setRules({
      title: 'A BLOCK IS VALID WHEN',
      items: ['<b>RECALC</b> = <b>HASH</b>']
    });
    UI.renderPrompt({
      icon: '⚠',
      title: 'CHAIN INTEGRITY FAILURE',
      sub: 'SOMETHING CHANGED INSIDE THE CHAIN.<br>'
         + 'EVERY BLOCK HAS BEEN <b>RECOMPUTED</b> FROM ITS CONTENTS.<br>'
         + 'FIND THE BLOCK WHOSE FINGERPRINT NO LONGER FITS<br>AND CLICK IT.',
      legend: [
        ['HASH', 'THE FINGERPRINT SEALED INTO THE BLOCK'],
        ['RECALC', 'THE FINGERPRINT ITS DATA PRODUCES NOW'],
        ['PREV', 'THE HASH THIS BLOCK COMMITS TO']
      ],
      timer: true,
      danger: true
    });
    UI.setActions([]);
    UI.netAlert('⚠ CHAIN INTEGRITY FAILURE · AUDIT IN PROGRESS');
    UI.log('TAMPERING DETECTED · RECOMPUTING ALL BLOCK HASHES', 'bad');

    UI.renderChain(s.chain, {
      showRecalc: true,
      auditable: true,
      onPick: function (i) { Game.resolveAudit(i); }
    });
    UI.scrollChainEnd(false);
  };

  Game.resolveAudit = function (picked) {
    var s = this.state, a = this.audit;
    if (!a || a.done) return;

    if (picked === a.target) {
      a.done = true;
      // Show the break that was there all along, then heal it.
      UI.renderChain(s.chain, { showRecalc: true, revealBreak: true });
      UI.markBlock(a.target, 'compromised');
      s.chain.restoreBlock(a.target);
      var changed = s.goodAction();
      var pts = s.award(PTS.tamper + Math.round(a.left * 15));
      s.repair(4);
      s.stats.threatsStopped++;
      A.play('success');
      this.net.burst(U.randInt(0, s.nodes.length - 1), 'ok');
      UI.toast('TAMPERED BLOCK ISOLATED', 'CHAIN RESTORED · HASHES RECONCILED', 'ok', pts);
      UI.log('BLOCK ' + U.pad2(a.target) + ' RESTORED · CHAIN VALID', 'ok');
      if (changed && s.multiplier > 1) { UI.popCombo(); A.play('combo', s.multiplier); }
      this.exitAudit();
      return;
    }

    if (picked < 0) {
      a.done = true;
      s.badAction();
      s.damage(DMG.tamperMissed);
      A.play('error');
      this.net.shake(1);
      UI.toast('TAMPERING MISSED', 'THE REWRITTEN BLOCK STAYED IN THE CHAIN.', 'bad', 0);
      UI.log('AUDIT FAILED · INTEGRITY −' + DMG.tamperMissed + '%', 'bad');
      s.chain.restoreBlock(a.target);
      this.exitAudit();
      return;
    }

    a.tries++;
    s.badAction();
    s.damage(DMG.tamperWrong);
    s.hit(50);
    A.play('error');
    this.net.shake(0.6);
    UI.flashBlock(picked, 'wrongpick', 500);
    UI.toast('INVALID BLOCK SELECTED', 'BLOCK ' + U.pad2(picked) + ' MATCHES ITS OWN HASH.', 'bad', -DMG.tamperWrong * 10);
    UI.log('WRONG BLOCK · INTEGRITY −' + DMG.tamperWrong + '%', 'bad');
  };

  Game.exitAudit = function () {
    var self = this;
    UI.netAlert(null);
    setTimeout(function () {
      if (self.state.over) return;
      UI.renderChain(self.state.chain, {});
      UI.scrollChainEnd(true);
      if (self.state.phase && self.state.phase.id === 'tamper') {
        self.mode = 'stream';
        UI.panelHead('INCOMING TRANSACTIONS', 'PHASE 04 · LIVE TRAFFIC');
        self.streamRules();
        self.pullNext();
      }
    }, 1200);
  };

  /* ============================================================
     PHASE 5 — MALICIOUS NODE
     ============================================================ */

  Game.enterNodeHunt = function () {
    var s = this.state;
    this.mode = 'stream';
    s.active = null;

    var bad = U.pick(s.liveNodes());
    bad.record = [];
    s.nodes.forEach(function (n) { n.record = []; });

    // Selection stays locked until the peer's own traffic incriminates it.
    this.hunt = { active: true, armed: false, node: bad, resolved: false };

    A.play('warn');
    UI.panelHead('INCOMING TRANSACTIONS', 'PHASE 05 · PEER AUDIT');
    UI.setRules({
      title: 'WATCH THE PEERS',
      items: ['EVERY NODE LOGS ITS BROADCASTS', '<b>▪</b> VALID', '<b>▪</b> INVALID']
    });
    UI.nodeMeta('ANOMALY ON THE WIRE · MONITOR PEER BROADCASTS', 'alert');
    UI.netAlert('⚠ INVALID DATA DETECTED · WATCH WHICH PEER RELAYS IT');
    UI.log('PEER AUDIT OPEN · TRACK THE BROADCAST RECORDS', 'warn');

    this.net.setSelectable(false, null);
    this.net.syncNodes();
    this.pullNext();
  };

  var ISOLATION_SECONDS = 9;

  /** Cut a peer out of consensus for a while. Isolation is never permanent. */
  Game.cutOff = function (n) {
    n.status = 'ISOLATED';
    n.record = [];
    n.rejoinAt = this.state.elapsed + ISOLATION_SECONDS;
  };

  /** Isolated peers resync and rejoin as honest once their timer expires. */
  Game.tickIsolation = function () {
    var s = this.state, self = this, changed = false;
    s.nodes.forEach(function (n) {
      if (n.status === 'ISOLATED' && n.rejoinAt != null && s.elapsed >= n.rejoinAt) {
        n.status = 'HONEST';
        n.record = [];
        n.rejoinAt = null;
        changed = true;
        UI.log(n.name + ' RESYNCED · REJOINED CONSENSUS', 'info');
        self.net.burst(n.id, 'ok');
      }
    });
    if (changed) {
      this.net.syncNodes();
      var attacking = s.phase && s.phase.id === 'attack';
      var hostile = s.hostileNodes().length;
      var note = hostile ? 'HOSTILE PEERS ACTIVE'
               : (attacking ? '51% ATTACK IN PROGRESS' : 'CONSENSUS STABLE');
      UI.nodeMeta(s.liveNodes().length + ' ONLINE · ' + note,
        (hostile || attacking) ? 'alert' : 'good');
      if (attacking) this.renderPower();
    }
  };

  Game.isolate = function (id) {
    var s = this.state;
    var n = s.nodes[id];
    if (!n || n.status === 'ISOLATED' || !this.net.selectable) return;

    // The network needs a quorum to keep producing blocks at all.
    if (s.liveNodes().length <= 2) {
      A.play('error');
      UI.toast('QUORUM PROTECTED', 'THE NETWORK CANNOT DROP BELOW TWO PEERS.', 'warn');
      return;
    }

    var wasThreat = (this.hunt && this.hunt.active && n === this.hunt.node) || n.status === 'HOSTILE';

    if (wasThreat) {
      this.cutOff(n);
      var changed = s.goodAction();
      var pts = s.award(PTS.node);
      s.repair(3);
      s.stats.nodesIsolated++;
      s.stats.threatsStopped++;
      A.play('success');
      this.net.burst(id, 'ok');
      UI.toast('NODE ISOLATED', n.name + ' REMOVED FROM CONSENSUS', 'ok', pts);
      UI.log(n.name + ' ISOLATED · CONNECTIONS DROPPED', 'ok');
      if (changed && s.multiplier > 1) { UI.popCombo(); A.play('combo', s.multiplier); }

      if (this.hunt && n === this.hunt.node) {
        this.hunt.active = false;
        this.hunt.resolved = true;
        UI.netAlert(null);
        UI.nodeMeta(s.liveNodes().length + ' ONLINE · CONSENSUS RESTORED', 'good');
        if (!s.hostileNodes().length) this.net.setSelectable(false, null);
      }
    } else {
      this.cutOff(n);
      s.badAction();
      s.damage(DMG.nodeWrong);
      s.hit(60);
      A.play('error');
      this.net.shake(0.8);
      this.net.burst(id, 'bad');
      UI.toast('INCORRECT NODE ISOLATED', n.name + ' WAS HONEST · NETWORK WEAKENED', 'bad', -DMG.nodeWrong * 10);
      UI.log(n.name + ' WAS HONEST · INTEGRITY −' + DMG.nodeWrong + '%', 'bad');
    }

    this.net.syncNodes();
    if (s.phase && s.phase.id === 'attack') this.renderPower();
  };

  /* ============================================================
     FINAL PHASE — 51% ATTACK
     ============================================================ */

  Game.enterAttack = function () {
    var s = this.state;
    this.mode = 'stream';
    s.active = null;

    if (this.hunt) this.hunt.active = false;

    var live = s.liveNodes();
    var turn = U.shuffle(live).slice(0, Math.min(2, Math.max(1, live.length - 2)));
    turn.forEach(function (n) { n.status = 'HOSTILE'; n.record = []; });

    s.attack = { flipTimer: 5, drain: 0 };

    A.play('attack');
    this.net.shake(1);
    UI.panelHead('51% ATTACK', 'CRITICAL · DEFEND CONSENSUS');
    UI.setRules({
      title: 'HOLD THE MAJORITY',
      items: ['ISOLATE HOSTILE PEERS', 'REJECT THEIR TRANSACTIONS']
    });
    UI.nodeMeta('HOSTILE PEERS FORKING THE CHAIN', 'alert');
    UI.netAlert('⚠ 51% ATTACK · ISOLATE HOSTILE NODES (CLICK OR 1-5)');
    UI.log('51% ATTACK · ' + turn.length + ' NODES TURNED HOSTILE', 'bad');

    this.net.setSelectable(true, function (id) { Game.isolate(id); });
    this.pullNext();
    this.renderPower();
  };

  Game.renderPower = function () {
    var s = this.state;
    UI.renderPowerMeter(s.honestNodes().length, s.hostileNodes().length);
  };

  Game.tickAttack = function (dt) {
    var s = this.state;
    if (!s.phase || s.phase.id !== 'attack' || !s.attack) return;

    // The attacker keeps buying hash power. Clear the board and it comes
    // back faster, so the last fifteen seconds never go quiet.
    var hostileNow = s.hostileNodes().length;
    s.attack.flipTimer -= dt * (hostileNow === 0 ? 2.2 : 1);
    if (s.attack.flipTimer <= 0) {
      s.attack.flipTimer = 5.5;
      var honest = s.honestNodes();
      if (honest.length > 1) {
        var victim = U.pick(honest);
        victim.status = 'HOSTILE';
        victim.record = [];
        this.net.syncNodes();
        this.net.shake(0.8);
        A.play('warn');
        UI.toast('NODE COMPROMISED', victim.name + ' JOINED THE ATTACKER', 'bad');
        UI.log(victim.name + ' TURNED HOSTILE', 'bad');
      }
    }

    // Losing the majority actively rewrites the honest chain.
    var hostile = s.hostileNodes().length;
    var honestCount = s.honestNodes().length;
    if (hostile > 0 && hostile >= honestCount) {
      s.damage(DMG.majorityDrain * dt);
      s.attack.drain += dt;
      if (s.attack.drain > 1) {
        s.attack.drain = 0;
        this.net.shake(0.5);
        UI.log('MAJORITY LOST · CHAIN BEING REWRITTEN', 'bad');
      }
    }
    this.renderPower();
  };

  /* ============================================================
     KEYBOARD
     ============================================================ */

  Game.key = function (e) {
    var s = this.state;
    if (!s || !s.running) return;
    var k = e.key.toLowerCase();

    if (this.mode === 'stream' && s.active) {
      if (k === 'a') { e.preventDefault(); this.decide(true); return; }
      if (k === 'r') { e.preventDefault(); this.decide(false); return; }
    }
    if (this.mode === 'build' && (k === ' ' || k === 'enter')) {
      e.preventDefault(); this.mineBlock(); return;
    }
    if (k >= '1' && k <= '5' && this.net && this.net.selectable) {
      e.preventDefault(); this.isolate(parseInt(k, 10) - 1); return;
    }
    if (k === 'i' && this.net && this.net.selectable) {
      e.preventDefault();
      // isolate the peer with the worst recent broadcast record
      var worst = null, worstBad = 0;
      s.liveNodes().forEach(function (n) {
        var bad = n.record.filter(function (r) { return !r; }).length;
        if (n.status === 'HOSTILE') bad += 10;
        if (bad > worstBad) { worstBad = bad; worst = n; }
      });
      if (worst) this.isolate(worst.id);
      return;
    }
  };

  CB.Game = Game;
})(window);
