/* REVIEW PROTOTYPE boss-mechanics v1 (#374): the rules of ADR 0015's building blocks as one deterministic fight.
   No randomness and no wall clock: a fight is a pure function of the boss, the tier and the mage's position at each step,
   like the client's BossCombat. Values are placeholders for #25; the shapes of the data are the proposal. */
(function(root){
    'use strict';
    const ARENA={width:360,height:440};
    const BOSS_AT={x:180,y:370};
    const MAGE_START={x:180,y:90};
    const MAGE_SPEED=260;
    const MAGE_HP=100;
    const TIME_LIMIT_MS=90000;
    const STEP_MS=10;
    const MARK_WARNING_MS=1500;
    const MARK_RADIUS_BP=1100;
    const FULL=10000;

    /* The prototype's loadout: catalog values of four existing spells. Frostfire Cone is a fusion; its elements are the root
       elements of its recipe (Frostfire Bolt = Firebolt + Icebolt, plus Ember Ring), so it counts as fire and ice. */
    const spells={
        'flare-javelin':{id:'flare-javelin',name:'Flare Javelin',elements:['fire'],shape:'bolt',damage:52,cooldownMs:6000},
        'frost-fang':{id:'frost-fang',name:'Frost Fang',elements:['ice'],shape:'bolt',damage:40,cooldownMs:4000},
        'ember-ring':{id:'ember-ring',name:'Ember Ring',elements:['fire'],shape:'cone',damage:22,cooldownMs:3500,rangeBp:5000,angleDegrees:60},
        'frostfire-cone':{id:'frostfire-cone',name:'Frostfire Cone',elements:['fire','ice'],shape:'cone',damage:90,cooldownMs:3500,rangeBp:6500,angleDegrees:90}
    };
    const LOADOUT=['flare-javelin','frost-fang','ember-ring','frostfire-cone'];

    /* Bosses as catalog data. Every block is optional; a boss is a combination. */
    const bosses={
        'ember-watcher':{
            id:'ember-watcher',name:'The Ember Watcher',realm:'fire',node:6,hp:1800,
            attacks:{'ember-strike':{name:'Ember Strike',damage:8,intervalMs:5000,warningMs:MARK_WARNING_MS,radiusBp:MARK_RADIUS_BP}},
            charged:{'ember-slam':{name:'Ember Slam',firstMs:8000,everyMs:12000,chargeMs:3000,area:{kind:'target',radiusBp:1550},damage:30,interruptDamage:80,staggerMs:3000}},
            weakPoint:{kind:'recovery',windowMs:2500,armorBp:5000},
            phases:[]
        },
        'cinder-warden':{
            id:'cinder-warden',name:'The Cinder Warden',realm:'fire',node:13,hp:2000,
            attacks:{'ember-strike':{name:'Ember Strike',damage:8,intervalMs:5000,warningMs:MARK_WARNING_MS,radiusBp:MARK_RADIUS_BP}},
            charged:{'cinder-sweep':{name:'Cinder Sweep',firstMs:12000,everyMs:15000,chargeMs:2500,area:{kind:'sweep'},damage:25,interruptDamage:100,staggerMs:2500}},
            ward:{name:'Cinder Ward',hp:400,breaksBy:{shape:'area'},otherDamageBp:2500},
            reinforcements:{'ember-imp':{name:'Ember Imp',behaviour:'striker',hp:30,damage:3,attackIntervalMs:4000,firstSpawnMs:6000,spawnIntervalMs:6000,waveSize:1,maxAlive:3,
                places:[{xBp:5000,yBp:5800},{xBp:2800,yBp:4600},{xBp:7200,yBp:4600},{xBp:1200,yBp:2800},{xBp:8800,yBp:2800}]}},
            phases:[{atHpBp:5000,transitionMs:1500,raiseWard:true,reinforcements:{'ember-imp':{waveSize:2,maxAlive:4}}}]
        },
        'ashen-knight':{
            id:'ashen-knight',name:'The Ashen Knight',realm:'fire',node:19,hp:2400,
            attacks:{'ember-strike':{name:'Ember Strike',damage:8,intervalMs:5000,warningMs:MARK_WARNING_MS,radiusBp:MARK_RADIUS_BP}},
            weakPoint:{kind:'flank',switchMs:7000,deadZoneBp:830,armorBp:4000},
            reinforcements:{'ash-pylon':{name:'Ash Pylon',behaviour:'pylon',hp:160,damageTakenBp:5000,firstSpawnMs:0,spawnIntervalMs:0,waveSize:2,maxAlive:2,
                places:[{xBp:2200,yBp:7600},{xBp:7800,yBp:7600}]}},
            phases:[{atHpBp:5000,transitionMs:2000,
                ward:{name:'Ash Ward',hp:300,breaksBy:{element:'ice'},otherDamageBp:2500},
                attacks:{'ember-strike':{intervalMs:3500}},
                charged:{'ashen-cleave':{name:'Ashen Cleave',firstMs:4000,everyMs:10000,chargeMs:2200,area:{kind:'sweep'},damage:30,interruptDamage:90,staggerMs:2500}},
                reinforcements:{'ash-mender':{name:'Ash Mender',behaviour:'mender',hp:140,heal:40,healIntervalMs:5000,channelMs:1000,firstSpawnMs:0,spawnIntervalMs:0,waveSize:2,maxAlive:2,
                    places:[{xBp:3300,yBp:6400},{xBp:6700,yBp:6400}]}}}]
        }
    };

    /* Tier scaling: everything with HP scales like the boss (ADR 0015 §Tierskalning); charge and weak windows shorten. */
    const tierScaling={enemyHpPerTierBp:15000,chargeMsPerTierBp:9000,markIntervalPerTierBp:9500,lastTier:3};
    const scaleBp=(value,bp,steps)=>{let v=value;for(let i=0;i<steps;i++)v=Math.ceil(v*bp/FULL);return v;};
    function tierOf(boss,tier){
        const steps=Math.max(0,Math.min(tier,tierScaling.lastTier)-1);
        const hp=v=>scaleBp(v,tierScaling.enemyHpPerTierBp,steps);
        const ms=(v,bp)=>v==null?v:Math.max(1,Math.floor(v*Math.pow(bp/FULL,steps)));
        const clone=JSON.parse(JSON.stringify(boss));
        const scaleCharged=c=>{for(const a of Object.values(c||{})){a.chargeMs=ms(a.chargeMs,tierScaling.chargeMsPerTierBp);a.interruptDamage=hp(a.interruptDamage);}};
        const scaleAdds=r=>{for(const a of Object.values(r||{})){if(a.hp!=null)a.hp=hp(a.hp);if(a.heal!=null)a.heal=hp(a.heal);}};
        clone.hp=hp(clone.hp);
        if(clone.ward)clone.ward.hp=hp(clone.ward.hp);
        if(clone.weakPoint?.windowMs)clone.weakPoint.windowMs=ms(clone.weakPoint.windowMs,tierScaling.chargeMsPerTierBp);
        const scaleMarks=a=>{for(const m of Object.values(a||{}))if(m.intervalMs)m.intervalMs=ms(m.intervalMs,tierScaling.markIntervalPerTierBp);};
        scaleMarks(clone.attacks);
        scaleCharged(clone.charged);scaleAdds(clone.reinforcements);
        for(const p of clone.phases){if(p.ward)p.ward.hp=hp(p.ward.hp);scaleCharged(p.charged);scaleAdds(p.reinforcements);scaleMarks(p.attacks);}
        clone.tier=Math.max(1,Math.min(tier,tierScaling.lastTier));
        return clone;
    }

    /* Wards the fight can raise, in order: the boss's own ward at start, re-raised or replaced by phases. */
    function wardsOf(boss){
        const list=[];
        if(boss.ward)list.push(boss.ward);
        for(const p of boss.phases){if(p.ward)list.push(p.ward);else if(p.raiseWard&&boss.ward)list.push(boss.ward);}
        return list;
    }

    const half=x=>Math.floor(x+0.5);
    const scale=(value,bp)=>half(value*bp/FULL);
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const at=p=>({x:p.xBp*ARENA.width/FULL,y:p.yBp*ARENA.height/FULL});
    const units=bp=>bp*ARENA.width/FULL;

    function breaksWard(ward,spell){
        const by=ward.breaksBy||{};
        if(by.element)return spell.elements.includes(by.element);
        if(by.shape==='area')return spell.shape==='cone'||spell.shape==='burst';
        if(by.shape)return spell.shape===by.shape;
        return false;
    }

    function create(bossId,{tier=1,startPhase=0}={}){
        const boss=tierOf(bosses[bossId],tier);
        const f={
            boss,t:0,over:null,events:[],nextId:1,
            hp:boss.hp,phase:0,invulnerableUntil:0,staggerUntil:0,exposedUntil:0,
            mage:{hp:MAGE_HP,max:MAGE_HP,x:MAGE_START.x,y:MAGE_START.y},
            attacks:{},charged:{},charge:null,marks:[],adds:[],spawners:{},ward:null,
            slots:LOADOUT.map(id=>({spell:id,readyAt:0,auto:true,casts:0,damage:0})),
            healed:0,wardsRaised:[]
        };
        applyBlocks(f,{attacks:boss.attacks,charged:boss.charged,reinforcements:boss.reinforcements},0);
        if(boss.ward)raiseWard(f,boss.ward);
        // A review scene may start in a later phase: the earlier phases' one-time adds count as defeated and their wards as broken.
        for(let p=0;p<startPhase;p++){
            for(const sp of Object.values(f.spawners))if(sp.once)sp.done=true;
            f.ward=null;f.wardsRaised=[];
            f.hp=Math.min(f.hp,threshold(f,p));enterPhase(f,p,true);
        }
        f.events=[];
        return f;
    }

    function applyBlocks(f,{attacks,charged,reinforcements},from){
        for(const [id,a] of Object.entries(attacks||{})){
            const old=f.attacks[id]||{};
            const merged={...old.def,...a};
            f.attacks[id]={def:merged,next:from+merged.intervalMs};
        }
        for(const [id,c] of Object.entries(charged||{}))f.charged[id]={def:c,next:from+c.firstMs};
        for(const [id,r] of Object.entries(reinforcements||{})){
            const old=f.spawners[id];
            const def=old?{...old.def,...r}:r;
            f.spawners[id]={id,def,next:old?old.next:from+def.firstSpawnMs,once:def.spawnIntervalMs===0,done:false};
            if(old&&old.once)f.spawners[id].done=old.done;
        }
    }

    function threshold(f,p){return Math.ceil(f.boss.hp*f.boss.phases[p].atHpBp/FULL);}

    function raiseWard(f,w){f.ward={name:w.name,hp:w.hp,max:w.hp,breaksBy:w.breaksBy,otherDamageBp:w.otherDamageBp};f.wardsRaised.push(w.hp);emit(f,'wardRaised',{name:w.name,hp:w.hp});}

    function enterPhase(f,p,silent){
        const ph=f.boss.phases[p];
        f.phase=p+1;
        f.invulnerableUntil=f.t+(silent?0:ph.transitionMs);
        f.charge=null;f.marks=[];
        const from=f.invulnerableUntil;
        applyBlocks(f,ph,from);
        if(ph.ward)raiseWard(f,ph.ward);else if(ph.raiseWard&&f.boss.ward)raiseWard(f,f.boss.ward);
        emit(f,'phase',{phase:f.phase+1,transitionMs:silent?0:ph.transitionMs});
    }

    function emit(f,kind,data){f.events.push({kind,at:f.t,...data});}

    /* Weak point: the boss takes full damage only while exposed; otherwise its armour scales the hit. */
    function flankSide(f){const w=f.boss.weakPoint;return Math.floor(f.t/w.switchMs)%2===0?'left':'right';}
    function exposed(f){
        const w=f.boss.weakPoint;
        if(f.t<f.staggerUntil)return true;
        if(!w)return true;
        if(w.kind==='recovery')return f.t<f.exposedUntil;
        if(w.kind==='flank'){const side=flankSide(f);const dz=units(w.deadZoneBp);return side==='left'?f.mage.x<BOSS_AT.x-dz:f.mage.x>BOSS_AT.x+dz;}
        return false;
    }
    const pylonBp=f=>f.adds.filter(a=>a.behaviour==='pylon').reduce((bp,a)=>Math.floor(bp*a.damageTakenBp/FULL),FULL);

    function hitBoss(f,slot,spell,raw){
        if(f.t<f.invulnerableUntil){emit(f,'immune',{slot});return 0;}
        let dealt=0;
        if(f.ward){
            const breaks=breaksWard(f.ward,spell);
            dealt=Math.min(f.ward.hp,breaks?raw:scale(raw,f.ward.otherDamageBp));
            f.ward.hp-=dealt;
            emit(f,'wardHit',{slot,amount:dealt,breaks});
            if(f.ward.hp<=0){emit(f,'wardBroken',{name:f.ward.name,slot});f.ward=null;}
        }else{
            const open=exposed(f);
            let bp=open?FULL:f.boss.weakPoint.armorBp;
            bp=Math.floor(bp*pylonBp(f)/FULL);
            dealt=scale(raw,bp);
            const p=f.phase;
            const floor=p<f.boss.phases.length?threshold(f,p):0;
            dealt=Math.min(dealt,f.hp-floor);
            f.hp-=dealt;
            emit(f,'bossHit',{slot,amount:dealt,weak:open&&!!f.boss.weakPoint,armored:!open,fortified:bp<(open?FULL:f.boss.weakPoint.armorBp)});
            if(p<f.boss.phases.length&&f.hp<=floor)enterPhase(f,p,false);
            else if(f.hp<=0)finish(f,'victory');
        }
        if(f.charge&&!f.charge.interrupted){
            f.charge.dealt+=dealt;
            if(f.charge.dealt>=f.charge.def.interruptDamage)interrupt(f);
        }
        return dealt;
    }

    function interrupt(f){
        const c=f.charge;
        f.charge=null;
        f.staggerUntil=f.t+c.def.staggerMs;
        for(const a of Object.values(f.attacks))a.next=Math.max(a.next,f.staggerUntil);
        f.marks=[];
        emit(f,'interrupted',{name:c.def.name,staggerMs:c.def.staggerMs});
    }

    function inCone(spell,mage,target){
        const range=spell.rangeBp*ARENA.width/FULL;
        const d=dist(mage,target);
        if(d>range||d===0)return false;
        const ax=BOSS_AT.x-mage.x,ay=BOSS_AT.y-mage.y,bx=target.x-mage.x,by=target.y-mage.y;
        const cos=(ax*bx+ay*by)/(Math.hypot(ax,ay)*d);
        return cos>=Math.cos(spell.angleDegrees/2*Math.PI/180)-1e-9;
    }

    function cast(f,slotIndex,manual){
        const s=f.slots[slotIndex];
        if(f.over||f.t<s.readyAt)return false;
        const spell=spells[s.spell];
        s.readyAt=f.t+spell.cooldownMs;
        s.casts++;
        const struck=[];
        if(spell.shape==='cone'){
            for(const a of f.adds.slice())if(inCone(spell,f.mage,a)){a.hp-=spell.damage;struck.push(a.id);if(a.hp<=0)defeatAdd(f,a);}
        }
        emit(f,'cast',{slot:slotIndex,spell:spell.id,manual:!!manual,struck});
        const dealt=hitBoss(f,slotIndex,spell,spell.damage);
        s.damage+=dealt;
        return true;
    }

    function defeatAdd(f,a){f.adds=f.adds.filter(x=>x!==a);emit(f,'addDefeated',{id:a.id,behaviour:a.behaviour,name:a.name});}

    function spawn(f,sp){
        const d=sp.def;
        const taken=new Set(f.adds.filter(a=>a.kind===sp.id).map(a=>a.place));
        let made=0;
        for(let i=0;i<d.places.length&&made<d.waveSize;i++){
            if(f.adds.filter(a=>a.kind===sp.id).length>=d.maxAlive)break;
            if(taken.has(i))continue;
            const p=at(d.places[i]);
            const a={id:sp.id+'-'+f.nextId++,kind:sp.id,name:d.name,behaviour:d.behaviour,place:i,x:p.x,y:p.y,hp:d.hp,max:d.hp,
                damage:d.damage,damageTakenBp:d.damageTakenBp,heal:d.heal,channelMs:d.channelMs,
                next:d.behaviour==='striker'?f.t+d.attackIntervalMs:d.behaviour==='mender'?f.t+d.healIntervalMs:null,interval:d.attackIntervalMs||d.healIntervalMs};
            f.adds.push(a);made++;
            emit(f,'spawn',{id:a.id,behaviour:a.behaviour,name:a.name});
        }
    }

    function hurtMage(f,amount,source){
        f.mage.hp=Math.max(0,f.mage.hp-amount);
        emit(f,'mageHit',{amount,source});
        if(f.mage.hp<=0)finish(f,'defeat','death');
    }

    function finish(f,outcome,reason){if(f.over)return;f.over={outcome,reason:reason||null,at:f.t};emit(f,outcome,{reason:reason||null});}

    function stepOnce(f){
        f.t+=STEP_MS;
        const t=f.t;
        if(t>=TIME_LIMIT_MS){finish(f,'defeat','timeLimit');return;}
        if(t<f.invulnerableUntil)return;
        const staggered=t<f.staggerUntil;
        // Reinforcements spawn and act.
        for(const sp of Object.values(f.spawners)){
            if(sp.done||t<sp.next)continue;
            spawn(f,sp);
            if(sp.once)sp.done=true;else sp.next=t+sp.def.spawnIntervalMs;
        }
        for(const a of f.adds){
            if(a.next==null||staggered&&a.behaviour==='mender')continue;
            if(a.behaviour==='mender'&&t>=a.next-a.channelMs&&!a.channeling){a.channeling=true;emit(f,'channel',{id:a.id});}
            if(t<a.next)continue;
            a.next=t+a.interval;
            if(a.behaviour==='striker')hurtMage(f,a.damage,a.name);
            if(a.behaviour==='mender'){
                a.channeling=false;
                const room=f.boss.hp-f.hp;
                const floorCap=f.phase>0?threshold(f,f.phase-1)-f.hp:room;
                const healed=Math.max(0,Math.min(a.heal,room,floorCap));
                f.hp+=healed;f.healed+=healed;
                emit(f,'heal',{id:a.id,amount:healed});
            }
            if(f.over)return;
        }
        // Marks: appear at the mage's position, land after the warning.
        if(!staggered)for(const [id,a] of Object.entries(f.attacks)){
            const d=a.def;
            if(t>=a.next-Math.min(d.warningMs,d.intervalMs)&&!a.shown){a.shown=true;f.marks.push({attack:id,x:f.mage.x,y:f.mage.y,radius:units(d.radiusBp),appears:t,lands:a.next,damage:d.damage});emit(f,'markShown',{attack:id});}
        }
        for(const m of f.marks.slice()){
            if(t<m.lands)continue;
            f.marks=f.marks.filter(x=>x!==m);
            const a=f.attacks[m.attack];if(a){a.shown=false;a.next=m.lands+a.def.intervalMs;}
            if(dist(f.mage,m)<=m.radius)hurtMage(f,m.damage,f.attacks[m.attack]?.def.name||'mark');else emit(f,'dodged',{source:'mark'});
            if(f.over)return;
        }
        // Charged attacks.
        if(!staggered&&!f.charge)for(const [id,c] of Object.entries(f.charged)){
            if(t<c.next)continue;
            const def=c.def;
            const area=def.area.kind==='target'?{kind:'target',x:f.mage.x,y:f.mage.y,radius:units(def.area.radiusBp)}:{kind:'sweep',side:f.mage.x<=BOSS_AT.x?'left':'right'};
            f.charge={id,def,startedAt:t,landsAt:t+def.chargeMs,area,dealt:0};
            c.next=t+def.everyMs;
            emit(f,'chargeStart',{name:def.name,area});
            break;
        }
        if(f.charge&&t>=f.charge.landsAt){
            const c=f.charge;f.charge=null;
            const a=c.area;
            const inside=a.kind==='target'?dist(f.mage,a)<=a.radius:(a.side==='left'?f.mage.x<=BOSS_AT.x:f.mage.x>BOSS_AT.x);
            emit(f,'chargeLanded',{name:c.def.name,hit:inside});
            if(inside)hurtMage(f,c.def.damage,c.def.name);
            if(f.boss.weakPoint?.kind==='recovery')f.exposedUntil=t+f.boss.weakPoint.windowMs;
            if(f.over)return;
        }
        // Autocast every ready slot.
        f.slots.forEach((s,i)=>{if(s.auto&&!f.over&&t>=s.readyAt)cast(f,i,false);});
    }

    /* Advance the fight by ms with the mage moving toward target at the mage's speed, like the thumb control. */
    function advance(f,ms,target){
        const steps=Math.floor(ms/STEP_MS);
        for(let i=0;i<steps&&!f.over;i++){
            if(target){
                const dx=target.x-f.mage.x,dy=target.y-f.mage.y,d=Math.hypot(dx,dy),max=MAGE_SPEED*STEP_MS/1000;
                if(d<=max){f.mage.x=target.x;f.mage.y=target.y;}else{f.mage.x+=dx/d*max;f.mage.y+=dy/d*max;}
                f.mage.x=Math.max(16,Math.min(ARENA.width-16,f.mage.x));f.mage.y=Math.max(16,Math.min(BOSS_AT.y-60,f.mage.y));
            }
            stepOnce(f);
        }
    }

    function castManually(f,slot){return cast(f,slot,true);}
    function setAuto(f,slot,on){f.slots[slot].auto=!!on;}
    function takeEvents(f){const e=f.events;f.events=[];return e;}

    /* The client's compact report: unchanged from ADR 0006 (no event log, no positions). */
    function report(f){
        return {outcome:f.over?.outcome||'defeat',reason:f.over?.reason||'left',combatTimeMs:f.over?.at??f.t,
            slots:f.slots.map(s=>({spell:s.spell,casts:s.casts,damage:s.damage}))};
    }

    /* The server's proposed check (ADR 0015 §Validering): today's bound from the frozen build, with the boss's effective HP
       (HP plus every ward the catalog raises) instead of its HP. No block raises a hit above the spell's base damage, so the
       per-slot bound is unchanged; menders' heals only add to what the player must deal and are not counted. */
    function effectiveHp(boss){return boss.hp+wardsOf(boss).reduce((s,w)=>s+w.hp,0);}
    function possibleCasts(t,cd){return Math.floor(t/cd)+1;}
    function maxDamage(t){return LOADOUT.reduce((s,id)=>s+possibleCasts(t,spells[id].cooldownMs)*spells[id].damage,0);}
    function minimumVictoryMs(boss){const need=effectiveHp(boss);let t=0;while(maxDamage(t)<need&&t<TIME_LIMIT_MS)t+=STEP_MS;return t;}
    function plausible(rep,bossId,tier){
        const boss=tierOf(bosses[bossId],tier);
        const reasons=[];
        if(rep.outcome!=='victory')return {ok:true,reasons:['defeats are accepted without a bound']};
        if(rep.combatTimeMs>=TIME_LIMIT_MS)reasons.push('combat time at or over 90 s');
        rep.slots.forEach((s,i)=>{
            const sp=spells[LOADOUT[i]];
            if(s.casts>possibleCasts(rep.combatTimeMs,sp.cooldownMs))reasons.push(`slot ${i+1}: too many casts`);
            if(s.damage>s.casts*sp.damage)reasons.push(`slot ${i+1}: damage above casts × base damage`);
        });
        const total=rep.slots.reduce((s,x)=>s+x.damage,0);
        if(total<effectiveHp(boss))reasons.push(`total ${total} below effective HP ${effectiveHp(boss)}`);
        if(maxDamage(rep.combatTimeMs)<effectiveHp(boss))reasons.push('faster than the build can deal the effective HP');
        return {ok:reasons.length===0,reasons,total,effectiveHp:effectiveHp(boss),minimumMs:minimumVictoryMs(boss)};
    }

    root.SpellcraftBossMechanics={ARENA,BOSS_AT,MAGE_START,MAGE_SPEED,MAGE_HP,TIME_LIMIT_MS,STEP_MS,FULL,spells,LOADOUT,bosses,tierScaling,
        tierOf,wardsOf,units,breaksWard,create,advance,castManually,setAuto,takeEvents,report,plausible,effectiveHp,maxDamage,minimumVictoryMs,exposed,flankSide,pylonBp,inCone};
})(typeof window!=='undefined'?window:globalThis);
