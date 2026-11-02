/* Spatial swarm study. Prototype values, explicit time, no authoritative progression. */
(function(scope){
    const patterns={Firebolt:{shape:'bolt'},Icebolt:{shape:'bolt'},'Frostfire Bolt':{shape:'burst',radius:8},'Flame Cone':{shape:'cone',angle:.46,range:86},'Frostfire Cone':{shape:'cone',angle:.68,range:100}};
    for(const d of MageIdleSpells.definitions)patterns[d.name]=d.pattern;
    function spawn(count,seed=0,kind='mob'){
        return Array.from({length:count},(_,i)=>{const n=seed+i,cluster=n%6,col=cluster%3,row=Math.floor(cluster/3);const x=19+col*30+Math.sin(n*2.7)*12,y=27+row*20+Math.cos(n*1.9)*8;return {id:kind+'-'+n,kind,x,y,baseX:x,baseY:y,hp:20,maxHp:20,phase:n*1.7};});
    }
    const alive=targets=>targets.filter(m=>m.hp>0);
    function resolve(targets,{name,aim,origin={x:50,y:91},damage=24}){
        const pattern=patterns[name],living=alive(targets);if(!pattern||!living.length||!Number.isFinite(damage)||damage<=0)return {hits:[],killed:0};
        aim=aim&&Number.isFinite(aim.x)&&Number.isFinite(aim.y)?aim:{x:50,y:40};
        const anchor=living.reduce((a,b)=>Math.hypot(a.x-aim.x,a.y-aim.y)<=Math.hypot(b.x-aim.x,b.y-aim.y)?a:b);
        const point={x:anchor.x,y:anchor.y};
        const direction=Math.atan2(point.y-origin.y,point.x-origin.x);
        const chosen=living.filter(m=>{
            if(pattern.shape==='bolt')return m===anchor;
            if(pattern.shape==='burst')return Math.hypot(m.x-point.x,m.y-point.y)<=pattern.radius;
            const distance=Math.hypot(m.x-origin.x,m.y-origin.y),angle=Math.atan2(m.y-origin.y,m.x-origin.x);
            const difference=Math.abs(Math.atan2(Math.sin(angle-direction),Math.cos(angle-direction)));
            return distance<=pattern.range&&difference<=pattern.angle;
        });
        const hits=chosen.map(m=>{const dealt=Math.min(m.hp,damage);m.hp=Math.max(0,m.hp-damage);return {id:m.id,x:m.x,y:m.y,damage,dealt,killed:m.hp===0,kind:m.kind};});
        return {name,origin,shape:pattern.shape,aim:point,direction,angle:pattern.angle||0,range:pattern.range||0,hits,killed:hits.filter(h=>h.killed).length};
    }
    function start({id,realm=0,owned=['Firebolt'],now=0,density=48}){
        return {id,realm,owned:[...owned],density,cursor:0,lastCast:-Infinity,lastStep:now,effects:MageEffects.create(),events:[],wave:1,serial:density,mobs:spawn(density),casts:0,popped:0,earned:0,claimed:0,nextSpawn:now};
    }
    function step(run,now,motion=true){
        const dt=Math.max(0,Math.min(100,now-run.lastStep));run.lastStep=now;
        for(const m of motion?alive(run.mobs):[]){m.phase+=dt*.00025;m.x=m.baseX+Math.sin(m.phase)*2;m.y=m.baseY+Math.cos(m.phase*.8)*1.3;}
        if(alive(run.mobs).length<=run.density-12&&now>=run.nextSpawn){run.mobs=alive(run.mobs);run.mobs.push(...spawn(12,run.serial));run.serial+=12;run.wave++;run.nextSpawn=now+1100;return true;}
        return false;
    }
    function cast(run,{id,loadout,preview=null,aim,damageBonus=0,damages,origin,now}){
        const build=(preview?[preview]:loadout||[]).filter(name=>run.owned.includes(name)&&(patterns[name]||MageEffects.definitions[name])).slice(0,4);
        if(!build.length||run.events.includes(id)||now-run.lastCast<420)return {accepted:false};
        const name=build[run.cursor%build.length];
        if(MageEffects.cast(run.effects,name,now)){run.events.push(id);run.lastCast=now;run.cursor++;run.casts++;run.lastSpell=name;return {accepted:true,name,shape:'support',hits:[],killed:0,earned:0};}
        const damage=damages?.[name];if(!Number.isFinite(damage)||damage<=0)return {accepted:false};
        const result=resolve(run.mobs,{name,aim,origin,damage:(damage+damageBonus)*MageEffects.multiplier(run.effects,now)});if(!result.hits.length)return {accepted:false};
        run.events.push(id);run.lastCast=now;run.cursor++;run.casts++;run.lastSpell=name;run.popped+=result.killed;run.earned=Math.floor(run.popped/8);
        return {accepted:true,...result,earned:run.earned-run.claimed};
    }
    function claim(run,player){const amount=run.earned-run.claimed;if(amount<=0)return 0;run.claimed=run.earned;player.shards[run.realm]+=amount;return amount;}
    scope.ArcaneActivityModel=Object.freeze({patterns,spawn,alive,resolve,start,step,cast,claim});
})(globalThis);
