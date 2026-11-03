// The simulator catalog. Proposed content is never an implicit PRD decision.
export const metadata = {
    version: '2026.11.03.3',
    prdVersion: '1.29',
    lastReviewed: '2026-11-03',
    sourcePrdSha256: '70defef46e519d97e97f09948cdb52b2d658be36a45e12f1170722d5b22d01d3'
};
export const realms = ['Fire', 'Ice', 'Earth', 'Wind'];
export const rules = {
    fusionCost: 30,
    forgeCaps: [0, 1, 2, 3, 3],
    bossRewards: [0, 80, 80, 0],
    forgeUpgradeCosts: [0, 20, 40]
};
// The tier 1 boss milestones that the 0–4 availability analysis counts in order (PRD §4 and §5.1, P-01).
// `gates` are the decided boss-node unlocks of the game content catalog; a test keeps both in agreement.
// The Ice milestone also covers the rest of the Ice path, because its guardian on node 25 opens Earth.
export const milestones = [
    {name:'Fire boss', node:6, gates:[{realm:0, tier:1, node:6, realms:[{realm:1, tier:1}], forgeLevel:1}],
        summary:'The Fire boss on Fire node 6 opens the Ice realm, forge level 1 and the first two side activities.'},
    {name:'Ice boss', node:6, gates:[{realm:1, tier:1, node:6, realms:[], forgeLevel:2},
        {realm:1, tier:1, node:25, realms:[{realm:2, tier:1}], forgeLevel:null}],
        summary:'The Ice boss on Ice node 6 opens forge level 2 with the fixed introduction reward. This milestone also covers the rest of the Ice path: the Ice guardian on node 25 opens Earth.'},
    {name:'Earth boss', node:null, gates:[],
        summary:'The Earth milestone allows the proposed forge level 3; which Earth boss node carries it is not decided. The Earth guardian on node 25 opens Wind.'},
    {name:'Wind boss', node:null, gates:[],
        summary:'The Wind milestone ends with the Wind guardian on node 25, which completes tier 1 and opens Fire tier 2. Later tiers add no forge gates in this tool.'}
];
export const spells = [
    {id:'fire',name:'Firebolt',symbol:'✦',color:'#f6a47f',realm:0,level:0,cost:0,known:true,role:'Starting offensive spell.',x:135,y:90},
    {id:'ice',name:'Icebolt',symbol:'❄',color:'#9cd5e3',realm:1,level:1,cost:5,known:true,role:'An extra spell that increases early farming output.',x:135,y:190},
    {id:'stone',name:'Stone Spike',symbol:'◆',color:'#cdbb8b',realm:2,level:2,cost:10,role:'Proposal: a heavy single-target strike.',x:135,y:290},
    {id:'gale',name:'Gale Blade',symbol:'≋',color:'#b7dba8',realm:3,level:3,cost:10,role:'Proposal: a fast sweeping projectile.',x:135,y:390},
    {id:'ember',name:'Ember Ring',symbol:'◉',color:'#f6a47f',realm:0,level:1,cost:10,role:'Proposal: close-range area damage.',x:135,y:490},
    {id:'ward',name:'Frost Ward',symbol:'◇',color:'#9cd5e3',realm:1,level:1,cost:10,role:'Proposal: a self-cast shield that absorbs incoming damage.',x:135,y:590},
    {id:'frostfire',name:'Frostfire Bolt',symbol:'✧',color:'#d2c0ee',level:2,inputs:['fire','ice'],known:true,role:'PRD: a clear power increase over the starting spells.',x:470,y:90},
    {id:'magma',name:'Magma Lance',symbol:'⟐',color:'#e6b18e',level:2,inputs:['fire','stone'],role:'Proposal: a stronger heavy strike.',x:470,y:210},
    {id:'hail',name:'Hailstorm',symbol:'⁕',color:'#b4ded9',level:3,inputs:['ice','gale'],role:'Proposal: a stronger sweeping storm.',x:470,y:330},
    {id:'vortex',name:'Cinder Vortex',symbol:'◎',color:'#e5c28f',level:3,inputs:['ember','gale'],role:'Proposal: a stronger area attack.',x:470,y:450},
    {id:'bastion',name:'Glacial Bastion',symbol:'⬡',color:'#bdcfcf',level:2,inputs:['ward','stone'],role:'Proposal: a stronger shield with an accompanying temporary defensive buff.',x:470,y:570},
    {id:'tempest',name:'Tempest Crown',symbol:'♜',color:'#d4ddae',level:3,inputs:['frostfire','hail'],role:'Proposal: the multi-step offensive payoff. Uses two already-fused spells.',x:805,y:330}
];

// Explicit PO exploration template; outside the unchanged shared six-base/six-fusion target.
export const coneProposal = [
    {id:'flame-cone',name:'Flame Cone',symbol:'◭',color:'#f5ac79',realm:0,level:1,cost:10,role:'Proposal: a cone-shaped flame spell; a shape ingredient for crowd clearing.'},
    {id:'frostfire-cone',name:'Frostfire Cone',symbol:'◭',color:'#cdb4f2',level:3,inputs:['frostfire','flame-cone'],role:'PO example: Frostfire Bolt gains a wide cone from Flame Cone. Useful against swarms and boss reinforcements. Geometry, recipe and values remain proposals.'}
];
function withProposal(catalog,candidates) {
    const next=structuredClone(catalog);
    for(const candidate of candidates){
        const existing=next.find(item=>item.id===candidate.id);
        if(existing){
            if(['name','role','level','realm','cost','inputs'].some(key=>JSON.stringify(existing[key])!==JSON.stringify(candidate[key])))throw new Error(`Local draft conflict: ${candidate.id}. Existing drafts were kept; the proposal was not added.`);
        }else next.push(structuredClone(candidate));
    }
    return next;
}

export const withConeProposal=catalog=>withProposal(catalog,coneProposal);
export const shieldProposal = [
    {id:'fire-shield',name:'Fire Shield',symbol:'⬡',color:'#f5bb79',level:2,inputs:['ward','fire'],role:'PO example: one shield spell combines a barrier, a temporary offensive buff while intact and smaller bolts back at the attacker, including absorbed hits. No separate buff spell or slot. Buff coupling, proc rules, capacity and values are proposals.'}
];
export const withShieldProposal=catalog=>withProposal(catalog,shieldProposal);
