/* Circles prototype (#418): four questions ADR 0016 leaves to a prototype, each with variants to choose between.
 * Q1 Loadouts with 1–8 mage slots and the familiar's slot: A · Grid, B · Ring.
 * Q2 The boss's spell row with up to eight buttons and the familiar's marker: A · Two rows, B · Arc.
 * Q3 The idle scene with up to eight orbs and the familiar beside the mage.
 * Q4 How the circle shows round crest: A · Rune ring, B · Numeral arc; with the glow, the Ascend view and the ceremony. */
(function () {
    'use strict';
    const C = globalThis.SpellcraftCircles;
    const q = new URLSearchParams(location.search);
    const $ = (sel, el) => (el || document).querySelector(sel);
    const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const img = (name, cls, alt) => `<img class="${cls || ''}" src="assets/${name}.png" alt="${esc(alt || '')}" draggable="false">`;
    const fmt = n => n.toLocaleString('en-US');
    const SCREENS = [
        ['loadouts-idle', 'Loadouts · Idle build'],
        ['loadouts-boss', 'Loadouts · Boss build'],
        ['boss', 'Bossens strid'],
        ['idle', 'Idle-scenen'],
        ['ascend', 'Crest · Ascend-vyn']
    ];
    const VARIANTS = {
        q1: { title: 'Fråga 1 · Loadouts', options: { A: 'Rutnät', B: 'Ring' } },
        q2: { title: 'Fråga 2 · Bossens spellrad', options: { A: 'Två rader', B: 'Båge' } },
        q4: { title: 'Fråga 4 · Circlen runt crest', options: { A: 'Runring', B: 'Siffra och båge' } }
    };
    const pick = (key, values, fallback) => (values.includes(q.get(key)) ? q.get(key) : fallback);

    const app = {
        screen: pick('screen', SCREENS.map(s => s[0]), 'loadouts-idle'),
        circle: Math.min(8, Math.max(1, parseInt(q.get('circle') || '4', 10) || 4)),
        familiar: q.get('familiar') !== '0',
        ready: q.get('ready') === '1',
        reduced: q.get('reduced') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches,
        q1: pick('q1', ['A', 'B'], 'A'),
        q2: pick('q2', ['A', 'B'], 'A'),
        q4: pick('q4', ['A', 'B'], 'A'),
        picker: null,
        highlight: null,
        ceremony: null,
        clock: 0
    };
    app.state = C.createState(app.circle, app.familiar);
    if (app.ready) app.state.magePower = C.threshold(Math.min(8, app.circle + 1)) + 40;

    const phone = $('#phone');
    if (q.get('chrome') === '0') document.documentElement.classList.add('bare');

    /* ---------- Shared pieces ---------- */

    function spellImg(id, cls) {
        return id ? img('spell-' + id, cls || 'spell', C.SPELL[id].name) : '';
    }

    /** Crest with the circle round it: A · eight rune dots on a ring, B · a segmented arc and the circle's numeral. */
    function crestHtml(size) {
        const s = app.state, ready = C.canAscend(s), big = size === 'big';
        let ring = '';
        if (app.q4 === 'A') {
            for (let i = 0; i < C.MAX_CIRCLES; i++) {
                const a = (-90 + (i * 360) / C.MAX_CIRCLES) * Math.PI / 180;
                const lit = i < s.circle, next = ready && i === s.circle, fresh = big && app.ceremony && i === s.circle - 1;
                ring += `<i class="rune${lit ? ' lit' : ''}${next ? ' next' : ''}${fresh ? ' fresh' : ''}" style="left:${50 + 44 * Math.cos(a)}%;top:${50 + 44 * Math.sin(a)}%"></i>`;
            }
        } else {
            const parts = [];
            for (let i = 0; i < C.MAX_CIRCLES; i++) {
                const from = i * 45 + 5, to = (i + 1) * 45 - 5;
                const color = big && app.ceremony && i === s.circle - 1 ? 'var(--new-seg, var(--gold))' : i < s.circle ? 'var(--gold)' : ready && i === s.circle ? 'rgba(255,211,107,.45)' : 'rgba(255,255,255,.12)';
                parts.push(`${color} ${from}deg ${to}deg`, `transparent ${to}deg ${(i + 1) * 45 + 5}deg`);
            }
            ring = `<i class="arc" style="background:conic-gradient(${parts.join(',')})"></i><b class="numeral">${C.roman(s.circle)}</b>`;
        }
        return `<span class="crest crest-${app.q4}${ready ? ' ready' : ''}${big ? ' big' : ''}">${ring}${img('crest', 'crest-img', '')}${ready && !big ? '<em class="ready-dot"></em>' : ''}</span>`;
    }

    function header() {
        return `<header class="hud">
            <div class="hud-row">
                <button class="crest-button" data-action="open-ascend" aria-label="Circle ${app.state.circle}${C.canAscend(app.state) ? ', ready to ascend' : ''}">${crestHtml()}</button>
                <div class="power"><small>MAGE POWER</small><b>${fmt(app.state.magePower)}</b></div>
                <div class="stats">
                    <span>${img('hp', 'stat-icon', '')}<b>100</b><small>HP</small></span>
                    <span>${img('spell-power', 'stat-icon', '')}<b>24</b><small>Spell power</small></span>
                </div>
                <button class="icon-button settings" aria-label="Settings">${img('settings', '', '')}</button>
            </div>
            <div class="currencies">${[['shard-fire', '263'], ['shard-ice', '41'], ['shard-earth', '0'], ['shard-wind', '0'], ['gold', '20']]
                .map(([i, n]) => `<span class="chip">${img(i, '', '')}<b>${n}</b></span>`).join('')}</div>
        </header>`;
    }

    /** The familiar until the PO's image exists: a tinted ember orb with eyes (ADR 0016, Bilder). */
    function familiarFigure(cls) {
        return `<span class="wisp${cls ? ' wisp-' + cls : ''}" role="img" aria-label="${C.FAMILIAR.name}"><i class="wisp-eye l"></i><i class="wisp-eye r"></i></span>`;
    }

    /* ---------- Q1 · Loadouts ---------- */

    function loadoutsScreen(build) {
        const s = app.state;
        const body = app.q1 === 'A' ? loadoutGrid(build) : loadoutRing(build);
        return header() + `<section class="feature">
            <div class="feature-head"><h1>Loadouts</h1><span class="circle-tag">Circle ${s.circle} · ${s.circle} ${s.circle === 1 ? 'slot' : 'slots'}</span><button class="icon-button" aria-label="Close">${img('chrome-icon-close', '', '')}</button></div>
            <div class="tabs" role="tablist">
                <button class="tab${build === 'idle' ? ' on' : ''}" role="tab" aria-selected="${build === 'idle'}" data-screen="loadouts-idle">Idle build</button>
                <button class="tab${build === 'boss' ? ' on' : ''}" role="tab" aria-selected="${build === 'boss'}" data-screen="loadouts-boss">Boss build</button>
            </div>
            <p class="hint">${build === 'idle' ? 'Idle casts every equipped spell automatically.' : 'AUTO casts on cooldown; TAP waits for you.'}</p>
            <div class="loadout-body variant-${app.q1}">${body}</div>
        </section>`;
    }

    function slotTile(build, i, size) {
        const id = app.state[build][i];
        const fresh = app.highlight === i;
        return `<button class="slot${id ? '' : ' empty'}${fresh ? ' fresh' : ''}" style="--s:${size}px" data-slot="${build}:${i}" aria-label="${build === 'idle' ? 'Idle' : 'Boss'} slot ${i + 1}, ${id ? C.SPELL[id].name : 'empty'}${fresh ? ', new' : ''}">
            ${id ? spellImg(id) : img('slot-empty', 'spell', '')}<small>${i + 1}</small>${fresh ? '<em class="new-tag">NEW</em>' : ''}</button>`;
    }

    function autocastButton(i) {
        const on = app.state.autocast[i];
        return `<button class="auto${on ? ' on' : ''}" data-autocast="${i}" aria-pressed="${on}" aria-label="Slot ${i + 1} autocast ${on ? 'on' : 'off'}">${on ? 'AUTO' : 'TAP'}</button>`;
    }

    function lockedTile(size) {
        const next = app.state.circle + 1;
        return `<div class="slot locked" style="--s:${size}px" role="img" aria-label="Slot ${next}, opens at Circle ${next} with ${fmt(C.threshold(next))} Mage Power">${img('lock', 'lock', '')}<b>Circle ${next}</b><small>${fmt(C.threshold(next))} MP</small></div>`;
    }

    function familiarCard(build) {
        const f = app.state.familiar;
        if (!f.id) return `<div class="familiar-card none"><span class="wisp-slot ghost"></span><div><b>No familiar yet</b><small>Your first familiar comes with the Ember Watcher.</small></div></div>`;
        return `<div class="familiar-card">
            ${familiarFigure('card')}
            <div class="familiar-text"><small>FAMILIAR · BOTH BUILDS</small><b>${C.FAMILIAR.name}</b><span>${build === 'boss' ? 'Always AUTO · ' : ''}Casts on its own</span></div>
            <button class="slot familiar-slot${f.spell ? '' : ' empty'}" style="--s:56px" data-slot="familiar" aria-label="Familiar slot, ${f.spell ? C.SPELL[f.spell].name : 'empty'}">${f.spell ? spellImg(f.spell) : img('slot-empty', 'spell', '')}</button>
        </div>`;
    }

    function loadoutGrid(build) {
        const s = app.state, cells = [];
        for (let i = 0; i < s.circle; i++) cells.push(`<div class="cell">${slotTile(build, i, 60)}${build === 'boss' ? autocastButton(i) : ''}</div>`);
        if (s.circle < C.MAX_CIRCLES) cells.push(`<div class="cell">${lockedTile(60)}${build === 'boss' ? '<span class="auto ghost"></span>' : ''}</div>`);
        return `<div class="slot-grid${build === 'boss' ? ' boss' : ''}">${cells.join('')}</div>${familiarCard(build)}`;
    }

    function loadoutRing(build) {
        const s = app.state, f = s.familiar;
        let ring = '';
        for (let i = 0; i < C.MAX_CIRCLES; i++) {
            const a = (-90 + i * 45) * Math.PI / 180;
            const pos = `left:${50 + 39 * Math.cos(a)}%;top:${50 + 39 * Math.sin(a)}%`;
            if (i < s.circle) {
                ring += `<div class="ring-cell" style="${pos}">${slotTile(build, i, 52)}${build === 'boss' ? `<span class="auto-badge${s.autocast[i] ? ' on' : ''}">${s.autocast[i] ? 'AUTO' : 'TAP'}</span>` : ''}</div>`;
            } else if (i === s.circle) {
                ring += `<div class="ring-cell" style="${pos}">${lockedTile(52)}</div>`;
            } else {
                ring += `<i class="ring-socket" style="${pos}"></i>`;
            }
        }
        const centre = f.id
            ? `<div class="ring-centre">${familiarFigure('ring')}<button class="slot familiar-slot${f.spell ? '' : ' empty'}" style="--s:52px" data-slot="familiar" aria-label="Familiar slot, ${f.spell ? C.SPELL[f.spell].name : 'empty'}">${f.spell ? spellImg(f.spell) : img('slot-empty', 'spell', '')}</button><small>${C.FAMILIAR.name}${build === 'boss' ? ' · AUTO' : ''}</small></div>`
            : `<div class="ring-centre"><span class="wisp-slot ghost"></span><small>No familiar yet</small></div>`;
        return `<div class="slot-ring"><i class="ring-line"></i>${ring}${centre}</div>`;
    }

    /* The picker: every owned spell, with where it sits now; choosing one moves it (one place per spell). */
    function pickerHtml() {
        const p = app.picker, s = app.state;
        const target = p.slot === 'familiar' ? 'the familiar' : `${p.build === 'idle' ? 'idle' : 'boss'} slot ${p.slot + 1}`;
        const rows = C.SPELLS.map(spell => {
            const place = placeTag(spell.id);
            const current = p.slot === 'familiar' ? s.familiar.spell === spell.id : s[p.build][p.slot] === spell.id;
            return `<button class="pick${current ? ' current' : ''}" data-pick="${spell.id}" aria-label="${spell.name}${place ? ', ' + place : ''}${current ? ', selected' : ''}">${spellImg(spell.id, 'pick-icon')}<span><b>${spell.name}</b>${place ? `<em class="${place === 'On the familiar' ? 'fam' : ''}">${place}</em>` : `<small>${spell.damage} damage · ${spell.cooldownMs / 1000} s</small>`}</span></button>`;
        }).join('');
        const auto = p.build === 'boss' && p.slot !== 'familiar' && app.q1 === 'B'
            ? `<button class="pick-auto" data-autocast="${p.slot}" aria-pressed="${s.autocast[p.slot]}">Autocast: ${s.autocast[p.slot] ? 'on' : 'off'}</button>` : '';
        return `<div class="sheet" role="dialog" aria-label="Choose a spell for ${target}">
            <div class="sheet-head"><div><small>CHOOSE A SPELL</small><h2>${p.slot === 'familiar' ? C.FAMILIAR.name : (p.build === 'idle' ? 'Idle' : 'Boss') + ' slot ' + (p.slot + 1)}</h2></div><button class="icon-button" data-action="close-picker" aria-label="Close">${img('chrome-icon-close', '', '')}</button></div>
            <p class="sheet-note">A spell sits with the mage or the familiar, never both.</p>
            ${auto}<div class="pick-list">${rows}<button class="pick clear" data-pick="" aria-label="Empty the slot">${img('slot-empty', 'pick-icon', '')}<span><b>Empty slot</b></span></button></div></div>`;
    }

    function placeTag(id) {
        const s = app.state;
        if (s.familiar.spell === id) return 'On the familiar';
        const idle = s.idle.indexOf(id), boss = s.boss.indexOf(id);
        if (idle >= 0 && boss >= 0) return `Idle ${idle + 1} · Boss ${boss + 1}`;
        if (idle >= 0) return `Idle ${idle + 1}`;
        if (boss >= 0) return `Boss ${boss + 1}`;
        return '';
    }

    /* ---------- Q2 · The boss's spell row ---------- */

    function bossScreen() {
        const s = app.state, f = s.familiar;
        // B · the arc: a half crown round the familiar, spaced so neighbouring 48-point buttons never touch.
        const n = s.boss.length, r = n < 2 ? 76 : Math.max(76, Math.round(31 / Math.sin(Math.PI / 2 / (n - 1))));
        const arcPos = i => {
            const a = n === 1 ? 0 : -Math.PI / 2 + (i * Math.PI) / (n - 1);
            return `style="left:calc(50% + ${(Math.sin(a) * r).toFixed(1)}px);top:${(30 + r - Math.cos(a) * r).toFixed(1)}px"`;
        };
        const buttons = s.boss.map((id, i) => {
            const spell = id && C.SPELL[id];
            const breaks = spell && spell.breaks;
            return `<button class="cast${id ? '' : ' empty'}${breaks ? ' breaks' : ''}${s.autocast[i] ? '' : ' manual'}" data-cast="${i}" ${app.q2 === 'B' ? arcPos(i) : ''} aria-label="${id ? spell.name : 'Empty slot'}${breaks ? ', breaks the ward' : ''}${s.autocast[i] ? ', autocast' : ''}" ${id ? '' : 'disabled'}>
                ${id ? spellImg(id) : img('slot-empty', 'spell', '')}<i class="sweep" data-sweep="${i}"></i>${breaks ? '<em class="breaks-tag">BREAKS</em>' : ''}<small>${s.autocast[i] ? 'AUTO' : i + 1}</small></button>`;
        }).join('');
        const fs = f.spell && C.SPELL[f.spell];
        const marker = f.id
            ? `<div class="familiar-marker${fs && fs.breaks ? ' breaks' : ''}" ${app.q2 === 'B' ? `style="top:${30 + r}px"` : ''} role="img" aria-label="${C.FAMILIAR.name} casts ${fs ? fs.name : 'nothing'}, always automatic">${familiarFigure('marker')}${fs ? spellImg(f.spell, 'marker-spell') : ''}<i class="sweep" data-sweep="familiar"></i>${fs && fs.breaks ? '<em class="breaks-tag">BREAKS</em>' : ''}<small>AUTO</small></div>` : '';
        const row = app.q2 === 'A' ? `<div class="cast-rows n${s.circle}">${buttons}</div>${marker}` : `<div class="cast-arc n${s.circle}" style="height:${r + 30 + 46}px">${buttons}${marker}</div>`;
        return `<section class="fight">
            <div class="fight-hud">
                <div class="fight-title"><b>The Cinder Warden</b><span><b>0:48</b></span></div>
                <div class="bar boss-bar"><i style="width:72%"></i><u style="width:46%"></u></div>
                <div class="fight-sub"><span>Cinder Ward 184 / 400</span><em class="chip-breaks">AREA BREAKS</em></div>
                <div class="bar mage-bar">${img('hp', 'bar-icon', '')}<i style="width:92%"></i><span>92 / 100</span></div>
            </div>
            <div class="arena">
                <div class="arena-bg"></div>
                <div class="boss-spot">${img('boss-cinder-warden', 'boss-img', '')}<i class="ward-ring"></i></div>
                <div class="fighters">${img('mage', 'mage', '')}${f.id ? familiarFigure('arena') : ''}</div>
                <p class="arena-hint">Drag to move · Avoid the mark</p>
            </div>
            <div class="cast-dock variant-${app.q2}">${row}</div>
            <button class="leave">Leave attempt</button>
        </section>`;
    }

    /* ---------- Q3 · The idle scene ---------- */

    function idleScreen(withAscend) {
        const s = app.state, f = s.familiar;
        const spells = s.idle.filter(Boolean);
        const orbs = spells.map((id, i) => {
            const n = spells.length;
            const span = Math.min(144, (n - 1) * 26), a = n === 1 ? -90 : -90 - span / 2 + (i * span) / (n - 1);
            const r = 64;
            return `<span class="orb ${C.SPELL[id].element}" data-orb="${i}" style="left:calc(50% + ${(Math.cos(a * Math.PI / 180) * r).toFixed(1)}px);top:${(84 + Math.sin(a * Math.PI / 180) * r * 0.82).toFixed(1)}px"><i class="orb-ring" data-sweep="orb${i}"></i></span>`;
        }).join('');
        const famOrb = f.id && f.spell ? `<span class="orb ${C.SPELL[f.spell].element} fam-orb"><i class="orb-ring" data-sweep="familiar-orb"></i></span>` : '';
        const slots = s.idle.map((id, i) => `<button class="mini-slot${id ? '' : ' empty'}" data-slot="idle:${i}" aria-label="Idle slot ${i + 1}, ${id ? C.SPELL[id].name : 'empty'}">${id ? spellImg(id) : img('slot-empty', 'spell', '')}<small>${i + 1}</small></button>`).join('');
        const famSlot = f.id ? `<button class="mini-slot fam" data-slot="familiar" aria-label="Familiar slot, ${f.spell ? C.SPELL[f.spell].name : 'empty'}">${f.spell ? spellImg(f.spell) : img('slot-empty', 'spell', '')}${familiarFigure('badge')}</button>` : '';
        return header() + bandHtml() + `
            <section class="scene">
                <div class="scene-bg"></div><span class="idle-badge">IDLE</span>
                <div class="monster"><div class="hpbar"><i></i></div>${img('mob-slime', 'mob', '')}</div>
                <div class="caster">${orbs}${img('mage', 'mage', '')}${f.id ? `<div class="fam-spot">${famOrb}${familiarFigure('scene')}</div>` : ''}</div>
            </section>
            <div class="idle-bar"><span class="cast-label">${spells.length ? C.SPELL[spells[0]].name : 'Equip a spell to begin'}</span>
                <div class="mini-slots n${s.circle}">${slots}</div>${famSlot}<button class="grid-button" aria-label="All features">${img('grid-button', '', '')}</button></div>
            ${withAscend ? ascendSheet() : ''}`;
    }

    /** Route band A as the game shows it since #406, collapsed: here only as context for the scene. */
    function bandHtml() {
        const nodes = Array.from({ length: 25 }, (_, i) => {
            const n = i + 1, state = n < 9 ? 'cleared' : n === 9 ? 'current' : n === 10 ? 'frontier' : 'locked';
            if (n === 6 || n === 25) return `<i class="bnode boss ${n === 6 ? 'beaten' : 'locked'}">${img(n === 6 ? 'boss-ember-watcher' : 'boss-cinder-warden', '', '')}</i>`;
            return `<i class="bnode ${state}"></i>`;
        }).join('');
        return `<div class="band fire" role="img" aria-label="Fire tier 1, node 9 of 25, farming">
            <div class="band-labels"><span class="band-where">${img('shard-fire', '', '')}<b>FIRE</b> T1</span><span class="band-section">Cinder Crossing</span><span class="band-node"><b>9</b>/25 · Farming</span></div>
            <div class="band-track">${nodes}</div></div>`;
    }

    /* ---------- Q4 · Ascend view and ceremony ---------- */

    function ascendSheet() {
        const s = app.state, next = s.circle + 1, ready = C.canAscend(s);
        if (s.circle >= C.MAX_CIRCLES) {
            return `<div class="sheet ascend" role="dialog" aria-label="Circle 8">${ascendHead()}<div class="ascend-hero">${crestHtml('big')}<p><b>Circle ${C.MAX_CIRCLES}</b><br>The highest circle.</p></div></div>`;
        }
        const goal = C.threshold(next), progress = Math.min(1, s.magePower / goal);
        return `<div class="sheet ascend" role="dialog" aria-label="Ascend">
            ${ascendHead()}
            <div class="ascend-hero">${crestHtml('big')}<div class="ascend-steps"><span>Circle ${s.circle}</span><i>›</i><b>Circle ${next}</b></div></div>
            <div class="mp"><div class="mp-row"><span>Mage Power</span><b>${fmt(s.magePower)} / ${fmt(goal)}</b></div><div class="bar mp-bar"><i style="width:${progress * 100}%"></i></div></div>
            <p class="ascend-gain">${img('slot-empty', 'gain-icon', '')}<span><b>A new spell slot</b> in your idle and boss builds. Nothing is reset.</span></p>
            <button class="cta" data-action="ascend" ${ready ? '' : 'disabled aria-disabled="true"'}>${ready ? 'Ascend' : `Reach ${fmt(goal)} Mage Power`}</button>
        </div>`;
    }

    function ascendHead() {
        return `<div class="sheet-head"><div><small>YOUR MAGE</small><h2>Ascension</h2></div><button class="icon-button" data-screen="idle" aria-label="Close">${img('chrome-icon-close', '', '')}</button></div>`;
    }

    function ceremonyHtml() {
        const n = app.state.circle, step = app.ceremony.step;
        return `<div class="ceremony${app.reduced ? ' still' : ''} step-${step}" role="dialog" aria-label="Ascended to Circle ${n}">
            <div class="ceremony-glow"></div>
            <div class="ceremony-crest">${crestHtml('big')}<i class="new-ring"></i></div>
            <div class="banner"><small>ASCENDED</small><b>Circle ${n}</b></div>
            <div class="new-slot">${img('slot-empty', 'spell', '')}<span>New spell slot<small>Slot ${n} in both builds</small></span></div>
            ${app.reduced ? '<button class="cta continue" data-action="ceremony-done">Open Loadouts</button>' : '<button class="skip" data-action="ceremony-done" aria-label="Skip the ceremony">Skip</button>'}
        </div>`;
    }

    function startCeremony() {
        if (!C.canAscend(app.state)) {
            app.state.magePower = C.threshold(app.state.circle + 1) + 40;
        }
        if (!C.canAscend(app.state)) return;
        app.state = C.ascend(app.state);
        app.circle = app.state.circle;
        app.ready = false;
        app.ceremony = { step: app.reduced ? 3 : 1, started: performance.now() };
        render();
        announce(`Ascended to Circle ${app.state.circle}. New spell slot unlocked.`);
    }

    function endCeremony() {
        app.ceremony = null;
        app.highlight = app.state.circle - 1;
        app.screen = 'loadouts-idle';
        render();
    }

    /* ---------- Rendering and the frame clock ---------- */

    function render() {
        let html;
        if (app.screen === 'loadouts-idle') html = loadoutsScreen('idle');
        else if (app.screen === 'loadouts-boss') html = loadoutsScreen('boss');
        else if (app.screen === 'boss') html = bossScreen();
        else html = idleScreen(app.screen === 'ascend');
        if (app.picker) html += pickerHtml();
        if (app.ceremony) html += ceremonyHtml();
        html += '<div id="toast" class="toast" hidden></div><div id="live" class="sr-only" aria-live="polite"></div>';
        phone.innerHTML = html;
        phone.className = `screen-${app.screen}${app.reduced ? ' reduced' : ''}`;
        refreshStudio();
        syncUrl();
    }

    function announce(text, toast) {
        const live = $('#live');
        if (live) live.textContent = text;
        if (!toast) return;
        const t = $('#toast');
        if (!t) return;
        t.textContent = text;
        t.hidden = false;
        clearTimeout(announce.timer);
        announce.timer = setTimeout(() => { const el = $('#toast'); if (el) el.hidden = true; }, 2400);
    }

    // Cooldown sweeps in the fight and round the orbs; reduced motion shows them still, a third of the way.
    let last = performance.now();
    function tick(now) {
        const dt = Math.min(100, now - last);
        last = now;
        if (!app.reduced) app.clock += dt;
        const s = app.state;
        const progress = (ms, offset) => (app.reduced ? 0.33 : ((app.clock + offset) % ms) / ms);
        $$('[data-sweep]').forEach(el => {
            const key = el.dataset.sweep;
            let id = null, offset = 0;
            if (key === 'familiar' || key === 'familiar-orb') { id = s.familiar.spell; offset = 900; }
            else if (key.startsWith('orb')) { const i = +key.slice(3); id = s.idle.filter(Boolean)[i]; offset = i * 700; }
            else { id = s.boss[+key]; offset = +key * 530; }
            if (!id) return;
            const p = progress(C.SPELL[id].cooldownMs, offset);
            el.style.setProperty('--p', (p * 360).toFixed(1) + 'deg');
            el.classList.toggle('done', !app.reduced && p > 0.94);
        });
        if (app.ceremony && !app.reduced) {
            const t = now - app.ceremony.started;
            const step = t < 800 ? 1 : t < 1500 ? 2 : t < 2600 ? 3 : 4;
            if (step === 4) endCeremony();
            else if (step !== app.ceremony.step) { app.ceremony.step = step; const el = $('.ceremony'); if (el) el.className = `ceremony step-${step}`; }
        }
        requestAnimationFrame(tick);
    }

    /* ---------- Studio ---------- */

    const NOTES = {
        q1: { A: 'Rutnät om fyra kolumner: magikerns slots i ordning, nästa låsta slot sist i rutnätet med "Circle n" och tröskeln, och familiaren som ett eget kort under med porträtt. Bossbygget har AUTO/TAP under varje slot. Läses som dagens Loadouts; åtta slots blir två rader.',
            B: 'Ring runt familiaren: åtta platser på en cirkel, de upplåsta fyllda, nästa låst och resten tomma socklar, med familiaren i mitten. Gör circlen synlig som form och visar hur långt det är kvar till åtta; autocast väljs i spellväljaren.' },
        q2: { A: 'Två rader om fyra knappar (52 × 52) med familiarens markering till höger, mindre och utan tryck, med egen cooldown. Raderna fylls i ordning, så 1–4 slots är en rad.',
            B: 'En båge med upp till åtta knappar (48 × 48) och familiarens markering i bågens mitt. Ger mer av arenan åt striden på låga circles och samlar familiaren mitt under magikern.' },
        q3: 'Idle-scenen: en orb per idle-spell i en båge över magikern (upp till åtta) och familiarens orb över familiaren, som står bredvid magikern och kastar på sin cooldown. Slots längst ned i två rader om fyra med familiarens slot bredvid.',
        q4: { A: 'Runring: åtta runplatser runt crest, de nådda tända i guld. När Mage Power når tröskeln pulserar nästa runa och crest får en prick; ett tryck öppnar Ascend-vyn.',
            B: 'Siffra och båge: en båge i åtta segment runt crest och circlens romerska siffra under. Tydligare siffra, mindre likt en runring som bild kan ersätta.' }
    };

    function refreshStudio() {
        $('#screens').innerHTML = SCREENS.map(([k, label]) => `<button data-screen="${k}" aria-current="${k === app.screen}">${label}</button>`).join('');
        $('#circles').innerHTML = Array.from({ length: 8 }, (_, i) => `<button data-circle="${i + 1}" aria-current="${i + 1 === app.state.circle}">${i + 1}</button>`).join('');
        $$('[data-toggle="familiar"]').forEach(b => { b.setAttribute('aria-pressed', !!app.state.familiar.id); b.textContent = app.state.familiar.id ? 'Familiar på' : 'Familiar av'; });
        $$('[data-toggle="ready"]').forEach(b => b.setAttribute('aria-pressed', C.canAscend(app.state)));
        $$('[data-toggle="reduced"]').forEach(b => b.setAttribute('aria-pressed', app.reduced));
        $('#variants').innerHTML = Object.entries(VARIANTS).map(([key, v]) => `<div class="variant-group"><b>${v.title}</b><div role="group" aria-label="${v.title}">${Object.entries(v.options).map(([o, name]) => `<button data-variant="${key}:${o}" aria-current="${app[key] === o}">${o} · ${name}</button>`).join('')}</div></div>`).join('');
        const n = [`<dl><dt>Loadouts ${app.q1}</dt><dd>${NOTES.q1[app.q1]}</dd><dt>Spellraden ${app.q2}</dt><dd>${NOTES.q2[app.q2]}</dd><dt>Idle-scenen</dt><dd>${NOTES.q3}</dd><dt>Crest ${app.q4}</dt><dd>${NOTES.q4[app.q4]}</dd></dl>`];
        $('#notes').innerHTML = n.join('') + '<p class="fine">Tryckytor minst 44 punkter, skärmläsarnamn på slots, knappar och crest ("Circle n"), och reducerad rörelse visar cooldowns och ceremonin som stillbilder.</p>';
        const label = SCREENS.find(s => s[0] === app.screen)[1];
        $$('.dock-screen').forEach(el => { el.textContent = label; });
    }

    function syncUrl() {
        const u = new URL(location.href);
        for (const [k, v] of Object.entries({ screen: app.screen, circle: app.state.circle, familiar: app.state.familiar.id ? '1' : '0', q1: app.q1, q2: app.q2, q4: app.q4 })) u.searchParams.set(k, v);
        history.replaceState(null, '', u);
    }

    function setCircle(n) {
        const familiar = !!app.state.familiar.id;
        app.state = C.createState(Math.min(8, Math.max(1, n)), familiar);
        app.highlight = null;
        app.picker = null;
        render();
    }

    function choose(spell) {
        const p = app.picker, before = spell && C.placeOf(app.state, p.build || 'idle', spell);
        const wasFamiliar = spell && app.state.familiar.spell === spell;
        if (p.slot === 'familiar') {
            const inSlots = spell && (app.state.idle.includes(spell) || app.state.boss.includes(spell));
            app.state = C.setFamiliar(app.state, spell || null);
            app.picker = null;
            render();
            if (spell) announce(inSlots ? `${C.SPELL[spell].name} moved to ${C.FAMILIAR.name}. It left the mage's slots.` : `${C.FAMILIAR.name} casts ${C.SPELL[spell].name}.`, true);
            return;
        }
        app.state = C.setSlot(app.state, p.build, p.slot, spell || null);
        app.picker = null;
        render();
        if (spell) announce(wasFamiliar ? `${C.SPELL[spell].name} moved from ${C.FAMILIAR.name} to slot ${p.slot + 1}.` : before && before.kind === 'slot' && before.slot !== p.slot ? `${C.SPELL[spell].name} swapped into slot ${p.slot + 1}.` : `${C.SPELL[spell].name} in slot ${p.slot + 1}.`, true);
    }

    function onClick(e) {
        const b = e.target.closest('button');
        if (!b) return;
        const inPhone = phone.contains(b);
        const menu = b.closest('.dock-menu');
        if (menu) { menu.hidden = true; $$('[data-demo="menu"]').forEach(m => m.setAttribute('aria-expanded', 'false')); }
        if (b.dataset.screen) { app.screen = b.dataset.screen; app.picker = null; app.highlight = null; render(); return; }
        if (b.dataset.circle) { setCircle(+b.dataset.circle); return; }
        if (b.dataset.variant) { const [k, v] = b.dataset.variant.split(':'); app[k] = v; render(); return; }
        if (b.dataset.toggle === 'familiar') { app.state = C.createState(app.state.circle, !app.state.familiar.id); render(); return; }
        if (b.dataset.toggle === 'ready') { app.state.magePower = C.canAscend(app.state) ? Math.max(124, C.threshold(app.state.circle) + Math.round((C.threshold(Math.min(8, app.state.circle + 1)) - C.threshold(app.state.circle)) * 0.6)) : C.threshold(Math.min(8, app.state.circle + 1)) + 40; render(); return; }
        if (b.dataset.toggle === 'reduced') { app.reduced = !app.reduced; render(); return; }
        if (b.dataset.demo === 'ceremony') { app.screen = 'ascend'; startCeremony(); return; }
        if (b.dataset.demo === 'menu') { const m = $('.dock-menu'); m.hidden = !m.hidden; b.setAttribute('aria-expanded', !m.hidden); return; }
        if (b.dataset.demo === 'prev-screen' || b.dataset.demo === 'next-screen') {
            const i = SCREENS.findIndex(s => s[0] === app.screen), d = b.dataset.demo === 'next-screen' ? 1 : -1;
            app.screen = SCREENS[(i + d + SCREENS.length) % SCREENS.length][0]; app.picker = null; render(); return;
        }
        if (b.dataset.demo === 'circle-down' || b.dataset.demo === 'circle-up') { setCircle(app.state.circle + (b.dataset.demo === 'circle-up' ? 1 : -1)); return; }
        if (!inPhone) return;
        if (b.dataset.action === 'open-ascend') { app.screen = 'ascend'; app.picker = null; render(); return; }
        if (b.dataset.action === 'ascend') { startCeremony(); return; }
        if (b.dataset.action === 'ceremony-done') { endCeremony(); return; }
        if (b.dataset.action === 'close-picker') { app.picker = null; render(); return; }
        if (b.dataset.autocast != null) { const i = +b.dataset.autocast; app.state.autocast[i] = !app.state.autocast[i]; render(); return; }
        if (b.dataset.pick != null) { choose(b.dataset.pick || null); return; }
        if (b.dataset.slot) {
            if (b.dataset.slot === 'familiar') app.picker = { slot: 'familiar', build: app.screen === 'loadouts-boss' ? 'boss' : 'idle' };
            else { const [build, i] = b.dataset.slot.split(':'); app.picker = { build, slot: +i }; }
            app.highlight = null;
            render();
            return;
        }
        if (b.dataset.cast != null) {
            const el = $(`[data-sweep="${b.dataset.cast}"]`);
            if (el && !app.reduced) b.animate([{ transform: 'scale(.92)' }, { transform: 'none' }], { duration: 160 });
        }
    }

    function init() {
        $('.dock-menu').innerHTML = SCREENS.map(([k, label]) => `<button data-screen="${k}">${label}</button>`).join('')
            + Object.entries(VARIANTS).map(([key, v]) => Object.entries(v.options).map(([o, name]) => `<button data-variant="${key}:${o}">${v.title.split(' · ')[1]}: ${o} · ${name}</button>`).join('')).join('')
            + '<button data-toggle="familiar">Familiar på/av</button><button data-toggle="ready">Tröskeln nådd</button><button data-toggle="reduced">Reducerad rörelse</button><button data-demo="ceremony">Spela ceremonin</button>';
        document.addEventListener('click', onClick);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.picker) { app.picker = null; render(); } });
        if (q.get('picker')) {
            const [build, slot] = q.get('picker').split(':');
            app.picker = slot === 'familiar' || build === 'familiar' ? { slot: 'familiar', build: 'idle' } : { build, slot: +slot };
        }
        render();
        if (q.get('ceremony')) {
            app.state.magePower = C.threshold(Math.min(8, app.state.circle + 1)) + 40;
            startCeremony();
            const step = +q.get('ceremony');
            if (step && app.ceremony) { app.ceremony.step = step; app.ceremony.started = performance.now() - [0, 0, 800, 1500][step]; render(); }
        }
        requestAnimationFrame(tick);
    }

    window.circlesProto = {
        get state() { return app.state; }, get app() { return app; }, model: C,
        render, setCircle, startCeremony, endCeremony,
        setReduced(v) { app.reduced = v; render(); }
    };
    init();
})();
