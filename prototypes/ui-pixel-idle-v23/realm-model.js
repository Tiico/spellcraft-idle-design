/* Shared realm-place review data. Names, route lengths and landmark positions are proposals. */
(function(scope){
    const routes=[
        {name:'Fire',places:[['emberwood','Emberwood','portal'],['cinder-crossing','Cinder Crossing','pond'],['ashen-ruins','Ashen Ruins','workshop']],boss:['sentinel-keep','Sentinel Keep','The Ember Sentinel']},
        {name:'Ice',places:[['hushed-glacier','Hushed Glacier','portal'],['frostfall-lake','Frostfall Lake','pond'],['crystal-pass','Crystal Pass','mine'],['winter-spire','Winter Spire','workshop']],boss:['wardens-crown',"Warden’s Crown",'The Glacier Warden']},
        {name:'Earth',places:[['verdant-hollow','Verdant Hollow','portal'],['mossroot-grove','Mossroot Grove','moth'],['stonevein-quarry','Stonevein Quarry','mine'],['tangled-ruins','Tangled Ruins','workshop'],['rootbound-gate','Rootbound Gate','portal']],boss:['colossus-heart','Colossus Heart','The Root Colossus']},
        {name:'Wind',places:[['skyreach','Skyreach','portal'],['gale-bridges','Gale Bridges','pond'],['stormwatch','Stormwatch','workshop']],boss:['tempest-shrine','Tempest Shrine','The Sky Keeper']}
    ].map(r=>Object.freeze({...r,places:Object.freeze(r.places.map(([id,name,art])=>Object.freeze({id,name,art}))),boss:Object.freeze({id:r.boss[0],name:r.boss[1],guardian:r.boss[2]})}));
    const valid=r=>Number.isInteger(r)&&r>=0&&r<routes.length;
    const count=r=>valid(r)?routes[r].places.length:0;
    const place=(r,level)=>valid(r)?routes[r].places[level-1]||null:null;
    const canVisit=(won,r)=>valid(r)&&(r===0||won.slice(0,r).every(Boolean));
    const frontier=(s,r)=>Math.min(count(r),s.cleared[r]+1);
    const canTravel=(s,r,level)=>canVisit(s.won,r)&&Number.isInteger(level)&&level>0&&level<=count(r)&&(s.won[r]||level<=frontier(s,r));
    const gate=(s,r=s.realm)=>valid(r)&&!s.won[r]&&s.levels[r]===count(r)&&s.cleared[r]>=count(r);
    function advance(s){const r=s.realm;if(!valid(r)||s.won[r]||s.heldLevel||gate(s)||s.seconds>=43200)return false;s.cleared[r]=Math.max(s.cleared[r],s.levels[r]);s.stageKills=0;if(s.groups)s.groups[r]=0;if(s.placeProgress)s.placeProgress[r][s.levels[r]]=0;if(s.levels[r]<count(r))s.levels[r]++;return true;}
    function travel(s,r,level){
        if(!canTravel(s,r,level))return false;
        s.groups||=[0,0,0,0];s.placeProgress||=[{},{},{},{}];s.placeProgress[s.realm][s.levels[s.realm]]=s.stageKills;s.groups[s.realm]=s.stageKills;
        const changed=s.levels[r]!==level;s.realm=r;s.levels[r]=level;s.stageKills=s.placeProgress[r][level]??(changed?0:s.groups[r]);s.groups[r]=s.stageKills;
        s.heldLevel=!!s.won[r]||level<frontier(s,r);return true;
    }
    // Review journey: a tier spans all four realms. Counts, boss positions and scaling are proposals.
    const nodeCount=25,bossNodes=Object.freeze([6,13,19,25]);
    const pairKey=(tier,realm)=>tier+':'+realm;
    const pairIndex=(tier,realm)=>(tier-1)*routes.length+realm;
    const validPair=(tier,realm)=>Number.isSafeInteger(tier)&&tier>0&&tier<=10000&&valid(realm);
    const journeyFresh=()=>({tier:1,realm:0,node:1,unlocked:0,pairs:{'1:0':{cleared:0}},bossReceipts:[]});
    const journeyCanVisit=(s,tier,realm)=>validPair(tier,realm)&&pairIndex(tier,realm)<=s.unlocked;
    const journeyCleared=(s,tier=s.tier,realm=s.realm)=>s.pairs[pairKey(tier,realm)]?.cleared||0;
    const isBoss=node=>bossNodes.includes(node);
    function journeyFrontier(s,tier=s.tier,realm=s.realm){const next=journeyCleared(s,tier,realm)+1;return next>nodeCount?nodeCount-1:isBoss(next)?next-1:next;}
    const journeyGate=s=>s.node===journeyFrontier(s)&&isBoss(journeyCleared(s)+1);
    const journeyTarget=s=>journeyGate(s)?pairKey(s.tier,s.realm)+':'+(journeyCleared(s)+1):null;
    function journeyIdle(s,seconds=0){
        if(!Number.isFinite(seconds)||seconds<0||seconds>=43200||s.node!==journeyFrontier(s)||journeyCleared(s)>=nodeCount||journeyGate(s))return false;
        s.pairs[pairKey(s.tier,s.realm)].cleared++;s.node=journeyFrontier(s);return true;
    }
    function journeyDefeat(s,target){
        if(!target||target!==journeyTarget(s)||s.bossReceipts.includes(target))return false;
        s.pairs[pairKey(s.tier,s.realm)].cleared++;s.bossReceipts.push(target);s.node=journeyFrontier(s);
        if(journeyCleared(s)===nodeCount){const index=pairIndex(s.tier,s.realm)+1;s.unlocked=Math.max(s.unlocked,index);const t=Math.floor(index/routes.length)+1,r=index%routes.length;s.pairs[pairKey(t,r)]||={cleared:0};}
        return true;
    }
    function journeyTravel(s,tier,realm,node){
        if(!journeyCanVisit(s,tier,realm)||!Number.isInteger(node)||node<1||node>nodeCount||isBoss(node)||node>journeyFrontier(s,tier,realm))return false;
        s.tier=tier;s.realm=realm;s.node=node;return true;
    }
    const journeyNext=s=>journeyCleared(s)===nodeCount?{tier:s.realm===routes.length-1?s.tier+1:s.tier,realm:(s.realm+1)%routes.length}:null;
    const journeyPlace=(realm,node)=>routes[realm].places[Math.min(routes[realm].places.length-1,Math.floor((node-1)/nodeCount*routes[realm].places.length))];
    const journey=Object.freeze({nodeCount,bossNodes,pairKey,pairIndex,isBoss,fresh:journeyFresh,canVisit:journeyCanVisit,cleared:journeyCleared,frontier:journeyFrontier,gate:journeyGate,target:journeyTarget,clearIdle:journeyIdle,defeat:journeyDefeat,travel:journeyTravel,next:journeyNext,place:journeyPlace});
    scope.MageRealms=Object.freeze({journey,routes:Object.freeze(routes),count,place,canVisit,frontier,canTravel,gate,advance,travel});
})(globalThis);
