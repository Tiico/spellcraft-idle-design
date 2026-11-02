/* Canonical daily-dungeon review model. Values/reset/quota policy are proposals.
   Explicit trusted-time input; no Unity/UGS/persistence or client-authoritative product rewards. */
(function(scope){
    const dayMs=86400000;
    const definitions=[
        {id:'ore',name:'Moonstone Vault',art:'mine',type:'ore',amount:80,label:'Moonstone ore'},
        {id:'shards',name:'Elemental Rift',art:'portal',type:'shards',amount:25,label:'Element shards'},
        {id:'familiar',name:'Familiar Grove',art:'moth',type:'fragments',amount:5,label:'Familiar fragments'},
        {id:'pearls',name:'Silverfin Grotto',art:'pond',type:'pearls',amount:60,label:'Silverfin pearls'}
    ];
    const day=now=>Number.isFinite(now)?Math.floor(now/dayMs):null;
    const fresh=(now,limit=2)=>({day:day(now),limit:limit===1?1:2,claims:Object.fromEntries(definitions.map(d=>[d.id,0])),active:null,receipts:[],fragments:0});
    const unlocked=player=>player.won[0]&&player.won[1];
    const elementUnlocked=(player,element)=>Number.isInteger(element)&&element>=0&&element<4&&player.won.slice(0,element).every(Boolean);
    const remaining=(daily,id)=>Math.max(0,daily.limit-(daily.claims[id]||0));
    function refresh(daily,now){const next=day(now);if(next!==null&&next>daily.day){daily.day=next;daily.claims=Object.fromEntries(definitions.map(d=>[d.id,0]));return true;}return false;}
    function begin(player,{id,dungeonId,element=0,now}){
        const daily=player.dungeons,def=definitions.find(d=>d.id===dungeonId);
        if(!id||!def||day(now)===null)return {ok:false,reason:'Invalid run'};
        if(!unlocked(player))return {ok:false,reason:'Defeat the Ice boss to unlock dungeons'};
        if(def.type==='shards'&&!elementUnlocked(player,element))return {ok:false,reason:'Unlock this realm first'};
        if(daily.receipts.some(r=>r.id===id))return {ok:false,reason:'Already completed'};
        if(daily.active)return daily.active.id===id?{ok:true,duplicate:true,run:structuredClone(daily.active)}:{ok:false,reason:'Finish or leave the current run'};
        refresh(daily,now);if(!remaining(daily,dungeonId))return {ok:false,reason:'Done for today'};
        daily.active={id,dungeonId,goal:24,reward:{type:def.type,amount:def.amount,element:def.type==='shards'?element:null}};
        return {ok:true,run:structuredClone(daily.active)};
    }
    function complete(player,{id,popped,now}){
        const daily=player.dungeons,old=daily.receipts.find(r=>r.id===id);
        if(old)return {ok:true,duplicate:true,receipt:old};
        const run=daily.active;if(!run||run.id!==id||!Number.isFinite(popped)||popped<run.goal||day(now)===null)return {ok:false,reason:'Clear the swarm first'};
        refresh(daily,now);if(!remaining(daily,run.dungeonId))return {ok:false,reason:'Done for today'};
        const r=run.reward;
        if(r.type==='ore')player.ore+=r.amount;
        else if(r.type==='pearls')player.pearls+=r.amount;
        else if(r.type==='shards')player.shards[r.element]+=r.amount;
        else daily.fragments+=r.amount;
        daily.claims[run.dungeonId]++;daily.active=null;
        const receipt={id,dungeonId:run.dungeonId,day:daily.day,reward:{...r},fragments:daily.fragments,familiarsEarned:Math.floor(daily.fragments/20)};
        daily.receipts.push(receipt);return {ok:true,duplicate:false,receipt};
    }
    function abandon(player,id){if(player.dungeons.active?.id!==id)return false;player.dungeons.active=null;return true;}
    scope.MageDungeons=Object.freeze({definitions,dayMs,fresh,unlocked,elementUnlocked,remaining,refresh,begin,complete,abandon,fragmentGoal:20,nextReset:daily=>(daily.day+1)*dayMs});
})(globalThis);
