/* Alchemy review model. Seeds grow in garden plots on the wall clock, a 5 % harvest window after 100 % pays the full yield
   and a late harvest decays linearly to half, an unlocked seed type can always be planted, two ingredients brew in a cauldron into a potion by a secret formula, and
   potions give short temporary bonuses. Time, randomness and command IDs are explicit inputs; nothing restarts itself. */
(function(root){
    const ALCHEMY_BOSS_WINS=8,PLOTS_START=3,PLOTS_MAX=9,CAULDRONS_START=1,CAULDRONS_MAX=3;
    const WINDOW_FRACTION=.05,DECAY_SPAN=1,HARVEST_MAX=4,HARVEST_MIN=2,DOSES=2,POTION_SECONDS=180,STACK_CAP=3;
    const elements=Object.freeze(['fire','ice','earth','wind']);
    const domains=Object.freeze(['combat','mine','sea']);
    const elementColors=Object.freeze({fire:'#ff8a3a',ice:'#8fd3ff',earth:'#8fc96a',wind:'#d9d3ff'});
    const domainNames=Object.freeze({combat:'Combat',mine:'Mine',sea:'Sea'});
    const growthTiers=Object.freeze([900,3600,14400,43200]);
    const brewMinutes=Object.freeze({2:5,3:10,4:15,5:20,6:30,7:45,8:60});
    const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    // Twelve plants: element × domain. The tier is the growth time; every domain holds one plant of each tier.
    const plantRows=[
        ['Emberpetal','fire','combat',1],['Frostbell','ice','combat',2],['Stoneroot','earth','combat',3],['Zephyr thistle','wind','combat',4],
        ['Glacier lichen','ice','mine',1],['Ironcap','earth','mine',2],['Gale fern','wind','mine',3],['Cinder moss','fire','mine',4],
        ['Mudlotus','earth','sea',1],['Foam reed','wind','sea',2],['Coral pepper','fire','sea',3],['Rime kelp','ice','sea',4]
    ];
    // New seed types follow boss wins from the opening boss: every tier 1 plant first, then tier 2 and so on. A realm find unlocks the
    // next locked type early. An unlocked type is never used up: it can be planted in any number of plots.
    const unlockOrder=[...plantRows].sort((a,b)=>a[3]-b[3]||domains.indexOf(a[2])-domains.indexOf(b[2]));
    const plants=Object.freeze(plantRows.map(([name,element,domain,tier])=>Object.freeze({id:slug(name),name,element,domain,tier,growth:growthTiers[tier-1],color:elementColors[element],unlockWin:ALCHEMY_BOSS_WINS+unlockOrder.findIndex(r=>r[0]===name)})));
    const plant=id=>plants.find(p=>p.id===id);
    const effects=Object.freeze({
        spellDamage:{name:'Spell damage',unit:'%',perLevel:5,domain:'combat'},
        shield:{name:'Shield capacity',unit:'%',perLevel:8,domain:'combat'},
        combatHp:{name:'Combat HP',unit:'%',perLevel:6,domain:'combat'},
        cooldown:{name:'Cooldown',unit:'%',perLevel:-4,domain:'combat'},
        miningPower:{name:'Mining power',unit:'%',perLevel:6,domain:'mine'},
        critDamage:{name:'Crit damage (mine)',unit:'%',perLevel:10,domain:'mine'},
        miningCrit:{name:'Crit chance (mine)',unit:'%',perLevel:3,domain:'mine'},
        miningSpeed:{name:'Mining speed',unit:'%',perLevel:6,domain:'mine'},
        catchSize:{name:'Catch size',unit:' step',perLevel:1,domain:'sea'},
        biteWindow:{name:'Bite window',unit:' s',perLevel:.5,domain:'sea'},
        netHaul:{name:'Net haul',unit:'%',perLevel:10,domain:'sea',cycle:true},
        baitRegen:{name:'Bait regen',unit:'%',perLevel:15,domain:'sea'},
        attackSpeed:{name:'Attack speed',unit:'%',perLevel:4,domain:'cross'},
        spellArea:{name:'Spell area',unit:'%',perLevel:8,domain:'cross'},
        mineYield:{name:'Yield (mine)',unit:'%',perLevel:6,domain:'cross'},
        netSpeed:{name:'Net speed',unit:'%',perLevel:10,domain:'cross',cycle:true},
        murky:{name:'Murky warmth',unit:'%',perLevel:1,domain:'none'}
    });
    const signature=Object.freeze({combat:{fire:'spellDamage',ice:'shield',earth:'combatHp',wind:'cooldown'},mine:{fire:'miningPower',ice:'critDamage',earth:'miningCrit',wind:'miningSpeed'},sea:{fire:'catchSize',ice:'biteWindow',earth:'netHaul',wind:'baitRegen'}});
    const cross=Object.freeze({fire:['attackSpeed','Blazing focus'],ice:['spellArea','Still waters'],earth:['mineYield','Deep roots'],wind:['netSpeed','Tailwind']});
    const specials=Object.freeze({
        'emberpetal+rime-kelp':{name:'Steam draught',effects:['spellDamage','biteWindow']},
        'cinder-moss+frostbell':{name:'Tempered ward',effects:['shield','miningPower']},
        'mudlotus+zephyr-thistle':{name:'Rooted gale',effects:['combatHp','cooldown']},
        'coral-pepper+gale-fern':{name:'Stormfire tonic',effects:['miningSpeed','catchSize']}
    });
    const pairKey=(a,b)=>[a,b].sort().join('+');
    // Every pair of plants has exactly one formula; it is secret until brewed. Pure brews give the plant's signature effect,
    // same-domain blends give both signatures, same-element pairs give the element's cross effect, the rest are murky
    // unless a hand-made special says otherwise.
    function formula(aId,bId){
        const a=plant(aId),b=plant(bId);if(!a||!b)return null;
        const id=pairKey(aId,bId),sum=a.tier+b.tier,level=Math.ceil(sum/2),brewSeconds=brewMinutes[sum]*60;
        let kind,name,list;
        if(a.id===b.id){kind='pure';name=`${a.name} tonic`;list=[signature[a.domain][a.element]];}
        else if(specials[id]){kind='special';name=specials[id].name;list=specials[id].effects;}
        else if(a.domain===b.domain){kind='blend';name=`${domainNames[a.domain]} blend`;list=[signature[a.domain][a.element],signature[b.domain][b.element]];}
        else if(a.element===b.element){kind='cross';name=cross[a.element][1];list=[cross[a.element][0]];}
        else{kind='murky';name='Murky brew';list=['murky'];}
        return {id,a:a.id,b:b.id,kind,name,level,brewSeconds,effects:list.map(stat=>({stat,level:kind==='murky'?1:level}))};
    }
    const formulas=Object.freeze((()=>{const out=[];for(let i=0;i<plants.length;i++)for(let j=i;j<plants.length;j++)out.push(formula(plants[i].id,plants[j].id));return out;})());
    const formulaById=id=>formulas.find(f=>f.id===id);
    const fishNames=Object.freeze(['reedfin','mooncarp','glass-eel','star-koi','mudskipper','bog-perch']);
    const nodes=Object.freeze([
        {id:'plot-4',name:'Fourth plot',text:'One more garden plot.',requires:[],cost:{reedfin:30},effect:{kind:'plot'}},
        {id:'plot-5',name:'Fifth plot',text:'One more garden plot.',requires:['plot-4'],cost:{reedfin:40,mooncarp:10},effect:{kind:'plot'}},
        {id:'plot-6',name:'Sixth plot',text:'One more garden plot.',requires:['plot-5'],cost:{mooncarp:30,'glass-eel':8},effect:{kind:'plot'}},
        {id:'plot-7',name:'Seventh plot',text:'One more garden plot.',requires:['plot-6'],cost:{mudskipper:40,'glass-eel':12},effect:{kind:'plot'}},
        {id:'plot-8',name:'Eighth plot',text:'One more garden plot.',requires:['plot-7'],cost:{mudskipper:50,'bog-perch':20},effect:{kind:'plot'}},
        {id:'plot-9',name:'Ninth plot',text:'The whole bed.',requires:['plot-8'],cost:{'bog-perch':30,'star-koi':6},effect:{kind:'plot'}},
        {id:'cauldron-2',name:'Second cauldron',text:'Brew two formulas at once.',requires:[],cost:{reedfin:40,mooncarp:15},effect:{kind:'cauldron'}},
        {id:'cauldron-3',name:'Third cauldron',text:'Brew three formulas at once.',requires:['cauldron-2'],cost:{mudskipper:40,'glass-eel':10,'star-koi':4},effect:{kind:'cauldron'}},
        {id:'duration-5',name:'Lasting draughts',text:'Potions last 5 minutes instead of 3.',requires:[],cost:{mooncarp:25,'glass-eel':6},effect:{kind:'duration',seconds:300}},
        {id:'duration-8',name:'Enduring draughts',text:'Potions last 8 minutes.',requires:['duration-5'],cost:{'bog-perch':30,'star-koi':5},effect:{kind:'duration',seconds:480}},
        {id:'greenhouse',name:'Greenhouse',text:'The harvest window grows from 5 % to 10 % of the growth time.',requires:['plot-4'],cost:{mooncarp:30,mudskipper:20},effect:{kind:'window',fraction:.10}},
        {id:'preserve',name:'Preserve',text:'A late harvest loses its yield half as fast.',requires:['greenhouse'],cost:{'glass-eel':15,'bog-perch':15},effect:{kind:'decay',span:2}}
    ].map(Object.freeze));
    const node=id=>nodes.find(n=>n.id===id);
    const fresh=()=>({
        bossWins:0,plots:Array(PLOTS_START).fill(null),cauldrons:Array(CAULDRONS_START).fill(null),
        found:{},ingredients:Object.fromEntries(plants.map(p=>[p.id,0])),
        potions:{},effects:{},book:{},nodes:{},fish:Object.fromEntries(fishNames.map(f=>[f,0])),receipts:[]
    });
    const bought=(s,id)=>!!s.nodes[id];
    const nodeEffects=(s,kind)=>nodes.filter(n=>bought(s,n.id)&&n.effect.kind===kind).map(n=>n.effect);
    const open=s=>s.bossWins>=ALCHEMY_BOSS_WINS;
    const seedUnlocked=(s,id)=>!!plant(id)&&(s.bossWins>=plant(id).unlockWin||!!s.found[id]);
    const unlockedPlants=s=>plants.filter(p=>seedUnlocked(s,p.id));
    const nextSeed=s=>[...plants].sort((a,b)=>a.unlockWin-b.unlockWin).find(p=>!seedUnlocked(s,p.id))||null;
    function findSeed(s){if(!open(s))return null;const p=nextSeed(s);if(!p)return null;s.found[p.id]=true;return p;}
    const plotCount=s=>PLOTS_START+nodeEffects(s,'plot').length;
    const cauldronCount=s=>CAULDRONS_START+nodeEffects(s,'cauldron').length;
    const windowFraction=s=>Math.max(WINDOW_FRACTION,...nodeEffects(s,'window').map(e=>e.fraction));
    const decaySpan=s=>Math.max(DECAY_SPAN,...nodeEffects(s,'decay').map(e=>e.span));
    const potionSeconds=s=>Math.max(POTION_SECONDS,...nodeEffects(s,'duration').map(e=>e.seconds));
    const stackCap=s=>potionSeconds(s)*STACK_CAP;
    // The window opens at 100 % and lasts 5 % of the growth time; afterwards the yield falls linearly to half over one
    // growth time and stays there. Only the window pays the full yield: a late yield rounds down and is always below it (#271).
    // The plant never dies, and the seed type stays unlocked.
    function growth(s,plot,now){
        if(!plot)return null;
        const p=plant(plot.plant),w=windowFraction(s),span=decaySpan(s),fraction=Math.max(0,(now-plot.plantedAt)/p.growth);
        const windowStart=plot.plantedAt+p.growth,windowEnd=windowStart+p.growth*w;
        let phase='growing',yieldNow=0,lost=0;
        if(fraction>=1+w){phase='late';const t=Math.min(1,Math.max(0,now-windowEnd)/(p.growth*span));yieldNow=Math.min(HARVEST_MAX-1,Math.floor(HARVEST_MAX-(HARVEST_MAX-HARVEST_MIN)*t));lost=t;}
        else if(fraction>=1){phase='window';yieldNow=HARVEST_MAX;}
        return {plant:p,fraction:Math.min(fraction,1),rawFraction:fraction,phase,yield:yieldNow,lost,toWindow:Math.max(0,windowStart-now),windowRemaining:Math.max(0,windowEnd-now),windowStart,windowEnd,stage:fraction<.25?0:fraction<.6?1:fraction<1?2:3};
    }
    const cauldronDone=(c,now)=>!!c&&now>=c.endsAt;
    const cauldronRemaining=(c,now)=>c?Math.max(0,c.endsAt-now):0;
    function activeEffects(s,now){
        return Object.entries(s.effects).filter(([,e])=>e.until>now).map(([stat,e])=>({stat,name:effects[stat].name,level:e.level,value:effects[stat].perLevel*e.level,unit:effects[stat].unit,remaining:e.until-now,cycle:!!effects[stat].cycle}));
    }
    const modifier=(s,stat,now)=>{const e=s.effects[stat];return e&&e.until>now?effects[stat].perLevel*e.level:0;};
    function expire(s,now){for(const [stat,e]of Object.entries(s.effects))if(e.until<=now)delete s.effects[stat];}
    function returnSummary(s,now){
        expire(s,now);
        const plots=s.plots.map((plot,index)=>plot?{index,...growth(s,plot,now)}:null).filter(Boolean);
        const brews=s.cauldrons.map((c,index)=>c?{index,formula:formulaById(c.formula),done:cauldronDone(c,now),remaining:cauldronRemaining(c,now)}:null).filter(Boolean);
        return {plots,brews};
    }
    const affordable=(s,cost)=>Object.entries(cost).every(([id,n])=>Number.isFinite(s.fish[id])&&s.fish[id]>=n);
    const pay=(s,cost)=>{for(const [id,n]of Object.entries(cost))s.fish[id]-=n;};
    const nodeLocked=(s,n)=>n.requires.find(r=>!bought(s,r))||null;
    function quote(s,action,target,now){
        let cost={},reason=null,detail=null;
        if(!open(s))reason=`Alchemy opens after the second realm (boss win ${ALCHEMY_BOSS_WINS})`;
        else if(action==='plant'){const i=Number(target?.plot),p=plant(target?.plant);if(!Number.isInteger(i)||i<0||i>=plotCount(s))reason='No such plot';else if(s.plots[i])reason='This plot is taken';else if(!p)reason='Unknown seed';else if(!seedUnlocked(s,p.id))reason=`${p.name} seeds come at boss win ${p.unlockWin}`;}
        else if(action==='harvest'){const i=Number(target?.plot),g=s.plots[i]&&growth(s,s.plots[i],now);if(!g)reason='Nothing planted here';else if(g.phase==='growing')reason='Not ripe yet';else detail={yield:g.yield,phase:g.phase,plant:g.plant.id};}
        else if(action==='brew'){const i=Number(target?.cauldron),a=plant(target?.a),b=plant(target?.b);if(!Number.isInteger(i)||i<0||i>=cauldronCount(s))reason='No such cauldron';else if(s.cauldrons[i])reason='This cauldron is busy';else if(!a||!b)reason='Choose two ingredients';else if(a.id===b.id?s.ingredients[a.id]<2:(s.ingredients[a.id]<1||s.ingredients[b.id]<1))reason='Not enough ingredients';else detail=formula(a.id,b.id);}
        else if(action==='collect'){const i=Number(target?.cauldron),c=s.cauldrons[i];if(!c)reason='Nothing brewing here';else if(!cauldronDone(c,now))reason='Still brewing';else detail=formulaById(c.formula);}
        else if(action==='drink'){const f=formulaById(target);if(!f)reason='Unknown potion';else if(!(s.potions[f.id]>0))reason='No doses left';else detail=f;}
        else if(action==='buy'){const n=node(target);const missing=n&&nodeLocked(s,n);if(!n)reason='Unknown node';else if(bought(s,n.id))reason='Already unlocked';else if(missing)reason=`Unlock ${node(missing).name} first`;else cost=n.cost;}
        else reason='Unknown action';
        if(!reason&&!affordable(s,cost))reason='Catch the required fish';
        return {ok:!reason,reason,action,target,cost,detail,token:JSON.stringify([action,target,cost])};
    }
    // Commits are idempotent: a replayed command ID returns its receipt and changes nothing; a changed payload is refused.
    function commit(s,{id,action,target,token,now}){
        if(typeof id!=='string'||!id||id.length>100)return {ok:false};
        const signature=JSON.stringify([action,target,token]),old=s.receipts.find(r=>r.id===id);
        if(old)return old.signature===signature?{ok:true,duplicate:true,receipt:old,result:old.result}:{ok:false};
        const q=quote(s,action,target,now);if(!q.ok||token!==q.token)return {ok:false,reason:q.reason||'Review the updated cost'};
        pay(s,q.cost);let result=null;
        if(action==='plant'){s.plots[target.plot]={plant:target.plant,plantedAt:now};result={plot:target.plot,plant:target.plant,plantedAt:now};}
        if(action==='harvest'){const d=q.detail;s.ingredients[d.plant]+=d.yield;s.plots[target.plot]=null;result={plot:target.plot,plant:d.plant,yield:d.yield,phase:d.phase};}
        if(action==='brew'){const f=q.detail;s.ingredients[f.a]--;s.ingredients[f.b]--;s.cauldrons[target.cauldron]={formula:f.id,startedAt:now,endsAt:now+f.brewSeconds};result={cauldron:target.cauldron,formula:f.id,known:!!s.book[f.id],endsAt:now+f.brewSeconds};}
        if(action==='collect'){const f=q.detail;s.potions[f.id]=(s.potions[f.id]||0)+DOSES;const discovered=!s.book[f.id];s.book[f.id]=true;s.cauldrons[target.cauldron]=null;result={cauldron:target.cauldron,formula:f.id,doses:DOSES,discovered};}
        if(action==='drink'){
            const f=q.detail,seconds=potionSeconds(s),cap=now+stackCap(s);expire(s,now);s.potions[f.id]--;
            for(const e of f.effects){const cur=s.effects[e.stat];const base=cur&&cur.until>now?cur.until:now;s.effects[e.stat]={until:Math.min(cap,base+seconds),level:Math.max(e.level,cur&&cur.until>now?cur.level:0)};}
            result={formula:f.id,effects:f.effects.map(e=>({stat:e.stat,level:s.effects[e.stat].level,until:s.effects[e.stat].until}))};
        }
        if(action==='buy'){s.nodes[target]=true;while(s.plots.length<plotCount(s))s.plots.push(null);while(s.cauldrons.length<cauldronCount(s))s.cauldrons.push(null);result={node:target};}
        const receipt={id,signature,action,target,cost:q.cost,result:result?structuredClone(result):null};s.receipts.push(receipt);
        return {ok:true,duplicate:false,receipt,result};
    }
    root.SpellcraftAlchemy=Object.freeze({ALCHEMY_BOSS_WINS,PLOTS_START,PLOTS_MAX,CAULDRONS_START,CAULDRONS_MAX,WINDOW_FRACTION,DECAY_SPAN,HARVEST_MAX,HARVEST_MIN,DOSES,POTION_SECONDS,STACK_CAP,elements,domains,elementColors,domainNames,growthTiers,brewMinutes,plants,plant,effects,signature,cross,specials,pairKey,formula,formulas,formulaById,fishNames,nodes,node,fresh,bought,open,seedUnlocked,unlockedPlants,nextSeed,findSeed,plotCount,cauldronCount,windowFraction,decaySpan,potionSeconds,stackCap,growth,cauldronDone,cauldronRemaining,activeEffects,modifier,expire,returnSummary,nodeLocked,quote,commit});
})(globalThis);
