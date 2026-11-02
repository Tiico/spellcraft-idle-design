/* Review model. Loot, assignment and production are server-owned in the product.
   No time, randomness, network or store entitlements enter these calculations. */
(function(root){
    const definitions=Object.freeze([
        {id:'delver',name:'Ember Delver',art:'spirit-delver',rarity:'Rare',ventures:['mine'],work:2,boost:.25,side:1,perk:'+25% Ore · +1 Pearl/min'},
        {id:'weaver',name:'Mist Weaver',art:'spirit-weaver',rarity:'Epic',ventures:['pond'],work:2,boost:.30,cross:.10,perk:'+30% Pearls · +10% Mine'},
        {id:'echo',name:'Echo Wisp',art:'spirit-echo',rarity:'Epic',ventures:['mine','pond'],work:2,boost:.20,cross:.10,perk:'+20% here · +10% other venture'}
    ].map(d=>Object.freeze({...d,ventures:Object.freeze(d.ventures)})));
    const find=id=>definitions.find(d=>d.id===id);
    const fresh=()=>({owned:[{id:'delver-1',kind:'delver',assigned:'mine'},{id:'weaver-1',kind:'weaver',assigned:null},{id:'echo-1',kind:'echo',assigned:null}],receipts:[]});
    function assign(data,id,venture){const item=data.owned.find(s=>s.id===id),d=find(item?.kind);if(!d||venture!==null&&!d.ventures.includes(venture))return false;item.assigned=venture;return true;}
    function drop(data,{receipt,id,kind}){if(typeof receipt!=='string'||!receipt||typeof id!=='string'||!id||!find(kind))return {ok:false};const old=data.receipts.find(r=>r.receipt===receipt);if(old)return old.id===id&&old.kind===kind?{ok:true,duplicate:true}:{ok:false};if(data.owned.some(s=>s.id===id))return {ok:false};data.owned.push({id,kind,assigned:null});data.receipts.push({receipt,id,kind});return {ok:true,duplicate:false};}
    function production({mining=1,fishing=1,synergy=false,ventureDevelopment},data){let mine=0,pond=0,side=0,mineWorkers=0,pondWorkers=0;for(const s of data.owned){const d=find(s.kind);if(!d||!d.ventures.includes(s.assigned))continue;if(s.assigned==='mine'){mineWorkers+=d.work;mine+=d.boost;pond+=d.cross||0;side+=d.side||0;}else{pondWorkers+=d.work;pond+=d.boost;mine+=d.cross||0;}}const ore=(mining+mineWorkers)*5*(1+mine)*(synergy?1.25:1),pearls=(fishing+pondWorkers)*8*(1+pond)+side;const habitat=root.MageVentureDevelopment?.bonuses(ventureDevelopment)||{mine:1,pond:1};return {ore:ore*habitat.mine,pearls:pearls*habitat.pond,mineBonus:mine,pondBonus:pond,sidePearls:side,mineWorkers,pondWorkers};}
    root.MageVentureSpirits=Object.freeze({definitions,find,fresh,assign,drop,production});
})(globalThis);
