/* Review-only permanent relics and stack inventory. Explicit receipts, samples, time and rates.
   Production authority/persistence belong to the server; all prices/values are proposals. */
(function(root){
    const R=root.MageRarity,quantities=Object.freeze([1,2,5,10,25]);
    const stats=Object.freeze([
        ['haste','Attack speed','idle',0,1,50,'time'],['yield','Shard yield','idle',1,1,50,'fire'],['crit','Critical chance','idle',2,.5,25,'power'],['critical','Critical power','idle',3,2,100,'fire'],['double','Double cast','idle',4,.5,20,'power'],
        ['cooldown','Cooldown reduction','active',0,.5,35,'time'],['area','Spell area','active',1,1,50,'wind'],['shield','Shield strength','active',2,1,50,'hp'],['echo','Spell echo','active',3,.5,25,'power'],['chain','Chain reaction','active',4,.25,10,'fire']
    ].map(([id,name,mode,rarity,step,cap,art])=>Object.freeze({id,name,mode,rarity,step,cap,art})));
    const chestOdds=Object.freeze([[10000,0,0,0,0],[4000,6000,0,0,0],[2000,3000,5000,0,0],[1000,1500,2500,5000,0],[0,1000,2000,3000,4000]].map(Object.freeze));
    const definitions=[...R.tiers.map((name,rarity)=>({id:'relic-'+rarity,name:name+' relic chest',short:name+' chest',kind:'chest',rarity,art:'chest-'+name.toLowerCase()+'-closed',price:[50,100,250,600,1500][rarity],sell:[10,20,50,120,300][rarity],conversion:[10,20,50,120,300][rarity]}))];
    for(const [kind,name,values,rarities]of [['time','Time Scroll',[1,10,60,360],[0,1,2,3]],['focus','Focus Incense',[1,5,15,60],[0,1,2,3]],['echo','Echo Sigil',[5,20,50,100],[1,2,3,4]]])values.forEach((value,i)=>definitions.push({id:kind+'-'+value,name:name+' · '+value+(kind==='echo'?' casts':'m'),short:name,kind,rarity:rarities[i],value,art:{time:'time-scroll',focus:'focus-incense',echo:'echo-sigil'}[kind],price:(kind==='echo'?10:20)*value,sell:(kind==='echo'?2:4)*value}));
    definitions.forEach(Object.freeze);Object.freeze(definitions);
    const find=id=>definitions.find(d=>d.id===id),safe=s=>typeof s==='string'&&/^[-a-z0-9]{1,96}$/i.test(s),integer=n=>Number.isSafeInteger(n)&&n>0&&n<=1000000;
    const milestoneIntervals=Object.freeze({idle:50,active:240});
    const fresh=()=>({stocks:Object.fromEntries(definitions.map(d=>[d.id,0])),ranks:Object.fromEntries(stats.map(s=>[s.id,0])),receipts:[],grants:[],milestones:[],progress:{idle:0,active:0},focusUntil:0,echoCharges:0});
    const value=(data,id)=>{const s=stats.find(s=>s.id===id);return s?Math.min(s.cap,(data?.ranks[id]||0)*s.step):0;};
    function grant(data,{id,key,count=1}){if(!safe(id)||!find(key)||!integer(count))return {ok:false};const signature=JSON.stringify([key,count]),old=data.grants.find(r=>r.id===id);if(old)return {ok:old.signature===signature,duplicate:true};if(!Number.isSafeInteger(data.stocks[key]+count))return {ok:false};data.stocks[key]+=count;data.grants.push({id,signature});return {ok:true,duplicate:false};}
    function quote(player,{action,key,count=1,now=0,rates={}}){
        const d=find(key),data=player.inventory;if(!d||!data||!['buy','sell','open','use'].includes(action)||!integer(count)||!Number.isFinite(now)||now<0)return {ok:false,reason:'Invalid request'};
        const rateKeys=['shards','ore','pearls'],validRates=rateKeys.every(k=>Number.isFinite(rates[k])&&rates[k]>=0&&rates[k]<=1e9);
        if(d.kind==='time'&&['buy','use'].includes(action)&&!validRates)return {ok:false,reason:'Production unavailable'};
        const production=d.kind==='time'&&validRates?Object.fromEntries(rateKeys.map(k=>[k,Math.floor(rates[k]*d.value*count)])):null;
        const unitPrice=d.kind==='time'?Math.max(d.price,validRates?Math.ceil((rates.ore+rates.pearls*2+rates.shards*2)*d.value*2):d.price):d.price;
        const total=action==='buy'?unitPrice*count:action==='sell'?d.sell*count:0,stock=data.stocks[key]||0,seconds=d.kind==='time'?d.value*60*count:0;
        if(production&&player.ventureDevelopment&&root.MageVentureDevelopment)production.materials=root.MageVentureDevelopment.preview(player.ventureDevelopment,rates,d.value*count*60);
        let reason=null;
        if(production?.materials&&Object.entries(production.materials).some(([id,n])=>!Number.isFinite(player.ventureDevelopment.stock[id]+n)))reason='Invalid material balance';
        if(action==='buy'&&player.ore<total)reason='Not enough Ore';
        if(action!=='buy'&&stock<count)reason='Not enough items';
        if(action==='open'&&d.kind!=='chest'||action==='use'&&d.kind==='chest')reason='Choose a valid action';
        if(action==='use'&&d.kind==='time'&&(!Number.isFinite(player.seconds)||player.seconds+seconds>43200))reason='Not enough idle time remaining';
        if(!Number.isSafeInteger(total)||!Number.isFinite(player.ore)||player.ore<0||!Number.isSafeInteger(stock)||stock<0||action==='buy'&&!Number.isSafeInteger(stock+count))reason='Invalid balance';
        if(action==='use'&&d.kind==='time'&&(!Number.isFinite(player.pearls)||!Number.isFinite(player.shards?.[player.realm])))reason='Invalid production balance';
        return {ok:!reason,reason,action,key,count,stock,total,unitPrice,seconds,production,odds:d.kind==='chest'?chestOdds[d.rarity]:null,focusSeconds:d.kind==='focus'?d.value*60*count:0,echoCharges:d.kind==='echo'?d.value*count:0};
    }
    function transact(player,args){
        const {id,action,key,count,now,samples,expectedTotal}=args,data=player.inventory;if(!data||!safe(id))return {ok:false,reason:'Invalid receipt'};const signature=JSON.stringify([action,key,count]),old=data.receipts.find(r=>r.id===id);if(old)return old.signature===signature?{ok:true,duplicate:true,receipt:old}:{ok:false,reason:'Receipt conflicts'};
        const q=quote(player,args);if(!q.ok)return q;if(expectedTotal!==undefined&&expectedTotal!==q.total)return {ok:false,reason:'Price changed. Review the new total.'};
        const d=find(key),changes={},gains={};let converted=0;
        if(action==='open'){
            if(!Array.isArray(samples)||samples.length!==count*2||!samples.every(n=>Number.isFinite(n)&&n>=0&&n<1))return {ok:false,reason:'Invalid chest rolls'};
            for(let i=0;i<count;i++){const rarity=R.roll(q.odds,samples[i*2]),mode=samples[i*2+1]<.5?'idle':'active',s=stats.find(s=>s.mode===mode&&s.rarity===rarity),rank=changes[s.id]??data.ranks[s.id],next=Math.min(Math.ceil(s.cap/s.step),rank+1);if(next===rank)converted++;else{changes[s.id]=next;gains[s.id]=(gains[s.id]||0)+s.step;}}
        }
        const receipt={id,signature,action,key,count,rarity:d.rarity,total:q.total,gains,converted,convertedOre:action==='open'?converted*d.conversion:0,production:action==='use'?q.production:null,seconds:action==='use'?q.seconds:0,focusSeconds:q.focusSeconds,echoCharges:q.echoCharges};
        data.stocks[key]+=(action==='buy'?count:-count);if(action==='buy')player.ore-=q.total;if(action==='sell')player.ore+=q.total;
        if(action==='open'){Object.assign(data.ranks,changes);player.ore+=receipt.convertedOre;}
        if(action==='use'&&d.kind==='time'){player.seconds+=q.seconds;player.ore+=q.production.ore;player.pearls+=q.production.pearls;player.shards[player.realm]+=q.production.shards;if(q.production.materials)root.MageVentureDevelopment.credit(player.ventureDevelopment,q.production.materials); }
        if(action==='use'&&d.kind==='focus')data.focusUntil=Math.max(now,data.focusUntil)+q.focusSeconds*1000;
        if(action==='use'&&d.kind==='echo')data.echoCharges+=q.echoCharges;
        data.receipts.push(receipt);return {ok:true,duplicate:false,receipt};
    }
    function modifiers(data,now=0){return {idleSpeed:1+value(data,'haste')/100,idleYield:1+value(data,'yield')/100,idleCrit:value(data,'crit')/100,idleCritical:1.5+value(data,'critical')/100,idleDouble:value(data,'double')/100,activeCooldown:1-value(data,'cooldown')/100,activeArea:1+value(data,'area')/100+(data?.focusUntil>now ? .2 : 0),activeShield:1+value(data,'shield')/100,activeEcho:value(data,'echo')/100,activeChain:value(data,'chain')/100};}
    function milestone(player,{source,total,realm=player.realm}){const data=player.inventory;if(!['idle','active'].includes(source)||!Number.isSafeInteger(total)||total<1||!Number.isInteger(realm)||realm<0||realm>3)return [];const interval=milestoneIntervals[source],upto=Math.floor(total/interval),previous=Math.floor(data.progress[source]/interval),found=[];data.progress[source]=Math.max(data.progress[source],total);for(let n=previous+1;n<=upto;n++){const id=source+'-'+n;if(data.milestones.includes(id))continue;const key=n%100===0?'relic-4':n%25===0?'relic-3':n%5===0?'relic-2':n%3===0?'time-10':'relic-0';found.push({id,key});data.milestones.push(id);}return found;}
    root.MageRelics=Object.freeze({stats,definitions,quantities,chestOdds,milestoneIntervals,find,fresh,value,grant,quote,transact,modifiers,milestone});
})(globalThis);
