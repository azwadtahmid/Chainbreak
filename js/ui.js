/* ============================================================
   CHAINBREAK — ui.js
   All DOM rendering. Reads state, writes pixels. No game rules.
   ============================================================ */
(function (root) {
  'use strict';

  var CB = root.CB = root.CB || {};
  var U = CB.util;
  var $ = U.$, el = U.el;

  var dom = {};
  var UI = {};

  UI.bind = function () {
    dom.integrity = $('#ui-integrity');
    dom.integrityBar = $('#ui-integrity-bar');
    dom.integrityStat = $('.stat-integrity');
    dom.score = $('#ui-score');
    dom.combo = $('#ui-combo');
    dom.comboWrap = $('#ui-combo-wrap');
    dom.time = $('#ui-time');
    dom.timeStat = $('.stat-time');
    dom.threat = $('#ui-threat');
    dom.threatWrap = $('#ui-threat-wrap');
    dom.chainRail = $('#chain-rail');
    dom.chainScroll = $('#chain-scroll');
    dom.chainMeta = $('#ui-chain-meta');
    dom.nodeMeta = $('#ui-node-meta');
    dom.panelTitle = $('#ui-panel-title');
    dom.panelMeta = $('#ui-panel-meta');
    dom.panelBody = $('#panel-body');
    dom.panelActions = $('#panel-actions');
    dom.rules = $('#rules-strip');
    dom.log = $('#event-log');
    dom.toasts = $('#toast-layer');
    dom.banner = $('#phase-banner');
    dom.crit = $('#crit-overlay');
    dom.netAlert = $('#net-alert');
  };

  /* ============================================================
     TOP BAR
     ============================================================ */
  var shownScore = 0;

  UI.resetHud = function () {
    shownScore = 0;
    dom.score.textContent = '0';
    U.clear(dom.log);
    dom.crit.hidden = true;
    dom.netAlert.hidden = true;
  };

  UI.hud = function (s, dt) {
    // score eases toward its true value so it feels alive
    if (shownScore !== s.score) {
      var diff = s.score - shownScore;
      var step = Math.max(1, Math.abs(diff) * Math.min(1, (dt || 0.016) * 9));
      shownScore += diff > 0 ? Math.min(diff, step) : Math.max(diff, -step);
      dom.score.textContent = U.commas(shownScore);
    }

    var pct = Math.round(s.integrity);
    dom.integrity.textContent = pct + '%';
    dom.integrityBar.style.width = pct + '%';

    var band = s.integrityBand();
    dom.integrityStat.className = 'stat stat-integrity'
      + (band === 'warning' ? ' warn' : '')
      + (band === 'critical' || band === 'unstable' || band === 'collapsed' ? ' crit' : '')
      + (band === 'unstable' || band === 'collapsed' ? ' unstable' : '');

    // The tutorial has no clock and no score to chase.
    if (s.demo) {
      dom.time.textContent = '—';
      dom.timeStat.className = 'stat stat-time';
      dom.threat.textContent = 'TUTORIAL';
      dom.threatWrap.className = 'stat stat-threat';
      dom.combo.textContent = '—';
      dom.comboWrap.className = 'stat stat-combo';
      dom.crit.hidden = true;
      return;
    }

    dom.time.textContent = Math.max(0, Math.ceil(s.timeLeft));
    dom.timeStat.className = 'stat stat-time' + (s.timeLeft <= 10 ? ' low' : '');

    dom.combo.textContent = '×' + s.multiplier;
    dom.comboWrap.className = 'stat stat-combo' + (s.multiplier >= 3 ? ' hot' : '');

    dom.threat.textContent = s.threatLevel;
    dom.threatWrap.className = 'stat stat-threat t-' + s.threatLevel.toLowerCase();

    dom.crit.hidden = !(s.phase && s.phase.id === 'attack');
    if (!dom.crit.hidden) dom.crit.className = 'crit-overlay scan';
  };

  UI.popCombo = function () {
    dom.comboWrap.classList.remove('pop');
    void dom.comboWrap.offsetWidth;
    dom.comboWrap.classList.add('pop');
  };

  UI.nodeMeta = function (text, cls) {
    dom.nodeMeta.textContent = text;
    dom.nodeMeta.className = 'head-meta' + (cls ? ' ' + cls : '');
  };

  UI.netAlert = function (text) {
    if (!text) { dom.netAlert.hidden = true; return; }
    dom.netAlert.hidden = false;
    dom.netAlert.textContent = text;
  };

  /* ============================================================
     EVENT LOG
     ============================================================ */
  UI.log = function (text, cls) {
    var line = el('div', 'log-line' + (cls ? ' ' + cls : ''));
    line.innerHTML = '<b>&rsaquo;</b> ' + text;
    dom.log.insertBefore(line, dom.log.firstChild);
    while (dom.log.children.length > 8) dom.log.removeChild(dom.log.lastChild);
  };

  /* ============================================================
     TOASTS + BANNERS
     ============================================================ */
  UI.toast = function (main, sub, kind, points) {
    var t = el('div', 'toast ' + (kind || 'info'));
    t.appendChild(el('span', 't-main', main));
    if (sub) t.appendChild(el('span', 't-sub', sub));
    if (points) t.appendChild(el('span', 't-pts', (points > 0 ? '+' : '') + U.commas(Math.abs(points)) + (points > 0 ? ' PTS' : ' PTS LOST')));
    dom.toasts.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1400);
    while (dom.toasts.children.length > 2) dom.toasts.removeChild(dom.toasts.firstChild);
  };

  UI.banner = function (kicker, main, sub, danger) {
    var b = dom.banner;
    b.hidden = false;
    b.className = 'phase-banner' + (danger ? ' danger' : '');
    U.clear(b);
    b.appendChild(el('div', 'pb-kicker', kicker));
    b.appendChild(el('div', 'pb-main', main));
    if (sub) b.appendChild(el('div', 'pb-sub', sub));
    // restart the CSS animation
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(b._t);
    b._t = setTimeout(function () { b.hidden = true; }, 1900);
  };

  UI.panelHead = function (title, meta) {
    dom.panelTitle.textContent = title;
    dom.panelMeta.textContent = meta;
  };

  UI.setRules = function (parts) {
    U.clear(dom.rules);
    dom.rules.appendChild(el('span', 'rules-title', parts.title));
    parts.items.forEach(function (item, i) {
      if (i) dom.rules.appendChild(el('span', 'rule-sep', '/'));
      var r = el('span', 'rule');
      r.innerHTML = item;
      dom.rules.appendChild(r);
    });
  };

  /* ============================================================
     CHAIN
     ============================================================ */
  function hashRow(label, value, cls) {
    var r = el('div', 'hr' + (cls ? ' ' + cls : ''));
    r.appendChild(el('b', null, label));
    r.appendChild(el('span', null, value));
    return r;
  }

  function blockEl(b, opts) {
    opts = opts || {};
    var n = el('div', 'blk' + (b.index === 0 ? ' genesis' : ''));
    n.dataset.index = String(b.index);

    var top = el('div', 'blk-top');
    top.appendChild(el('div', 'blk-idx', 'BLOCK ' + U.pad2(b.index)));
    top.appendChild(el('div', 'blk-tag', b.index === 0 ? 'GENESIS' : (b.minedBy || 'SEALED')));
    n.appendChild(top);

    var hashes = el('div', 'blk-hash');
    hashes.appendChild(hashRow('PREV', b.previousHash, 'prev'));
    hashes.appendChild(hashRow('HASH', b.hash, ''));
    if (opts.showRecalc) {
      hashes.appendChild(hashRow('RECALC', CB.chain.blockHash(b), 'recalc'));
    }
    n.appendChild(hashes);

    var txs = el('div', 'blk-txs');
    var total = 0;
    b.transactions.forEach(function (t) { total += t.amount; });
    b.transactions.slice(0, 4).forEach(function (t) {
      var row = el('div', 'blk-tx');
      var left = el('em', null, t.from.slice(0, 5) + '→' + t.to.slice(0, 5));
      row.appendChild(left);
      row.appendChild(el('b', null, U.money(t.amount)));
      txs.appendChild(row);
    });
    n.appendChild(txs);

    // Always legible, even where the detailed list has to be dropped.
    n.appendChild(el('div', 'blk-sum',
      b.transactions.length + ' TX · ' + U.money(total)));

    return n;
  }

  /**
   * How many blocks fit on screen without scrolling. The chain keeps
   * growing; the view simply follows the tip, so the most recent blocks
   * are always readable at a glance on a stall screen.
   */
  UI.visibleBlockCount = function () {
    var w = dom.chainScroll ? dom.chainScroll.clientWidth : 900;
    // block width + connector, matching the CSS at this breakpoint
    var per = (root.innerWidth >= 1700) ? 198 : 176;
    return U.clamp(Math.floor((w - 100) / per), 3, 8);
  };

  /**
   * Render the chain (most recent window of blocks).
   * opts.showRecalc  — also print each block's live recomputed hash
   * opts.auditable   — blocks are clickable
   * opts.onPick      — click handler(trueIndex)
   */
  UI.renderChain = function (chain, opts) {
    opts = opts || {};
    var rail = dom.chainRail;
    var audit = chain.audit();
    U.clear(rail);

    var total = chain.blocks.length;
    var window_ = UI.visibleBlockCount();
    var start = Math.max(0, total - window_);

    if (start > 0) {
      var earlier = el('div', 'blk-earlier');
      earlier.appendChild(el('b', null, '+' + start));
      earlier.appendChild(el('span', null, start === 1 ? 'EARLIER BLOCK' : 'EARLIER BLOCKS'));
      earlier.appendChild(el('span', 'be-hash', chain.blocks[start - 1].hash));
      rail.appendChild(earlier);
      rail.appendChild(el('div', 'blk-link'));
    }

    for (var i = start; i < total; i++) {
      var b = chain.blocks[i];
      if (i > start) {
        // The break is only drawn once the culprit is known — during the
        // audit the player has to find it by comparing HASH against RECALC.
        rail.appendChild(el('div', 'blk-link' + (opts.revealBreak && !audit[i - 1].hashOk ? ' broken' : '')));
      }
      var node = blockEl(b, opts);
      if (opts.revealBreak && b.tampered) node.classList.add('glitch');
      if (opts.auditable) {
        node.classList.add('auditable');
        node.tabIndex = 0;
        (function (idx, elem) {
          elem.addEventListener('click', function () { if (opts.onPick) opts.onPick(idx, elem); });
          elem.addEventListener('keydown', function (e) {
            if ((e.key === 'Enter' || e.key === ' ') && opts.onPick) { e.preventDefault(); opts.onPick(idx, elem); }
          });
        })(i, node);
      }
      rail.appendChild(node);
    }

    var broken = chain.findBroken();
    dom.chainMeta.textContent = 'HEIGHT ' + chain.height()
      + ' · ' + (broken < 0 ? 'ALL LINKS VERIFIED' : 'LINK FAILURE DETECTED');
    dom.chainMeta.className = 'head-meta' + (broken < 0 ? ' good' : ' alert');
  };

  UI.scrollChainEnd = function (smooth) {
    var s = dom.chainScroll;
    if (!s) return;
    try {
      s.scrollTo({ left: s.scrollWidth, behavior: (smooth && !U.reduceMotion) ? 'smooth' : 'auto' });
    } catch (e) { s.scrollLeft = s.scrollWidth; }
  };

  UI.markBlock = function (index, cls) {
    var node = dom.chainRail.querySelector('.blk[data-index="' + index + '"]');
    if (node) { node.classList.add(cls); }
    return node;
  };

  UI.flashBlock = function (index, cls, ms) {
    var node = UI.markBlock(index, cls);
    if (node) setTimeout(function () { node.classList.remove(cls); }, ms || 600);
  };

  /* ============================================================
     PANEL: TRANSACTION CARD
     ============================================================ */
  function metaCell(k, v, cls) {
    var m = el('div', 'm');
    m.appendChild(el('div', 'm-k', k));
    m.appendChild(el('div', 'm-v' + (cls ? ' ' + cls : ''), v));
    return m;
  }

  /**
   * The active transaction. Everything a validator needs is on the face
   * of the card: who signed it, what they can afford, which nonce it
   * spends, and which peer relayed it.
   */
  UI.renderTxCard = function (tx, ledger, conflictTx) {
    var body = dom.panelBody;
    U.clear(body);

    if (conflictTx) {
      var warn = el('div', 'conflict-banner');
      warn.innerHTML = '⚠ <b>DOUBLE SPEND DETECTED</b> &middot; ' + tx.from
        + ' SPENT NONCE ' + U.pad2(tx.nonce) + ' TWICE';
      body.appendChild(warn);
    }

    var card = el('div', 'tx-card active enter' + (conflictTx ? ' conflict' : ''));
    card.id = 'active-tx';

    var head = el('div', 'tx-head');
    head.appendChild(el('span', 'tx-id', 'TX ' + tx.id));
    head.appendChild(el('span', null, 'VIA ' + (tx.node != null ? 'NODE ' + U.pad2(tx.node + 1) : 'MEMPOOL')));
    card.appendChild(head);

    var flow = el('div', 'tx-flow');
    var f = el('div', 'tx-party from');
    f.appendChild(el('div', 'p-role', 'SENDER'));
    f.appendChild(el('div', 'p-name', tx.from));
    flow.appendChild(f);
    flow.appendChild(el('div', 'tx-arrow'));
    var t2 = el('div', 'tx-party to');
    t2.appendChild(el('div', 'p-role', 'RECEIVER'));
    t2.appendChild(el('div', 'p-name', tx.to));
    flow.appendChild(t2);
    card.appendChild(flow);

    card.appendChild(el('div', 'tx-amount', U.money(tx.amount)));

    var avail = ledger.avail(tx.from);
    var spent = ledger.isSpent(tx.from, tx.nonce);
    var meta = el('div', 'tx-meta');
    meta.appendChild(metaCell('SENDER AVAIL', U.money(avail), avail < tx.amount ? 'bad' : 'ok'));
    meta.appendChild(metaCell('NONCE',
      U.pad2(tx.nonce) + (spent ? ' USED' : ''),
      spent ? 'bad' : (conflictTx ? 'warn' : '')));
    meta.appendChild(metaCell('SIGNATURE',
      CB.chain.sigValid(tx) ? 'VALID' : 'FORGED',
      CB.chain.sigValid(tx) ? 'ok' : 'bad'));
    card.appendChild(meta);

    var timer = el('div', 'tx-timer');
    timer.appendChild(el('i'));
    card.appendChild(timer);

    body.appendChild(card);
    return card;
  };

  UI.renderQueue = function (queue, activeTx) {
    var body = dom.panelBody;
    var q = el('div', 'queue');
    q.appendChild(el('div', 'queue-title', 'MEMPOOL · ' + queue.length + ' WAITING'));
    queue.slice(0, 4).forEach(function (t) {
      var item = el('div', 'q-item' + (activeTx && t.conflictsWith === activeTx.id ? ' linked' : ''));
      item.appendChild(el('span', 'q-id', t.id));
      item.appendChild(el('span', null, t.from.slice(0, 5) + ' → ' + t.to.slice(0, 5)));
      item.appendChild(el('span', 'q-amt', U.money(t.amount)));
      q.appendChild(item);
    });
    body.appendChild(q);
  };

  UI.setTxTimer = function (frac, urgent) {
    var card = $('#active-tx');
    if (!card) return;
    var bar = card.querySelector('.tx-timer');
    if (!bar) return;
    bar.classList.toggle('urgent', !!urgent);
    bar.firstChild.style.transform = 'scaleX(' + Math.max(0, frac) + ')';
  };

  UI.dismissTxCard = function (ok) {
    var card = $('#active-tx');
    if (!card) return;
    card.id = '';
    card.classList.add(ok ? 'leaving-ok' : 'leaving-bad');
    setTimeout(function () { if (card.parentNode) card.parentNode.removeChild(card); }, 360);
  };

  /* ============================================================
     PANEL: ACTIONS
     ============================================================ */
  UI.setActions = function (list) {
    U.clear(dom.panelActions);
    (list || []).forEach(function (a) {
      var b = el('button', 'act ' + (a.cls || 'act-primary'));
      b.type = 'button';
      b.appendChild(document.createTextNode(a.label));
      if (a.key) b.appendChild(el('kbd', null, a.key));
      if (a.disabled) b.disabled = true;
      b.addEventListener('click', a.onClick);
      if (a.id) b.id = a.id;
      dom.panelActions.appendChild(b);
    });
  };

  UI.enableAction = function (id, on) {
    var b = document.getElementById(id);
    if (b) b.disabled = !on;
  };

  /* ============================================================
     PANEL: BLOCK BUILDER
     ============================================================ */
  UI.renderBuilder = function (model, onToggle, focusTxId) {
    var body = dom.panelBody;
    U.clear(body);

    var hint = el('div', 'builder-hint');
    hint.innerHTML = '<span>SELECT <b>' + model.capacity + '</b> VALID TRANSACTIONS</span>'
      + '<span>' + model.selected.length + ' / ' + model.capacity + '</span>';
    body.appendChild(hint);

    var pool = el('div', 'pool');
    model.pool.forEach(function (tx) {
      var on = model.selected.indexOf(tx.id) >= 0;
      var chip = el('button', 'chip' + (on ? ' on' : ''));
      chip.type = 'button';
      chip.appendChild(el('span', 'c-box'));
      var mid = el('span', null, tx.from + ' → ' + tx.to);
      chip.appendChild(mid);
      chip.appendChild(el('span', 'c-amt', U.money(tx.amount)));
      var sigOk = CB.chain.sigValid(tx);
      var afford = model.ledger.avail(tx.from) >= tx.amount;
      var tag, tagCls;
      if (!sigOk) { tag = 'SIG ✗'; tagCls = 'bad'; }
      else if (!afford) { tag = 'AVAIL ' + U.money(model.ledger.avail(tx.from)); tagCls = 'bad'; }
      else { tag = 'SIG ✓'; tagCls = 'ok'; }
      chip.appendChild(el('span', 'c-sig ' + tagCls, tag));
      if (!on && model.selected.length >= model.capacity) chip.disabled = true;
      chip.dataset.tx = tx.id;
      chip.setAttribute('aria-pressed', String(on));
      chip.addEventListener('click', function () { onToggle(tx.id); });
      pool.appendChild(chip);
    });
    body.appendChild(pool);

    // Re-rendering replaces the buttons, so put keyboard focus back on the
    // chip the player just toggled.
    if (focusTxId) {
      var again = pool.querySelector('.chip[data-tx="' + focusTxId + '"]');
      if (again && !again.disabled) { try { again.focus(); } catch (e) {} }
    }

    var draft = el('div', 'draft');
    var dh = el('div', 'draft-head');
    dh.appendChild(el('b', null, 'BLOCK ' + U.pad2(model.nextIndex)));
    dh.appendChild(el('span', null, 'PENDING SEAL'));
    draft.appendChild(dh);

    var slots = el('div', 'draft-slots');
    var i;
    for (i = 0; i < model.capacity; i++) {
      var id = model.selected[i];
      var tx = id ? model.byId[id] : null;
      var slot = el('div', 'slot' + (tx ? ' full' : ''));
      if (tx) {
        slot.appendChild(el('span', null, (i + 1) + '. ' + tx.from + ' → ' + tx.to));
        slot.appendChild(el('b', null, U.money(tx.amount)));
      } else {
        slot.appendChild(el('span', null, (i + 1) + '. — EMPTY —'));
      }
      slots.appendChild(slot);
    }
    draft.appendChild(slots);

    var hashes = el('div', 'draft-hashes');
    hashes.appendChild(hashRow('PREVIOUS HASH', model.previousHash, 'prev'));
    hashes.appendChild(hashRow('HASH', model.draftHash, ''));
    draft.appendChild(hashes);

    body.appendChild(draft);
  };

  /* ============================================================
     PANEL: PROMPT (audit / node hunt / attack)
     ============================================================ */
  UI.renderPrompt = function (o) {
    var body = dom.panelBody;
    U.clear(body);
    var card = el('div', 'prompt-card' + (o.danger ? ' danger' : ''));
    if (o.icon) card.appendChild(el('div', 'p-icon', o.icon));
    card.appendChild(el('div', 'p-title', o.title));
    var sub = el('div', 'p-sub');
    sub.innerHTML = o.sub;
    card.appendChild(sub);

    if (o.legend) {
      var lg = el('div', 'legend');
      o.legend.forEach(function (pair) {
        var row = el('div', 'lg');
        row.appendChild(el('span', null, pair[0]));
        row.appendChild(el('span', null, pair[1]));
        lg.appendChild(row);
      });
      card.appendChild(lg);
    }

    if (o.timer) {
      var t = el('div', 'mini-timer');
      t.appendChild(el('i'));
      t.id = 'prompt-timer';
      card.appendChild(t);
    }
    body.appendChild(card);
  };

  UI.setPromptTimer = function (frac) {
    var t = document.getElementById('prompt-timer');
    if (t && t.firstChild) t.firstChild.style.transform = 'scaleX(' + Math.max(0, frac) + ')';
  };

  /* ============================================================
     PANEL: HASH POWER METER (51% attack)
     ============================================================ */
  UI.renderPowerMeter = function (honest, hostile) {
    var body = dom.panelBody;
    var old = document.getElementById('power-meter');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var total = honest + hostile;
    var hPct = total ? (honest / total) * 100 : 100;
    var mPct = 100 - hPct;

    var pm = el('div', 'power-meter');
    pm.id = 'power-meter';

    var row = el('div', 'pm-row');
    row.innerHTML = '<span class="h">HONEST NODES: ' + honest + '</span>'
      + '<span class="m">MALICIOUS NODES: ' + hostile + '</span>';
    pm.appendChild(row);

    var bar = el('div', 'pm-bar');
    var hb = el('i', 'pm-h'); hb.style.width = hPct + '%';
    var mb = el('i', 'pm-m'); mb.style.width = mPct + '%';
    bar.appendChild(hb); bar.appendChild(mb);
    pm.appendChild(bar);

    var losing = hostile > 0 && hostile >= honest;
    var note = el('div', 'pm-note' + (losing ? ' bad' : ''),
      losing ? 'MAJORITY LOST — CHAIN BEING REWRITTEN' : 'HONEST MAJORITY HOLDING');
    pm.appendChild(note);

    body.insertBefore(pm, body.firstChild);
  };

  CB.ui = UI;
  CB.dom = dom;
})(window);
