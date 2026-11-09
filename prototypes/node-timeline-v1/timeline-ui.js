/* Node timeline prototype (#403): the idle view with three full-width route timelines under the header.
 * A · Band: an even node strip in the realms' canonical order; a bridge shows that Fire node 6 opens Ice (P-01).
 * B · Rail: a metro line in unlock order that forks at Fire node 6; the open view is a vertical route map.
 * C · Lens: the current section in full, the rest of the route compressed to chips; the open view pages realm cards. */
(function () {
    'use strict';
    const M = globalThis.SpellcraftNodeTimeline;
    const q = new URLSearchParams(location.search);
    const $ = (sel, el) => (el || document).querySelector(sel);
    const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const img = (name, cls, alt) => `<img class="${cls || ''}" src="assets/${name}.png" alt="${esc(alt || '')}" draggable="false">`;
    const realmName = r => M.REALM[r].name;
    const pairLabel = (realm, tier) => realmName(realm) + ' tier ' + tier;
    const same = (a, b) => a && b && a.realm === b.realm && a.tier === b.tier && a.node === b.node;
    const MOVE_MS = 650;
    const EASE = 'cubic-bezier(.3,.7,.2,1)';

    const app = {
        variant: ['A', 'B', 'C'].includes(q.get('variant')) ? q.get('variant') : 'A',
        scenario: M.SCENARIOS[q.get('scene')] ? q.get('scene') : 'start',
        open: q.get('open') === '1',
        reduced: q.get('reduced') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches,
        auto: q.get('paused') !== '1',
        selected: null,
        cardIndex: null,
        dialog: null,
        hp: 1,
        killing: false,
        lastTx: null
    };
    app.state = M.createState(M.SCENARIOS[app.scenario].state);

    const phone = $('#phone');
    if (q.get('chrome') === '0') document.documentElement.classList.add('bare');
    if (q.get('notch') === '1') phone.classList.add('notch');

    /* ---------- Shell: header, currencies, scene and spell bar, as in the current game view ---------- */

    function renderShell() {
        phone.innerHTML = `
            <div class="safe-top"></div>
            <header class="hud">
                <div class="hud-row">
                    ${img('crest', 'crest', '')}
                    <div class="power"><small>MAGE POWER</small><b>124</b></div>
                    <div class="stats">
                        <span>${img('hp', 'stat-icon', '')}<b>100</b><small>HP</small></span>
                        <span>${img('spell-power', 'stat-icon', '')}<b>24</b><small>Spell power</small></span>
                    </div>
                    <button class="icon-button settings" aria-label="Settings">${img('settings', '', '')}</button>
                </div>
                <div class="currencies">
                    ${[['shard-fire', '263', 'Fire shards'], ['shard-ice', '41', 'Ice shards'], ['shard-earth', '0', 'Earth shards'], ['shard-wind', '0', 'Wind shards'], ['gold', '20', 'Gold']]
                        .map(([i, n, label]) => `<span class="chip" role="img" aria-label="${n} ${label}">${img(i, '', '')}<b>${n}</b></span>`).join('')}
                </div>
            </header>
            <section id="timeline" class="tl" aria-label="Route"></section>
            <div class="scene">
                <div class="scene-bg"></div>
                <span class="idle-badge">IDLE</span>
                <div class="monster"><div class="hpbar"><i></i></div><div class="monster-art"></div><span class="monster-name"></span></div>
                ${img('mage', 'mage', '')}
            </div>
            <div class="spellbar">
                <span class="cast-label">Flare Javelin</span>
                <div class="slots">
                    ${['spell-flare-javelin', 'spell-frost-fang', 'spell-ember-ring', 'slot-empty'].map((s, i) => `<button class="slot" aria-label="Spell slot ${i + 1}${i === 3 ? ', empty' : ''}">${img(s, '', '')}<small>${i + 1}</small></button>`).join('')}
                </div>
                <button class="grid-button" aria-label="All features">${img('grid-button', '', '')}</button>
            </div>
            <div class="safe-bottom"></div>
            <section id="sheet" class="sheet" hidden></section>
            <div id="dialog" class="dialog-layer" hidden></div>
            <div id="toast" class="toast" hidden></div>
            <div id="live" class="sr-only" aria-live="polite"></div>`;
    }

    function announce(text, toast) {
        $('#live').textContent = text;
        if (!toast) return;
        const t = $('#toast');
        t.textContent = text;
        t.hidden = false;
        clearTimeout(announce.timer);
        announce.timer = setTimeout(() => { t.hidden = true; }, 2200);
    }

    function renderScene() {
        const { realm, tier, node } = app.state.location;
        const mon = M.monsterOf(realm, tier, node);
        const scene = $('.scene');
        scene.dataset.realm = realm;
        $('.scene-bg').style.backgroundImage = `url(assets/realm-${realm}.png)`;
        const art = $('.monster-art');
        if (art.dataset.key !== M.nodeKey(realm, tier, node)) {
            art.dataset.key = M.nodeKey(realm, tier, node);
            art.innerHTML = img(mon.art, 'mob mob-' + realm, '');
        }
        $('.monster-name').textContent = mon.name;
        $('.hpbar i').style.width = Math.max(0, app.hp * 100) + '%';
    }

    /* ---------- Shared route facts ---------- */

    function statusText() {
        const s = app.state, { realm, tier, node } = s.location;
        if (M.waitingBoss(s)) return 'Boss ahead';
        if (node < s.frontiers[M.key(realm, tier)]) return 'Revisiting';
        if (M.nextStep(s, realm, tier, node).end) return 'Route cleared';
        return 'Farming';
    }
    function routeLabel() {
        const s = app.state, { realm, tier, node } = s.location, w = M.waitingBoss(s);
        return `Route. ${realmName(realm)} realm, tier ${tier}, ${M.sectionOf(realm, node).name}, node ${node} of 25. ${w ? w.name + ' waits at node ' + w.node + '. ' : ''}Open the route to move between nodes.`;
    }
    function labelsHtml() {
        const s = app.state, { realm, tier, node } = s.location;
        if (app.variant === 'B') return `<div class="tl-labels" aria-hidden="true">
            <span class="tl-where">${img('shard-' + realm, 'tl-realm-icon', '')}<b>${realmName(realm).toUpperCase()}</b><span>T${tier}</span><i>${esc(M.sectionOf(realm, node).name)}</i></span>
            <span class="tl-node"><b>${node}</b>/25 · ${statusText()}</span></div>`;
        return `<div class="tl-labels" aria-hidden="true">
            <span class="tl-where">${img('shard-' + realm, 'tl-realm-icon', '')}<b>${realmName(realm).toUpperCase()}</b><span>TIER ${tier}</span></span>
            <span class="tl-section">${esc(M.sectionOf(realm, node).name)}</span>
            <span class="tl-node">Node <b>${node}</b>/25 · ${statusText()}</span></div>`;
    }
    function nodeAria(realm, tier, node) {
        const st = M.nodeState(app.state, realm, tier, node), d = M.describe(realm, tier, node);
        const what = d.boss ? 'boss ' + d.boss.name : d.monster.name;
        const words = { current: 'the mage is here', frontier: 'frontier', cleared: 'cleared', locked: 'locked', beaten: 'defeated', waiting: 'waits for you', ready: 'ready to challenge' };
        return `${pairLabel(realm, tier)}, node ${node}, ${d.section}, ${what}, ${words[st]}`;
    }

    /* Linear layouts for A and B: per-pair node offsets with a wider gap between sections. */
    function offsets(c) {
        const off = [0];
        let x = 0;
        for (let n = 1; n <= 25; n++) {
            if (n > 1) x += c.gap + (M.REALMS[0].sections.some(([, a]) => a === n) ? c.secGap : 0);
            off[n] = x;
            x += M.isBoss(n) ? c.boss : c.idle;
        }
        return { off, width: x };
    }
    const width = (c, n) => (M.isBoss(n) ? c.boss : c.idle);

    /* A: canonical order. Each pair is a gate followed by its 25 nodes. */
    function bandLayout(c) {
        const o = offsets(c);
        const gw = p => (p % 4 === 0 ? c.tierGate : c.gate);
        const cache = [0];
        const base = p => { while (cache.length <= p) { const k = cache.length - 1; cache.push(cache[k] + gw(k) + c.pad * 2 + o.width + c.pad); } return cache[p]; };
        return {
            gateX: p => base(p), gateW: gw,
            nodeX: (p, n) => base(p) + gw(p) + c.pad * 2 + o.off[n],
            endX: p => base(p + 1), nodeW: n => width(c, n)
        };
    }
    /* B: unlock order. Fire tier 1 forks after node 6: the main line goes on to Ice, Fire 7–25 runs on the branch. */
    function railLayout(c) {
        const o = offsets(c);
        const gw = p => (p % 4 === 0 ? c.tierGate : c.gate);
        const forkX = gw(0) + c.pad * 2 + o.off[6] + c.boss + c.gap * 2;
        const cache = [0, forkX];
        const base = p => { while (cache.length <= p) { const k = cache.length - 1; cache.push(cache[k] + gw(k) + c.pad * 2 + o.width + c.pad); } return cache[p]; };
        return {
            forkX,
            gateX: p => base(p), gateW: gw,
            nodeX: (p, n) => (p === 0 && n > 6 ? forkX + (o.off[n] - o.off[7]) + c.gap : base(p) + gw(p) + c.pad * 2 + o.off[n]),
            lane: (p, n) => (p === 0 && n > 6 ? 'branch' : 'main'),
            branchEnd: () => forkX + o.off[25] - o.off[7] + c.boss + c.gap * 2,
            nodeW: n => width(c, n)
        };
    }

    /* ---------- Collapsed timeline ---------- */

    function renderTimeline(animate) {
        const tl = $('#timeline');
        const prev = animate && !app.reduced ? snapshot(tl) : null;
        tl.className = 'tl tl-' + app.variant.toLowerCase();
        tl.dataset.variant = app.variant;
        const html = app.variant === 'A' ? bandCollapsed() : app.variant === 'B' ? railCollapsed() : lensCollapsed();
        tl.innerHTML = html.labels + `<button class="tl-open" aria-label="${esc(routeLabel())}" aria-expanded="${app.open}"></button>
            <div class="tl-viewport"><div class="tl-track">${html.track}</div></div>${html.overlay || ''}`;
        const track = $('.tl-track', tl);
        const center = $('[data-center]', track);
        const vw = $('.tl-viewport', tl).clientWidth;
        const tx = Math.round(vw / 2 - (parseFloat(center.dataset.cx)));
        track.style.transform = `translateX(${tx}px)`;
        if (prev && prev.variant === app.variant) play(track, prev, tx);
        app.lastTx = tx;
        app.lastVariant = app.variant;
        if (html.after) html.after(tl, tx, vw);
    }
    function snapshot(tl) {
        const m = new Map();
        $$('.tl-track [data-k]', tl).forEach(e => m.set(e.dataset.k, { x: e.offsetLeft, y: e.offsetTop }));
        return { items: m, tx: app.lastTx, variant: app.lastVariant };
    }
    function play(track, prev, tx) {
        const opt = { duration: MOVE_MS, easing: EASE };
        if (prev.tx != null && prev.tx !== tx) track.animate([{ transform: `translateX(${prev.tx}px)` }, { transform: `translateX(${tx}px)` }], opt);
        $$('[data-k]', track).forEach(e => {
            const b = prev.items.get(e.dataset.k);
            if (!b) { e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }); return; }
            const dx = b.x - e.offsetLeft, dy = b.y - e.offsetTop;
            if (Math.abs(dx) > .5 || Math.abs(dy) > .5) e.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], opt);
        });
    }

    /* Window of pairs around the mage: one behind, two ahead; the route itself has no end. */
    function windowPairs(p) { const out = []; for (let i = Math.max(0, p - 1); i <= p + 2; i++) out.push(i); return out; }

    function bossTile(realm, tier, node, st, size) {
        const b = M.bossOf(realm, tier, node);
        return `<span class="boss-face ${st}" style="--s:${size}px">${img(b.art, '', '')}</span>`;
    }

    /* A · Band */
    const BAND = { idle: 20, boss: 30, gap: 5, secGap: 9, gate: 40, tierGate: 52, pad: 4 };
    function bandCollapsed() {
        const s = app.state, loc = s.location, L = bandLayout(BAND);
        const cp = M.pairIndex(loc.realm, loc.tier);
        let track = '';
        for (const p of windowPairs(cp)) {
            const { realm, tier } = M.pairAt(p);
            const open = M.unlocked(s, realm, tier);
            track += `<span class="band-seg ${realm}${open ? '' : ' locked'}" style="left:${L.gateX(p)}px;width:${L.endX(p) - L.gateX(p)}px"></span>`;
            track += `<span class="gate ${realm}${p % 4 === 0 ? ' tier-gate' : ''}${open ? '' : ' locked'}" data-k="g${p}" style="left:${L.gateX(p)}px;width:${L.gateW(p)}px">
                ${p % 4 === 0 ? `<em>T${tier}</em>` : ''}${img('shard-' + realm, 'gate-icon', '')}<small>${realmName(realm).toUpperCase()}</small>${open ? '' : img('lock', 'gate-lock', '')}</span>`;
            for (const [, a] of M.REALM[realm].sections.slice(1)) track += `<span class="sec-tick" style="left:${L.nodeX(p, a) - (BAND.gap + BAND.secGap) / 2}px"></span>`;
            for (let n = 1; n <= 25; n++) {
                const st = M.nodeState(s, realm, tier, n), x = L.nodeX(p, n), w = L.nodeW(n);
                const here = same(loc, { realm, tier, node: n });
                const attrs = `data-k="${M.nodeKey(realm, tier, n)}" style="left:${x}px;width:${w}px"${here ? ` data-center data-cx="${x + w / 2}"` : ''}`;
                if (M.isBoss(n)) {
                    const face = bossTile(realm, tier, n, st, w);
                    track += st === 'waiting'
                        ? `<button class="node boss hit ${realm} ${st}" ${attrs} aria-label="${esc(nodeAria(realm, tier, n))}. Challenge">${face}<span class="boss-tag">BOSS</span></button>`
                        : `<span class="node boss ${realm} ${st}" ${attrs}>${face}</span>`;
                } else track += `<span class="node ${realm} ${st}${here ? ' here' : ''}" ${attrs}></span>`;
            }
        }
        // P-01: the Ember Watcher at Fire node 6 opens Ice tier 1, which the canonical order places after Fire node 25.
        if (cp <= 2) {
            const x1 = L.nodeX(0, 6) + BAND.boss + 3, x2 = L.gateX(1) + L.gateW(1) / 2;
            const opened = M.defeated(s, 'fire', 1, 6);
            track += `<span class="bridge${opened ? ' opened' : ''}" data-k="bridge" style="left:${x1}px;width:${x2 - x1}px"><i class="bridge-from">${img('shard-ice', '', '')}</i></span>`;
        }
        const here = L.nodeX(cp, loc.node) + BAND.idle / 2;
        track += `<span class="here-pin" data-k="pin" style="left:${here - 5}px"></span>`;
        return {
            labels: labelsHtml(), track,
            after: (tl, tx, vw) => {
                // The next realm is shown at the edge while its gate is off-screen, with what opens it.
                const np = cp + 1, nx = L.gateX(np) + tx;
                if (nx < vw - 20) return;
                const { realm, tier } = M.pairAt(np), op = M.openerOf(realm, tier);
                const open = M.unlocked(s, realm, tier);
                const hint = open ? 'open' : op.realm === loc.realm && op.tier === loc.tier ? 'at node ' + op.node : 'locked';
                const edge = document.createElement('span');
                edge.className = 'edge-hint ' + realm;
                edge.setAttribute('aria-hidden', 'true');
                edge.innerHTML = `${img('shard-' + realm, '', '')}<b>${np % 4 === 0 ? 'T' + tier + ' ' : ''}${realmName(realm)}</b><small>${hint}</small>`;
                $('.tl-viewport', tl).after(edge);
            }
        };
    }

    /* B · Rail */
    const RAIL = { idle: 14, boss: 26, gap: 9, secGap: 8, gate: 30, tierGate: 44, pad: 4 };
    const LANE_Y = { main: 47, branch: 26 };
    function railCollapsed() {
        const s = app.state, loc = s.location, L = railLayout(RAIL);
        const cp = M.pairIndex(loc.realm, loc.tier);
        const pairs = windowPairs(cp);
        let track = '', lines = '';
        const segs = [];
        const pushLine = (x1, x2, lane, realm, lit) => segs.push({ x1, x2, y: LANE_Y[lane], realm, lit });
        for (const p of pairs) {
            const { realm, tier } = M.pairAt(p);
            const open = M.unlocked(s, realm, tier);
            const gx = L.gateX(p), gw = L.gateW(p);
            track += `<span class="rgate ${realm}${p % 4 === 0 ? ' tier-gate' : ''}${open ? '' : ' locked'}" data-k="g${p}" style="left:${gx}px;width:${gw}px;top:${LANE_Y.main}px">
                ${img('shard-' + realm, '', '')}${p % 4 === 0 ? `<em>T${tier}</em>` : ''}</span>`;
            for (let n = 1; n <= 25; n++) {
                const lane = L.lane(p, n), x = L.nodeX(p, n), w = L.nodeW(n), st = M.nodeState(s, realm, tier, n);
                const here = same(loc, { realm, tier, node: n });
                const style = `left:${x}px;width:${w}px;top:${LANE_Y[lane]}px`;
                const attrs = `data-k="${M.nodeKey(realm, tier, n)}" style="${style}"${here ? ` data-center data-cx="${x + w / 2}"` : ''}`;
                if (M.isBoss(n)) {
                    const face = bossTile(realm, tier, n, st, w);
                    track += st === 'waiting'
                        ? `<button class="stn boss hit ${realm} ${st}" ${attrs} aria-label="${esc(nodeAria(realm, tier, n))}. Challenge">${face}</button>`
                        : `<span class="stn boss ${realm} ${st}" ${attrs}>${face}</span>`;
                } else track += `<span class="stn ${realm} ${st}" ${attrs}></span>`;
                if (n > 1 && !(p === 0 && n === 7)) {
                    const px = L.nodeX(p, n - 1) + L.nodeW(n - 1) / 2;
                    pushLine(px, x + w / 2, lane, realm, passed(realm, tier, n - 1) && passed(realm, tier, n));
                }
            }
            // Line from the gate to node 1.
            pushLine(gx + gw / 2, L.nodeX(p, 1) + RAIL.idle / 2, 'main', realm, open);
            // Line into the gate from the previous pair's end (or the fork).
            if (p === 1) pushLine(L.nodeX(0, 6) + RAIL.boss / 2, gx + gw / 2, 'main', realm, open);
            else if (p > 1) pushLine(L.nodeX(p - 1, 25) + RAIL.boss / 2, gx + gw / 2, 'main', realm, open);
        }
        let branch = '';
        if (cp <= 2) {
            // The fork: Fire's own line curves up to the branch at node 7 and ends after the guardian.
            const x6 = L.nodeX(0, 6) + RAIL.boss / 2, x7 = L.nodeX(0, 7) + RAIL.idle / 2;
            const lit = (s.frontiers['fire-1'] || 0) >= 7;
            branch = `<path class="rail-line fire${lit ? ' lit' : ''}" d="M${x6} ${LANE_Y.main} C ${x6 + 14} ${LANE_Y.main}, ${x7 - 16} ${LANE_Y.branch}, ${x7} ${LANE_Y.branch}"/>`;
            const ex = L.branchEnd();
            track += `<span class="rail-end" data-k="end" style="left:${ex - 6}px;top:${LANE_Y.branch}px" aria-hidden="true"></span>`;
            pushLine(L.nodeX(0, 25) + RAIL.boss / 2, ex - 6, 'branch', 'fire', false);
        }
        const minX = L.gateX(pairs[0]) - 40, maxX = L.gateX(pairs[pairs.length - 1] + 1) + 40;
        lines = segs.map(g => `<line class="rail-line ${g.realm}${g.lit ? ' lit' : ''}" x1="${g.x1}" y1="${g.y}" x2="${g.x2}" y2="${g.y}"/>`).join('') + branch;
        const svg = `<svg class="rail-svg" style="left:${minX}px;width:${maxX - minX}px" viewBox="${minX} 0 ${maxX - minX} 68" aria-hidden="true">${lines}</svg>`;
        // The mage token sits on the current station and slides with it.
        const cx = L.nodeX(cp, loc.node) + RAIL.idle / 2, lane = L.lane(cp, loc.node);
        track = svg + track + `<span class="token" data-k="token" style="left:${cx - 15}px;top:${LANE_Y[lane] - 15}px">${img('mage', '', '')}</span>`;
        return { labels: labelsHtml(), track };
    }

    /* C · Lens: the current section in full; earlier and later sections and the next pairs as chips. */
    const LENS = { idle: 24, boss: 30, gap: 6, chip: 86, mini: 30, pairChip: 40, cap: 34 };
    function lensItems(realm, tier) {
        const s = app.state, items = [];
        const loc = s.location;
        const op = M.openerOf(realm, tier);
        if (!op) items.push({ kind: 'cap', key: 'start', text: 'START', w: LENS.cap });
        else {
            const b = M.bossOf(op.realm, op.tier, op.node);
            items.push({ kind: 'origin', key: 'o' + realm + tier, op, boss: b, w: 108 });
        }
        const cur = M.sectionOf(realm, loc.node).index;
        M.REALM[realm].sections.forEach(([name, a, b], i) => {
            if (i === cur) for (let n = a; n <= b; n++) items.push({ kind: 'node', node: n, w: M.isBoss(n) ? LENS.boss : LENS.idle });
            else items.push({ kind: 'section', i, name, a, b, mini: Math.abs(i - cur) > 1, w: Math.abs(i - cur) > 1 ? LENS.mini : LENS.chip });
        });
        const pi = M.pairIndex(realm, tier);
        if (realm === 'fire' && tier === 1) items.push({ kind: 'cap', key: 'end-fire-1', text: 'END', w: LENS.cap });
        for (let k = 1; k <= 7; k++) {
            const p = M.pairAt(pi + k);
            items.push({ kind: 'pair', p, w: LENS.pairChip });
        }
        return items;
    }
    function lensCollapsed() {
        const s = app.state, loc = s.location, { realm, tier } = loc;
        const items = lensItems(realm, tier);
        let x = 0, track = '';
        const curSec = M.sectionOf(realm, loc.node).index;
        for (const it of items) {
            const gap = it.kind === 'node' ? LENS.gap : 8;
            if (track) x += gap;
            if (it.kind === 'node') {
                const n = it.node, st = M.nodeState(s, realm, tier, n), here = n === loc.node;
                const attrs = `data-k="${M.nodeKey(realm, tier, n)}" style="left:${x}px;width:${it.w}px"${here ? ` data-center data-cx="${x + it.w / 2}"` : ''}`;
                if (M.isBoss(n)) {
                    const badge = realm === 'fire' && tier === 1 && n === 6 ? `<i class="opens">${img('shard-ice', '', '')}</i>` : '';
                    const face = bossTile(realm, tier, n, st, it.w) + badge;
                    track += st === 'waiting'
                        ? `<button class="lnode boss hit ${realm} ${st}" ${attrs} aria-label="${esc(nodeAria(realm, tier, n))}${badge ? ', opens Ice tier 1' : ''}. Challenge">${face}</button>`
                        : `<span class="lnode boss ${realm} ${st}" ${attrs}>${face}</span>`;
                } else track += `<span class="lnode ${realm} ${st}" ${attrs}><small>${n}</small></span>`;
            } else if (it.kind === 'section') {
                const done = countDone(realm, tier, it.a, it.b), total = it.b - it.a + 1;
                const lock = it.i > curSec && done === 0 && !(passed(realm, tier, it.a));
                track += it.mini
                    ? `<span class="lchip mini ${realm}${done === total ? ' done' : ''}${lock ? ' locked' : ''}" data-k="sec-${realm}-${tier}-${it.i}" style="left:${x}px;width:${it.w}px"><b>${it.a}</b><small>${done}/${total}</small></span>`
                    : `<span class="lchip ${realm}${done === total ? ' done' : ''}${lock ? ' locked' : ''}" data-k="sec-${realm}-${tier}-${it.i}" style="left:${x}px;width:${it.w}px">
                    <b>${esc(it.name)}</b><small>${it.a}–${it.b} · ${done}/${total}</small></span>`;
            } else if (it.kind === 'origin') {
                track += `<span class="lorigin ${it.op.realm}" data-k="${it.key}" style="left:${x}px;width:${it.w}px">${img(it.boss.art, 'origin-face', '')}<b>${realmName(it.op.realm)} T${it.op.tier} · ${it.op.node}</b><small>opened ${realmName(realm)}</small></span>`;
            } else if (it.kind === 'cap') {
                track += `<span class="lcap" data-k="${it.key}" style="left:${x}px;width:${it.w}px">${it.text}</span>`;
            } else {
                const open = M.unlocked(s, it.p.realm, it.p.tier);
                track += `<span class="lpair ${it.p.realm}${open ? '' : ' locked'}${it.p.realm === 'fire' ? ' tier-start' : ''}" data-k="pair-${it.p.realm}-${it.p.tier}" style="left:${x}px;width:${it.w}px">${img('shard-' + it.p.realm, '', '')}<small>T${it.p.tier}</small></span>`;
            }
            x += it.w;
        }
        const lensHead = `<div class="tl-labels lens-labels" aria-hidden="true"><span class="tl-where">${img('shard-' + realm, 'tl-realm-icon', '')}<b>${realmName(realm).toUpperCase()}</b><span>TIER ${tier}</span></span>
            <span class="tl-section">${esc(M.sectionOf(realm, loc.node).name)}</span><span class="tl-node">Node <b>${loc.node}</b>/25 · ${statusText()}</span></div>`;
        // P-01: while both Fire tier 1 and Ice tier 1 are unfinished, the other line is one tap away.
        let overlay = '';
        const other = realm === 'fire' && tier === 1 ? 'ice' : realm === 'ice' && tier === 1 ? 'fire' : null;
        if (other && M.unlocked(s, other, 1) && !routeDone(other, 1)) {
            overlay = `<button class="tl-switch ${other}" aria-label="Show the ${realmName(other)} tier 1 line, frontier node ${s.frontiers[M.key(other, 1)]}">${img('shard-' + other, '', '')}<small>${realmName(other)} ${s.frontiers[M.key(other, 1)]}</small></button>`;
        }
        const pi = M.pairIndex(realm, tier);
        return {
            labels: lensHead, track, overlay,
            after: (tl, tx, vw) => {
                // The horizon: while the next realm's chip is off-screen, the next pairs stay pinned at the right edge.
                const first = $(`[data-k="pair-${M.pairAt(pi + 1).realm}-${M.pairAt(pi + 1).tier}"]`, tl);
                if (first && first.offsetLeft + tx < vw - 56) return;
                const h = document.createElement('span');
                h.className = 'horizon';
                h.setAttribute('aria-hidden', 'true');
                h.innerHTML = [1, 2, 3].map(k => { const p = M.pairAt(pi + k); return `<i class="${p.realm}${M.unlocked(s, p.realm, p.tier) ? '' : ' locked'}${p.realm === 'fire' ? ' tier-start' : ''}">${img('shard-' + p.realm, '', '')}<small>${k === 1 ? realmName(p.realm) : ''}${p.realm === 'fire' || k === 1 ? ' T' + p.tier : ''}</small></i>`; }).join('');
                $('.tl-viewport', tl).after(h);
            }
        };
    }
    /* A node the mage has passed: an idle node before the frontier, or a defeated boss. */
    function passed(realm, tier, n) {
        const f = app.state.frontiers[M.key(realm, tier)];
        if (f == null) return false;
        return M.isBoss(n) ? M.defeated(app.state, realm, tier, n) : n <= f;
    }
    function countDone(realm, tier, a, b) {
        let c = 0;
        const f = app.state.frontiers[M.key(realm, tier)] || 0;
        for (let n = a; n <= b; n++) if (M.isBoss(n) ? M.defeated(app.state, realm, tier, n) : n < f) c++;
        return c;
    }
    function routeDone(realm, tier) { return M.defeated(app.state, realm, tier, 25); }

    /* ---------- Open view ---------- */

    function openSheet(focus) {
        app.open = true;
        const hud = $('.hud');
        phone.style.setProperty('--sheet-top', (hud.offsetTop + hud.offsetHeight) + 'px');
        app.selected = focus || Object.assign({}, app.state.location);
        app.cardIndex = M.pairIndex(app.selected.realm, app.selected.tier);
        renderSheet(true);
        renderTimeline(false);
    }
    function closeSheet() {
        app.open = false;
        const sh = $('#sheet');
        if (!app.reduced) {
            sh.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-12px)' }], { duration: 180, easing: 'ease-in' }).onfinish = () => { sh.hidden = true; };
        } else sh.hidden = true;
        renderTimeline(false);
        $('.tl-open').focus();
    }

    function renderSheet(entering) {
        const sh = $('#sheet');
        sh.hidden = false;
        sh.className = 'sheet sheet-' + app.variant.toLowerCase();
        sh.setAttribute('aria-label', 'Route');
        sh.setAttribute('role', 'dialog');
        if (app.variant === 'A') sheetA(sh); else if (app.variant === 'B') sheetB(sh); else sheetC(sh);
        if (entering && !app.reduced) sh.animate([{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
        $('[data-close]', sh).onclick = closeSheet;
        if (entering) $('[data-close]', sh).focus({ preventScroll: true });
    }

    function sheetHead(title, sub) {
        return `<div class="sheet-head"><div><h2>${title}</h2><p>${sub}</p></div><button class="icon-button close" data-close aria-label="Close the route">${img('chrome-icon-close', '', '')}</button></div>`;
    }

    /* The selected node: what it is, and either the move, the boss or what opens it. */
    function detailHtml(compact) {
        const s = app.state, sel = app.selected, d = M.describe(sel.realm, sel.tier, sel.node);
        const st = M.nodeState(s, sel.realm, sel.tier, sel.node);
        const v = M.checkMove(s, sel.realm, sel.tier, sel.node);
        const art = d.boss ? d.boss.art : d.monster.art;
        const name = d.boss ? d.boss.name : d.monster.name;
        const kind = d.boss ? (d.boss.guardian ? 'Realm guardian' : 'Boss') : 'Idle node · ' + d.monster.hp + ' HP';
        let action = '';
        if (st === 'waiting' || st === 'ready') {
            const reach = st === 'ready' ? `<p class="note">Farm up to node ${sel.node - 1} and the boss waits for you there.</p>` : '';
            action = `${reach}<button class="cta" data-challenge>Challenge ${esc(name)}</button>`;
        } else if (v.ok) action = `<button class="cta" data-move>Move here</button>`;
        else if (v.code === 'here') action = `<p class="note here-note">${img('mage', 'mini-mage', '')}The mage farms here.</p>`;
        else if (v.code === 'boss') action = `<p class="note">${img('crest', 'note-icon', '')}${esc(v.reason)}</p>`;
        else action = `<p class="note lock-note">${img('lock', 'note-icon', '')}${esc(v.reason)}</p>`;
        const opens = M.opensFrom(sel.realm, sel.tier, sel.node).map(o => pairLabel(o.realm, o.tier));
        return `<div class="detail ${compact ? 'compact' : ''}">
            <div class="detail-top"><span class="detail-art ${st === 'locked' ? 'locked' : ''}">${img(art, d.boss ? '' : 'mob-' + sel.realm, '')}</span>
            <div><small>${realmName(sel.realm).toUpperCase()} · TIER ${sel.tier} · NODE ${sel.node}</small><h3>${esc(name)}</h3>
            <p>${esc(d.section)} · ${kind}${opens.length ? ' · Opens ' + opens.join(', ') : ''}</p></div></div>${action}</div>`;
    }
    function wireDetail(root) {
        const mv = $('[data-move]', root);
        if (mv) mv.onclick = () => confirmMove(app.selected);
        const ch = $('[data-challenge]', root);
        if (ch) ch.onclick = () => challenge(M.bossOf(app.selected.realm, app.selected.tier, app.selected.node));
    }
    function select(realm, tier, node) {
        app.selected = { realm, tier, node };
        renderSheet(false);
    }

    /* A · the band, enlarged and freely scrollable. */
    const BIG = { idle: 44, boss: 56, gap: 6, secGap: 18, gate: 72, tierGate: 88, pad: 6 };
    function sheetA(sh) {
        const s = app.state, sel = app.selected, L = bandLayout(BIG);
        const keepScroll = $('.big-band', sh) ? $('.big-band', sh).scrollLeft : null;
        const sp = M.pairIndex(sel.realm, sel.tier);
        const last = Math.max(app.bigLast || 0, sp + 2, M.pairIndex(s.location.realm, s.location.tier) + 2);
        app.bigLast = last;
        let track = '';
        for (let p = 0; p <= last; p++) track += bigPair(p, L);
        const P = sel;
        const tierNow = sel.tier;
        sh.innerHTML = sheetHead('Route', 'Scroll the road. Tap a node to see it.') + `
            <div class="jump" role="group" aria-label="Jump to a realm">
                ${M.REALMS.map(r => `<button class="jump-chip ${r.id}${r.id === P.realm ? ' on' : ''}${M.unlocked(s, r.id, tierNow) ? '' : ' locked'}" data-jump="${r.id}" aria-label="${r.name} tier ${tierNow}${M.unlocked(s, r.id, tierNow) ? '' : ', locked'}">${img('shard-' + r.id, '', '')}<span>${r.name}</span></button>`).join('')}
                <span class="tier-step"><button data-tier="-1" aria-label="Previous tier" ${tierNow <= 1 ? 'disabled' : ''}>‹</button><b>T${tierNow}</b><button data-tier="1" aria-label="Next tier">›</button></span>
            </div>
            <div class="big-band" tabindex="-1"><div class="big-track" style="width:${L.endX(last) + 40}px">${track}</div></div>
            <div class="sheet-foot">${detailHtml()}<button class="ghost" data-here>Back to the mage</button></div>`;
        const band = $('.big-band', sh);
        const centerOn = (x, smooth) => band.scrollTo({ left: Math.max(0, x - band.clientWidth / 2), behavior: smooth && !app.reduced ? 'smooth' : 'auto' });
        if (keepScroll != null) band.scrollLeft = keepScroll;
        else centerOn(L.nodeX(sp, sel.node) + BIG.idle / 2, false);
        $$('[data-node]', sh).forEach(b => { b.onclick = () => { const [r, t, n] = b.dataset.node.split('-'); select(r, +t, +n); }; });
        $$('[data-jump]', sh).forEach(b => { b.onclick = () => { const p = M.pairIndex(b.dataset.jump, tierNow); app.selected = { realm: b.dataset.jump, tier: tierNow, node: 1 }; app.bigLast = Math.max(app.bigLast, p + 1); renderSheet(false); centerOn(L.gateX(p) + 160, true); }; });
        $$('[data-tier]', sh).forEach(b => { b.onclick = () => { const t = Math.max(1, tierNow + +b.dataset.tier); const p = M.pairIndex('fire', t); app.selected = { realm: 'fire', tier: t, node: 1 }; app.bigLast = Math.max(app.bigLast, p + 1); renderSheet(false); centerOn(L.gateX(p) + 160, true); }; });
        $('[data-here]', sh).onclick = () => { app.selected = Object.assign({}, s.location); renderSheet(false); centerOn(L.nodeX(M.pairIndex(s.location.realm, s.location.tier), s.location.node) + BIG.idle / 2, true); };
        // Forever: the road grows as the player scrolls towards its end.
        band.onscroll = () => {
            if (band.scrollLeft + band.clientWidth > L.endX(app.bigLast) - 600) {
                const left = band.scrollLeft;
                app.bigLast += 2;
                const t = $('.big-track', sh);
                let more = '';
                for (let p = app.bigLast - 1; p <= app.bigLast; p++) more += bigPair(p, L);
                t.insertAdjacentHTML('beforeend', more);
                t.style.width = (L.endX(app.bigLast) + 40) + 'px';
                $$('[data-node]', t).forEach(b => { b.onclick = () => { const [r, tt, n] = b.dataset.node.split('-'); select(r, +tt, +n); }; });
                band.scrollLeft = left;
            }
        };
        wireDetail(sh);
    }
    function bigPair(p, L) {
        const s = app.state, { realm, tier } = M.pairAt(p), open = M.unlocked(s, realm, tier);
        const op = M.openerOf(realm, tier);
        const opener = op ? M.bossOf(op.realm, op.tier, op.node) : null;
        let h = `<span class="band-seg big ${realm}${open ? '' : ' locked'}" style="left:${L.gateX(p)}px;width:${L.endX(p) - L.gateX(p)}px;background-image:linear-gradient(#0b0f1ad0,#0b0f1af0),url(assets/realm-${realm}.png)"></span>`;
        h += `<span class="big-gate ${realm}${p % 4 === 0 ? ' tier-gate' : ''}${open ? '' : ' locked'}" style="left:${L.gateX(p)}px;width:${L.gateW(p)}px;background-image:linear-gradient(#0000,#0b0f1acc),url(assets/realm-${realm}.png)">
            ${p % 4 === 0 ? `<em>TIER ${tier}</em>` : ''}${img('shard-' + realm, 'gate-icon', '')}<b>${realmName(realm).toUpperCase()}</b>${open ? '' : img('lock', 'gate-lock', '')}
            <small>${opener ? (open ? 'Opened' : 'Opens') + ' by ' + esc(opener.name.replace(/^The /, '')) : 'Start'}</small></span>`;
        M.REALM[realm].sections.forEach(([name, a]) => { h += `<span class="sec-label ${realm}" style="left:${L.nodeX(p, a)}px">${esc(name)}</span>`; });
        for (let n = 1; n <= 25; n++) {
            const st = M.nodeState(s, realm, tier, n), x = L.nodeX(p, n), w = L.nodeW(n);
            const on = same(app.selected, { realm, tier, node: n }) ? ' selected' : '';
            const here = same(s.location, { realm, tier, node: n });
            const inner = M.isBoss(n) ? bossTile(realm, tier, n, st, w - 6) : `<span>${n}</span>${here ? img('mage', 'tile-mage', '') : ''}`;
            h += `<button class="big-node ${realm} ${st}${M.isBoss(n) ? ' boss' : ''}${on}${here ? ' here' : ''}" data-node="${realm}-${tier}-${n}" style="left:${x}px;width:${w}px" aria-label="${esc(nodeAria(realm, tier, n))}"${on ? ' aria-current="true"' : ''}>${inner}</button>`;
        }
        if (p === 0) {
            const x1 = L.nodeX(0, 6) + BIG.boss / 2, x2 = L.gateX(1) + L.gateW(1) / 2;
            h += `<span class="bridge big${M.defeated(s, 'fire', 1, 6) ? ' opened' : ''}" style="left:${x1}px;width:${x2 - x1}px"><i class="bridge-from">${img('shard-ice', '', '')}</i><small>The Ember Watcher opens Ice</small></span>`;
        }
        return h;
    }

    /* B · the route map: a vertical metro line that forks in tier 1. */
    function sheetB(sh) {
        const s = app.state;
        const list = $('.metro', sh);
        const keep = list ? list.scrollTop : null;
        const last = Math.max(app.metroLast || 0, M.pairIndex(s.location.realm, s.location.tier) + 2, 4);
        app.metroLast = last;
        sh.innerHTML = sheetHead('Route map', 'The road forks once, at Fire node 6.') + `<div class="metro" tabindex="-1">${metroHtml(last)}</div><div class="sheet-foot">${detailHtml(true)}</div>`;
        const m = $('.metro', sh);
        if (keep != null) m.scrollTop = keep;
        else { const at = $('.metro-row.selected', m) || $('.metro-row.here', m); if (at) m.scrollTop = at.offsetTop - m.clientHeight / 2 + 24; }
        wireMetro(sh);
        m.onscroll = () => {
            if (m.scrollTop + m.clientHeight > m.scrollHeight - 400) {
                const top = m.scrollTop;
                app.metroLast += 2;
                m.insertAdjacentHTML('beforeend', metroPairs(app.metroLast - 1, app.metroLast));
                wireMetro(sh);
                m.scrollTop = top;
            }
        };
        wireDetail(sh);
    }
    function wireMetro(sh) { $$('[data-node]', sh).forEach(b => { b.onclick = () => { const [r, t, n] = b.dataset.node.split('-'); select(r, +t, +n); }; }); }
    function metroBanner(realm, tier, narrow) {
        const s = app.state, open = M.unlocked(s, realm, tier), op = M.openerOf(realm, tier);
        const b = op ? M.bossOf(op.realm, op.tier, op.node) : null;
        const sub = !op ? 'Where every mage starts' : (open ? 'Opened by ' : 'Opens with ') + b.name + ' · ' + realmName(op.realm) + ' ' + op.node;
        return `<div class="metro-banner ${realm}${open ? '' : ' locked'}${narrow ? ' narrow' : ''}${M.pairIndex(realm, tier) % 4 === 0 ? ' tier-gate' : ''}" style="background-image:linear-gradient(90deg,#0b0f1aee 30%,#0b0f1a55),url(assets/realm-${realm}.png)">
            ${img('shard-' + realm, '', '')}<div><b>${realmName(realm).toUpperCase()}${M.pairIndex(realm, tier) % 4 === 0 ? ` <em>TIER ${tier}</em>` : ` · T${tier}`}</b><small>${esc(sub)}</small></div>${open ? '' : img('lock', 'banner-lock', '')}</div>`;
    }
    function metroRows(realm, tier, from, to) {
        const s = app.state;
        let h = '';
        for (let n = from; n <= to; n++) {
            const sec = M.REALM[realm].sections.find(([, a]) => a === n);
            if (sec) h += `<div class="metro-sec ${realm}"><b>${esc(sec[0])}</b><small>${sec[1]}–${sec[2]}</small></div>`;
            const st = M.nodeState(s, realm, tier, n), d = M.describe(realm, tier, n);
            const here = same(s.location, { realm, tier, node: n }), on = same(app.selected, { realm, tier, node: n });
            const name = d.boss ? d.boss.name : d.monster.name;
            const tag = here ? 'Here' : st === 'frontier' ? 'Frontier' : st === 'waiting' || st === 'ready' ? 'Boss' : st === 'beaten' ? 'Defeated' : '';
            const lit = st !== 'locked' && st !== 'waiting' && st !== 'ready';
            h += `<button class="metro-row ${realm} ${st}${here ? ' here' : ''}${on ? ' selected' : ''}${d.boss ? ' boss' : ''}${lit ? ' lit' : ''}" data-node="${realm}-${tier}-${n}" aria-label="${esc(nodeAria(realm, tier, n))}"${on ? ' aria-current="true"' : ''}>
                <span class="rail">${d.boss ? bossTile(realm, tier, n, st, 34) : here ? img('mage', 'row-mage', '') : '<i></i>'}</span>
                <span class="row-n">${n}</span><span class="row-name">${esc(name)}</span>${tag ? `<span class="row-tag">${tag}</span>` : st === 'locked' ? img('lock', 'row-lock', '') : ''}</button>`;
        }
        return h;
    }
    function metroPairs(from, to) {
        let h = '';
        for (let p = from; p <= to; p++) {
            const { realm, tier } = M.pairAt(p);
            if (realm === 'ice' && tier === 1) continue;
            if (realm === 'fire' && tier === 1) {
                h += metroBanner('fire', 1) + `<div class="metro-col">${metroRows('fire', 1, 1, 6)}</div>`;
                h += `<div class="fork-note"><b>The road splits</b><small>The Ember Watcher opens Ice. Fire goes on to node 25.</small></div>
                    <div class="fork"><div class="metro-col">${metroBanner('ice', 1, true)}${metroRows('ice', 1, 1, 25)}</div>
                    <div class="metro-col branch">${metroBanner('fire', 1, true).replace('Where every mage starts', 'Fire goes on')}${metroRows('fire', 1, 7, 25)}<div class="metro-end">End of Fire tier 1</div></div></div>`;
                continue;
            }
            h += metroBanner(realm, tier) + `<div class="metro-col">${metroRows(realm, tier, 1, 25)}</div>`;
        }
        return h;
    }
    function metroHtml(last) { return metroPairs(0, last); }

    /* C · realm cards, one per realm and tier, paged sideways without end. */
    function sheetC(sh) {
        const s = app.state, sel = app.selected;
        const pager = $('.pager', sh);
        const keep = pager ? pager.scrollLeft : null;
        const last = Math.max(app.cardLast || 0, app.cardIndex + 2, M.pairIndex(s.location.realm, s.location.tier) + 2);
        app.cardLast = last;
        const { realm, tier } = M.pairAt(app.cardIndex);
        sh.innerHTML = `<div class="sheet-head pager-head"><button class="icon-button" data-page="-1" aria-label="Previous realm" ${app.cardIndex <= 0 ? 'disabled' : ''}>${img('chrome-icon-back', '', '')}</button>
            <div><h2>${realmName(realm)} · Tier ${tier}</h2><p>${pagerSub(realm, tier)}</p></div>
            <button class="icon-button" data-page="1" aria-label="Next realm">${img('chrome-icon-back', 'flip', '')}</button>
            <button class="icon-button close" data-close aria-label="Close the route">${img('chrome-icon-close', '', '')}</button></div>
            <div class="pager" tabindex="-1">${Array.from({ length: last + 1 }, (_, p) => realmCard(p)).join('')}</div>
            <div class="sheet-foot">${detailHtml(true)}<button class="ghost" data-map>${img('shard-' + sel.realm, '', '')}Realm map</button></div>`;
        const pg = $('.pager', sh);
        const cardW = () => $('.rcard', pg).offsetWidth + 12;
        if (keep != null) pg.scrollLeft = keep; else pg.scrollLeft = app.cardIndex * cardW();
        const goTo = (i, smooth) => { app.cardIndex = Math.max(0, i); pg.scrollTo({ left: app.cardIndex * cardW(), behavior: smooth && !app.reduced ? 'smooth' : 'auto' }); };
        $$('[data-page]', sh).forEach(b => { b.onclick = () => { const i = app.cardIndex + +b.dataset.page; if (i > app.cardLast - 1) { app.cardLast = i + 2; } app.cardIndex = i; renderSheet(false); goTo(i, true); }; });
        $$('[data-node]', sh).forEach(b => { b.onclick = () => { const [r, t, n] = b.dataset.node.split('-'); app.cardIndex = M.pairIndex(r, +t); select(r, +t, +n); }; });
        $('[data-map]', sh).onclick = () => announce('The realm map opens here: the full overview of realms and tiers.', true);
        let settle;
        pg.onscroll = () => {
            clearTimeout(settle);
            settle = setTimeout(() => {
                const i = Math.round(pg.scrollLeft / cardW());
                if (i !== app.cardIndex) {
                    app.cardIndex = i;
                    if (i >= app.cardLast - 1) app.cardLast = i + 2;
                    const { realm: r, tier: t } = M.pairAt(i);
                    $('.pager-head h2', sh).textContent = realmName(r) + ' · Tier ' + t;
                    $('.pager-head p', sh).textContent = pagerSub(r, t);
                    $('[data-page="-1"]', sh).disabled = i <= 0;
                    if (i >= app.cardLast - 2) { app.cardLast += 2; pg.insertAdjacentHTML('beforeend', realmCard(app.cardLast - 1) + realmCard(app.cardLast)); $$('[data-node]', pg).forEach(b => { b.onclick = () => { const [rr, tt, nn] = b.dataset.node.split('-'); app.cardIndex = M.pairIndex(rr, +tt); select(rr, +tt, +nn); }; }); }
                }
            }, 120);
        };
        wireDetail(sh);
    }
    function pagerSub(realm, tier) {
        const op = M.openerOf(realm, tier), s = app.state;
        if (!op) return 'The start of the road';
        const b = M.bossOf(op.realm, op.tier, op.node);
        return (M.unlocked(s, realm, tier) ? 'Opened by ' : 'Opens with ') + b.name + ' (' + realmName(op.realm) + ' T' + op.tier + ' · ' + op.node + ')';
    }
    function realmCard(p) {
        const s = app.state, { realm, tier } = M.pairAt(p), open = M.unlocked(s, realm, tier);
        const f = s.frontiers[M.key(realm, tier)] || 0;
        let rows = '';
        M.REALM[realm].sections.forEach(([name, a, b]) => {
            let tiles = '';
            for (let n = a; n <= b; n++) {
                const st = M.nodeState(s, realm, tier, n), here = same(s.location, { realm, tier, node: n }), on = same(app.selected, { realm, tier, node: n });
                const opensIce = realm === 'fire' && tier === 1 && n === 6;
                tiles += `<button class="tile ${realm} ${st}${M.isBoss(n) ? ' boss' : ''}${here ? ' here' : ''}${on ? ' selected' : ''}" data-node="${realm}-${tier}-${n}" aria-label="${esc(nodeAria(realm, tier, n))}${opensIce ? ', opens Ice tier 1' : ''}"${on ? ' aria-current="true"' : ''}>
                    ${M.isBoss(n) ? bossTile(realm, tier, n, st, 38) : `<span>${n}</span>`}${here ? img('mage', 'tile-mage', '') : ''}${opensIce ? `<i class="opens">${img('shard-ice', '', '')}</i>` : ''}</button>`;
            }
            rows += `<div class="sec-row"><div class="sec-head"><b>${esc(name)}</b><small>${a}–${b} · ${countDone(realm, tier, a, b)}/${b - a + 1}</small></div><div class="tiles">${tiles}</div></div>`;
        });
        return `<article class="rcard ${realm}${open ? '' : ' locked'}" aria-label="${pairLabel(realm, tier)}">
            <div class="rcard-banner" style="background-image:linear-gradient(90deg,#0b0f1aee 25%,#0b0f1a44),url(assets/realm-${realm}.png)">${img('shard-' + realm, '', '')}<div><b>${realmName(realm).toUpperCase()} · TIER ${tier}</b><small>${open ? (f ? 'Frontier node ' + f : '') : 'Locked'}</small></div>${open ? '' : img('lock', 'banner-lock', '')}</div>
            ${rows}</article>`;
    }

    /* ---------- Moves, kills and bosses ---------- */

    function confirmMove(target) {
        const s = app.state, d = M.describe(target.realm, target.tier, target.node);
        const f = s.frontiers[M.key(target.realm, target.tier)];
        const behind = target.node < f;
        showDialog(`<h2>Move the mage?</h2>
            <p class="dlg-place">${img('shard-' + target.realm, '', '')}<span><b>${realmName(target.realm)} · Tier ${target.tier} · Node ${target.node}</b><small>${esc(d.section)} · ${esc(d.monster.name)}</small></span></p>
            <p>${behind ? `Your frontier stays at node ${f}. Idle farms this node and does not move on until you return.` : 'Idle moves on from here, one node per kill.'}</p>
            <div class="dlg-actions"><button class="ghost" data-cancel>Cancel</button><button class="cta" data-ok>Move</button></div>`,
        () => {
            app.state = M.move(app.state, target.realm, target.tier, target.node);
            app.hp = 1;
            closeSheet();
            renderTimeline(true);
            renderScene();
            announce('Moved to ' + M.placeName(target.realm, target.tier, target.node) + '.', true);
            refreshReview();
        });
    }
    function challenge(boss) {
        showDialog(`<h2>${esc(boss.name)}</h2>
            <p class="dlg-place">${img(boss.art, '', '')}<span><b>${realmName(boss.realm)} · Tier ${boss.tier} · Node ${boss.node}</b><small>${boss.guardian ? 'Realm guardian' : 'Boss'}</small></span></p>
            <p>In the game this opens the boss preparation. The prototype only simulates the result.</p>
            <div class="dlg-actions"><button class="ghost" data-cancel>Cancel</button><button class="cta" data-ok>Win (demo)</button></div>`,
        () => {
            if (app.open) closeSheet();
            if (!M.waitingBoss(app.state)) {
                // A boss that is ready but not yet reached: the demo walks the mage to the frontier first.
                const k = M.key(boss.realm, boss.tier);
                app.state = M.move(app.state, boss.realm, boss.tier, app.state.frontiers[k]);
            }
            win();
        });
    }
    function showDialog(html, ok) {
        const layer = $('#dialog');
        layer.hidden = false;
        layer.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-label="Confirm">${html}</div>`;
        const close = () => { layer.hidden = true; layer.innerHTML = ''; app.dialog = null; };
        $('[data-cancel]', layer).onclick = () => { close(); announce('Cancelled.'); };
        $('[data-ok]', layer).onclick = () => { close(); ok(); };
        app.dialog = layer;
        $('[data-ok]', layer).focus();
    }

    function kill() {
        const r = M.kill(app.state);
        app.state = r.state;
        app.hp = 1;
        if (r.event.type === 'advance') {
            renderTimeline(true);
            announce('Node ' + r.event.to + ' reached.');
        } else if (r.event.type === 'boss-gate') {
            renderTimeline(false);
            announce(r.event.boss.name + ' waits at node ' + r.event.boss.node + '.');
        }
        renderScene();
        if (app.open) renderSheet(false);
        refreshReview();
        return r.event;
    }
    function win() {
        const boss = M.waitingBoss(app.state);
        if (!boss) { announce('No boss waits right now.', true); return null; }
        const r = M.winBoss(app.state);
        app.state = r.state;
        app.hp = 1;
        if (app.open) closeSheet();
        renderTimeline(true);
        renderScene();
        announce(boss.name + ' defeated.' + (r.event.opens.length ? ' ' + r.event.opens.map(o => pairLabel(o.realm, o.tier)).join(', ') + ' opened.' : ''), true);
        refreshReview();
        return r.event;
    }

    /* Auto-farm: the monster's HP drains and a kill moves the timeline. */
    let lastTick = performance.now();
    function tick(now) {
        const dt = Math.min(100, now - lastTick);
        lastTick = now;
        if (app.auto && !app.dialog) {
            app.hp -= dt / 2600;
            if (app.hp <= 0) {
                const m = $('.monster-art img');
                if (m && !app.reduced) m.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.6)', opacity: 0 }], { duration: 220 });
                kill();
            }
            $('.hpbar i').style.width = Math.max(0, app.hp * 100) + '%';
        }
        requestAnimationFrame(tick);
    }

    /* ---------- Review chrome ---------- */

    const NOTES = {
        A: { name: 'A · Band', lines: [
            ['Hopfällt', 'En jämn remsa med lika stora noder i spelets realmordning. Bandets färg byter vid varje realm, och nästa realm ligger fast i kanten med vad som öppnar den tills dess port syns.'],
            ['P-01', 'Ice ligger efter Fire 25 som i realmordningen. En streckad bro från Eld-bossen på nod 6 går över Fire 7–25 till Is-porten och säger rakt ut att den öppnar Ice.'],
            ['Realm map', 'Ersätter. Öppet läge är hela vägen i stor skala med hopp till realm och tier.'],
            ['Risk', 'Bron är lång och syns bara nära nod 6 och Is-porten; mitt emellan visar bara kanten att Ice redan är öppen.']] },
        B: { name: 'B · Rail', lines: [
            ['Hopfällt', 'En tunnelbanelinje i upplåsningsordning. Magiker-token glider längs linjen, den tända delen är avklarad och realmporten byter färg på linjen.'],
            ['P-01', 'Linjen grenar sig vid Fire 6: Ice tar huvudspåret och Fire 7–25 blir ett sidospår ovanför som slutar efter Ember Sentinel. Från tier 2 är linjen rak.'],
            ['Realm map', 'Öppnar. Ett tryck öppnar realm map, som blir en lodrät linjekarta med förgreningen i två spalter.'],
            ['Risk', 'Två spår kräver lite mer höjd (70 px mot 62 px) och två spalter i kartan blir smala på 360 px.']] },
        C: { name: 'C · Lens', lines: [
            ['Hopfällt', 'Nuvarande avsnitt i full storlek, övriga avsnitt som brickor med framsteg, och nästa realms och tiers som ikoner som fortsätter utan slut. Avsnittsbytet morfar.'],
            ['P-01', 'En linje per realm. Ice börjar med brickan "Fire T1 · 6 opened Ice", Fire T1 slutar med END, och så länge båda är ofärdiga växlar en knapp till den andra linjen.'],
            ['Realm map', 'Kompletterar. Öppet läge visar ett realmkort per realm och tier (bläddra i sidled); realm map finns kvar för helheten.'],
            ['Risk', 'Avlägsna noder syns inte, bara avsnitt och realms; avståndet till nästa realm läses som brickor, inte som noder.']] }
    };
    function refreshReview() {
        $$('[data-variant]').forEach(b => b.setAttribute('aria-current', b.dataset.variant === app.variant));
        $$('[data-scene]').forEach(b => b.setAttribute('aria-current', b.dataset.scene === app.scenario));
        $$('[data-demo="auto"]').forEach(b => b.setAttribute('aria-pressed', app.auto));
        $$('[data-demo="reduced"]').forEach(b => b.setAttribute('aria-pressed', app.reduced));
        phone.classList.toggle('reduced', app.reduced);
        const n = NOTES[app.variant];
        $('#variant-notes').innerHTML = `<h3>${n.name}</h3><dl>${n.lines.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
            <p class="fine">Träffytor minst 44 pt, skärmläsaretiketter på tidslinjen, noderna och dialogerna, och reducerad rörelse (systeminställningen eller knappen) tar bort glidningar och pulser utan att ta bort någon information.</p>`;
    }
    function setVariant(v) {
        app.variant = v;
        app.lastTx = null;
        if (app.open) { app.open = false; $('#sheet').hidden = true; }
        renderTimeline(false);
        refreshReview();
        syncUrl();
    }
    function setScenario(key) {
        app.scenario = key;
        app.state = M.createState(M.SCENARIOS[key].state);
        app.hp = 1;
        app.lastTx = null;
        app.bigLast = app.metroLast = app.cardLast = 0;
        if (app.open) { app.open = false; $('#sheet').hidden = true; }
        renderTimeline(false);
        renderScene();
        refreshReview();
        syncUrl();
    }
    function syncUrl() {
        const u = new URL(location.href);
        u.searchParams.set('variant', app.variant);
        u.searchParams.set('scene', app.scenario);
        history.replaceState(null, '', u);
    }
    function demo(action) {
        if (action === 'kill') kill();
        else if (action === 'win') win();
        else if (action === 'open') app.open ? closeSheet() : openSheet();
        else if (action === 'auto') { app.auto = !app.auto; refreshReview(); }
        else if (action === 'reduced') { app.reduced = !app.reduced; refreshReview(); }
        else if (action === 'menu') {
            const menu = $('.dock-menu'), b = $('[data-demo="menu"]');
            menu.hidden = !menu.hidden;
            b.setAttribute('aria-expanded', !menu.hidden);
        }
    }

    function init() {
        renderShell();
        const scenarioButtons = Object.entries(M.SCENARIOS).map(([k, v]) => `<button data-scene="${k}">${esc(v.label)}</button>`).join('');
        $('#scenarios').innerHTML = scenarioButtons;
        $('.dock-menu').innerHTML = scenarioButtons + `<button data-demo="open">Öppna / stäng</button><button data-demo="auto" aria-pressed="false">Auto-farm</button><button data-demo="reduced" aria-pressed="false">Reducerad rörelse</button>`;
        document.addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.matches('.tl-open')) { app.open ? closeSheet() : openSheet(); return; }
            if (b.matches('.tl-boss, #timeline .hit')) { challenge(M.waitingBoss(app.state)); return; }
            if (b.matches('.tl-switch')) { const r = [...b.classList].find(c => M.REALM[c]); openSheet({ realm: r, tier: 1, node: app.state.frontiers[M.key(r, 1)] }); return; }
            if (b.dataset.variant && !phone.contains(b)) setVariant(b.dataset.variant);
            else if (b.dataset.scene) { setScenario(b.dataset.scene); if (b.closest('.dock-menu')) demo('menu'); }
            else if (b.dataset.demo && !phone.contains(b)) demo(b.dataset.demo);
        });
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            if (app.dialog) $('[data-cancel]', app.dialog).click(); else if (app.open) closeSheet();
        });
        matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => { app.reduced = e.matches; refreshReview(); });
        window.addEventListener('resize', () => renderTimeline(false));
        renderTimeline(false);
        renderScene();
        refreshReview();
        if (app.open) {
            const sel = q.get('select');
            const [r, t, n] = sel ? sel.split('-') : [];
            openSheet(sel ? { realm: r, tier: +t, node: +n } : null);
        }
        if (q.get('confirm') === '1' && app.open) { const mv = $('[data-move]'); if (mv) mv.click(); }
        requestAnimationFrame(tick);
    }

    window.timelineProto = {
        get state() { return app.state; }, get app() { return app; }, model: M,
        kill, win, setVariant, setScenario, openSheet, closeSheet, select, demo,
        setReduced(v) { app.reduced = v; refreshReview(); }, setAuto(v) { app.auto = v; refreshReview(); }
    };
    init();
})();
