/* Mine loop review model. Veins with HP, one spirit per vein, a tiered upgrade tree, spirit fusion and prestige.
   Time, randomness and command IDs are explicit inputs; absence uses expected values and the shared 12h cap. */
(function(root){
    const CAP_SECONDS=43200,VEINS_PER_DEPTH=9,DEPTHS=3,TREE_CAP=20,TREE_GATE=5,MAX_STARS=5,FUSION_BOSS_WINS=4;
    const depths=Object.freeze([
        {id:'surface',name:'Surface shafts'},
        {id:'deep',name:'Deep veins'},
        {id:'abyss',name:'Abyssal seams'}
    ]);
    const names=[
        ['Tin','Copper','Iron','Zinc','Nickel','Silver','Cobalt','Gold','Platinum'],
        ['Obsidian','Moonstone','Amber','Jade','Opal','Sapphire','Ruby','Emerald','Diamond'],
        ['Mithril','Adamant','Orichalcum','Voidsteel','Starmetal','Dragonbone','Aetherite','Sunstone','Eternium']
    ];
    const colors=[
        ['#b5c8d6','#d58b58','#8d8f99','#9fb3b8','#c7c0a0','#e6e8ef','#5f7fd1','#efca66','#d8c7f6'],
        ['#3b3550','#a9c4e8','#e39a3b','#5fae7a','#e8d9f0','#3f6fd6','#d8404f','#38b06c','#bfeeff'],
        ['#9fe3ff','#7a8aa6','#f0a640','#5d4e7a','#fff3a8','#e8dcc6','#b58cff','#ffb347','#ff6fd8']
    ];
    // HP rises gently inside a depth and jumps between depths; yield doubles per depth so deeper veins stay worth the wait.
    const materials=Object.freeze(names.flatMap((row,depth)=>row.map((name,slot)=>{const index=depth*VEINS_PER_DEPTH+slot;return Object.freeze({index,id:name.toLowerCase(),name,depth,slot,color:colors[depth][slot],hp:Math.round(20*Math.pow(1.15,slot)*Math.pow(4,depth)),yield:3*Math.pow(2,depth)});})));
    const rarities=Object.freeze(['Common','Uncommon','Rare','Epic','Legendary']);
    const rarityColors=Object.freeze(['#c9d2d8','#8fd18c','#6fa8ff','#c98bff','#ffb64d']);
    const dropOdds=Object.freeze([.60,.25,.10,.04,.01]);
    const bonusBands=Object.freeze([[1,20],[15,35],[30,55],[50,80],[75,120]]);
    const extraStats=Object.freeze(['speed','yield','critChance','critDamage']);
    const extraLabels=Object.freeze({speed:'Mining speed',yield:'Yield',critChance:'Crit chance',critDamage:'Crit damage'});
    const extraBands=Object.freeze({speed:[[0,0],[5,15],[10,25],[20,40],[30,60]],yield:[[0,0],[5,15],[10,25],[20,40],[30,60]],critChance:[[0,0],[2,6],[4,10],[8,16],[12,25]],critDamage:[[0,0],[10,30],[20,50],[40,80],[60,120]]});
    const kinds=Object.freeze([{id:'delver',name:'Ember Delver',art:'spirit-delver'},{id:'weaver',name:'Mist Weaver',art:'spirit-weaver'},{id:'echo',name:'Echo Wisp',art:'spirit-echo'}]);
    const tree=Object.freeze([
        [{id:'power',name:'Mining power',unit:'+1 power'},{id:'speed',name:'Mining speed',unit:'+5 %'},{id:'yield',name:'Yield',unit:'+5 %'}],
        [{id:'critChance',name:'Crit chance',unit:'+1 %'},{id:'critDamage',name:'Crit damage',unit:'+5 %'},{id:'rollOdds',name:'Spirit roll odds',unit:'+2.5 % best-of-two'}],
        [{id:'hp',name:'Permanent HP',unit:'+10 HP'},{id:'spellPower',name:'Permanent Spell power',unit:'+2 power'},{id:'fusionOdds',name:'Fusion stat odds',unit:'+2.5 % best-of-two'}]
    ].map(tier=>Object.freeze(tier.map(Object.freeze))));
    const upgrades=Object.freeze(tree.flat());
    const upgrade=id=>upgrades.find(u=>u.id===id);
    const tierOf=id=>tree.findIndex(t=>t.some(u=>u.id===id));
    const material=index=>materials[index];
    const kind=id=>kinds.find(k=>k.id===id);
    const fresh=()=>({
        bossWins:0,seconds:0,
        veins:materials.map(m=>({index:m.index,built:m.index===0,hp:m.hp,swing:0})),
        stock:Object.fromEntries(materials.map(m=>[m.id,0])),
        spirits:[{id:'starter',kind:'delver',rarity:0,stars:0,bonus:5,extras:{},vein:0}],
        tree:Object.fromEntries(upgrades.map(u=>[u.id,0])),
        receipts:[]
    });
    const spirit=(s,id)=>s.spirits.find(x=>x.id===id);
    const assigned=(s,veinIndex)=>s.spirits.find(x=>x.vein===veinIndex)||null;
    const fusionUnlocked=s=>s.bossWins>=FUSION_BOSS_WINS;
    const depthOpen=(s,depth)=>s.veins.some(v=>v.built&&material(v.index).depth===depth);
    const nextVein=s=>s.veins.find(v=>!v.built)||null;
    const veinAvailable=(s,index)=>{const next=nextVein(s);return !!next&&next.index===index&&index<=s.bossWins;};
    // Vein i costs the material mined just before it; a new depth also asks for the previous depth's deepest material.
    function veinCost(index){if(index<=0)return {};const m=material(index-1),cost={[m.id]:40*(m.slot+1)};if(m.slot===VEINS_PER_DEPTH-1)cost[m.id]=200;return cost;}
    function upgradeCost(id,level){const t=tierOf(id),m=materials[t*VEINS_PER_DEPTH+Math.min(Math.floor(level/3),VEINS_PER_DEPTH-1)];return {[m.id]:30+10*level};}
    const affordable=(s,cost)=>Object.entries(cost).every(([id,n])=>Number.isFinite(s.stock[id])&&s.stock[id]>=n);
    const pay=(s,cost)=>{for(const [id,n]of Object.entries(cost))s.stock[id]-=n;};
    // Live and absence production share these numbers; only the crit roll differs (seeded live, expected value away).
    function stats(s,veinIndex){
        const v=s.veins[veinIndex],m=material(veinIndex),sp=assigned(s,veinIndex),t=s.tree,x=sp?.extras||{};
        if(!v?.built||!sp)return {power:0,interval:0,swings:0,yieldMultiplier:0,critChance:0,critDamage:0,expectedDamage:0,rate:0,material:m,spirit:null};
        const power=(4+t.power)*(1+sp.bonus/100);
        const swings=(1/1.5)*(1+t.speed*.05+(x.speed||0)/100);
        const yieldMultiplier=1+t.yield*.05+(x.yield||0)/100;
        const critChance=Math.min(1,t.critChance*.01+(x.critChance||0)/100);
        const critDamage=.5+t.critDamage*.05+(x.critDamage||0)/100;
        const expectedDamage=power*swings*(1+critChance*critDamage);
        return {power,interval:1/swings,swings,yieldMultiplier,critChance,critDamage,expectedDamage,rate:expectedDamage/m.hp*m.yield*yieldMultiplier,material:m,spirit:sp};
    }
    function production(s){const out={};for(const v of s.veins){const r=stats(s,v.index).rate;if(r>0)out[material(v.index).id]=(out[material(v.index).id]||0)+r;}return out;}
    function preview(s,seconds){if(!Number.isFinite(seconds)||seconds<0)return null;const t=Math.min(CAP_SECONDS,seconds);return Object.fromEntries(Object.entries(production(s)).map(([id,rate])=>[id,rate*t]));}
    function credit(s,amounts){if(!amounts||Object.entries(amounts).some(([id,n])=>!(id in s.stock)||!Number.isFinite(n)||n<0))return false;for(const [id,n]of Object.entries(amounts))s.stock[id]+=n;return true;}
    // Live simulation: each swing is explicit so the UI can animate it; rng decides only whether a swing crits.
    function advance(s,dt,rng){
        const events=[];if(!Number.isFinite(dt)||dt<=0)return events;
        for(const v of s.veins){
            const st=stats(s,v.index);if(!st.rate)continue;
            v.swing+=dt;
            while(v.swing>=st.interval){
                v.swing-=st.interval;
                const crit=rng()<st.critChance,damage=st.power*(crit?1+st.critDamage:1);
                v.hp-=damage;
                const event={vein:v.index,damage,crit,broke:false,gained:0};
                // Overkill carries into the next vein so live mining converges on the absence expectation.
                while(v.hp<=0){event.broke=true;event.gained+=st.material.yield*st.yieldMultiplier;s.stock[st.material.id]+=st.material.yield*st.yieldMultiplier;v.hp+=st.material.hp;}
                events.push(event);
            }
        }
        return events;
    }
    const rollBetween=([lo,hi],rng)=>lo+rng()*(hi-lo);
    function bestOf(band,rng,chance){const a=rollBetween(band,rng);return rng()<chance?Math.max(a,rollBetween(band,rng)):a;}
    const round1=n=>Math.round(n*10)/10;
    function rollRarity(rng){const r=rng();let total=0;for(let i=0;i<dropOdds.length-1;i++){total+=dropOdds[i];if(r<total)return i;}return dropOdds.length-1;}
    function drop(s,{id,rng,rarity,kindId}){
        if(typeof id!=='string'||!id||spirit(s,id))return null;
        const rar=rarity??rollRarity(rng),k=kindId??kinds[Math.floor(rng()*kinds.length)].id,chance=s.tree.rollOdds*.025;
        const extras={};for(const stat of extraStats.slice(0,rar))extras[stat]=round1(bestOf(extraBands[stat][rar],rng,chance));
        const sp={id,kind:k,rarity:rar,stars:0,bonus:round1(bestOf(bonusBands[rar],rng,chance)),extras,vein:null};
        s.spirits.push(sp);return sp;
    }
    function assignPreview(s,spiritId,veinIndex){
        const sp=spirit(s,spiritId),v=s.veins[veinIndex];if(!sp||!v?.built)return null;
        const before=production(s),copy=structuredClone(s),cs=spirit(copy,spiritId),displaced=assigned(copy,veinIndex);
        if(displaced&&displaced.id!==spiritId)displaced.vein=cs.vein;cs.vein=veinIndex;
        return {before,after:production(copy),displaced:displaced&&displaced.id!==spiritId?displaced.id:null};
    }
    function fusionPairs(s){
        const groups={};for(const sp of s.spirits){if(sp.rarity>=rarities.length-1)continue;const key=sp.rarity+':'+sp.stars;(groups[key]=groups[key]||[]).push(sp.id);}
        return Object.values(groups).filter(g=>g.length>=2);
    }
    function fusionPreview(s,aId,bId){
        const a=spirit(s,aId),b=spirit(s,bId);
        if(!fusionUnlocked(s))return {ok:false,reason:'Fusion opens after the first realm milestone'};
        if(!a||!b||a.id===b.id)return {ok:false,reason:'Choose two spirits'};
        if(a.rarity!==b.rarity||a.stars!==b.stars)return {ok:false,reason:'Same rarity and stars required'};
        if(a.rarity>=rarities.length-1)return {ok:false,reason:'Legendary spirits prestige instead'};
        const extras={};for(const stat of extraStats)if((a.extras[stat]||0)+(b.extras[stat]||0))extras[stat]=round1((a.extras[stat]||0)+(b.extras[stat]||0));
        const newStat=extraStats.find(stat=>!(stat in extras))||null;
        return {ok:true,rarity:a.rarity+1,stars:a.stars,bonus:round1(a.bonus+b.bonus),extras,newStat,newBand:newStat?extraBands[newStat][a.rarity+1]:null,vein:a.vein??b.vein};
    }
    function quote(s,action,target){
        let cost={},reason=null,detail=null;
        if(action==='build'){const i=Number(target);if(!Number.isInteger(i)||!s.veins[i])reason='Unknown vein';else if(s.veins[i].built)reason='Already built';else if(nextVein(s).index!==i)reason='Build the previous vein first';else if(i>s.bossWins)reason='Win the next boss to dig here';else cost=veinCost(i);}
        else if(action==='upgrade'){const u=upgrade(target),t=tierOf(target),level=s.tree[target];if(!u)reason='Unknown upgrade';else if(level>=TREE_CAP)reason='Maxed';else if(t>0&&tree[t-1].some(p=>s.tree[p.id]<TREE_GATE))reason=`Raise every tier ${t} upgrade to ${TREE_GATE} first`;else if(!depthOpen(s,t))reason=`Dig down to ${depths[t].name} first`;else cost=upgradeCost(target,level);}
        else if(action==='fuse'){const [a,b]=Array.isArray(target)?target:[];detail=fusionPreview(s,a,b);if(!detail.ok)reason=detail.reason;}
        else if(action==='prestige'){const sp=spirit(s,target);if(!sp)reason='Unknown spirit';else if(sp.rarity<rarities.length-1)reason='Only Legendary spirits prestige';else if(sp.stars>=MAX_STARS)reason='Already at five stars';}
        else if(action==='assign'){const sp=spirit(s,target?.spirit),i=target?.vein;if(!sp)reason='Unknown spirit';else if(i!==null&&!s.veins[i]?.built)reason='Build this vein first';}
        else reason='Unknown action';
        if(!reason&&!affordable(s,cost))reason='Gather the required materials';
        return {ok:!reason,reason,action,target,cost,detail,token:JSON.stringify([action,target,cost])};
    }
    function commit(s,{id,action,target,token,rng}){
        if(typeof id!=='string'||!id||id.length>100)return {ok:false};
        const signature=JSON.stringify([action,target,token]),old=s.receipts.find(r=>r.id===id);
        if(old)return old.signature===signature?{ok:true,duplicate:true,receipt:old}:{ok:false};
        const q=quote(s,action,target);if(!q.ok||token!==q.token)return {ok:false,reason:q.reason||'Review the updated cost'};
        pay(s,q.cost);let result=null;
        if(action==='build'){s.veins[target].built=true;}
        if(action==='upgrade'){s.tree[target]++;}
        if(action==='assign'){const sp=spirit(s,target.spirit),displaced=target.vein===null?null:assigned(s,target.vein);if(displaced&&displaced.id!==sp.id)displaced.vein=sp.vein;sp.vein=target.vein;}
        if(action==='fuse'){
            const d=q.detail,[aId,bId]=target,a=spirit(s,aId),roll=rng||Math.random,extras={...d.extras};
            if(d.newStat)extras[d.newStat]=round1(bestOf(d.newBand,roll,s.tree.fusionOdds*.025));
            s.spirits=s.spirits.filter(x=>x.id!==aId&&x.id!==bId);
            result={id:id,kind:a.kind,rarity:d.rarity,stars:d.stars,bonus:d.bonus,extras,vein:d.vein};s.spirits.push(result);
        }
        if(action==='prestige'){const sp=spirit(s,target);sp.rarity=0;sp.stars++;result=sp;}
        const receipt={id,signature,action,target,cost:q.cost,result:result?structuredClone(result):null};s.receipts.push(receipt);
        return {ok:true,duplicate:false,receipt,result};
    }
    root.MageMine=Object.freeze({CAP_SECONDS,VEINS_PER_DEPTH,DEPTHS,TREE_CAP,TREE_GATE,MAX_STARS,FUSION_BOSS_WINS,depths,materials,rarities,rarityColors,dropOdds,bonusBands,extraStats,extraLabels,extraBands,kinds,tree,upgrades,upgrade,tierOf,material,kind,fresh,spirit,assigned,fusionUnlocked,depthOpen,nextVein,veinAvailable,veinCost,upgradeCost,stats,production,preview,credit,advance,rollRarity,drop,assignPreview,fusionPairs,fusionPreview,quote,commit});
})(globalThis);
