/* Realm-exclusive discovery review model. Rates, intervals, spell effects and pool sizes are proposals.
   Trusted elapsed time, source, event identity and random samples are explicit inputs. */
(function(scope){
    const definitions=[
        {id:'ember-bloom',name:'Ember Bloom',realm:0,art:'emberbloom',damage:36,cooldown:5,pattern:{shape:'burst',radius:13},description:'Embers bloom around the impact, striking nearby monsters.'},
        {id:'glacier-lance',name:'Glacier Lance',realm:1,art:'glacierlance',damage:48,cooldown:5,pattern:{shape:'bolt'},description:'A heavy ice lance strikes one enemy.'},
        {id:'stoneburst',name:'Stoneburst',realm:2,art:'stoneburst',damage:28,cooldown:4,pattern:{shape:'burst',radius:15},description:'Stone fragments burst across a cluster of monsters.'},
        {id:'gale-spiral',name:'Gale Spiral',realm:3,art:'galespiral',damage:22,cooldown:3,pattern:{shape:'burst',radius:18},description:'A wide spiral of wind sweeps through nearby monsters.'}
    ];
    const interval=300,hardLimit=10,cap=43200;
    const chance=misses=>misses>=9?1:Math.min(55,10+Math.max(0,misses-5)*15)/100;
    const fresh=()=>({bank:[0,0,0,0],misses:[0,0,0,0],windows:{},receipts:[],unseen:[],pending:[]});
    const canFarm=(p,r)=>Number.isInteger(r)&&r>=0&&r<4&&(r===0||p.won.slice(0,r).every(Boolean));
    function credit(player,{id,windowId,realm,seconds,source='idle',paused=false,samples=[]}){
        if(typeof id!=='string'||typeof windowId!=='string'||!/^[-a-z0-9]{1,96}$/i.test(id)||!/^[a-z0-9][-a-z0-9]{0,95}$/i.test(windowId)||!canFarm(player,realm)||!Number.isFinite(seconds)||seconds<0||!['idle','absence'].includes(source)||paused||(source==='idle'&&!player.idle?.some(Boolean)))return {ok:false,reason:'No qualifying idle time'};
        const key=JSON.stringify([windowId,realm,seconds,source]),old=player.realmFinds.receipts.find(r=>r.id===id);
        if(old)return old.key===key?{ok:true,duplicate:true,receipt:old}:{ok:false,reason:'Conflicting idle report'};
        if(!Array.isArray(samples))return {ok:false,reason:'Missing or invalid random input'};
        const prior=player.realmFinds,next={...prior,bank:[...prior.bank],misses:[...prior.misses],windows:{...prior.windows},unseen:[...prior.unseen],pending:[...(prior.pending||[])]},owned=[...player.unlocked],def=definitions[realm],credited=Math.min(seconds,Math.max(0,cap-(Object.hasOwn(next.windows,windowId)?next.windows[windowId]:0))),rolls=[],found=[];
        next.windows[windowId]=(Object.hasOwn(next.windows,windowId)?next.windows[windowId]:0)+credited;
        if(!owned.includes(def.name)&&!next.pending.includes(def.name)){
            next.bank[realm]+=credited;
            while(next.bank[realm]>=interval&&!found.length){
                const sample=samples[rolls.length];if(!Number.isFinite(sample)||sample<0||sample>=1)return {ok:false,reason:'Missing or invalid random input'};
                next.bank[realm]-=interval;const odds=chance(next.misses[realm]),hit=sample<odds;rolls.push({chance:odds,found:hit});
                if(hit){found.push(def.name);next.pending.push(def.name);next.misses[realm]=0;next.bank[realm]=0;}
                else next.misses[realm]++;
            }
        }
        const receipt={id,key,realm,source,credited,rolls,found,missesAfter:next.misses[realm],bankAfter:next.bank[realm]};next.receipts.push(receipt);player.realmFinds=next;player.unlocked=owned;
        return {ok:true,duplicate:false,receipt};
    }
    scope.MageIdleSpells=Object.freeze({definitions,interval,hardLimit,cap,chance,fresh,canFarm,credit});
})(globalThis);
