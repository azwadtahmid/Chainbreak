/* ============================================================
   CHAINBREAK — state.js
   Single source of truth: run state, scoring, combo, integrity,
   node roster. Nothing here touches the DOM.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB = root.CB || {};
  var U = CB.util;

  var ROUND_SECONDS = 120;
  var NODE_COUNT = 5;

  var COMBO_TIERS = [
    { at: 10, mult: 4, label: 'CHAIN MASTER x4' },
    { at: 6,  mult: 3, label: 'COMBO x3' },
    { at: 3,  mult: 2, label: 'COMBO x2' }
  ];

  // Scaled for the 120s round. Every phase got longer, but the shape is the
  // same: a calm opening, three set-piece threats, then the finale.
  var PHASES = [
    { id: 'validate', from: 0,   to: 24,  title: 'VALIDATE TRANSACTIONS', kicker: 'PHASE 01', sub: 'ACCEPT THE HONEST. REJECT THE REST.' },
    { id: 'double',   from: 24,  to: 44,  title: 'DOUBLE SPEND DETECTED',  kicker: 'PHASE 02', sub: 'THE SAME FUNDS, PROMISED TWICE.', danger: true },
    { id: 'build',    from: 44,  to: 62,  title: 'BUILD THE NEXT BLOCK',   kicker: 'PHASE 03', sub: 'ONLY VALID TRANSACTIONS GET SEALED.' },
    { id: 'tamper',   from: 62,  to: 80,  title: 'CHAIN INTEGRITY FAILURE',kicker: 'PHASE 04', sub: 'SOMETHING CHANGED INSIDE THE CHAIN.', danger: true },
    { id: 'nodes',    from: 80,  to: 100, title: 'MALICIOUS NODE ONLINE',  kicker: 'PHASE 05', sub: 'ONE PEER IS BROADCASTING LIES.', danger: true },
    { id: 'attack',   from: 100, to: 120, title: '51% ATTACK DETECTED',    kicker: 'CRITICAL THREAT', sub: 'KEEP THE HONEST CHAIN ALIVE.', danger: true }
  ];

  // Calibrated against full simulated 120s rounds. Steady play at ~1.8s per
  // decision with a handful of mistakes lands around 17-20k; a first-timer
  // working at 3s a card lands around 7-9k.
  var TITLES = [
    { min: 28000, name: 'CHAIN MASTER' },
    { min: 20000, name: 'BLOCKCHAIN DEFENDER' },
    { min: 13000, name: 'CHAIN GUARDIAN' },
    { min: 7000,  name: 'VALIDATOR' },
    { min: -1e9,  name: 'NETWORK ROOKIE' }
  ];

  function makeNodes() {
    var list = [], i;
    for (i = 0; i < NODE_COUNT; i++) {
      list.push({
        id: i,
        name: 'NODE ' + U.pad2(i + 1),
        status: 'HONEST',        // HONEST | SUSPECT | HOSTILE | ISOLATED
        record: [],              // recent broadcast results: true = valid
        pulse: 0,
        x: 0, y: 0
      });
    }
    return list;
  }

  function State() { this.reset(); }

  State.prototype.reset = function () {
    this.running = false;
    this.over = false;
    this.elapsed = 0;
    this.timeLeft = ROUND_SECONDS;

    this.score = 0;
    this.integrity = 100;
    this.streak = 0;
    this.bestStreak = 0;
    this.multiplier = 1;

    this.stats = {
      threatsStopped: 0,
      blocksVerified: 0,
      doubleSpendsCaught: 0,
      nodesIsolated: 0,
      txAccepted: 0,
      txRejected: 0,
      mistakes: 0
    };

    this.phase = null;
    this.phaseIndex = -1;

    this.ledger = CB.gen.buildLedger(9);
    this.chain = new CB.chain.Chain();
    this.nodes = makeNodes();

    this.queue = [];
    this.active = null;
    this.activeDeadline = 0;
    this.activeWindow = 3.4;
    this.pendingMined = [];   // accepted txs waiting to be sealed into a block

    this.threatLevel = 'LOW';
    this.attack = null;
    this.demo = false;
  };

  /* ---------- scoring ---------- */

  State.prototype.recomputeMultiplier = function () {
    var m = 1, i;
    for (i = 0; i < COMBO_TIERS.length; i++) {
      if (this.streak >= COMBO_TIERS[i].at) { m = COMBO_TIERS[i].mult; break; }
    }
    var changed = m !== this.multiplier;
    this.multiplier = m;
    return changed;
  };

  State.prototype.comboLabel = function () {
    var i;
    for (i = 0; i < COMBO_TIERS.length; i++) {
      if (this.multiplier === COMBO_TIERS[i].mult) return COMBO_TIERS[i].label;
    }
    return null;
  };

  /** Award points through the current multiplier. Returns points added. */
  State.prototype.award = function (base) {
    var pts = Math.round(base * this.multiplier);
    this.score += pts;
    return pts;
  };

  State.prototype.hit = function (base) {
    var pts = Math.round(base);
    this.score = Math.max(0, this.score - pts);
    return pts;
  };

  State.prototype.goodAction = function () {
    this.streak++;
    if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    return this.recomputeMultiplier();
  };

  State.prototype.badAction = function () {
    this.streak = 0;
    this.stats.mistakes++;
    this.recomputeMultiplier();
  };

  State.prototype.damage = function (amount) {
    this.integrity = U.clamp(this.integrity - amount, 0, 100);
    return this.integrity;
  };

  State.prototype.repair = function (amount) {
    this.integrity = U.clamp(this.integrity + amount, 0, 100);
    return this.integrity;
  };

  State.prototype.integrityBand = function () {
    if (this.integrity <= 0) return 'collapsed';
    if (this.integrity < 25) return 'unstable';
    if (this.integrity < 50) return 'critical';
    if (this.integrity < 75) return 'warning';
    return 'stable';
  };

  /* ---------- nodes ---------- */

  State.prototype.nodeById = function (id) { return this.nodes[id]; };

  State.prototype.liveNodes = function () {
    return this.nodes.filter(function (n) { return n.status !== 'ISOLATED'; });
  };
  State.prototype.honestNodes = function () {
    return this.nodes.filter(function (n) { return n.status === 'HONEST' || n.status === 'SUSPECT'; });
  };
  State.prototype.hostileNodes = function () {
    return this.nodes.filter(function (n) { return n.status === 'HOSTILE'; });
  };

  /** Pick a node to broadcast an honest transaction from. */
  State.prototype.pickHonestNode = function () {
    var pool = this.honestNodes();
    return pool.length ? U.pick(pool) : this.nodes[0];
  };

  State.prototype.recordBroadcast = function (node, wasValid) {
    if (!node) return;
    node.record.push(!!wasValid);
    if (node.record.length > 5) node.record.shift();
    node.pulse = 1;
  };

  /** Fraction of hash power currently in hostile hands. */
  State.prototype.hostileShare = function () {
    var live = this.liveNodes().length;
    if (!live) return 0;
    return this.hostileNodes().length / live;
  };

  State.prototype.updateThreat = function () {
    var t = 'LOW';
    var share = this.hostileShare();
    if (this.phase && this.phase.id === 'attack') t = 'CRITICAL';
    else if (share >= 0.4 || this.integrity < 45) t = 'HIGH';
    else if (share > 0 || this.integrity < 75 || this.elapsed >= 20) t = 'MEDIUM';
    this.threatLevel = t;
    return t;
  };

  State.prototype.titleForScore = function () {
    var i;
    for (i = 0; i < TITLES.length; i++) if (this.score >= TITLES[i].min) return TITLES[i].name;
    return TITLES[TITLES.length - 1].name;
  };

  CB.State = State;
  CB.PHASES = PHASES;
  CB.ROUND_SECONDS = ROUND_SECONDS;
  CB.NODE_COUNT = NODE_COUNT;
})(window);
