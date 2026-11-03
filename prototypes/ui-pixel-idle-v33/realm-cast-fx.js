/* Prototype spell visuals. The combat views own targeting and the impact clock. */
const RealmCastFx = (() => {
    const profiles = {
        flarejavelin: 'flight',
        rimenova: 'area',
        frostfang: 'flight',
        quartzspike: 'eruption',
        bramblesnare: 'area',
        squallblade: 'flight',
        thundergust: 'area'
    };
    const choices = MageIdleSpells.definitions.filter(spell =>
        spell.art === 'ashfall' || Object.hasOwn(profiles, spell.art));
    const fragments = [
        [-34, -9], [26, -20], [-11, -30], [32, 13], [-22, 19], [10, 24], [3, -40]
    ];

    function prepare(layer, {art, mode, origin, target, lead, radius}) {
        const kind = profiles[art];
        if (!kind) return null;
        const effect = document.createElement('div');
        effect.className = 'realm-cast-fx';
        effect.dataset.castArt = art;
        effect.dataset.castMode = mode;
        effect.setAttribute('aria-hidden', 'true');
        const dx = (target.x - origin.x) * layer.clientWidth;
        const dy = (target.y - origin.y) * layer.clientHeight;
        const properties = {
            'from-x': origin.x + '%', 'from-y': origin.y + '%',
            'to-x': target.x + '%', 'to-y': target.y + '%',
            angle: Math.atan2(dy, dx) + 'rad', lead: lead + 'ms'
        };
        if (kind === 'area' && mode === 'active') {
            properties.width = 2 * radius + '%';
            properties.height = properties.width;
        }
        for (const [key, value] of Object.entries(properties)) {
            effect.style.setProperty('--cast-' + key, value);
        }
        const chips = fragments.slice(0, mode === 'active' ? 7 : 4);
        effect.innerHTML = `
            ${kind === 'flight' ? '<i class="realm-cast-flight"></i>' : ''}
            <div class="realm-cast-zone">
                ${kind !== 'flight' ? '<i class="realm-cast-mark"></i>' : ''}
                <i class="realm-cast-core"></i>
                ${chips.map(([x, y]) =>
                    `<i class="realm-cast-chip" style="--chip-x:${x}px;--chip-y:${y}px"></i>`).join('')}
            </div>`;
        layer.append(effect);
        // A canceled cast can disappear without an impact.
        setTimeout(() => effect.remove(), lead + 460);
        return effect;
    }

    function impact(effect, hits = []) {
        if (!effect?.isConnected) return;
        const marked = new Set();
        for (const {id, x, y} of hits) {
            if (marked.has(id)) continue;
            marked.add(id);
            const chip = document.createElement('i');
            chip.className = 'realm-cast-hit';
            chip.style.left = x + '%';
            chip.style.top = y + '%';
            effect.append(chip);
        }
        effect.classList.add('is-impact');
    }

    return { choices, prepare, impact };
})();
