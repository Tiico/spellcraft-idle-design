/* Fishing loop review model. The mage casts from a pier (charge → size, a one-second bite window → bonus), nets run on the
   wall clock without spirits, and fish pay for a global skill tree of binary unlocks in four branches.
   Time, randomness and command IDs are explicit inputs. The server would roll species and size when a cast is committed;
   the client only reports whether the bite was hooked. */
(function(root){
    const FISHING_BOSS_WINS=4,ZONE_EVERY=2,ZONES=12,SPECIES_PER_ZONE=4,CAP_SECONDS=43200;
    const CHARGE_MAX=2,BITE_DELAY=[1,3],BITE_WINDOW=1,HIT_BONUS=1,SIZE_STEPS=[.35,.7];
    const BAIT_CAP=20,BAIT_REGEN_SECONDS=1800,NET_RATE_PER_HOUR=6;
    const elements=Object.freeze(['ice','earth','fire','wind']);
    const elementColors=Object.freeze({ice:{water:'#2a5f8f',deep:'#173a5c',sky:'#9fc4e8',shore:'#c9d8e6'},earth:{water:'#3d6b4a',deep:'#22402c',sky:'#b7c9a2',shore:'#6e6246'},fire:{water:'#c4521f',deep:'#6e240c',sky:'#f0a070',shore:'#3c2a28'},wind:{water:'#5e84c2',deep:'#3a5a92',sky:'#dbe7f5',shore:'#8ea0b8'}});
    const rarities=Object.freeze(['Common','Uncommon','Rare','Epic']);
    const rarityColors=Object.freeze(['#c9d2d8','#8fd18c','#6fa8ff','#c98bff']);
    const rarityWeights=Object.freeze([60,25,10,5]);
    const zoneNames=[
        ['Silver Lake',['Reedfin','Mooncarp','Glass eel','Star koi']],
        ['Reed Swamps',['Mudskipper','Bog perch','Reed pike','Marsh lantern']],
        ['Lava River',['Cinder minnow','Ash carp','Magma eel','Ember koi']],
        ['Cloud Shoals',['Gale sprat','Sky trout','Zephyr ray','Storm marlin']],
        ['Frost Fjord',['Rime herring','Glacier cod','Aurora pike','Hoarfrost ray']],
        ['Peat Mire',['Peat loach','Root catfish','Amber tench','Moss gar']],
        ['Obsidian Falls',['Soot darter','Slag bass','Pyre eel','Furnace koi']],
        ['Tempest Strait',['Squall smelt','Thunder bream','Cyclone tuna','Lightning sail']],
        ['Moonwell',['Moon minnow','Pale sturgeon','Crystal char','Lunar pike']],
        ['Rootsea',['Loam sprat','Bark grouper','Ironwood pike','Elder salmon']],
        ['Sunforge Basin',['Spark fry','Brass snapper','Solar eel','Phoenix koi']],
        ['Aether Reach',['Wisp sardine','Halo trout','Nimbus manta','Aether marlin']]
    ];
    const speciesColors=Object.freeze([['#9fd3c7','#e8dca8','#bfe6f2','#ff9a6a'],['#8b9a5b','#c0a060','#6f8f4f','#e6d86a'],['#f0a060','#8a6a5a','#ff6a3a','#ffd060'],['#cfe3ff','#8fb5d6','#a8c4ee','#4f6fd1'],['#bfe0ff','#7fa2c4','#c8f0ff','#9ad3ff'],['#8a7a4a','#5f6a3a','#d9a84a','#6f8f5f'],['#55504a','#8a6f4a','#ff8a3a','#ffb24a'],['#b4c7d8','#8aa0c4','#4f7fbf','#f2f0a0'],['#e8ecff','#d0d0e0','#b9f0ff','#f5f5ff'],['#a08a5a','#7f5f3f','#6f6f5f','#e0a070'],['#ffd27a','#d8a040','#ff9a2a','#ff6a2a'],['#f0f4ff','#ffe9a8','#c8d8ff','#bcd0ff']]);
    const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    // Zone i opens for free at a boss-win threshold; fishing itself opens after the first realm (its four bosses).
    const zoneThreshold=i=>FISHING_BOSS_WINS+ZONE_EVERY*i;
    const zones=Object.freeze(zoneNames.map(([name,fish],index)=>{
        const element=elements[index%elements.length];
        const species=fish.map((n,rarity)=>Object.freeze({id:slug(n),name:n,zone:index,rarity,weight:rarityWeights[rarity],color:speciesColors[index][rarity],art:index===0?slug(n):null}));
        return Object.freeze({index,id:slug(name),name,element,colors:elementColors[element],threshold:zoneThreshold(index),species:Object.freeze(species)});
    }));
    const species=Object.freeze(zones.flatMap(z=>z.species));
    const speciesById=Object.fromEntries(species.map(f=>[f.id,f]));
    const fish=id=>speciesById[id];
    const zone=index=>zones[index];
    const netTypes=Object.freeze([
        {id:'short',name:'Short net',seconds:600},
        {id:'hour',name:'Hour net',seconds:3600},
        {id:'long',name:'Long net',seconds:28800},
        {id:'day',name:'Day net',seconds:86400}
    ].map(Object.freeze));
    const netType=id=>netTypes.find(t=>t.id===id);
    const branches=Object.freeze([
        {id:'fishing',name:'Fishing',icon:'🎣',text:'Nets, net slots, bait and the rod.'},
        {id:'mine',name:'Mine',icon:'⛏',text:'Rule-bending nodes inside the 12 h cap. No power, no HP, no Spell power.'},
        {id:'qol',name:'Quality of life',icon:'✦',text:'Fewer taps. Never power.'},
        {id:'spells',name:'Spells',icon:'✶',text:'Abilities without numbers. The list is grilled when Spell Clearing exists.'}
    ].map(Object.freeze));
    // Every node is a binary unlock. Fishing nodes change this model; the other branches describe a rule that lives in
    // another system and only record the purchase here.
    const nodes=Object.freeze([
        {id:'net-hour',branch:'fishing',name:'Hour net',text:'A net that fishes for one hour.',requires:[],cost:{reedfin:30},effect:{kind:'netType',type:'hour'}},
        {id:'net-slot-2',branch:'fishing',name:'Second net slot',text:'Run two nets at once, in any zones.',requires:[],cost:{reedfin:25,mooncarp:10},effect:{kind:'netSlot'}},
        {id:'bait-pouch',branch:'fishing',name:'Bait pouch',text:'Carry 30 bait instead of 20.',requires:[],cost:{reedfin:20},effect:{kind:'baitCap',value:30}},
        {id:'net-long',branch:'fishing',name:'Long net',text:'A net that fishes for eight hours.',requires:['net-hour'],cost:{reedfin:40,mooncarp:15},effect:{kind:'netType',type:'long'}},
        {id:'net-slot-3',branch:'fishing',name:'Third net slot',text:'Run three nets at once.',requires:['net-slot-2'],cost:{mooncarp:30,'glass-eel':10,'star-koi':3},effect:{kind:'netSlot'}},
        {id:'keen-eye',branch:'fishing',name:'Keen eye',text:'The bite window grows from 1 s to 1.5 s.',requires:['bait-pouch'],cost:{mooncarp:20,'glass-eel':6},effect:{kind:'biteWindow',seconds:1.5}},
        {id:'steady-hands',branch:'fishing',name:'Steady hands',text:'Full charge takes 1.5 s instead of 2 s.',requires:['bait-pouch'],cost:{mudskipper:30,'bog-perch':10},effect:{kind:'chargeMax',seconds:1.5}},
        {id:'bait-keeper',branch:'fishing',name:'Bait keeper',text:'Bait returns every 20 minutes instead of 30.',requires:['bait-pouch'],cost:{mudskipper:40,'reed-pike':8},effect:{kind:'baitRegen',seconds:1200}},
        {id:'net-day',branch:'fishing',name:'Day net',text:'A net that fishes for a full day on the wall clock.',requires:['net-long'],cost:{'glass-eel':20,'star-koi':6,'bog-perch':20},effect:{kind:'netType',type:'day'}},
        {id:'net-slot-4',branch:'fishing',name:'Fourth net slot',text:'Run four nets at once.',requires:['net-slot-3'],cost:{'cinder-minnow':60,'ash-carp':20,'magma-eel':8},effect:{kind:'netSlot'}},
        {id:'double-hook',branch:'fishing',name:'Double hook',text:'A hooked bite gives +2 fish instead of +1.',requires:['keen-eye'],cost:{'star-koi':8,'marsh-lantern':4,'ember-koi':2},effect:{kind:'hitBonus',value:2}},
        {id:'twin-pick',branch:'mine',name:'Twin pick',text:'A spirit may work two neighbouring veins at half power each.',requires:[],cost:{reedfin:40,mooncarp:10},effect:{kind:'rule',system:'mine'}},
        {id:'carry-over',branch:'mine',name:'Carry-over',text:'Absence keeps the fraction of a vein already chipped instead of rounding it away.',requires:[],cost:{reedfin:30,'glass-eel':5},effect:{kind:'rule',system:'mine'}},
        {id:'forge-in-place',branch:'mine',name:'Forge in place',text:'Fuse two spirits without taking them off their veins first.',requires:['twin-pick'],cost:{mudskipper:40,'bog-perch':15,'star-koi':3},effect:{kind:'rule',system:'mine'}},
        {id:'deep-ledger',branch:'mine',name:'Deep ledger',text:'Preview a whole depth\'s production before moving spirits.',requires:['carry-over'],cost:{'cinder-minnow':40,'ash-carp':12},effect:{kind:'rule',system:'mine'}},
        {id:'chest-cap',branch:'qol',name:'Bigger free chest',text:'The free chest holds 5 charges instead of 3.',requires:[],cost:{reedfin:35,mooncarp:12},effect:{kind:'rule',system:'shop'}},
        {id:'haul-all',branch:'qol',name:'Haul all',text:'Collect every finished net in every zone with one tap.',requires:[],cost:{mooncarp:25,'glass-eel':8},effect:{kind:'rule',system:'fishing'}},
        {id:'reset-tap',branch:'qol',name:'Empty and reset',text:'Collecting a net offers to set the same net again in one tap. Never automatic.',requires:['haul-all'],cost:{mudskipper:30,'reed-pike':10},effect:{kind:'rule',system:'fishing'}},
        {id:'fast-travel',branch:'qol',name:'Fast travel',text:'Switch zones without the walk.',requires:[],cost:{'bog-perch':20,'cinder-minnow':20},effect:{kind:'rule',system:'fishing'}},
        {id:'loadout-slot',branch:'qol',name:'Extra loadout',text:'One more saved spell loadout.',requires:['fast-travel'],cost:{'ash-carp':25,'magma-eel':6},effect:{kind:'rule',system:'spells'}},
        {id:'second-slot',branch:'spells',name:'Second clearing slot',text:'Bring two spells into Spell Clearing.',requires:[],cost:{reedfin:60,'glass-eel':10},effect:{kind:'rule',system:'spells'}},
        {id:'mid-fight-swap',branch:'spells',name:'Mid-fight swap',text:'Change one spell once during a boss fight.',requires:['second-slot'],cost:{mudskipper:50,'marsh-lantern':3},effect:{kind:'rule',system:'spells'}},
        {id:'recipe-sight',branch:'spells',name:'Recipe sight',text:'See a fusion recipe before paying for it.',requires:[],cost:{mooncarp:30,'star-koi':4},effect:{kind:'rule',system:'spells'}},
        {id:'walking-cast',branch:'spells',name:'Walking cast',text:'Keep casting while the mage moves.',requires:['recipe-sight','mid-fight-swap'],cost:{'cinder-minnow':50,'ember-koi':3,'gale-sprat':30},effect:{kind:'rule',system:'spells'}}
    ].map(Object.freeze));
    const node=id=>nodes.find(n=>n.id===id);
    const fresh=()=>({
        bossWins:0,zone:0,bait:{charges:BAIT_CAP,last:0},stock:Object.fromEntries(species.map(f=>[f.id,0])),
        nets:[null],pending:null,nodes:{},receipts:[]
    });
    const bought=(s,id)=>!!s.nodes[id];
    const effects=(s,kind)=>nodes.filter(n=>bought(s,n.id)&&n.effect.kind===kind).map(n=>n.effect);
    const fishingOpen=s=>s.bossWins>=FISHING_BOSS_WINS;
    const zoneOpen=(s,index)=>!!zones[index]&&s.bossWins>=zones[index].threshold;
    const openZones=s=>zones.filter(z=>zoneOpen(s,z.index));
    const nextZone=s=>zones.find(z=>!zoneOpen(s,z.index))||null;
    const netSlots=s=>1+effects(s,'netSlot').length;
    const unlockedNetTypes=s=>netTypes.filter(t=>t.id==='short'||effects(s,'netType').some(e=>e.type===t.id));
    const baitCap=s=>Math.max(BAIT_CAP,...effects(s,'baitCap').map(e=>e.value));
    const baitRegen=s=>Math.min(BAIT_REGEN_SECONDS,...effects(s,'baitRegen').map(e=>e.seconds));
    const chargeMax=s=>Math.min(CHARGE_MAX,...effects(s,'chargeMax').map(e=>e.seconds));
    const biteWindow=s=>Math.max(BITE_WINDOW,...effects(s,'biteWindow').map(e=>e.seconds));
    const hitBonus=s=>Math.max(HIT_BONUS,...effects(s,'hitBonus').map(e=>e.value));
    // Bait returns on the wall clock up to the cap, like the free chest's charges.
    function settleBait(s,now){
        if(!Number.isFinite(now)||now<s.bait.last)return s.bait.charges;
        const cap=baitCap(s),regen=baitRegen(s);
        if(s.bait.charges>=cap){s.bait.last=now;return s.bait.charges;}
        const earned=Math.floor((now-s.bait.last)/regen);
        if(earned>0){s.bait.charges=Math.min(cap,s.bait.charges+earned);s.bait.last=s.bait.charges>=cap?now:s.bait.last+earned*regen;}
        return s.bait.charges;
    }
    const baitNextIn=(s,now)=>s.bait.charges>=baitCap(s)?0:Math.max(0,baitRegen(s)-(now-s.bait.last));
    const sizeFor=(s,charge)=>{const ratio=Math.max(0,Math.min(1,(Number(charge)||0)/chargeMax(s)));return ratio<SIZE_STEPS[0]?1:ratio<SIZE_STEPS[1]?2:3;};
    const sizeNames=Object.freeze(['','Small','Medium','Large']);
    function rollSpecies(z,rng){const total=z.species.reduce((a,f)=>a+f.weight,0);let r=rng()*total;for(const f of z.species){r-=f.weight;if(r<0)return f;}return z.species[z.species.length-1];}
    const rollBite=(s,rng)=>BITE_DELAY[0]+rng()*(BITE_DELAY[1]-BITE_DELAY[0]);
    const affordable=(s,cost)=>Object.entries(cost).every(([id,n])=>Number.isFinite(s.stock[id])&&s.stock[id]>=n);
    const pay=(s,cost)=>{for(const [id,n]of Object.entries(cost))s.stock[id]-=n;};
    const netYield=type=>Math.round(NET_RATE_PER_HOUR*type.seconds/3600);
    // A finished net pays the zone's species by weight; the roll is deterministic for a given rng, as a server key would be.
    function rollHaul(z,count,rng){const out={};for(let i=0;i<count;i++){const f=rollSpecies(z,rng);out[f.id]=(out[f.id]||0)+1;}return out;}
    const netDone=(net,now)=>!!net&&now>=net.endsAt;
    const netRemaining=(net,now)=>net?Math.max(0,net.endsAt-now):0;
    // Nets run on the wall clock: one started cycle always completes, even past the 12 h absence cap, and nothing restarts it.
    function returnSummary(s,now){
        const finished=s.nets.map((net,slot)=>net&&netDone(net,now)?{slot,zone:net.zone,type:net.type,count:netYield(netType(net.type))}:null).filter(Boolean);
        const running=s.nets.map((net,slot)=>net&&!netDone(net,now)?{slot,zone:net.zone,type:net.type,remaining:netRemaining(net,now)}:null).filter(Boolean);
        return {finished,running,bait:settleBait(s,now)};
    }
    function credit(s,amounts){if(!amounts||Object.entries(amounts).some(([id,n])=>!(id in s.stock)||!Number.isFinite(n)||n<0))return false;for(const [id,n]of Object.entries(amounts))s.stock[id]+=n;return true;}
    const nodeLocked=(s,n)=>n.requires.find(r=>!bought(s,r))||null;
    function quote(s,action,target,now){
        let cost={},reason=null,detail=null;
        if(!fishingOpen(s))reason=`Fishing opens after the first realm (boss win ${FISHING_BOSS_WINS})`;
        else if(action==='cast'){const charge=Number(target?.charge);if(s.pending)reason='Reel in first';else if(!Number.isFinite(charge)||charge<0)reason='Hold to charge the cast';else if(settleBait(s,now)<1)reason='Out of bait';else detail={size:sizeFor(s,charge),bait:1};}
        else if(action==='hook'){if(!s.pending)reason='Nothing on the line';else if(target?.catch!==s.pending.id)reason='That catch is gone';else if(typeof target?.hit!=='boolean')reason='Report hooked or missed';}
        else if(action==='setNet'){const slot=Number(target?.slot),t=netType(target?.type),z=zones[s.zone];if(!Number.isInteger(slot)||slot<0||slot>=netSlots(s))reason='No such net slot';else if(s.nets[slot])reason='This slot already holds a net';else if(!t)reason='Unknown net';else if(!unlockedNetTypes(s).some(x=>x.id===t.id))reason=`Unlock the ${t.name} in the skill tree`;else if(!zoneOpen(s,z.index))reason='This zone is closed';}
        else if(action==='collectNet'){const slot=Number(target?.slot),net=s.nets[slot];if(!net)reason='No net here';else if(!netDone(net,now))reason='Still fishing';else detail={count:netYield(netType(net.type)),zone:net.zone};}
        else if(action==='zone'){const i=Number(target);if(!zones[i])reason='Unknown zone';else if(!zoneOpen(s,i))reason=`Opens at boss win ${zones[i].threshold}`;}
        else if(action==='buy'){const n=node(target);const missing=n&&nodeLocked(s,n);if(!n)reason='Unknown node';else if(bought(s,n.id))reason='Already unlocked';else if(missing)reason=`Unlock ${node(missing).name} first`;else cost=n.cost;}
        else reason='Unknown action';
        if(!reason&&!affordable(s,cost))reason='Catch the required fish';
        return {ok:!reason,reason,action,target,cost,detail,token:JSON.stringify([action,target,cost])};
    }
    // Commits are idempotent: a replayed command ID returns its receipt and changes nothing; a changed payload is refused.
    function commit(s,{id,action,target,token,rng,now}){
        if(typeof id!=='string'||!id||id.length>100)return {ok:false};
        const signature=JSON.stringify([action,target,token]),old=s.receipts.find(r=>r.id===id);
        if(old)return old.signature===signature?{ok:true,duplicate:true,receipt:old,result:old.result}:{ok:false};
        const q=quote(s,action,target,now);if(!q.ok||token!==q.token)return {ok:false,reason:q.reason||'Review the updated cost'};
        const roll=rng||Math.random;pay(s,q.cost);let result=null;
        if(action==='cast'){s.bait.charges--;if(s.bait.charges===baitCap(s)-1)s.bait.last=now;const f=rollSpecies(zones[s.zone],roll);s.pending={id,zone:s.zone,species:f.id,size:q.detail.size,bite:rollBite(s,roll),window:biteWindow(s),bonus:hitBonus(s)};result={...s.pending};}
        if(action==='hook'){const p=s.pending,count=p.size+(target.hit?p.bonus:0);s.stock[p.species]+=count;result={species:p.species,size:p.size,hit:target.hit,bonus:target.hit?p.bonus:0,count};s.pending=null;}
        if(action==='setNet'){const t=netType(target.type);s.nets[target.slot]={zone:s.zone,type:t.id,startedAt:now,endsAt:now+t.seconds};result={...s.nets[target.slot],slot:target.slot};}
        if(action==='collectNet'){const net=s.nets[target.slot],haul=rollHaul(zones[net.zone],q.detail.count,roll);credit(s,haul);s.nets[target.slot]=null;result={slot:target.slot,zone:net.zone,type:net.type,haul};}
        if(action==='zone'){s.zone=Number(target);}
        if(action==='buy'){s.nodes[target]=true;if(s.nets.length<netSlots(s))s.nets.push(null);result={node:target};}
        const receipt={id,signature,action,target,cost:q.cost,result:result?structuredClone(result):null};s.receipts.push(receipt);
        return {ok:true,duplicate:false,receipt,result};
    }
    root.SpellcraftFishing=Object.freeze({FISHING_BOSS_WINS,ZONE_EVERY,ZONES,SPECIES_PER_ZONE,CAP_SECONDS,CHARGE_MAX,BITE_DELAY,BITE_WINDOW,HIT_BONUS,BAIT_CAP,BAIT_REGEN_SECONDS,NET_RATE_PER_HOUR,elements,rarities,rarityColors,rarityWeights,zones,species,fish,zone,zoneThreshold,netTypes,netType,branches,nodes,node,fresh,bought,fishingOpen,zoneOpen,openZones,nextZone,netSlots,unlockedNetTypes,baitCap,baitRegen,chargeMax,biteWindow,hitBonus,settleBait,baitNextIn,sizeFor,sizeNames,rollSpecies,netYield,netDone,netRemaining,returnSummary,credit,nodeLocked,quote,commit});
})(globalThis);
