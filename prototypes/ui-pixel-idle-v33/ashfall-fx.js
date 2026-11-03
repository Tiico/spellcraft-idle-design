/* Ashfall review effect. Coordinates and timing come from the existing cast. */
const AshfallFx = (() => {
    const emberPoints = [
        [23, 43], [50, 27], [76, 48],
        [37, 61], [65, 70], [14, 55], [87, 56], [42, 36], [61, 43]
    ];
    const cinderOffsets = [[-27,-7], [-17,-21], [-7,-11], [9,-23], [23,-12], [29,-3], [0,-29]];
    const afterglowMs = 340;

    function prepare(layer, { mode, x, y, radius, lead }) {
        const effect = document.createElement('div');
        effect.className = 'ashfall-fx';
        effect.dataset.ashfall = mode;
        effect.setAttribute('aria-hidden', 'true');
        effect.style.setProperty('--ashfall-x', x);
        effect.style.setProperty('--ashfall-y', y);
        if (mode === 'active') effect.style.setProperty('--ashfall-span', 2 * radius + '%');
        const embers = emberPoints.slice(0, mode === 'idle' ? 3 : emberPoints.length);
        effect.innerHTML = `
            <div class="ashfall-zone">
                <span class="ashfall-ring"></span>
                <span class="ashfall-seal"></span>
                <div class="ashfall-cinders">
                    ${cinderOffsets.slice(0, mode === 'idle' ? 5 : 7).map(([dx, dy]) =>
                        `<i style="--cinder-x:${dx}px;--cinder-y:${dy}px"></i>`).join('')}
                </div>
                ${embers.map(([left, top], i) => {
                    const delay = Math.round(lead * (.42 - i % 3 * .06));
                    return `<span class="ashfall-ember" style="left:${left}%;top:${top}%;
                        --ember-delay:${delay}ms;--ember-time:${lead-delay}ms"><i></i></span>`;
                }).join('')}
            </div>`;
        layer.append(effect);
        // Also remove a cue when its cast is interrupted before impact.
        setTimeout(() => effect.remove(), lead + afterglowMs + 80);
        return effect;
    }

    function impact(effect, hits = []) {
        if (!effect?.isConnected) return;
        for (const { x, y } of hits) {
            const spark = document.createElement('span');
            spark.className = 'ashfall-hit';
            spark.style.left = x + '%';
            spark.style.top = y + '%';
            effect.append(spark);
        }
        effect.classList.add('is-impact');
    }

    return { prepare, impact };
})();
