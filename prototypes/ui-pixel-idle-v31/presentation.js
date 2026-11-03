/* Prototype presentation data and transitions. No Unity, persistence or game-service dependencies. */
(function (scope) {
    // Measured visible bounds, not equal atlas cells: transparent gutters differ between icons.
    const hudBounds = {
        fire:[47,56,235,263],ice:[357,53,249,262],earth:[664,46,246,274],wind:[977,61,248,254],
        ore:[40,374,260,242],pearls:[353,374,254,242],hp:[659,378,265,235],power:[977,363,254,250],
        crest:[46,659,232,244],evolved:[339,648,270,261],crowned:[644,636,292,283],book:[971,666,257,246],
        lock:[41,946,235,256],time:[361,932,230,268],settings:[661,946,252,251],empty:[983,959,219,226]
    };
    function frameStyle(bounds, inset = 0.84) {
        const padding = 4;
        const [left, top, width, height] = bounds;
        const x = left - padding, y = top - padding, w = width + padding * 2, h = height + padding * 2;
        const longest = Math.max(w, h);
        return `--fw:${w / longest * inset * 100}%;--fh:${h / longest * inset * 100}%;--fx:${x / (1254 - w) * 100}%;--fy:${y / (1254 - h) * 100}%;--fsx:${1254 / w * 100}%;--fsy:${1254 / h * 100}%`;
    }
    function nextIdleSpell(loadout, previous) {
        const equipped = loadout.filter(Boolean);
        if (!equipped.length) return null;
        return equipped[(equipped.indexOf(previous) + 1) % equipped.length];
    }
    function canVisitRealm(won, realm) {
        return Number.isInteger(realm) && realm >= 0 && realm < won.length && won.slice(0, realm).every(Boolean);
    }
    scope.MagePresentation = Object.freeze({ hudBounds, frameStyle, nextIdleSpell, canVisitRealm });
})(globalThis);
