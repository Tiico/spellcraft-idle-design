/* Shared realm journey review model: one tier-node path per realm and tier.
   A tier spans all four realms. Node count, boss positions, scaling and the section split are proposals. */
(function(scope){
    const nodeCount=25,bossNodes=Object.freeze([6,13,19,25]);
    // The earlier named places name the node sections between bosses; each section ends on its boss node.
    const realms=[
        {name:'Fire',sections:[['emberwood','Emberwood','The Ember Watcher'],['cinder-crossing','Cinder Crossing','The Cinder Warden'],['ashen-ruins','Ashen Ruins','The Ashen Knight'],['sentinel-keep','Sentinel Keep','The Ember Sentinel']]},
        {name:'Ice',sections:[['hushed-glacier','Hushed Glacier','Ice Watcher'],['frostfall-lake','Frostfall Lake','Ice Warden'],['crystal-pass','Crystal Pass','Ice Knight'],['wardens-crown','Warden’s Crown','The Glacier Warden']]},
        {name:'Earth',sections:[['verdant-hollow','Verdant Hollow','Earth Watcher'],['mossroot-grove','Mossroot Grove','Earth Warden'],['stonevein-quarry','Stonevein Quarry','Earth Knight'],['colossus-heart','Colossus Heart','The Root Colossus']]},
        {name:'Wind',sections:[['skyreach','Skyreach','Wind Watcher'],['gale-bridges','Gale Bridges','Wind Warden'],['stormwatch','Stormwatch','Wind Knight'],['tempest-shrine','Tempest Shrine','The Sky Keeper']]}
    ].map(r=>Object.freeze({...r,sections:Object.freeze(r.sections.map(([id,name,boss],i)=>Object.freeze({id,name,boss,from:i?bossNodes[i-1]+1:1,to:bossNodes[i]})))}));
    const valid=r=>Number.isInteger(r)&&r>=0&&r<realms.length;
    const pairKey=(tier,realm)=>tier+':'+realm;
    const pairIndex=(tier,realm)=>(tier-1)*realms.length+realm;
    const validPair=(tier,realm)=>Number.isSafeInteger(tier)&&tier>0&&tier<=10000&&valid(realm);
    const fresh=()=>({tier:1,realm:0,node:1,unlocked:0,pairs:{'1:0':{cleared:0}},bossReceipts:[]});
    const canVisit=(s,tier,realm)=>validPair(tier,realm)&&pairIndex(tier,realm)<=s.unlocked;
    const cleared=(s,tier=s.tier,realm=s.realm)=>s.pairs[pairKey(tier,realm)]?.cleared||0;
    const isBoss=node=>bossNodes.includes(node);
    function frontier(s,tier=s.tier,realm=s.realm){const next=cleared(s,tier,realm)+1;return next>nodeCount?nodeCount-1:isBoss(next)?next-1:next;}
    const gate=s=>s.node===frontier(s)&&isBoss(cleared(s)+1);
    const target=s=>gate(s)?pairKey(s.tier,s.realm)+':'+(cleared(s)+1):null;
    function clearIdle(s,seconds=0){
        if(!Number.isFinite(seconds)||seconds<0||seconds>=43200||s.node!==frontier(s)||cleared(s)>=nodeCount||gate(s))return false;
        s.pairs[pairKey(s.tier,s.realm)].cleared++;s.node=frontier(s);return true;
    }
    function defeat(s,id){
        if(!id||id!==target(s)||s.bossReceipts.includes(id))return false;
        s.pairs[pairKey(s.tier,s.realm)].cleared++;s.bossReceipts.push(id);s.node=frontier(s);
        if(cleared(s)===nodeCount){const index=pairIndex(s.tier,s.realm)+1;s.unlocked=Math.max(s.unlocked,index);const t=Math.floor(index/realms.length)+1,r=index%realms.length;s.pairs[pairKey(t,r)]||={cleared:0};}
        return true;
    }
    function travel(s,tier,realm,node){
        if(!canVisit(s,tier,realm)||!Number.isInteger(node)||node<1||node>nodeCount||isBoss(node)||node>frontier(s,tier,realm))return false;
        s.tier=tier;s.realm=realm;s.node=node;return true;
    }
    const next=s=>cleared(s)===nodeCount?{tier:s.realm===realms.length-1?s.tier+1:s.tier,realm:(s.realm+1)%realms.length}:null;
    const section=(realm,node)=>valid(realm)&&Number.isInteger(node)&&node>=1&&node<=nodeCount?realms[realm].sections.find(s=>node<=s.to):null;
    const journey=Object.freeze({nodeCount,bossNodes,pairKey,pairIndex,isBoss,fresh,canVisit,cleared,frontier,gate,target,clearIdle,defeat,travel,next,section});
    scope.MageRealms=Object.freeze({realms:Object.freeze(realms),journey});
})(globalThis);
