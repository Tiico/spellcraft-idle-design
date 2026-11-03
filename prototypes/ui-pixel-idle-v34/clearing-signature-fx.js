/* Active effects draw the geometry of the cast plan, never a collection icon. */
const ClearingSignatureFx = (() => {
    const mix = (a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    const clamp = t=>Math.max(0,Math.min(1,t));
    const shades = {
        'Squall Blade':['#e6fff3','#3cdcb6','#173861'],
        'Flare Javelin':['#fff4a2','#ff672d','#6b2340'],
        'Frost Fang':['#f1ffff','#51bbff','#243d86'],
        'Quartz Spike':['#fff0cd','#dd93d0','#623e71'],
        'Rime Nova':['#eeffff','#63d6ff','#214b82'],
        'Bramble Snare':['#f1e589','#94c452','#503443'],
        'Thunder Gust':['#fff9b3','#b5a0ff','#443274']
    };

    function play(layer, outcome) {
        const canvas=document.createElement('canvas');
        canvas.className='clearing-signature-fx';
        canvas.dataset.signature=outcome.name;
        canvas.setAttribute('aria-hidden','true');
        canvas.width=Math.max(1,layer.clientWidth);
        canvas.height=Math.max(1,layer.clientHeight);
        layer.append(canvas);
        const ctx=canvas.getContext('2d'), sx=canvas.width/100, sy=canvas.height/100;
        const [light,tone,dark]=shades[outcome.name];
        const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        const px=p=>({x:p.x*sx,y:p.y*sy});
        const angle=(a,b)=>Math.atan2((b.y-a.y)*sy,(b.x-a.x)*sx);
        function line(points,color,width,alpha=1) {
            ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;
            ctx.lineCap='square';ctx.lineJoin='miter';ctx.beginPath();
            points.forEach((p,i)=>{const q=px(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});
            ctx.stroke();ctx.restore();
        }
        function ring(point,radius,color,width,alpha=1) {
            ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;
            const p=px(point);ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(.1,radius*sx),
                Math.max(.1,radius*sy),0,0,Math.PI*2);ctx.stroke();ctx.restore();
        }
        function polygon(point, rotation, points, fill, outline, alpha=1) {
            const p=px(point);
            ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.rotate(rotation);
            ctx.globalAlpha=alpha;ctx.fillStyle=fill;ctx.strokeStyle=outline;ctx.lineWidth=2;
            ctx.beginPath();
            points.forEach(([x,y],i)=>{if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
            ctx.closePath();ctx.stroke();ctx.fill();ctx.restore();
        }
        function sparks(point,count,radius,t) {
            const p=px(point);
            ctx.save();ctx.globalAlpha=(1-t)*.95;
            for(let i=0;i<count;i++){
                const theta=i*2.39996, speed=.28+(i%5)*.16, travel=radius*speed*(.18+t*.82);
                const x=Math.round(p.x+Math.cos(theta)*travel);
                const y=Math.round(p.y+Math.sin(theta)*travel-9*t);
                ctx.fillStyle=dark;ctx.fillRect(x-1,y-1,5,5);
                ctx.fillStyle=i%3?light:tone;ctx.fillRect(x,y,i%3?3:4,2);
            }
            ctx.restore();
        }
        function travel(cue, age) {
            const t=reduced?1:clamp(age/cue.duration);
            const head=mix(cue.from,cue.to,t), back=mix(cue.from,cue.to,Math.max(0,t-.30));
            const dir=angle(cue.from,cue.to);
            if(reduced){
                line([cue.from,cue.to],tone,2,.50);
                return;
            }
            if(cue.kind==='blade'){
                const normalized=Math.atan2(cue.to.y-cue.from.y,cue.to.x-cue.from.x);
                const half=cue.width*Math.hypot(Math.sin(normalized)*sx,Math.cos(normalized)*sy);
                line([back,head],dark,half*1.5,.70);line([back,head],tone,half*.85,.58);
                polygon(head,dir,[[-12,-22],[1,-16],[9,-7],[13,0],[9,9],[1,17],[-12,22],
                    [-4,10],[1,0],[-4,-9]].map(([x,y])=>[x,y*half/22]),light,dark);
                line([mix(back,head,.52),head],light,2,.76);
            }else if(cue.kind==='lance'){
                line([back,head],dark,7,.75);line([back,head],tone,4,.93);
                polygon(head,dir,[[-16,-2],[0,-2],[6,-5],[15,0],[6,5],[0,2],[-16,2]],light,dark);
                sparks(back,5,16,.45);
            }else{
                const p=px(head);
                const gap=10*(1-t);
                for(const side of [-1,1]){
                    const split={x:(p.x-Math.sin(dir)*gap*side)/sx,y:(p.y+Math.cos(dir)*gap*side)/sy};
                    polygon(split,dir+side*.27,[[-9,-5],[0,-7],[10,-2],[6,6],[2,8],[3,2],[-7,2]],
                        side===1?light:tone,dark);
                }
                line([back,head],tone,3,.56);
            }
        }
        function drawCue(cue,age) {
            if(['blade','lance','fang'].includes(cue.kind)){
                if(age<=cue.duration)travel(cue,age);
                return;
            }
            if(cue.kind==='splash'&&age<335){
                const t=clamp(age/335), r=cue.radius*(reduced?1:.32+.68*clamp(age/130));
                ring(cue.point,r,dark,6,(1-t)*.78);ring(cue.point,r,tone,3,1-t);
                ring(cue.point,r*.77,light,2,(1-t)*.7);
                if(!reduced){
                    for(let i=0;i<9;i++){
                        const rad=i*Math.PI*2/9;
                        const end={x:cue.point.x+Math.cos(rad)*r,y:cue.point.y+Math.sin(rad)*r};
                        line([mix(cue.point,end,.22),end],i%3?tone:light,i%3?3:5,(1-t)*.8);
                    }
                    sparks(cue.point,19,Math.max(sx,sy)*cue.radius*1.32,t);
                }
            }else if(cue.kind==='shatter'&&age<255){
                const t=clamp(age/255);
                for(const ray of cue.rays){
                    const tip=mix(cue.point,ray,reduced?1:clamp(age/90));
                    line([cue.point,tip],dark,5,1-t);line([cue.point,tip],tone,3,1-t);
                    if(!reduced)polygon(tip,angle(cue.point,ray),[[-6,1],[0,-3],[7,0],[0,3]],light,dark,1-t);
                }
                if(!reduced)sparks(cue.point,11,25,t);
            }else if(cue.kind==='spike'&&age<310){
                const t=clamp(age/310), rise=reduced?1:Math.max(.12,clamp(age/75));
                const height=(cue.radius*sy+25)*rise, width=cue.radius*sx;
                ring(cue.point,cue.radius,tone,2,1-t);
                polygon(cue.point,0,[[-width,3],[-width*.60,-height*.28],[-4,-height*.24],
                    [1,-height],[width*.55,-height*.57],[width,2],[4,7]],tone,dark,1-t);
                polygon(cue.point,0,[[-2,1],[1,-height+3],[width*.42,-height*.51],[5,1]],light,dark,(1-t)*.8);
                if(!reduced)sparks(cue.point,10,24,t);
            }else if(cue.kind==='frostwave'&&age<250){
                const phase=reduced?1:clamp(age/cue.duration);
                const radius=cue.previous+(cue.radius-cue.previous)*phase;
                const fade=1-clamp((age-cue.duration)/178);
                ring(cue.point,radius,dark,6,fade*.82);ring(cue.point,radius,tone,3,fade*.96);
                ring(cue.point,radius*.87,light,1.5,fade*.7);
                if(!reduced){
                    for(let i=0;i<12;i++){
                        const a=i*Math.PI/6, edge={x:cue.point.x+Math.cos(a)*radius,y:cue.point.y+Math.sin(a)*radius};
                        polygon(edge,angle(cue.point,edge),[[-5,-2],[4,0],[-4,2]],light,dark,fade);
                    }
                }
            }else if((cue.kind==='roots'||cue.kind==='thorns')&&age<(cue.kind==='roots'?280:265)){
                const t=clamp(age/265), root=cue.kind==='roots';
                const grow=root?(reduced?1:clamp(age/cue.duration)):1;
                for(const [from,bend,to] of cue.paths){
                    const end=grow<.5?mix(from,bend,grow*2):mix(bend,to,grow*2-1);
                    const trace=grow<.5?[from,end]:[from,bend,end];
                    line(trace,dark,root?8:9,root?.92:1-t);
                    line(trace,tone,root?4:5,root?.92:1-t);
                    if(!reduced){
                        for(const [start,tip] of trace.slice(1).map((p,i)=>[trace[i],p])){
                            const direction=angle(start,tip);
                            for(const amount of [.37,.82]){
                                polygon(mix(start,tip,amount),direction,
                                    [[-4,3],[-1,-8],[5,-1],[8,4]],light,dark,root?.8:1-t);
                            }
                        }
                        if(!root)sparks(end,7,20,t);
                    }
                }
            }else if(cue.kind==='lightning'&&age<190){
                const t=clamp(age/190), dx=cue.to.x-cue.from.x, dy=cue.to.y-cue.from.y;
                const length=Math.hypot(dx,dy)||1;
                const arc=[cue.from,...[.27,.52,.76].map((p,i)=>{
                    const m=mix(cue.from,cue.to,p), offset=i%2?-2.2:2.2;
                    return {x:m.x-dy/length*offset,y:m.y+dx/length*offset};
                }),cue.to];
                line(arc,dark,cue.hop?6:9,1-t);line(arc,tone,cue.hop?4:6,1-t);
                line(arc,light,2,1-t);
                ring(cue.to,3+4*t,tone,2,1-t);
                if(!reduced)sparks(cue.to,11,24,t);
            }
        }
        const duration=Math.max(...outcome.cues.map(c=>c.at+(c.duration||0)),0)+345;
        const start=performance.now();
        function frame(now) {
            if(!canvas.isConnected)return;
            const time=now-start;
            if(time>duration){canvas.remove();return;}
            ctx.clearRect(0,0,canvas.width,canvas.height);
            for(const cue of outcome.cues)if(time>=cue.at)drawCue(cue,time-cue.at);
            for(const beat of outcome.beats){
                const age=time-beat.at;
                if(age<0||age>155)continue;
                for(const hit of beat.hits){
                    if(reduced)ring(hit,3,tone,2,1-age/155);
                    else sparks(hit,5,hit.killed?17:11,age/155);
                }
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }
    return {play};
})();
