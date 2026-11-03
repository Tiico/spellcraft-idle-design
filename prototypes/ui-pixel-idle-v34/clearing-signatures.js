/* Spell Clearing proposals. Geometry, hit order and presentation share this cast plan. */
const ClearingSignatures = (() => {
    const names = new Set([
        'Squall Blade', 'Flare Javelin', 'Frost Fang', 'Quartz Spike',
        'Rime Nova', 'Bramble Snare', 'Thunder Gust'
    ]);
    const hints = {
        'Squall Blade':'Aim through a line of monsters',
        'Flare Javelin':'Graze along the way · Burst at aim',
        'Frost Fang':'Bite first · Shatter behind the target',
        'Quartz Spike':'Send three spikes toward your aim',
        'Rime Nova':'Three frost waves · Stronger outer edge',
        'Bramble Snare':'Roots catch · Thorns snap shut',
        'Thunder Gust':'Aim near a cluster to chain lightning'
    };
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const lerp = (a, b, t) => ({x:a.x + (b.x-a.x)*t, y:a.y + (b.y-a.y)*t});
    const nearest = (mobs, point) => mobs.reduce((best, mob) =>
        !best || distance(mob, point) < distance(best, point) ? mob : best, null);

    function lane(mobs, from, to, width) {
        const dx = to.x-from.x, dy = to.y-from.y;
        const length = Math.hypot(dx, dy);
        if (!length) return [];
        return mobs.map(mob => ({
            mob,
            t: ((mob.x-from.x)*dx+(mob.y-from.y)*dy)/(length*length),
            offset: Math.abs((mob.x-from.x)*dy-(mob.y-from.y)*dx)/length
        })).filter(hit => hit.t>=0 && hit.t<=1 && hit.offset<=width)
            .sort((a,b) => a.t-b.t);
    }

    function fieldEdge(origin, point) {
        const dx = point.x-origin.x, dy = point.y-origin.y;
        if (!dx && !dy) return {x:origin.x,y:0};
        const tx = dx ? ((dx>0?100:0)-origin.x)/dx : Infinity;
        const ty = dy ? ((dy>0?100:0)-origin.y)/dy : Infinity;
        return lerp(origin, point, Math.min(tx,ty));
    }

    function plan(name, {mobs, origin, point, areaScale}) {
        const beats = [], cues = [];
        const strike = (at, targets, scale=1, root=0) => beats.push({at, targets, scale, root});
        const cue = (kind, at, geometry) => cues.push({kind, at, ...geometry});
        const around = (center, radius) => mobs.filter(mob=>distance(mob,center)<=radius);
        const ray = Math.atan2(point.y-origin.y,point.x-origin.x);

        if (name==='Squall Blade') {
            const to=fieldEdge(origin,point), width=5*areaScale;
            cue('blade',0,{from:origin,to,width,duration:280});
            for(const hit of lane(mobs,origin,to,width)){
                strike(Math.max(20,Math.round(hit.t*280)),[hit.mob]);
            }
        } else if (name==='Flare Javelin') {
            const width=3.5*areaScale, radius=13*areaScale;
            cue('lance',0,{from:origin,to:point,width,duration:225});
            for(const hit of lane(mobs,origin,point,width)){
                strike(Math.max(16,Math.min(214,Math.round(hit.t*225))),[hit.mob],.26);
            }
            cue('splash',225,{point,radius});
            strike(225,around(point,radius));
        } else if (name==='Frost Fang') {
            const anchor=nearest(mobs,point);
            cue('fang',0,{from:origin,to:point,duration:155});
            if(anchor)strike(155,[anchor]);
            const rays=[-.45,0,.45].map(angle=>({
                x:point.x+Math.cos(ray+angle)*19*areaScale,
                y:point.y+Math.sin(ray+angle)*19*areaScale
            }));
            const shards=new Set(rays.flatMap(to=>lane(mobs,point,to,3.5*areaScale).map(hit=>hit.mob)));
            shards.delete(anchor);
            cue('shatter',155,{point,rays});
            strike(245,[...shards],.52);
        } else if (name==='Quartz Spike') {
            const struck=new Set(), radius=7.5*areaScale;
            [.48,.74,1].forEach((t,i)=>{
                const center=lerp(origin,point,t), at=95+i*78;
                const hit=around(center,radius).filter(mob=>!struck.has(mob));
                hit.forEach(mob=>struck.add(mob));
                cue('spike',at,{point:center,radius});
                strike(at,hit,[.62,.78,1][i]);
            });
        } else if (name==='Rime Nova') {
            let previous=0;
            [7,14,22].forEach((size,i)=>{
                const radius=size*areaScale, at=105+i*72;
                const targets=around(point,radius).filter(mob=>i===0||distance(mob,point)>previous);
                cue('frostwave',at-72,{point,radius,previous,duration:72});
                strike(at,targets,[.72,.9,1.24][i]);
                previous=radius;
            });
        } else if (name==='Bramble Snare') {
            const angle=ray-Math.PI/3;
            const ends=[0,1,2].map(i=>({
                x:point.x+Math.cos(angle+i*Math.PI*2/3)*20*areaScale,
                y:point.y+Math.sin(angle+i*Math.PI*2/3)*20*areaScale
            }));
            const paths=ends.map(end=>[point,{
                x:(point.x+end.x)/2+(end.y-point.y)*.12,
                y:(point.y+end.y)/2-(end.x-point.x)*.12
            },end]);
            const caught=new Set(around(point,5*areaScale));
            for(const [from,bend,to] of paths){
                for(const hit of [...lane(mobs,from,bend,4.5*areaScale),...lane(mobs,bend,to,4.5*areaScale)]){
                    caught.add(hit.mob);
                }
            }
            cue('roots',0,{paths,duration:110});
            strike(110,[...caught],0,1150);
            cue('thorns',255,{paths});
            strike(255,[...caught],1);
        } else if (name==='Thunder Gust') {
            const first=nearest(around(point,10*areaScale),point);
            let from={x:point.x+4,y:point.y-25}, target=first;
            const visited=new Set();
            for(let i=0;i<5;i++){
                if(i>0&&!target)break;
                const to=target?{x:target.x,y:target.y}:point, at=65+i*49;
                cue('lightning',at,{from,to,hop:i});
                if(!target)break;
                strike(at,[target],1-i*.11);
                visited.add(target);
                from=to;
                target=nearest(mobs.filter(mob=>!visited.has(mob)&&distance(from,mob)<=17*areaScale),from);
            }
        }
        return {beats:beats.sort((a,b)=>a.at-b.at), cues};
    }

    return {supports:name=>names.has(name),hint:name=>hints[name],plan};
})();
globalThis.ClearingSignatures = ClearingSignatures;
