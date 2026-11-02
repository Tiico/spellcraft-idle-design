/* Realm-exclusive discovery review model. Rates, intervals, spell names/effects and the 3-per-realm pools are proposals.
   Each realm pool shares one pity track; a find picks uniformly among spells neither owned nor pending, so no duplicate drops before the pool is complete.
   Trusted elapsed time, source, event identity and random samples are explicit inputs: one sample per roll and one more to pick the spell after a hit. */
(function(scope){
    const definitions=[
        {id:'ember-bloom',name:'Ember Bloom',realm:0,art:'emberbloom',damage:36,cooldown:5,pattern:{shape:'burst',radius:13},description:'Embers bloom around the impact, striking nearby monsters.'},
        {id:'glacier-lance',name:'Glacier Lance',realm:1,art:'glacierlance',damage:48,cooldown:5,pattern:{shape:'bolt'},description:'A heavy ice lance strikes one enemy.'},
        {id:'stoneburst',name:'Stoneburst',realm:2,art:'stoneburst',damage:28,cooldown:4,pattern:{shape:'burst',radius:15},description:'Stone fragments burst across a cluster of monsters.'},
        {id:'gale-spiral',name:'Gale Spiral',realm:3,art:'galespiral',damage:22,cooldown:3,pattern:{shape:'burst',radius:18},description:'A wide spiral of wind sweeps through nearby monsters.'},
        {id:'ashfall',name:'Ashfall',realm:0,art:'ashfall',damage:26,cooldown:4,pattern:{shape:'burst',radius:16},description:'Glowing ash rains over a wide patch of monsters.'},
        {id:'flare-javelin',name:'Flare Javelin',realm:0,art:'flarejavelin',damage:52,cooldown:6,pattern:{shape:'bolt'},description:'A white-hot javelin pierces one enemy.'},
        {id:'rime-nova',name:'Rime Nova',realm:1,art:'rimenova',damage:24,cooldown:4,pattern:{shape:'burst',radius:17},description:'A ring of frost bursts outward from the impact.'},
        {id:'frost-fang',name:'Frost Fang',realm:1,art:'frostfang',damage:40,cooldown:4,pattern:{shape:'bolt'},description:'A quick shard of ice bites one enemy.'},
        {id:'quartz-spike',name:'Quartz Spike',realm:2,art:'quartzspike',damage:44,cooldown:5,pattern:{shape:'bolt'},description:'A crystal spike erupts beneath one enemy.'},
        {id:'bramble-snare',name:'Bramble Snare',realm:2,art:'bramblesnare',damage:30,cooldown:5,pattern:{shape:'burst',radius:14},description:'Thorned roots lash a cluster of monsters.'},
        {id:'squall-blade',name:'Squall Blade',realm:3,art:'squallblade',damage:30,cooldown:3,pattern:{shape:'bolt'},description:'A thin blade of wind slices one enemy.'},
        {id:'thunder-gust',name:'Thunder Gust',realm:3,art:'thundergust',damage:32,cooldown:5,pattern:{shape:'burst',radius:15},description:'A crackling gust strikes nearby monsters.'}
    ];
    const interval=1200,hardLimit=12,cap=43200;
    const chance=misses=>misses>=hardLimit-1?1:Math.min(55,10+Math.max(0,misses-7)*15)/100;
    const fresh=()=>({bank:[0,0,0,0],misses:[0,0,0,0],windows:{},receipts:[],unseen:[],pending:[]});
    const canFarm=(p,r)=>Number.isInteger(r)&&r>=0&&r<4&&(r===0||p.won.slice(0,r).every(Boolean));
    const pool=r=>definitions.filter(d=>d.realm===r);
    const remaining=(p,r)=>pool(r).filter(d=>!p.unlocked.includes(d.name)&&!(p.realmFinds.pending||[]).includes(d.name));
    function status(p,r){
        const all=pool(r),pending=all.filter(d=>(p.realmFinds.pending||[]).includes(d.name)),owned=all.filter(d=>p.unlocked.includes(d.name)),left=remaining(p,r),misses=p.realmFinds.misses[r],bank=p.realmFinds.bank[r];
        return {pool:all,owned,pending,left,complete:!left.length,misses,chance:chance(misses),nextSeconds:interval-bank,guaranteeRolls:hardLimit-misses,guaranteeSeconds:(hardLimit-misses)*interval-bank};
    }
    function credit(player,{id,windowId,realm,seconds,source='idle',paused=false,samples=[]}){
        if(typeof id!=='string'||typeof windowId!=='string'||!/^[-a-z0-9]{1,96}$/i.test(id)||!/^[a-z0-9][-a-z0-9]{0,95}$/i.test(windowId)||!canFarm(player,realm)||!Number.isFinite(seconds)||seconds<0||!['idle','absence'].includes(source)||paused||(source==='idle'&&!player.idle?.some(Boolean)))return {ok:false,reason:'No qualifying idle time'};
        const key=JSON.stringify([windowId,realm,seconds,source]),old=player.realmFinds.receipts.find(r=>r.id===id);
        if(old)return old.key===key?{ok:true,duplicate:true,receipt:old}:{ok:false,reason:'Conflicting idle report'};
        if(!Array.isArray(samples))return {ok:false,reason:'Missing or invalid random input'};
        const prior=player.realmFinds,next={...prior,bank:[...prior.bank],misses:[...prior.misses],windows:{...prior.windows},unseen:[...prior.unseen],pending:[...(prior.pending||[])]},owned=[...player.unlocked],credited=Math.min(seconds,Math.max(0,cap-(Object.hasOwn(next.windows,windowId)?next.windows[windowId]:0))),rolls=[],found=[];
        next.windows[windowId]=(Object.hasOwn(next.windows,windowId)?next.windows[windowId]:0)+credited;
        let left=pool(realm).filter(d=>!owned.includes(d.name)&&!next.pending.includes(d.name)),used=0;
        const sample=()=>{const s=samples[used++];return Number.isFinite(s)&&s>=0&&s<1?s:null;};
        if(left.length){
            next.bank[realm]+=credited;
            while(next.bank[realm]>=interval&&left.length){
                const roll=sample();if(roll===null)return {ok:false,reason:'Missing or invalid random input'};
                next.bank[realm]-=interval;const odds=chance(next.misses[realm]),hit=roll<odds;
                if(!hit){rolls.push({chance:odds,found:false});next.misses[realm]++;continue;}
                const pick=sample();if(pick===null)return {ok:false,reason:'Missing or invalid random input'};
                const d=left[Math.floor(pick*left.length)];rolls.push({chance:odds,found:true,spell:d.name});
                found.push(d.name);next.pending.push(d.name);next.misses[realm]=0;left=left.filter(x=>x!==d);
            }
            if(!left.length)next.bank[realm]=0;
        }
        const receipt={id,key,realm,source,credited,rolls,found,missesAfter:next.misses[realm],bankAfter:next.bank[realm]};next.receipts.push(receipt);player.realmFinds=next;player.unlocked=owned;
        return {ok:true,duplicate:false,receipt};
    }
    scope.MageIdleSpells=Object.freeze({definitions,interval,hardLimit,cap,chance,fresh,canFarm,pool,remaining,status,credit});
})(globalThis);
