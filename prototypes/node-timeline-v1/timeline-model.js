/* Node timeline prototype (#403): the realm route as data and the rules the timeline shows.
 * Mirrors the content catalog (realms, sections, monsters, boss nodes and what each boss opens) and RealmRules in
 * shared/SpellcraftIdle.Rules: a kill moves the mage and the frontier one idle node only when the mage stands on the
 * frontier, never past an undefeated boss; defeated boss nodes are passed; the player may move to any idle node of an
 * unlocked realm/tier pair up to its frontier. Prototype only: no game or server code reads this file. */
(function (root) {
    'use strict';

    const NODE_COUNT = 25;
    const BOSS_NODES = [6, 13, 19, 25];
    const HP_GROWTH = 1.08;
    const TIER_HP = 1.5;
    const CATALOG_LAST_TIER = 3;

    const REALMS = [
        {
            id: 'fire', name: 'Fire',
            sections: [['Emberwood', 1, 6], ['Cinder Crossing', 7, 13], ['Ashen Ruins', 14, 19], ['Sentinel Keep', 20, 25]],
            monsters: [['Cinder Slime', 'mob-slime'], ['Ashfang Imp', 'mob-imp'], ['Emberwing Bat', 'mob-bat'], ['Obsidian Beetle', 'mob-beetle']],
            bosses: { 6: ['ember-watcher', 'The Ember Watcher'], 13: ['cinder-warden', 'The Cinder Warden'], 19: ['ashen-knight', 'The Ashen Knight'], 25: ['ember-sentinel', 'The Ember Sentinel'] }
        },
        {
            id: 'ice', name: 'Ice',
            sections: [['Hushed Glacier', 1, 6], ['Frostfall Lake', 7, 13], ['Crystal Pass', 14, 19], ['Warden’s Crown', 20, 25]],
            monsters: [['Ice Slime', 'mob-slime'], ['Frostpelt Fox', 'mob-imp'], ['Rime Moth', 'mob-bat'], ['Glacier Slime', 'mob-slime']],
            bosses: { 6: ['ice-watcher', 'Ice Watcher'], 13: ['ice-warden', 'Ice Warden'], 19: ['ice-knight', 'Ice Knight'], 25: ['glacier-warden', 'The Glacier Warden'] }
        },
        {
            id: 'earth', name: 'Earth',
            sections: [['Verdant Hollow', 1, 6], ['Mossroot Grove', 7, 13], ['Stonevein Quarry', 14, 19], ['Colossus Heart', 20, 25]],
            monsters: [['Moss Golem', 'mob-beetle'], ['Burrow Fox', 'mob-imp'], ['Root Moth', 'mob-bat'], ['Stone Golem', 'mob-beetle']],
            bosses: { 6: ['earth-watcher', 'Earth Watcher'], 13: ['earth-warden', 'Earth Warden'], 19: ['earth-knight', 'Earth Knight'], 25: ['root-colossus', 'The Root Colossus'] }
        },
        {
            id: 'wind', name: 'Wind',
            sections: [['Skyreach', 1, 6], ['Gale Bridges', 7, 13], ['Stormwatch', 14, 19], ['Tempest Shrine', 20, 25]],
            monsters: [['Gust Spirit', 'mob-slime'], ['Wind Slime', 'mob-slime'], ['Storm Bat', 'mob-bat'], ['Cloud Spirit', 'mob-slime']],
            bosses: { 6: ['wind-watcher', 'Wind Watcher'], 13: ['wind-warden', 'Wind Warden'], 19: ['wind-knight', 'Wind Knight'], 25: ['sky-keeper', 'The Sky Keeper'] }
        }
    ];
    const REALM = Object.fromEntries(REALMS.map((r, i) => [r.id, Object.assign(r, { order: i })]));

    const key = (realm, tier) => realm + '-' + tier;
    const nodeKey = (realm, tier, node) => realm + '-' + tier + '-' + node;
    const parseKey = k => { const [realm, tier] = k.split('-'); return { realm, tier: +tier }; };
    const isBoss = node => BOSS_NODES.includes(node);

    /** The realm/tier pair at position index of the canonical order Fire → Ice → Earth → Wind → Fire tier 2 → …, without end. */
    function pairAt(index) {
        return { realm: REALMS[index % 4].id, tier: Math.floor(index / 4) + 1 };
    }
    function pairIndex(realm, tier) { return (tier - 1) * 4 + REALM[realm].order; }

    function sectionOf(realm, node) {
        const s = REALM[realm].sections.findIndex(([, a, b]) => node >= a && node <= b);
        const [name, first, last] = REALM[realm].sections[s];
        return { index: s, name, first, last };
    }
    function monsterOf(realm, tier, node) {
        const s = sectionOf(realm, node).index;
        const [name, art] = REALM[realm].monsters[s];
        return { name, art, hp: Math.round(10 * Math.pow(HP_GROWTH, node - 1) * Math.pow(TIER_HP, tier - 1)) };
    }
    function bossOf(realm, tier, node) {
        const b = REALM[realm].bosses[node];
        if (!b) return null;
        return { id: b[0], name: b[1], art: 'boss-' + b[0], guardian: node === NODE_COUNT, tier, realm, node };
    }

    /** What a boss victory opens: P-01 lets Fire's first boss (node 6) open Ice in tier 1; otherwise a realm's guardian
     * (node 25) opens the next realm, and Wind's guardian opens Fire in the next tier. Fire's tier 1 guardian opens nothing. */
    function opensFrom(realm, tier, node) {
        if (tier === 1 && realm === 'fire') return node === 6 ? [{ realm: 'ice', tier: 1 }] : [];
        if (node !== NODE_COUNT) return [];
        const i = REALM[realm].order;
        return i === 3 ? [{ realm: 'fire', tier: tier + 1 }] : [{ realm: REALMS[i + 1].id, tier }];
    }
    /** The boss node that opens a pair, or null for the start pair Fire tier 1. */
    function openerOf(realm, tier) {
        if (realm === 'fire' && tier === 1) return null;
        if (realm === 'ice' && tier === 1) return { realm: 'fire', tier: 1, node: 6 };
        const i = REALM[realm].order;
        return i === 0 ? { realm: 'wind', tier: tier - 1, node: NODE_COUNT } : { realm: REALMS[i - 1].id, tier, node: NODE_COUNT };
    }

    function createState(spec) {
        const s = { location: { realm: 'fire', tier: 1, node: 1 }, frontiers: { 'fire-1': 1 }, victories: {} };
        if (spec) {
            s.location = Object.assign({}, spec.location);
            s.frontiers = Object.assign({}, spec.frontiers);
            for (const v of spec.victories || []) s.victories[v] = true;
        }
        return s;
    }
    function cloneState(s) { return { location: Object.assign({}, s.location), frontiers: Object.assign({}, s.frontiers), victories: Object.assign({}, s.victories) }; }

    const unlocked = (s, realm, tier) => s.frontiers[key(realm, tier)] != null;
    const defeated = (s, realm, tier, node) => !!s.victories[nodeKey(realm, tier, node)];

    /** The next idle node after node, passing defeated boss nodes; stops at an undefeated boss node. */
    function nextStep(s, realm, tier, node) {
        for (let n = node + 1; n <= NODE_COUNT; n++) {
            if (!isBoss(n)) return { node: n };
            if (!defeated(s, realm, tier, n)) return { boss: n };
        }
        return { end: true };
    }

    /** The undefeated boss the mage waits at: the mage stands on the frontier and the next node is an undefeated boss. */
    function waitingBoss(s) {
        const { realm, tier, node } = s.location;
        if (s.frontiers[key(realm, tier)] !== node) return null;
        const step = nextStep(s, realm, tier, node);
        return step.boss ? bossOf(realm, tier, step.boss) : null;
    }

    /** A node's state for the timeline. */
    function nodeState(s, realm, tier, node) {
        const here = s.location.realm === realm && s.location.tier === tier && s.location.node === node;
        const open = unlocked(s, realm, tier);
        const frontier = s.frontiers[key(realm, tier)];
        if (isBoss(node)) {
            if (defeated(s, realm, tier, node)) return 'beaten';
            if (!open) return 'locked';
            const step = nextStep(s, realm, tier, frontier);
            if (step.boss === node) {
                const w = waitingBoss(s);
                return w && w.realm === realm && w.tier === tier && w.node === node ? 'waiting' : 'ready';
            }
            return 'locked';
        }
        if (here) return 'current';
        if (!open || node > frontier) return 'locked';
        return node === frontier ? 'frontier' : 'cleared';
    }

    function describe(realm, tier, node) {
        const r = REALM[realm], sec = sectionOf(realm, node), boss = bossOf(realm, tier, node);
        return { realm, tier, node, realmName: r.name, section: sec.name, sectionIndex: sec.index, boss, monster: boss ? null : monsterOf(realm, tier, node) };
    }
    function placeName(realm, tier, node) { return REALM[realm].name + ' tier ' + tier + ' node ' + node; }

    /** Whether the mage may move to a node, and the player-facing reason when not (MoveVerdict). */
    function checkMove(s, realm, tier, node) {
        if (s.location.realm === realm && s.location.tier === tier && s.location.node === node) return { ok: false, code: 'here', reason: 'The mage farms here now.' };
        if (!unlocked(s, realm, tier)) return { ok: false, code: 'pair-locked', reason: lockReason(s, realm, tier, node) };
        if (isBoss(node)) return { ok: false, code: 'boss', reason: defeated(s, realm, tier, node) ? 'Boss defeated. Boss nodes are fought, never farmed.' : 'Boss nodes are fought, never farmed.' };
        if (node > s.frontiers[key(realm, tier)]) return { ok: false, code: 'beyond-frontier', reason: lockReason(s, realm, tier, node) };
        return { ok: true, code: 'ok' };
    }

    /** What opens a locked node, in player-facing English. */
    function lockReason(s, realm, tier, node) {
        if (!unlocked(s, realm, tier)) {
            const op = openerOf(realm, tier);
            const b = bossOf(op.realm, op.tier, op.node);
            const where = REALM[op.realm].name + (op.tier !== tier || op.realm !== realm ? ' tier ' + op.tier : '') + ' node ' + op.node;
            const target = REALM[realm].name + ' tier ' + tier;
            const chain = unlocked(s, op.realm, op.tier) ? '' : ' ' + REALM[op.realm].name + ' tier ' + op.tier + ' is not open yet either.';
            return 'Defeat ' + b.name + ' (' + where + ') to open ' + target + '.' + chain;
        }
        const frontier = s.frontiers[key(realm, tier)];
        for (let n = frontier + 1; n < node; n++) {
            if (isBoss(n) && !defeated(s, realm, tier, n)) return 'Defeat ' + bossOf(realm, tier, n).name + ' at node ' + n + ' first.';
        }
        if (isBoss(node)) return 'Reach node ' + (node - 1) + ' to challenge ' + bossOf(realm, tier, node).name + '.';
        return 'Idle reaches it: each kill on the frontier (node ' + frontier + ') moves one node on.';
    }

    function move(s, realm, tier, node) {
        const v = checkMove(s, realm, tier, node);
        if (!v.ok) throw new Error('Move refused: ' + v.code);
        const t = cloneState(s);
        t.location = { realm, tier, node };
        return t;
    }

    /** A cleared node. The mage and the frontier move one idle node only from the frontier and never past an undefeated boss. */
    function kill(s) {
        const { realm, tier, node } = s.location;
        const k = key(realm, tier);
        if (s.frontiers[k] !== node) return { state: s, event: { type: 'stay', reason: 'earlier-node' } };
        const step = nextStep(s, realm, tier, node);
        if (step.boss) return { state: s, event: { type: 'boss-gate', boss: bossOf(realm, tier, step.boss) } };
        if (step.end) return { state: s, event: { type: 'stay', reason: 'route-complete' } };
        const t = cloneState(s);
        t.frontiers[k] = step.node;
        t.location = { realm, tier, node: step.node };
        return { state: t, event: { type: 'advance', from: node, to: step.node } };
    }

    /** Wins the boss the mage waits at: the frontier passes it, the mage follows, and its unlocks open with frontier 1.
     * The prototype then moves the mage into a newly opened pair, as the introduction's guide does after the Ember Watcher. */
    function winBoss(s) {
        const boss = waitingBoss(s);
        if (!boss) throw new Error('No boss waits');
        const t = cloneState(s);
        t.victories[nodeKey(boss.realm, boss.tier, boss.node)] = true;
        const opens = opensFrom(boss.realm, boss.tier, boss.node);
        for (const o of opens) if (!unlocked(t, o.realm, o.tier)) t.frontiers[key(o.realm, o.tier)] = 1;
        const step = nextStep(t, boss.realm, boss.tier, boss.node);
        if (step.node) t.frontiers[key(boss.realm, boss.tier)] = step.node;
        if (opens.length) t.location = { realm: opens[0].realm, tier: opens[0].tier, node: 1 };
        else if (step.node) t.location = { realm: boss.realm, tier: boss.tier, node: step.node };
        return { state: t, event: { type: 'victory', boss, opens } };
    }

    /** Ready-made states for the review: each shows one acceptance criterion. */
    const SCENARIOS = {
        start: { label: 'New player · Fire node 2', state: { location: { realm: 'fire', tier: 1, node: 2 }, frontiers: { 'fire-1': 2 } } },
        boss: { label: 'Boss waits · Fire node 5', state: { location: { realm: 'fire', tier: 1, node: 5 }, frontiers: { 'fire-1': 5 } } },
        ice: { label: 'Fire → Ice · Ice node 3', state: { location: { realm: 'ice', tier: 1, node: 3 }, frontiers: { 'fire-1': 7, 'ice-1': 3 }, victories: ['fire-1-6'] } },
        branch: { label: 'Back in Fire · node 11', state: { location: { realm: 'fire', tier: 1, node: 11 }, frontiers: { 'fire-1': 11, 'ice-1': 16 }, victories: ['fire-1-6', 'ice-1-6', 'ice-1-13'] } },
        tier: { label: 'Wind → Fire tier 2 · Wind node 24', state: { location: { realm: 'wind', tier: 1, node: 24 }, frontiers: { 'fire-1': 18, 'ice-1': 24, 'earth-1': 24, 'wind-1': 24 }, victories: ['fire-1-6', 'fire-1-13', 'ice-1-6', 'ice-1-13', 'ice-1-19', 'ice-1-25', 'earth-1-6', 'earth-1-13', 'earth-1-19', 'earth-1-25', 'wind-1-6', 'wind-1-13', 'wind-1-19'] } },
        tier2: { label: 'Tier 2 begins · Fire tier 2 node 2', state: { location: { realm: 'fire', tier: 2, node: 2 }, frontiers: { 'fire-1': 18, 'ice-1': 24, 'earth-1': 24, 'wind-1': 24, 'fire-2': 2 }, victories: ['fire-1-6', 'fire-1-13', 'ice-1-6', 'ice-1-13', 'ice-1-19', 'ice-1-25', 'earth-1-6', 'earth-1-13', 'earth-1-19', 'earth-1-25', 'wind-1-6', 'wind-1-13', 'wind-1-19', 'wind-1-25'] } }
    };

    root.SpellcraftNodeTimeline = {
        NODE_COUNT, BOSS_NODES, CATALOG_LAST_TIER, REALMS, REALM, SCENARIOS,
        key, nodeKey, parseKey, isBoss, pairAt, pairIndex, sectionOf, monsterOf, bossOf, opensFrom, openerOf,
        createState, cloneState, unlocked, defeated, nextStep, waitingBoss, nodeState, describe, placeName,
        checkMove, lockReason, move, kill, winBoss
    };
})(typeof globalThis !== 'undefined' ? globalThis : window);
