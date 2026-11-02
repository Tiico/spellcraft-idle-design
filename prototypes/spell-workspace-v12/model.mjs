import { realms, spells, rules, metadata } from './catalog.mjs';

// Portable, pure simulation model. No DOM, time, persistence or randomness.
const FusionModel = (() => {
    const find = id => spells.find(s => s.id === id);
    const fresh = () => ({bosses:0,forge:0,essence:0,shards:[0,0,0,0],owned:['fire'],discovered:[],log:[],notice:'Start with Firebolt. The Fire boss is reachable without a fusion.',error:false});
    const finish = (s,notice,error=false) => ({...s,notice,error,log:[notice,...s.log].slice(0,20)});
    const cap = s => rules.forgeCaps[s.bosses];
    function reduce(state,action) {
        const s = {...state,owned:[...state.owned],discovered:[...state.discovered],shards:[...state.shards],log:[...state.log]};
        if(action.type === 'boss') {
            if(s.bosses === 4) return finish(s,'All four initial realm-guardian milestones are complete. Later tiers continue in the journey prototype.',true);
            const name = realms[s.bosses++];
            if(s.bosses === 1) s.forge = 1;
            s.essence += rules.bossRewards[s.bosses - 1];
            return finish(s,`${name} boss victory simulated. ${s.bosses===1?'Ice, forge level 1 and side activities open.':s.bosses===2?'Earth opens. +80 proposed essence covers the level 2 upgrade (20) and Frostfire (30).':s.bosses===3?'Wind opens. +80 proposed essence; forge level 3 can now be purchased.':'Tier 1 guardian milestones are complete. Fire tier 2 opens in the journey model.'}`);
        }
        if(action.type === 'farm') {
            const realm = action.realm;
            if(!Number.isInteger(realm) || realm < 0 || realm > Math.min(s.bosses,3)) return finish(s,'That realm is unavailable. No shards collected.',true);
            s.shards[realm] += 5;
            return finish(s,`Collected 5 ${realms[realm].toLowerCase()} shards. Simulated resource grant; no time simulation. Returning to an unlocked realm is allowed.`);
        }
        if(action.type === 'craft') {
            const spell = find(action.id);
            if(!spell || spell.inputs || s.owned.includes(spell.id)) return finish(s,'No new base spell to craft. Nothing spent.',true);
            if(spell.realm > s.bosses || spell.level > s.forge) return finish(s,'Realm or forge requirement not met. Nothing spent.',true);
            if(s.shards[spell.realm] < spell.cost) return finish(s,`Need ${spell.cost} ${realms[spell.realm].toLowerCase()} shards. Nothing spent.`,true);
            s.shards[spell.realm] -= spell.cost;
            s.owned.push(spell.id);
            return finish(s,`${spell.name} unlocked for ${spell.cost} shards. Firebolt and all other spells remain in the library.`);
        }
        if(action.type === 'upgrade') {
            if(s.forge >= cap(s)) return finish(s,'Forge is at its current boss-gated cap. Nothing spent.',true);
            const cost = rules.forgeUpgradeCosts[s.forge];
            if(s.essence < cost) return finish(s,`Need ${cost} essence for the next forge level. Nothing spent.`,true);
            s.essence -= cost; s.forge++;
            return finish(s,`Forge upgraded to level ${s.forge} for ${cost} proposed essence.`);
        }
        if(action.type === 'fuse') {
            if(!action.a || !action.b || action.a === action.b || !s.owned.includes(action.a) || !s.owned.includes(action.b)) return finish(s,'Choose two different unlocked spells. Nothing spent.',true);
            const recipe = spells.find(p => p.inputs && p.inputs.includes(action.a) && p.inputs.includes(action.b));
            if(!recipe) return finish(s,'This pair has no recipe. Nothing spent.',true);
            if(recipe.level > s.forge) return finish(s,'Forge level too low for this pair. Nothing spent; result remains hidden.',true);
            if(s.owned.includes(recipe.id)) return finish(s,'You already know this result. Nothing spent. This duplicate-attempt rule is a simulation proposal.',true);
            if(s.essence < rules.fusionCost) return finish(s,`Need ${rules.fusionCost} essence for a fusion. Nothing spent; result remains hidden.`,true);
            s.essence -= rules.fusionCost; s.owned.push(recipe.id); s.discovered.push(recipe.id);
            return finish(s,`Discovered ${recipe.name}! ${rules.fusionCost} essence spent; both ingredients remain unlocked.`);
        }
        if(action.type === 'essence') { s.essence += 60; return finish(s,'+60 simulation essence granted for free exploration. This is a design control, not a proposed reward rate.'); }
        return s;
    }
    function preset(name) {
        const s = fresh();
        if(name==='chain' || name==='invalid') {
            Object.assign(s,{bosses:3,forge:3,essence:180,owned:spells.filter(p=>!p.inputs).map(p=>p.id),notice:'Scenario setup: Earth defeated, forge 3, all six base spells unlocked, 180 proposed essence.'});
        }
        return s;
    }
    return {realms,spells,find,fresh,reduce,cap,preset};
})();

export default FusionModel;

// Content design drafts are independent of simulated player progression above.
// Normalize all imported/browser data before it reaches rendering or analysis.
export function normalizeWorkspace(value) {
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.spells) ||
        value.spells.length < spells.length || value.spells.length > 100) {
        throw new Error('Expected a version 1 workspace with the shared catalog and at most 100 spells.');
    }
    const catalog = value.spells.map(source => {
        if (!source || typeof source !== 'object' || typeof source.id !== 'string' ||
            !/^[a-z][a-z0-9-]{0,47}$/.test(source.id)) throw new Error('Spell IDs must be unique lowercase names, up to 48 characters.');
        for (const [field, max] of [['name',80], ['role',600], ['symbol',4]]) {
            if (typeof source[field] !== 'string' || !source[field].trim() || source[field].length > max) {
                throw new Error(`Invalid ${field} for ${source.id} (1–${max} characters required).`);
            }
        }
        if (typeof source.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(source.color)) {
            throw new Error(`Invalid accent color for ${source.id}.`);
        }
        if (!Number.isInteger(source.level) || source.level < 0 || source.level > 3) {
            throw new Error(`Forge requirement for ${source.id} must be between 0 and 3.`);
        }
        const spell = {id:source.id,name:source.name.trim(),role:source.role.trim(),symbol:source.symbol.trim(),
            color:source.color,level:source.level};
        if (source.inputs !== undefined) {
            if (!Array.isArray(source.inputs) || source.inputs.length !== 2 ||
                source.inputs.some(id => typeof id !== 'string')) throw new Error(`A fusion needs two ingredients: ${source.id}.`);
            spell.inputs = [...source.inputs];
        } else {
            if (!Number.isInteger(source.realm) || source.realm < 0 || source.realm > 3 ||
                !Number.isInteger(source.cost) || source.cost < 0 || source.cost > 1000000) {
                throw new Error(`Invalid shard realm or cost for ${source.id}.`);
            }
            Object.assign(spell, {realm:source.realm,cost:source.cost});
        }
        const original = spells.find(item => item.id === spell.id);
        const fields = ['name','role','symbol','color','level','realm','cost'];
        const unchanged = original && fields.every(key => original[key] === spell[key]) &&
            JSON.stringify(original.inputs) === JSON.stringify(spell.inputs);
        spell.draft = !unchanged;
        spell.known = !!(unchanged && original.known);
        return spell;
    });
    for (const original of spells) {
        if (!catalog.some(spell => spell.id === original.id)) throw new Error(`Workspace must retain shared spell ${original.id}.`);
    }
    return catalog;
}

export function workspaceDocument(catalog) {
    return {schemaVersion:1, sourceCatalogVersion:metadata.version, spells:catalog};
}

export function layoutCatalog(catalog) {
    const byId = new Map(catalog.map(spell => [spell.id,spell]));
    const depths = new Map();
    function depth(id, path = new Set()) {
        if (depths.has(id)) return depths.get(id);
        if (path.has(id) || !byId.has(id)) return 0;
        const nextPath = new Set(path).add(id);
        const inputs = byId.get(id).inputs;
        const value = inputs ? 1 + Math.max(...inputs.map(input => depth(input,nextPath))) : 0;
        depths.set(id,value);
        return value;
    }
    const counts = new Map();
    const nodes = catalog.map(spell => {
        const column = depth(spell.id);
        const row = counts.get(column) || 0;
        counts.set(column,row + 1);
        return {...spell,x:116 + column * 240,y:93 + row * 96,column};
    });
    return {nodes,width:Math.max(720,Math.max(...nodes.map(spell => spell.x)) + 120),
        height:Math.max(360, Math.max(...counts.values()) * 96 + 52),columns:counts.size};
}
