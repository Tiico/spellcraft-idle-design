// The simulator catalog. Proposed content is never an implicit PRD decision.
export const metadata = {
    version: '2026.11.02.14',
    prdVersion: '1.26',
    lastReviewed: '2026-11-02',
    sourcePrdSha256: 'd6b8a4f53608f99ad308a452b9936e12a3289df3a69f90bd74eeae6fc2deb83a'
};
export const realms = ['Fire', 'Ice', 'Earth', 'Wind'];
export const rules = {
    fusionCost: 30,
    forgeCaps: [0, 1, 2, 3, 3],
    bossRewards: [0, 80, 80, 0],
    forgeUpgradeCosts: [0, 20, 40]
};
export const spells = [
    {id:'fire',name:'Firebolt',symbol:'Ô£ª',color:'#f6a47f',realm:0,level:0,cost:0,known:true,role:'Starting offensive spell.',x:135,y:90},
    {id:'ice',name:'Icebolt',symbol:'ÔØä',color:'#9cd5e3',realm:1,level:1,cost:5,known:true,role:'An extra spell that increases early farming output.',x:135,y:190},
    {id:'stone',name:'Stone Spike',symbol:'Ôùå',color:'#cdbb8b',realm:2,level:2,cost:10,role:'Proposal: a heavy single-target strike.',x:135,y:290},
    {id:'gale',name:'Gale Blade',symbol:'Ôëï',color:'#b7dba8',realm:3,level:3,cost:10,role:'Proposal: a fast sweeping projectile.',x:135,y:390},
    {id:'ember',name:'Ember Ring',symbol:'Ôùë',color:'#f6a47f',realm:0,level:1,cost:10,role:'Proposal: close-range area damage.',x:135,y:490},
    {id:'ward',name:'Frost Ward',symbol:'Ôùç',color:'#9cd5e3',realm:1,level:1,cost:10,role:'Proposal: a self-cast shield that absorbs incoming damage.',x:135,y:590},
    {id:'frostfire',name:'Frostfire Bolt',symbol:'Ô£º',color:'#d2c0ee',level:2,inputs:['fire','ice'],known:true,role:'PRD: a clear power increase over the starting spells.',x:470,y:90},
    {id:'magma',name:'Magma Lance',symbol:'ÔƒÉ',color:'#e6b18e',level:2,inputs:['fire','stone'],role:'Proposal: a stronger heavy strike.',x:470,y:210},
    {id:'hail',name:'Hailstorm',symbol:'Ôüò',color:'#b4ded9',level:3,inputs:['ice','gale'],role:'Proposal: a stronger sweeping storm.',x:470,y:330},
    {id:'vortex',name:'Cinder Vortex',symbol:'ÔùÄ',color:'#e5c28f',level:3,inputs:['ember','gale'],role:'Proposal: a stronger area attack.',x:470,y:450},
    {id:'bastion',name:'Glacial Bastion',symbol:'Ô¼í',color:'#bdcfcf',level:2,inputs:['ward','stone'],role:'Proposal: a stronger shield with an accompanying temporary defensive buff.',x:470,y:570},
    {id:'tempest',name:'Tempest Crown',symbol:'ÔÖ£',color:'#d4ddae',level:3,inputs:['frostfire','hail'],role:'Proposal: the multi-step offensive payoff. Uses two already-fused spells.',x:805,y:330}
];

// Explicit PO exploration template; outside the unchanged shared six-base/six-fusion target.
export const coneProposal = [
    {id:'flame-cone',name:'Flame Cone',symbol:'Ôù¡',color:'#f5ac79',realm:0,level:1,cost:10,role:'Proposal: a cone-shaped flame spell; a shape ingredient for crowd clearing.'},
    {id:'frostfire-cone',name:'Frostfire Cone',symbol:'Ôù¡',color:'#cdb4f2',level:3,inputs:['frostfire','flame-cone'],role:'PO example: Frostfire Bolt gains a wide cone from Flame Cone. Useful against swarms and boss reinforcements. Geometry, recipe and values remain proposals.'}
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
    {id:'fire-shield',name:'Fire Shield',symbol:'Ô¼í',color:'#f5bb79',level:2,inputs:['ward','fire'],role:'PO example: one shield spell combines a barrier, a temporary offensive buff while intact and smaller bolts back at the attacker, including absorbed hits. No separate buff spell or slot. Buff coupling, proc rules, capacity and values are proposals.'}
];
export const withShieldProposal=catalog=>withProposal(catalog,shieldProposal);
