import { rules } from './catalog.mjs';

// Potential acquisition with unlimited farmable resources, not combat or timing.
export function reachableSpells(catalog, bossesDefeated, forgeLevel) {
    const reachable = new Set(catalog.filter(spell => !spell.inputs &&
        spell.realm <= bossesDefeated && spell.level <= forgeLevel).map(spell => spell.id));
    let changed = true;
    while (changed) {
        changed = false;
        for (const spell of catalog) {
            if (!reachable.has(spell.id) && spell.inputs?.length === 2 &&
                spell.level <= forgeLevel && spell.inputs.every(id => reachable.has(id))) {
                reachable.add(spell.id);
                changed = true;
            }
        }
    }
    return [...reachable];
}

export function analyzeCatalog(catalog, forgeCaps = rules.forgeCaps) {
    const issues = [];
    const byId = new Map();
    const pairs = new Set();
    for (const spell of catalog) {
        if (byId.has(spell.id)) issues.push(`Duplicate spell id: ${spell.id}`);
        byId.set(spell.id, spell);
        if (!Number.isInteger(spell.level) || spell.level < 0 || spell.level > Math.max(...forgeCaps)) {
            issues.push(`Unreachable forge requirement: ${spell.name}`);
        }
        if (spell.inputs) {
            if (spell.inputs.length !== 2 || new Set(spell.inputs).size !== 2) {
                issues.push(`A fusion needs two different ingredients: ${spell.name}`);
            }
            const pair = [...spell.inputs].sort().join('+');
            if (pairs.has(pair)) issues.push(`Ambiguous recipe pair: ${pair}`);
            pairs.add(pair);
        } else if (!Number.isInteger(spell.realm) || spell.realm < 0 || spell.realm > 3 ||
            !Number.isFinite(spell.cost) || spell.cost < 0) {
            issues.push(`Invalid base-spell acquisition: ${spell.name}`);
        }
    }
    const visiting = new Set();
    const visited = new Set();
    function visit(id) {
        if (visiting.has(id)) { issues.push(`Circular recipe dependency at ${id}`); return; }
        if (visited.has(id)) return;
        visiting.add(id);
        for (const input of byId.get(id)?.inputs || []) {
            if (!byId.has(input)) issues.push(`Missing ingredient ${input} for ${id}`);
            else visit(input);
        }
        visiting.delete(id);
        visited.add(id);
    }
    catalog.forEach(spell => visit(spell.id));
    const stages = forgeCaps.map((forge, bosses) => ({bosses, forge,
        reachable: reachableSpells(catalog, bosses, forge)}));
    const bySpell = Object.fromEntries(catalog.map(spell => [spell.id, {
        earliestStage: stages.find(stage => stage.reachable.includes(spell.id))?.bosses ?? null,
        usedBy: catalog.filter(other => other.inputs?.includes(spell.id)).map(other => other.id)
    }]));
    const unreachable = catalog.filter(spell => bySpell[spell.id].earliestStage === null).map(spell => spell.id);
    if (unreachable.length) issues.push(`Unreachable spells: ${unreachable.join(', ')}`);
    return {issues: [...new Set(issues)], stages, bySpell, unreachable,
        baseCount: catalog.filter(spell => !spell.inputs).length,
        fusionCount: catalog.filter(spell => spell.inputs).length,
        multiStepCount: catalog.filter(spell => spell.inputs?.some(id => byId.get(id)?.inputs)).length};
}
