/* Circles prototype (#418): the rules ADR 0016 sets, as data the views read. Prototype only; no game code reads this file.
 * A n-circle mage has n slots in the idle and the boss build, beside one familiar slot shared by both builds. A spell sits
 * with the mage or with the familiar, never both (one place per spell), and may sit in both builds' mage slots. Ascension is
 * one step at a time when Mage Power reaches the catalog's threshold; the new slot is empty in both builds. The thresholds
 * are placeholders (#25) except circle 2's, which the PO set to about 500. */
(function (root) {
    'use strict';

    const MAX_CIRCLES = 8;
    const THRESHOLDS = { 1: 0, 2: 500, 3: 1200, 4: 2200, 5: 3600, 6: 5400, 7: 7600, 8: 10200 };
    const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

    // Owned spells with catalog-shaped values; "breaks" marks the spells that break the Cinder Ward (area spells, ADR 0015).
    const SPELLS = [
        { id: 'flare-javelin', name: 'Flare Javelin', element: 'fire', damage: 24, cooldownMs: 3000, breaks: false },
        { id: 'frost-fang', name: 'Frost Fang', element: 'ice', damage: 20, cooldownMs: 4000, breaks: false },
        { id: 'ember-ring', name: 'Ember Ring', element: 'fire', damage: 18, cooldownMs: 5000, breaks: true },
        { id: 'frostfire-cone', name: 'Frostfire Cone', element: 'fire', damage: 30, cooldownMs: 6000, breaks: true },
        { id: 'magma-lance', name: 'Magma Lance', element: 'fire', damage: 34, cooldownMs: 5500, breaks: false },
        { id: 'hailstorm', name: 'Hailstorm', element: 'ice', damage: 28, cooldownMs: 7000, breaks: true },
        { id: 'gale-blade', name: 'Gale Blade', element: 'wind', damage: 16, cooldownMs: 2500, breaks: false },
        { id: 'stone-spike', name: 'Stone Spike', element: 'earth', damage: 26, cooldownMs: 4500, breaks: false },
        { id: 'glacier-lance', name: 'Glacier Lance', element: 'ice', damage: 32, cooldownMs: 6500, breaks: false },
        { id: 'rime-nova', name: 'Rime Nova', element: 'ice', damage: 22, cooldownMs: 5000, breaks: true },
        { id: 'thunder-gust', name: 'Thunder Gust', element: 'wind', damage: 27, cooldownMs: 5200, breaks: true },
        { id: 'cinder-vortex', name: 'Cinder Vortex', element: 'fire', damage: 36, cooldownMs: 8000, breaks: true }
    ];
    const SPELL = Object.fromEntries(SPELLS.map(spell => [spell.id, spell]));
    const FAMILIAR = { id: 'ember-wisp', name: 'Ember Wisp', castPowerBp: 10000, bossBuffBp: 11000 };

    function threshold(circle) { return THRESHOLDS[circle] || 0; }
    function roman(circle) { return ROMAN[circle] || String(circle); }

    /** A player at <circle> with its slots filled in order and, with a familiar, Frost Fang on the familiar. */
    function createState(circle, familiar) {
        const order = ['flare-javelin', 'ember-ring', 'magma-lance', 'gale-blade', 'stone-spike', 'glacier-lance', 'hailstorm', 'thunder-gust'];
        const fill = n => order.slice(0, n);
        return {
            circle,
            magePower: Math.max(124, threshold(circle)),
            familiar: familiar ? { id: FAMILIAR.id, spell: 'frost-fang' } : { id: null, spell: null },
            idle: fill(circle),
            boss: fill(circle),
            autocast: Array.from({ length: circle }, (_, i) => i !== 1)
        };
    }

    function clone(state) {
        return { circle: state.circle, magePower: state.magePower, familiar: Object.assign({}, state.familiar), idle: state.idle.slice(), boss: state.boss.slice(), autocast: state.autocast.slice() };
    }

    /** Where a spell sits now: on the familiar, in a slot of the build, or nowhere. */
    function placeOf(state, build, spell) {
        if (state.familiar.spell === spell) return { kind: 'familiar' };
        const slot = state[build].indexOf(spell);
        return slot >= 0 ? { kind: 'slot', slot } : { kind: 'none' };
    }

    /** Puts a spell in a mage slot. From the familiar it moves (one place per spell); from another slot of the build it swaps. */
    function setSlot(state, build, slot, spell) {
        const next = clone(state);
        const list = next[build];
        const from = spell == null ? -1 : list.indexOf(spell);
        if (from >= 0 && from !== slot) list[from] = list[slot];
        if (spell != null && next.familiar.spell === spell) next.familiar.spell = null;
        list[slot] = spell;
        return next;
    }

    /** Gives the familiar a spell; a spell from a mage slot leaves every mage slot of both builds (one place per spell). */
    function setFamiliar(state, spell) {
        const next = clone(state);
        if (!next.familiar.id) throw new Error('No familiar');
        if (spell != null) {
            next.idle = next.idle.map(id => (id === spell ? null : id));
            next.boss = next.boss.map(id => (id === spell ? null : id));
        }
        next.familiar.spell = spell;
        return next;
    }

    function canAscend(state) {
        return state.circle < MAX_CIRCLES && state.magePower >= threshold(state.circle + 1);
    }

    /** One step up: a new empty slot last in both builds, autocast on in the boss build. Nothing else changes. */
    function ascend(state) {
        if (!canAscend(state)) throw new Error('Cannot ascend');
        const next = clone(state);
        next.circle += 1;
        next.idle.push(null);
        next.boss.push(null);
        next.autocast.push(true);
        return next;
    }

    root.SpellcraftCircles = { MAX_CIRCLES, THRESHOLDS, SPELLS, SPELL, FAMILIAR, threshold, roman, createState, clone, placeOf, setSlot, setFamiliar, canAscend, ascend };
})(typeof globalThis !== 'undefined' ? globalThis : window);
