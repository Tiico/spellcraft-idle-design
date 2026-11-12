/* Research lab review model (#678). Fish is fuel: each species gives a fixed amount of fuel, ten times more per zone, and the
   player pours fish into a tank. Research slots run projects that are themselves the lab's permanent upgrades; every running slot
   burns fuel at the lab's speed, and an empty tank pauses every project without losing anything. A project can be paused and keeps
   its progress. Time and command IDs are explicit inputs; nothing restarts by itself. */
(function(root){
    const BASE_CAPACITY=120,BASE_BURN_PER_MINUTE=1,SOCKETS=8,BASE_SLOTS=1,LAB_BOSS_WINS=12,AWAY_CAP_SECONDS=12*3600;
    const EPS=1e-9;
    const elementColors=Object.freeze({ice:'#8fd3ff',earth:'#8fc96a',fire:'#ff8a3a',wind:'#d9d3ff'});
    // The first four fishing zones of the game catalog. A species' fuel is its place in the zone (1-4) times ten per zone after the first.
    const zoneRows=[
        ['silver-lake','Silver Lake','ice',12,['Reedfin','Mooncarp','Glass Eel','Star Koi']],
        ['reed-swamps','Reed Swamps','earth',14,['Mudskipper','Bog Perch','Reed Pike','Marsh Lantern']],
        ['lava-river','Lava River','fire',16,['Cinder Minnow','Ash Carp','Magma Eel','Ember Koi']],
        ['cloud-shoals','Cloud Shoals','wind',18,['Gale Sprat','Sky Trout','Zephyr Ray','Storm Marlin']]
    ];
    const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    const zones=Object.freeze(zoneRows.map(([id,name,element,bossWins],i)=>Object.freeze({id,name,element,bossWins,order:i+1,color:elementColors[element]})));
    const species=Object.freeze(zoneRows.flatMap(([zone,,element],z)=>zoneRows[z][4].map((name,i)=>Object.freeze({id:slug(name),name,zone,element,color:elementColors[element],rank:i+1,fuel:(i+1)*10**z}))));
    const fish=id=>species.find(f=>f.id===id);
    const zone=id=>zones.find(z=>z.id===id);
    // The research tree. Lab projects grow the lab itself; the others are permanent upgrades across the game. Placeholders (#678).
    const projectRows=[
        ['bench-2','Second bench','lab','+1 research slot',20,{reedfin:6,mooncarp:2},[],{kind:'slot'}],
        ['tank-1','Wider tank','lab','Tank holds 2× fuel',30,{reedfin:8,mooncarp:3},[],{kind:'tank',multiplier:2}],
        ['valve-1','Pressure valve','lab','Research speed +50 %, fuel use +50 %',45,{mooncarp:4,'glass-eel':1},['tank-1'],{kind:'speed',bp:5000}],
        ['filter-1','Fine filter','lab','Every fish gives +25 % fuel',60,{'glass-eel':2,'star-koi':1},['valve-1'],{kind:'fuel',bp:2500}],
        ['tank-2','Copper tank','lab','Tank holds 3.5× fuel',240,{mudskipper:6,'bog-perch':2},['tank-1'],{kind:'tank',multiplier:3.5}],
        ['bench-3','Third bench','lab','+1 research slot',480,{'bog-perch':4,'reed-pike':1},['bench-2'],{kind:'slot'}],
        ['valve-2','Twin turbines','lab','Research speed +100 %, fuel use +100 %',720,{'ash-carp':3,'magma-eel':1},['valve-1'],{kind:'speed',bp:10000}],
        ['tank-3','Brass tank','lab','Tank holds 5× fuel',1440,{'reed-pike':2,'marsh-lantern':1},['tank-2'],{kind:'tank',multiplier:5}],
        ['bench-4','Fourth bench','lab','+1 research slot',4320,{'magma-eel':3,'ember-koi':1},['bench-3'],{kind:'slot'}],
        ['ember-theory','Ember theory','power','Cooldown −3 %',15,{reedfin:4},[],{kind:'stat'}],
        ['arc-geometry','Arc geometry','power','Spell area +5 %',120,{mooncarp:5,'glass-eel':1},['ember-theory'],{kind:'stat'}],
        ['battle-cadence','Battle cadence','power','Attack speed +4 %',1440,{mudskipper:10,'reed-pike':2},['arc-geometry'],{kind:'stat'}],
        ['vein-mapping','Vein mapping','mining','Mining speed +5 %',10,{reedfin:3},[],{kind:'stat'}],
        ['spirit-diet','Spirit diet','mining','Spirits gain +10 % XP from fish',60,{mooncarp:3,reedfin:4},['vein-mapping'],{kind:'stat'}],
        ['deep-assay','Deep assay','mining','Mine yield +6 %',2880,{'ash-carp':4,'magma-eel':2},['spirit-diet'],{kind:'stat'}],
        ['knot-craft','Knot craft','fishing','Trap time −5 %',5,{reedfin:2},[],{kind:'stat'}],
        ['lure-chemistry','Lure chemistry','fishing','Rare catch chance +2 %',180,{'glass-eel':2,'bog-perch':2},['knot-craft'],{kind:'stat'}],
        ['storm-charts','Storm charts','fishing','Bite window +0.3 s',2880,{'gale-sprat':6,'zephyr-ray':1},['lure-chemistry'],{kind:'stat'}],
        ['soil-notes','Soil notes','alchemy','Harvest window +1 %',30,{reedfin:5,mooncarp:1},[],{kind:'stat'}],
        ['cauldron-flues','Cauldron flues','alchemy','Brew time −5 %',360,{'bog-perch':3,'reed-pike':1},['soil-notes'],{kind:'stat'}]
    ];
    const systems=Object.freeze({lab:'Lab',power:'Power',mining:'Mining',fishing:'Fishing',alchemy:'Alchemy'});
    const projects=Object.freeze(projectRows.map(([id,name,system,effectText,minutes,cost,requires,effect])=>Object.freeze({id,name,system,effectText,minutes,work:minutes*60,cost:Object.freeze(cost),requires:Object.freeze(requires),effect:Object.freeze(effect)})));
    const project=id=>projects.find(p=>p.id===id);
    // Where each locked slot comes from; slots beyond the lab's benches come from the Grimoire after a prestige.
    const slotSources=Object.freeze(['bench-2','bench-3','bench-4']);
    const fresh=()=>({
        bossWins:0,fish:Object.fromEntries(species.map(f=>[f.id,0])),fuel:0,
        slots:Array(BASE_SLOTS).fill(null),queue:[],paused:{},done:{},
        grimoire:{tank:1,speed:1,slots:0},burned:0,log:[],receipts:[]
    });
    const open=s=>s.bossWins>=LAB_BOSS_WINS;
    const zoneOpen=(s,id)=>s.bossWins>=zone(id).bossWins;
    const doneEffects=(s,kind)=>projects.filter(p=>s.done[p.id]&&p.effect.kind===kind).map(p=>p.effect);
    const slotCount=s=>BASE_SLOTS+doneEffects(s,'slot').length+s.grimoire.slots;
    const capacity=s=>BASE_CAPACITY*Math.max(1,...doneEffects(s,'tank').map(e=>e.multiplier))*s.grimoire.tank;
    const capacityMultiple=s=>capacity(s)/BASE_CAPACITY;
    // Speed raises progress and fuel use exactly alike.
    const speed=s=>(10000+doneEffects(s,'speed').reduce((n,e)=>n+e.bp,0))/10000*s.grimoire.speed;
    const fuelPerFish=(s,id)=>fish(id).fuel*(10000+doneEffects(s,'fuel').reduce((n,e)=>n+e.bp,0))/10000;
    const running=s=>s.slots.map((slot,index)=>slot?{index,...slot}:null).filter(Boolean);
    const burnPerSecond=s=>running(s).length*BASE_BURN_PER_MINUTE/60*speed(s);
    // How fast the fuel goes compared with one slot at base speed; the review shows it as "speed ×N".
    const burnMultiple=s=>burnPerSecond(s)/(BASE_BURN_PER_MINUTE/60);
    const fuelSecondsLeft=s=>{const b=burnPerSecond(s);return b>0?s.fuel/b:Infinity;};
    const projectSecondsLeft=(s,slot)=>{const p=s.slots[slot];return p?(project(p.project).work-p.progress)/speed(s):0;};
    const progressFraction=(s,slot)=>{const p=s.slots[slot];return p?Math.min(1,p.progress/project(p.project).work):0;};
    const busy=(s,id)=>s.slots.some(p=>p&&p.project===id)||s.queue.includes(id);
    // The animation follows a damped logarithmic scale with a cap: 100 times the base burn moves about 8 times as fast.
    const motion=multiple=>multiple<=0?0:Math.min(8,1+3.5*Math.log10(Math.max(1,multiple)));
    // Sockets: the wheel always has eight; each holds an eighth of the tank. The socket at the nozzle is the one draining.
    const socketFuel=s=>capacity(s)/SOCKETS;
    function sockets(s){
        const per=socketFuel(s),full=Math.floor((s.fuel+EPS)/per),part=s.fuel-full*per;
        const out=[];
        // Position 0 is at the nozzle; positions 1..7 run back toward the sockets that come next.
        if(part>EPS){out.push({state:'active',fill:part/per,fuel:part});for(let i=0;i<full&&out.length<SOCKETS;i++)out.push({state:'full',fill:1,fuel:per});}
        else if(full>0){out.push({state:'active',fill:1,fuel:per});for(let i=1;i<full;i++)out.push({state:'full',fill:1,fuel:per});}
        while(out.length<SOCKETS)out.push({state:'empty',fill:0,fuel:0});
        return out;
    }
    // A socket shows one fish icon in the start tank, a fish with five dots in mid game and a gauge with a number in late game.
    const socketStyle=s=>capacityMultiple(s)>=30?'gauge':capacityMultiple(s)>=3?'dots':'icon';
    const machineStage=s=>capacityMultiple(s)>=30?'late':capacityMultiple(s)>=3?'mid':'start';
    const affordable=(s,cost)=>Object.entries(cost).every(([id,n])=>(s.fish[id]||0)>=n);
    const lockedZoneOf=(s,cost)=>{for(const id of Object.keys(cost)){const z=fish(id).zone;if(!zoneOpen(s,z))return zone(z);}return null;};
    // Ready to start: prerequisites done, not done, not running or queued; a paused project resumes for free.
    function ready(s){
        return projects.filter(p=>!s.done[p.id]&&!busy(s,p.id)&&p.requires.every(r=>s.done[r])).map(p=>{
            const paused=s.paused[p.id]!==undefined,locked=lockedZoneOf(s,p.cost);
            return {project:p,paused,progress:paused?s.paused[p.id]/p.work:0,affordable:paused||affordable(s,p.cost),lockedZone:paused?null:locked};
        });
    }
    function startQueued(s){
        for(let i=0;i<s.slots.length&&s.queue.length;i++){
            if(s.slots[i])continue;
            const id=s.queue.shift();const progress=s.paused[id]??0;delete s.paused[id];
            s.slots[i]={project:id,progress};
        }
    }
    function complete(s,i){
        const id=s.slots[i].project;s.done[id]=true;s.slots[i]=null;s.log.push(id);
        while(s.slots.length<slotCount(s))s.slots.push(null);
        startQueued(s);
    }
    // Event-driven settlement: steps to the next completion or the empty tank, so any split of the same time gives the same lab.
    function advance(s,seconds){
        let left=Math.max(0,seconds),burned=0;const completed=[];
        while(left>EPS){
            const runs=running(s);
            if(!runs.length||s.fuel<=EPS){s.fuel=Math.max(0,s.fuel);break;}
            const v=speed(s),burn=burnPerSecond(s);
            const toEmpty=s.fuel/burn,toDone=Math.min(...runs.map(r=>(project(r.project).work-r.progress)/v));
            const step=Math.min(left,toEmpty,toDone);
            s.fuel-=burn*step;burned+=burn*step;left-=step;
            for(const r of runs)s.slots[r.index].progress+=v*step;
            if(s.fuel<EPS*burn)s.fuel=0;
            for(let i=0;i<s.slots.length;i++){const p=s.slots[i];if(p&&p.progress>=project(p.project).work-EPS){completed.push(p.project);complete(s,i);}}
        }
        s.burned+=burned;
        return {burned,completed};
    }
    // A return after being away settles at most twelve hours, like the mine.
    function away(s,seconds){const counted=Math.min(seconds,AWAY_CAP_SECONDS);return {counted,capped:seconds>AWAY_CAP_SECONDS,...advance(s,counted)};}
    function quote(s,action,target){
        let reason=null,detail=null;
        if(!open(s))reason=`The lab opens with fishing, at the Earth guardian`;
        else if(action==='fill'){
            const f=fish(target?.species),count=Number(target?.count);
            if(!f)reason='Unknown fish';else if(!Number.isInteger(count)||count<1)reason='Choose how many';
            else if((s.fish[f.id]||0)<count)reason=`Not enough ${f.name}`;
            else{const per=fuelPerFish(s,f.id),room=capacity(s)-s.fuel,fits=Math.min(count,Math.floor((room+EPS)/per));
                if(fits<1)reason=room<=EPS?'The tank is full':`One ${f.name} gives ${per} fuel; the tank has room for ${Math.floor(room)}`;
                else detail={species:f.id,count:fits,fuel:fits*per,leftOut:count-fits};}
        }
        else if(action==='queue'){
            const p=project(target);
            if(!p)reason='Unknown research';else if(s.done[p.id])reason='Already researched';else if(busy(s,p.id))reason='Already running or queued';
            else if(!p.requires.every(r=>s.done[r]))reason=`Research ${project(p.requires.find(r=>!s.done[r])).name} first`;
            else if(s.paused[p.id]===undefined){const z=lockedZoneOf(s,p.cost);if(z)reason=`Needs fish from ${z.name}`;else if(!affordable(s,p.cost))reason='Catch the required fish';}
            if(!reason)detail={project:p.id,resume:s.paused[p.id]!==undefined,cost:s.paused[p.id]!==undefined?{}:p.cost,startsNow:s.slots.some(x=>!x)};
        }
        else if(action==='pause'){
            const i=Number(target);if(!Number.isInteger(i)||!s.slots[i])reason='Nothing runs in this slot';else detail={slot:i,project:s.slots[i].project,progress:s.slots[i].progress};
        }
        else if(action==='unqueue'){
            const i=s.queue.indexOf(target);if(i<0)reason='Not queued';else detail={project:target};
        }
        else reason='Unknown action';
        return {ok:!reason,reason,action,target,detail};
    }
    // Commits are idempotent: a replayed command ID returns its receipt and changes nothing; a changed payload is refused.
    function commit(s,{id,action,target}){
        if(typeof id!=='string'||!id||id.length>100)return {ok:false};
        const signature=JSON.stringify([action,target]),old=s.receipts.find(r=>r.id===id);
        if(old)return old.signature===signature?{ok:true,duplicate:true,result:old.result}:{ok:false,reason:'This command ID was used for something else'};
        const q=quote(s,action,target);if(!q.ok)return {ok:false,reason:q.reason};
        let result=null;const d=q.detail;
        if(action==='fill'){s.fish[d.species]-=d.count;s.fuel+=d.fuel;result={...d,tank:s.fuel};}
        if(action==='queue'){for(const [f,n]of Object.entries(d.cost))s.fish[f]-=n;s.queue.push(d.project);startQueued(s);result={...d,slot:s.slots.findIndex(x=>x&&x.project===d.project)};}
        if(action==='pause'){s.paused[d.project]=d.progress;s.slots[d.slot]=null;startQueued(s);result=d;}
        // A queued project that has not started gives its fish back; one that had progress stays paused with it.
        if(action==='unqueue'){s.queue.splice(s.queue.indexOf(d.project),1);if(s.paused[d.project]===undefined){for(const [f,n]of Object.entries(project(d.project).cost))s.fish[f]+=n;}result=d;}
        s.receipts.push({id,signature,result:structuredClone(result)});
        return {ok:true,duplicate:false,result};
    }
    root.SpellcraftResearchLab=Object.freeze({BASE_CAPACITY,BASE_BURN_PER_MINUTE,SOCKETS,BASE_SLOTS,LAB_BOSS_WINS,AWAY_CAP_SECONDS,elementColors,zones,zone,species,fish,systems,projects,project,slotSources,fresh,open,zoneOpen,slotCount,capacity,capacityMultiple,speed,fuelPerFish,running,burnPerSecond,burnMultiple,fuelSecondsLeft,projectSecondsLeft,progressFraction,motion,socketFuel,sockets,socketStyle,machineStage,ready,advance,away,quote,commit});
})(globalThis);
