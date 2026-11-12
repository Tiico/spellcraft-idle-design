/* Research lab review UI (#678), drawn after the H3 carousel boards (start, mid and late game) in the lab design canvas.
   The rules live in lab-model.js; this file draws the workbench and the menu and runs a demo clock (real time times the
   review's demo speed) so that the wheel's clicks can be seen. Several projects at once get one research tank each, and
   every running project adds the base burn once more. Every scene is deterministic at load. */
(function(){
    const L=globalThis.SpellcraftResearchLab;
    const scenes=['start','running','parallel','empty','mid','late'];
    const sceneLabels={start:'Start · Labbet öppnar',running:'Två projekt samtidigt',parallel:'Tre projekt · bränsle × 3',empty:'Tom tank · paus',mid:'Mid game · 5 × tanken',late:'Late game · 100 × tanken'};
    const phone=document.querySelector('#phone');
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const FISH='M3 12c4-6 11-6 15 0-4 6-11 6-15 0zM18 12l4-4v8z';
    const CX=112,CY=132,VIEW_H=256;
    // The three H3 boards, moved into the machine panel's own coordinates (the panel starts at 12, 138 on the 390 × 844 board).
    const GEOMETRY={
        start:{sockR:60,sr:17,hub:26,hubFont:24,ring:{r:79,w:2,color:'#2c4146'},dashed:59.5,spokes:0,funnel:[194,114,24,36,'#8a6a2c'],glow:[192,124,6,16,'#f0a64a'],
            pipe:{x0:216,xv:240,top:20,w:5,inner:false},ticks:[[232,62],[232,84],[232,106]],turbines:[],tank:{cx:300,w:56,top:36,bottom:212},caption:228,dots:5,dotR:4,glowPeriod:.6},
        mid:{sockR:64,sr:22,hub:28,hubFont:24,ring:{r:89,w:2,color:'#4d6a70'},dashed:83.5,spokes:2,funnel:[204,112,24,40,'#8a6a2c'],glow:[202,123,6,18,'#f0a64a'],
            pipe:{x0:228,xv:250,top:20,w:6,inner:false},ticks:[[242,102]],turbines:[[250,70,1]],tank:{cx:304,w:52,top:34,bottom:212},caption:236,dots:8,dotR:4,glowPeriod:.25},
        late:{sockR:64,sr:23,hub:30,hubFont:20,ring:{r:90.5,w:3,color:'#d2a24c',fill:'#0f1a1d'},dashed:0,spokes:4,gear:98.5,hubRing:35.5,funnel:[210,108,28,48,'#d2a24c'],glow:[207,118,8,28,'#ffd27a'],
            pipe:{x0:236,xv:256,top:18,w:9,inner:true},ticks:[],turbines:[[256,61,1],[256,97,-1]],tank:{cx:309,w:54,top:32,bottom:214},caption:248,dots:14,dotR:4.5,glowPeriod:.1,stream:true,bubbles:true}
    };
    let state,ui,serial=0;
    const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const fmtTime=sec=>{if(!Number.isFinite(sec))return '—';const s=Math.max(0,Math.ceil(sec-1e-6)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
        if(d)return `${d} d ${h} h`;if(h)return `${h} h ${m} min`;if(m)return `${m} min`;return `${s} s`;};
    const fmtFuel=x=>{const v=Math.max(0,Math.ceil(x-1e-6));if(v<1000)return String(v);if(v<1e6)return (v/1000).toFixed(v<10000?1:0).replace(/\.0$/,'')+'k';return (v/1e6).toFixed(v<1e7?1:0).replace(/\.0$/,'')+'M';};
    const fmtX=x=>x>=10?Math.round(x).toString():(Math.round(x*10)/10).toString();
    const command=(action,target)=>L.commit(state,{id:'ui-'+(++serial),action,target});
    const nonEmpty=()=>L.sockets(state).filter(x=>x.state!=='empty').length;
    const fishIcon=(size,fill,opacity=1)=>`<svg x="${-size/2}" y="${-size/2}" width="${size}" height="${size}" viewBox="0 0 24 24" opacity="${(+opacity).toFixed(3)}" overflow="visible"><path d="${FISH}" fill="${fill}" stroke="#0c1416" stroke-width="1" stroke-linejoin="round"/></svg>`;
    function toast(text){const old=phone.querySelector('.toast');if(old)old.remove();phone.insertAdjacentHTML('beforeend',`<div class="toast" role="status">${esc(text)}</div>`);}
    function selectedSlot(){if(state.slots[ui.selected])return ui.selected;const r=L.running(state)[0];return r?r.index:ui.selected;}
    // One research tank per running project, side by side under one pipe; with nothing running the single tank waits empty.
    function tanks(g){
        const runs=L.running(state),n=Math.max(1,runs.length),gap=6,w=n===1?g.tank.w:(90-(n-1)*gap)/n,total=n*w+(n-1)*gap,x0=(n===1?g.tank.cx:306)-total/2;
        return Array.from({length:n},(_,i)=>({slot:runs[i]?.index??null,x:x0+i*(w+gap),w,cx:x0+i*(w+gap)+w/2,top:g.tank.top,bottom:g.tank.bottom}));
    }
    const tankPath=t=>{const r=Math.min(t.w/2,(t.bottom-t.top)/2);return `M${t.x.toFixed(1)} ${t.top} V${(t.bottom-r).toFixed(1)} A${(t.w/2).toFixed(1)} ${r.toFixed(1)} 0 0 0 ${(t.x+t.w).toFixed(1)} ${(t.bottom-r).toFixed(1)} V${t.top}`;};
    const along=(pts,u)=>{const segs=[];let total=0;for(let i=0;i<pts.length-1;i++){const l=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);segs.push(l);total+=l;}
        let d=u*total;for(let i=0;i<segs.length;i++){if(d<=segs[i]){const k=segs[i]?d/segs[i]:0;return [pts[i][0]+(pts[i+1][0]-pts[i][0])*k,pts[i][1]+(pts[i+1][1]-pts[i][1])*k];}d-=segs[i];}return pts[pts.length-1];};
    const route=(g,t)=>[[g.pipe.x0,CY],[g.pipe.xv,CY],[g.pipe.xv,g.pipe.top],[t.cx,g.pipe.top],[t.cx,t.top]];

    // ---- Machine -----------------------------------------------------------------------------------------------------------
    function machineSvg(){
        const stage=L.machineStage(state),g=GEOMETRY[stage],ts=tanks(g),multi=ts.length>1;
        const pipeD=`M${g.pipe.x0} ${CY}H${g.pipe.xv}V${g.pipe.top}H${ts[ts.length-1].cx.toFixed(1)}`+ts.map(t=>`M${t.cx.toFixed(1)} ${g.pipe.top}V${t.top}`).join('');
        const spokes=Array.from({length:g.spokes},(_,i)=>{const a=i*180/g.spokes;return `<line x1="${CX}" y1="${CY-(g.ring.r-1)}" x2="${CX}" y2="${CY+(g.ring.r-1)}" stroke="${stage==='late'?'#2c4146':'#1d2f33'}" stroke-width="2" transform="rotate(${a} ${CX} ${CY})"/>`;}).join('');
        const sockets=Array.from({length:8},(_,k)=>`<g data-socket="${k}"></g>`).join('');
        const dots=Array.from({length:g.dots},(_,i)=>`<circle data-dot="${i}" r="${g.dotR}" cx="-20" cy="-20" filter="url(#lab-glow)"/>`).join('');
        const turbines=g.turbines.map(([x,y,dir],i)=>`<g transform="translate(${x} ${y})"><circle r="${stage==='late'?13:12}" fill="#132024"/><circle data-turbine="${dir}" r="${stage==='late'?10:9.5}" fill="none" stroke="#d2a24c" stroke-width="${stage==='late'?6:5}" stroke-dasharray="4 3"/></g>`).join('');
        const tankShapes=ts.map((t,i)=>`<clipPath id="tank-clip-${i}"><path d="${tankPath(t)}Z"/></clipPath>`).join('');
        const tankSvg=ts.map((t,i)=>`<g data-tank="${i}"${t.slot!==null&&multi?` data-select-tank="${t.slot}" style="cursor:pointer"`:''}>
            <path d="${tankPath(t)}Z" fill="#0c1416"/>
            <g clip-path="url(#tank-clip-${i})"><rect data-liquid x="${t.x}" width="${t.w}" y="${t.bottom}" height="0" fill="#7fe3ee" filter="url(#lab-soft)"/>${g.bubbles?[0,1,2].map(b=>`<circle data-bubble="${b}" r="${b===1?2.5:3}" cx="${t.x+t.w*(.2+.3*b)}" cy="${t.bottom}" fill="#e6fbfd" opacity="0"/>`).join(''):''}</g>
            <path data-tank-edge d="${tankPath(t)}" fill="none" stroke="#4d8f97" stroke-width="3" stroke-linejoin="round"/>
            <path data-drip d="M0 -5.5 C3 -2 4 1 4 2.5 A4 4 0 0 1 -4 2.5 C-4 1 -3 -2 0 -5.5Z" fill="#7fe3ee" opacity="0"/>
            ${multi?`<text x="${t.cx.toFixed(1)}" y="${t.bottom+15}" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-size="11" font-weight="700" fill="#9db0ad">${t.slot+1}</text>`:''}
        </g>`).join('');
        const [fx,fy,fw,fh,fc]=g.funnel,[gx,gy,gw,gh,gc]=g.glow;
        return `<svg class="machine" viewBox="0 0 366 ${VIEW_H}" role="img" aria-label="Research machine">
            <defs>
                <filter id="lab-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <filter id="lab-soft" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <filter id="lab-nozzle" x="-400%" y="-150%" width="900%" height="400%"><feGaussianBlur stdDeviation="${stage==='late'?6:4}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                ${tankShapes}
                ${stage==='late'?Array.from({length:8},(_,k)=>`<clipPath id="sock-clip-${k}"><circle r="${g.sr-1}"/></clipPath>`).join(''):''}
            </defs>
            <path d="${pipeD}" fill="none" stroke="#d2a24c" stroke-width="${g.pipe.w}" stroke-linecap="round" stroke-linejoin="round"/>
            ${g.pipe.inner?`<path d="${pipeD}" fill="none" stroke="#132024" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`:''}
            ${g.ticks.map(([x,y])=>`<path d="M${x} ${y}h16" stroke="#8a6a2c" stroke-width="3" stroke-linecap="round"/>`).join('')}
            ${turbines}
            ${tankSvg}
            ${g.gear?`<circle data-gear cx="${CX}" cy="${CY}" r="${g.gear}" fill="none" stroke="#8a6a2c" stroke-width="7" stroke-dasharray="6 5"/>`:''}
            <g data-wheel>
                <circle cx="${CX}" cy="${CY}" r="${g.ring.r}" fill="${g.ring.fill||'none'}" stroke="${g.ring.color}" stroke-width="${g.ring.w}"/>
                ${g.dashed?`<circle cx="${CX}" cy="${CY}" r="${g.dashed}" fill="none" stroke="#2c4146" stroke-width="1" stroke-dasharray="3 3"/>`:''}
                ${spokes}
            </g>
            ${sockets}
            ${g.hubRing?`<circle data-hub-ring cx="${CX}" cy="${CY}" r="${g.hubRing}" fill="none" stroke="#8a6a2c" stroke-width="5" stroke-dasharray="5 4"/>`:''}
            <circle cx="${CX}" cy="${CY}" r="${g.hub}" fill="#d2a24c"/>
            <text data-hub x="${CX}" y="${CY+g.hubFont*.36}" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-size="${g.hubFont}" font-weight="700" fill="#0c1416"></text>
            ${g.stream?[0,1,2].map(i=>`<g data-stream="${i}" opacity="0">${fishIcon(14,'#ffd27a')}</g>`).join(''):''}
            <polygon points="${fx},${fy} ${fx+fw},${fy+fh*.32} ${fx+fw},${fy+fh*.68} ${fx},${fy+fh}" fill="${fc}"/>
            <rect data-glow x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="${gw/2}" fill="${gc}" filter="url(#lab-nozzle)" opacity="0"/>
            <g data-dots>${dots}</g>
            <text data-caption x="${CX}" y="${g.caption}" text-anchor="middle" font-family="Spectral,Georgia,serif" font-size="13" fill="#9db0ad"></text>
        </svg>`;
    }
    function socketContent(sk,stage,g,k){
        const ring=sk.state==='active'?'#ffd27a':sk.state==='full'?(stage==='late'?'#d2a24c':'#4d8f97'):'#2c4146';
        let inner='';
        if(stage==='start')inner=fishIcon(24,'#f0a64a',sk.state==='empty'?0:sk.state==='active'?sk.fill:1);
        else if(stage==='mid'){
            const lit=sk.state==='empty'?0:sk.state==='full'?5:Math.ceil(sk.fill*5-1e-9);
            inner=`<g transform="translate(0 -4)">${fishIcon(20,'#f0a64a',sk.state==='empty'?.12:sk.state==='active'?.3+.7*sk.fill:1)}</g>`+Array.from({length:5},(_,i)=>`<circle cx="${-12+i*6}" cy="10" r="2" fill="${i<lit?'#f0a64a':'#2c4146'}"/>`).join('');
        }else{
            const h=(g.sr-1)*2,level=sk.state==='empty'?0:sk.fill;
            inner=`<g clip-path="url(#sock-clip-${k})"><rect x="${-g.sr}" y="${(g.sr-1-h*level).toFixed(2)}" width="${g.sr*2}" height="${(h*level).toFixed(2)}" fill="#9a6418"/></g>${sk.state==='empty'?'':`<text y="4.5" text-anchor="middle" font-family="Cinzel,Georgia,serif" font-size="13" font-weight="700" fill="#fff3d6">${fmtFuel(sk.fuel)}</text>`}`;
        }
        return `<circle r="${g.sr}" fill="#0c1416" stroke="${ring}" stroke-width="2"/>${inner}`;
    }
    // Follows the fuel: a socket that empties turns the wheel one 45° click, counterclockwise as on H3.
    function syncWheel(){
        const per=L.socketFuel(state),n=nonEmpty();
        if(per!==ui.per){ui.per=per;ui.n=n;return;}
        if(n<ui.n){ui.rot+=ui.n-n;ui.tween={from:ui.shown,to:ui.rot*45,start:performance.now()};}
        ui.n=n;
    }
    function drawMachine(now,dt){
        const svg=phone.querySelector('svg.machine');if(!svg)return;
        const stage=L.machineStage(state),g=GEOMETRY[stage],runs=L.running(state),paused=!runs.length||state.fuel<=1e-9,multiple=paused?0:L.burnMultiple(state),motion=L.motion(multiple);
        ui.phase+=dt*(reduced?0:motion);
        if(ui.tween){const d=reduced?1:Math.min(1,(now-ui.tween.start)/300),e=1-(1-d)**3;ui.shown=ui.tween.from+(ui.tween.to-ui.tween.from)*e;if(d>=1){ui.shown=ui.tween.to;ui.tween=null;}}
        svg.querySelector('[data-wheel]').setAttribute('transform',`rotate(${(-ui.shown).toFixed(2)} ${CX} ${CY})`);
        const list=L.sockets(state);
        for(let k=0;k<8;k++){
            const a=(k*45-ui.shown)*Math.PI/180,x=CX+g.sockR*Math.cos(a),y=CY+g.sockR*Math.sin(a),p=((k-ui.rot)%8+8)%8,sk=list[p];
            const el=svg.querySelector(`[data-socket="${k}"]`);el.setAttribute('transform',`translate(${x.toFixed(2)} ${y.toFixed(2)})`);
            const key=`${stage}|${sk.state}|${sk.fill.toFixed(3)}|${stage==='late'?fmtFuel(sk.fuel):''}`;
            if(el.dataset.key!==key){el.dataset.key=key;el.innerHTML=socketContent(sk,stage,g,k);el.dataset.state=sk.state;}
        }
        svg.querySelector('[data-hub]').textContent=fmtFuel(state.fuel);
        const n=runs.length;
        svg.querySelector('[data-caption]').textContent=paused?'fuel left on the wheel':n>1?`fuel left · ${n} at once · speed ×${fmtX(multiple)}`:multiple!==1?`fuel left · speed ×${fmtX(multiple)}`:'fuel left on the wheel';
        const period=g.glowPeriod*Math.max(.25,1/Math.max(1,motion/ (stage==='late'?8:stage==='mid'?3:1)));
        svg.querySelector('[data-glow]').setAttribute('opacity',paused?'0':(.75+.25*Math.sin(now/1000/period*Math.PI*2)).toFixed(3));
        svg.setAttribute('aria-label',`Research machine: ${fmtFuel(state.fuel)} of ${fmtFuel(L.capacity(state))} fuel, ${nonEmpty()} of 8 sockets hold fuel${paused?', stopped':`, ${n} project${n>1?'s':''} at once, speed ×${fmtX(multiple)}`}`);
        const ts=tanks(g);
        svg.querySelectorAll('[data-dot]').forEach((dot,i)=>{const t=ts[i%ts.length],u=((i/g.dots)+ui.phase*.22)%1,[x,y]=along(route(g,t),u);dot.setAttribute('cx',x.toFixed(1));dot.setAttribute('cy',y.toFixed(1));dot.setAttribute('fill',u<.45?'#ffd27a':'#7fe3ee');dot.setAttribute('opacity',paused?'0':'1');});
        svg.querySelectorAll('[data-turbine]').forEach(t=>{const p=t.parentNode.getAttribute('transform');t.setAttribute('transform',`rotate(${(ui.phase*300*Number(t.dataset.turbine)%360).toFixed(1)})`);});
        const gear=svg.querySelector('[data-gear]');if(gear)gear.setAttribute('transform',`rotate(${(ui.phase*15%360).toFixed(1)} ${CX} ${CY})`);
        const hubRing=svg.querySelector('[data-hub-ring]');if(hubRing)hubRing.setAttribute('transform',`rotate(${(-ui.phase*40%360).toFixed(1)} ${CX} ${CY})`);
        svg.querySelectorAll('[data-stream]').forEach((f,i)=>{const t=(ui.phase*.6+i/3)%1;f.setAttribute('transform',`translate(${(186+t*30).toFixed(1)} ${CY-10+i*9})`);f.setAttribute('opacity',paused?'0':(t<.2?t/.2:1-(t-.2)/.8).toFixed(2));});
        const selected=selectedSlot();
        svg.querySelectorAll('[data-tank]').forEach((el,i)=>{
            const t=ts[i];if(!t)return;
            const f=t.slot===null?0:L.progressFraction(state,t.slot),surface=t.bottom-(t.bottom-t.top)*f;
            const liquid=el.querySelector('[data-liquid]');liquid.setAttribute('y',surface.toFixed(1));liquid.setAttribute('height',(t.bottom-surface+2).toFixed(1));
            el.querySelector('[data-tank-edge]').setAttribute('stroke',ts.length>1&&t.slot===selected?'#7fe3ee':'#4d8f97');
            // A drop falls from each branch of the pipe into its tank, faster as more fuel burns (H3's drip, 34 px).
            const drip=el.querySelector('[data-drip]'),dp=(ui.phase*.9+i*.37)%1;
            drip.setAttribute('transform',`translate(${t.cx.toFixed(1)} ${(t.top+6+dp*34).toFixed(1)})`);drip.setAttribute('opacity',paused||t.slot===null?'0':(dp<.15?dp/.15:1-(dp-.15)/.85).toFixed(2));
            el.querySelectorAll('[data-bubble]').forEach((b,j)=>{const bp=(ui.phase*1.4+j*.33+i*.21)%1;b.setAttribute('cy',(t.bottom-6-bp*70).toFixed(1));b.setAttribute('opacity',paused||t.slot===null||t.bottom-6-bp*70<surface?'0':(bp<.2?bp/.2*.9:.9*(1-(bp-.2)/.8)).toFixed(2));});
        });
    }

    // ---- Menu --------------------------------------------------------------------------------------------------------------
    function slotRows(){
        const total=Math.max(L.slotCount(state),1+L.slotSources.length)+state.grimoire.slots,rows=[],selected=selectedSlot();
        for(let i=0;i<total;i++){
            const p=state.slots[i];
            if(i>=L.slotCount(state)){const source=L.slotSources[i-1];rows.push(`<div class="slot dashed"><span>Slot ${i+1} · locked</span><span>${source?`Research ${esc(L.project(source).name)}`:'Unlock in the grimoire'}</span></div>`);}
            else if(p&&i===selected)rows.push(`<button class="slot selected" data-select="${i}"><span style="min-width:0"><span class="label" style="display:block">Slot ${i+1} · researching</span><span class="what" style="display:block">${esc(L.project(p.project).name)}</span></span><span class="time" data-live-slot="${i}"></span></button>`);
            else if(p)rows.push(`<button class="slot" data-select="${i}"><span class="what" style="font-size:14px;font-weight:400">Slot ${i+1} · ${esc(L.project(p.project).name)}</span><span class="time" data-live-slot="${i}"></span></button>`);
            else rows.push(`<div class="slot dashed"><span>Slot ${i+1} · free</span><span>Queue a project below</span></div>`);
        }
        for(const id of state.queue)rows.push(`<div class="slot"><span class="what" style="font-size:14px;font-weight:400">Up next · ${esc(L.project(id).name)}</span><button class="remove" data-unqueue="${id}">Remove</button></div>`);
        return rows.join('');
    }
    function readyCards(){
        const list=L.ready(state);
        if(!list.length)return '<p class="empty-note">Everything open is researched or running.</p>';
        return list.map(r=>{
            const p=r.project,q=L.quote(state,'queue',p.id),time=fmtTime(p.work*(1-r.progress)/L.speed(state));
            const needs=r.paused?`Paused at ${Math.floor(r.progress*100)}% · ${time} left`:'Needs '+Object.entries(p.cost).map(([id,n])=>{const have=state.fish[id]||0;return have<n?`<span class="short">${have}/${n} ${esc(L.fish(id).name)}</span>`:`${n} ${esc(L.fish(id).name)}`;}).join(', ')+` · ${time}`;
            const button=r.paused?`<button class="queue resume" data-queue="${p.id}">Resume</button>`:`<button class="queue" data-queue="${p.id}" ${q.ok?'':'disabled'} ${q.ok?'':`title="${esc(q.reason)}"`}>Queue</button>`;
            return `<div class="card"><div class="what"><div class="title">${esc(p.name)}</div><div class="sub">${needs}</div><div class="effect">${esc(p.effectText)}${q.ok||r.paused?'':` · ${esc(q.reason)}`}</div></div>${button}</div>`;
        }).join('');
    }
    function fillSheet(){
        const room=L.capacity(state)-state.fuel,picked=ui.sheet.counts;
        const used=Object.entries(picked).reduce((n,[id,c])=>n+c*L.fuelPerFish(state,id),0);
        const owned=L.species.filter(f=>L.zoneOpen(state,f.zone)&&(state.fish[f.id]||0)>0);
        const groups=L.zones.filter(z=>owned.some(f=>f.zone===z.id)).map(z=>`<p class="zone">${esc(z.name)}</p>`+owned.filter(f=>f.zone===z.id).map(f=>{
            const c=picked[f.id]||0,per=L.fuelPerFish(state,f.id),more=c<(state.fish[f.id]||0)&&used+per<=room+1e-9;
            return `<div class="pick"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="${FISH}" fill="${f.color}" stroke="#0c1416" stroke-width="1"/></svg><div class="what"><div class="title">${esc(f.name)}</div><div class="sub">${fmtX(per)} fuel each · ${state.fish[f.id]} in stock</div></div><div class="stepper"><button data-less="${f.id}" aria-label="One fewer ${esc(f.name)}" ${c?'':'disabled'}>−</button><output aria-label="${esc(f.name)} to add">${c}</output><button data-more="${f.id}" aria-label="One more ${esc(f.name)}" ${more?'':'disabled'}>+</button><button class="max" data-max="${f.id}" ${more?'':'disabled'}>Max</button></div></div>`;
        }).join('')).join('');
        const count=Object.values(picked).reduce((a,b)=>a+b,0);
        return `<div class="scrim" data-action="close"><section class="sheet" role="dialog" aria-label="Add fish to the tank"><h3>Add fish to the tank</h3><p class="room">${fmtFuel(room-used)} of ${fmtFuel(L.capacity(state))} fuel free after this</p>${groups||'<p class="empty-note">No fish in stock. Catch fish at the pond first.</p>'}<button class="confirm" data-action="confirm-fill" ${count?'':'disabled'}>${count?`ADD ${count} FISH · +${fmtFuel(used)} FUEL`:'CHOOSE FISH TO ADD'}</button><button class="ghost" data-action="close">Close</button></section></div>`;
    }
    function returnSheet(){
        const r=ui.sheet.result;
        return `<div class="scrim" data-action="close"><section class="sheet" role="dialog" aria-label="Welcome back"><h3>Welcome back</h3><p class="room">${r.capped?`You were away ${ui.sheet.hours} h; the lab counts the first 12 h.`:`You were away ${ui.sheet.hours} h.`}</p><div class="card"><div class="title">${fmtFuel(r.burned)} fuel burned</div><div class="sub">${state.fuel<=1e-9?'The tank ran empty, so research paused.':`${fmtFuel(state.fuel)} fuel left.`}</div></div>${r.completed.length?`<div class="card"><div class="title">Research complete</div><div class="sub">${r.completed.map(id=>esc(L.project(id).name)).join(' · ')}</div></div>`:''}<button class="confirm" data-action="close">BACK TO THE LAB</button></section></div>`;
    }
    function render(){
        const scroll=phone.querySelector('.scroll'),top=scroll?scroll.scrollTop:0,done=Object.keys(state.done);
        phone.innerHTML=`<header class="top"><h1>Research Lab</h1><span data-live="slots"></span></header>
            <div class="fuel"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f0a64a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${FISH}"/></svg><b>Fuel</b><div class="bar"><i data-live="fuelbar"></i></div><b data-live="fueltime"></b></div>
            <div class="scroll"><section class="panel" aria-label="Workbench">${machineSvg()}<div class="project" data-live="project"></div></section>
            <div class="slots">${slotRows()}</div>
            <h2>READY TO START</h2>${readyCards()}
            ${done.length?`<details class="done"><summary>Completed research (${done.length})</summary><ul>${done.map(id=>`<li>${esc(L.project(id).name)} · ${esc(L.project(id).effectText)}</li>`).join('')}</ul></details>`:''}
            </div>
            <button class="add" data-action="fill">ADD FISH TO THE TANK</button>
            ${ui.sheet?.type==='fill'?fillSheet():ui.sheet?.type==='return'?returnSheet():''}`;
        const s=phone.querySelector('.scroll');if(s)s.scrollTop=top;
        live();drawMachine(performance.now(),0);
    }
    // Text that changes with time is updated in place, so buttons and scrolling are never rebuilt by the clock.
    function live(){
        const runs=L.running(state),slot=selectedSlot(),p=state.slots[slot],empty=state.fuel<=1e-9;
        const set=(sel,html)=>{const el=phone.querySelector(sel);if(el&&el.innerHTML!==html)el.innerHTML=html;};
        set('[data-live="slots"]',`${runs.length} of ${L.slotCount(state)} slots in use`);
        const bar=phone.querySelector('[data-live="fuelbar"]');if(bar)bar.style.width=(state.fuel/L.capacity(state)*100).toFixed(1)+'%';
        set('[data-live="fueltime"]',!runs.length?(empty?'Empty':'Idle'):empty?'Empty':fmtTime(L.fuelSecondsLeft(state)));
        if(p){const pr=L.project(p.project),f=L.progressFraction(state,slot);
            set('[data-live="project"]',`<div class="row"><div><div class="name">${esc(pr.name)}</div><div class="effect">${esc(pr.effectText)}</div></div><div class="pct">${Math.floor(f*100)}%</div></div><div class="bar"><i style="width:${(f*100).toFixed(1)}%"></i></div><div class="left"><span>${empty?'Paused · add fish to the tank':`${fmtTime(L.projectSecondsLeft(state,slot))} left`}</span><button class="pause" data-pause="${slot}">Pause</button></div>`);}
        else set('[data-live="project"]',`<div class="row"><div><div class="name">No research running</div><div class="effect">Queue a project from Ready to start.</div></div></div>`);
        for(const r of runs)set(`[data-live-slot="${r.index}"]`,empty?'paused':`${fmtTime(L.projectSecondsLeft(state,r.index))} left`);
        document.querySelector('#state').textContent=JSON.stringify({scene:ui.scene,timeScale:ui.timeScale,bossWins:state.bossWins,fuel:Math.round(state.fuel*1000)/1000,capacity:L.capacity(state),speed:L.speed(state),burnMultiple:L.burnMultiple(state),slotCount:L.slotCount(state),
            slots:state.slots.map((p,i)=>p?{slot:i,project:p.project,progress:Math.round(L.progressFraction(state,i)*1000)/1000}:{slot:i,free:true}),queue:state.queue,paused:Object.keys(state.paused),done:Object.keys(state.done),
            fish:Object.fromEntries(Object.entries(state.fish).filter(([,n])=>n>0)),wheel:{rot:ui.rot,stage:L.machineStage(state),sockets:L.sockets(state).map(x=>x.state),tanks:Math.max(1,runs.length)},sheet:ui.sheet?.type||null},null,2);
    }
    function advance(seconds){
        const before=L.running(state).length,r=L.advance(state,seconds);syncWheel();
        if(r.completed.length){toast(`Research complete: ${r.completed.map(id=>L.project(id).name).join(', ')}`);render();}
        else if(L.running(state).length!==before)render();
        return r;
    }

    // ---- Input -------------------------------------------------------------------------------------------------------------
    phone.addEventListener('click',e=>{
        const tank=e.target.closest('[data-select-tank]');if(tank){ui.selected=Number(tank.dataset.selectTank);render();return;}
        const t=e.target.closest('button,[data-action]');if(!t)return;
        if(t.dataset.action==='close'&&(e.target===t||t.tagName==='BUTTON')){ui.sheet=null;render();return;}
        if(t.dataset.action==='fill'){ui.sheet={type:'fill',counts:{}};render();return;}
        if(t.dataset.action==='confirm-fill'){
            let added=0;
            for(const [id,c]of Object.entries(ui.sheet.counts)){if(!c)continue;const r=command('fill',{species:id,count:c});if(r.ok)added+=r.result.fuel;}
            syncWheel();ui.sheet=null;render();if(added)toast(`+${fmtFuel(added)} fuel in the tank`);return;
        }
        if(t.dataset.more||t.dataset.less||t.dataset.max){
            const id=t.dataset.more||t.dataset.less||t.dataset.max,counts=ui.sheet.counts,per=L.fuelPerFish(state,id);
            const others=Object.entries(counts).filter(([k])=>k!==id).reduce((n,[k,c])=>n+c*L.fuelPerFish(state,k),0),room=L.capacity(state)-state.fuel-others;
            const max=Math.min(state.fish[id]||0,Math.floor((room+1e-9)/per));
            counts[id]=Math.max(0,Math.min(max,t.dataset.max?max:(counts[id]||0)+(t.dataset.more?1:-1)));render();return;
        }
        if(t.dataset.queue){const r=command('queue',t.dataset.queue);if(r.ok){if(r.result.slot>=0)ui.selected=r.result.slot;toast(r.result.resume?`Resumed ${L.project(t.dataset.queue).name}`:r.result.startsNow?`Started ${L.project(t.dataset.queue).name}`:`Queued ${L.project(t.dataset.queue).name}`);}else toast(r.reason);render();return;}
        if(t.dataset.pause){const i=Number(t.dataset.pause),name=L.project(state.slots[i].project).name;command('pause',i);toast(`Paused ${name}; its progress is kept`);render();return;}
        if(t.dataset.unqueue){command('unqueue',t.dataset.unqueue);render();return;}
        if(t.dataset.select){ui.selected=Number(t.dataset.select);render();}
    });
    document.addEventListener('click',e=>{
        const demo=e.target.closest('[data-demo]'),scene=e.target.closest('[data-scene]'),time=e.target.closest('[data-time]');
        if(scene){load(scene.dataset.scene);return;}
        if(time){ui.timeScale=Number(time.dataset.time);marks();live();return;}
        if(!demo)return;
        const d=demo.dataset.demo;
        if(d==='catch'){const got=[];for(const z of L.zones){if(!L.zoneOpen(state,z.id))continue;L.species.filter(f=>f.zone===z.id).forEach((f,i)=>{state.fish[f.id]+=Math.max(1,Math.round([20,8,3,1][i]/z.order));});got.push(z.name);}toast(`Caught fish in ${got.join(', ')}`);render();}
        if(d==='boss'){const next=L.zones.find(z=>!L.zoneOpen(state,z.id));if(next){state.bossWins=next.bossWins;toast(`${next.name} opens for fishing`);}else toast('Every zone in the prototype is open');render();}
        if(d==='skip10m')advance(600);
        if(d==='skip1h')advance(3600);
        if(d==='away8h'||d==='away30h'){const hours=d==='away8h'?8:30,r=L.away(state,hours*3600);syncWheel();ui.sheet={type:'return',hours,result:r};render();}
        if(d==='grimoire-tank'){state.grimoire.tank=state.grimoire.tank===20?1:20;state.fuel=Math.min(state.fuel,L.capacity(state));syncWheel();toast(state.grimoire.tank===20?'Grimoire: the tank holds 20× more':'Grimoire tank node removed');render();}
        if(d==='grimoire-speed'){state.grimoire.speed=state.grimoire.speed===10?1:10;toast(state.grimoire.speed===10?'Grimoire: research speed ×10, fuel use ×10':'Grimoire speed node removed');render();}
        if(d==='grimoire-slot'){state.grimoire.slots=state.grimoire.slots?0:2;while(state.slots.length<L.slotCount(state))state.slots.push(null);toast(state.grimoire.slots?'Grimoire: two more research slots':'Grimoire slot nodes removed');render();}
        marks();
    });
    function marks(){
        document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.scene===ui.scene)));
        document.querySelectorAll('[data-time]').forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.time)===ui.timeScale)));
        document.querySelector('#scene-label').textContent=sceneLabels[ui.scene];
    }
    document.querySelector('#previous').addEventListener('click',()=>load(scenes[(scenes.indexOf(ui.scene)+scenes.length-1)%scenes.length]));
    document.querySelector('#next').addEventListener('click',()=>load(scenes[(scenes.indexOf(ui.scene)+1)%scenes.length]));

    // ---- Scenes ------------------------------------------------------------------------------------------------------------
    function load(scene){
        state=L.fresh();
        ui={scene,timeScale:ui?.timeScale??(Number(new URLSearchParams(location.search).get('time'))||60),selected:0,sheet:null,rot:0,shown:0,tween:null,per:0,n:0,phase:0};
        const give=a=>{for(const [id,n]of Object.entries(a))state.fish[id]=(state.fish[id]||0)+n;};
        const finish=ids=>{for(const id of ids)state.done[id]=true;while(state.slots.length<L.slotCount(state))state.slots.push(null);};
        const run=(slot,id,fraction)=>{state.slots[slot]={project:id,progress:L.project(id).work*fraction};};
        if(scene==='start'){state.bossWins=12;give({reedfin:40,mooncarp:12,'glass-eel':3,'star-koi':1});}
        if(scene==='running'){state.bossWins=14;finish(['bench-2','tank-1','knot-craft','vein-mapping']);run(0,'valve-1',.35);run(1,'lure-chemistry',.6);state.queue=['soil-notes'];state.fuel=150;give({reedfin:34,mooncarp:9,'glass-eel':2,mudskipper:14,'bog-perch':5,'reed-pike':1});}
        if(scene==='parallel'){state.bossWins=14;finish(['bench-2','bench-3','tank-1','knot-craft','vein-mapping']);run(0,'ember-theory',.2);run(1,'spirit-diet',.55);run(2,'lure-chemistry',.8);state.fuel=200;give({reedfin:30,mooncarp:12,'glass-eel':3,mudskipper:20,'bog-perch':6,'reed-pike':2});}
        if(scene==='empty'){state.bossWins=12;finish(['knot-craft']);run(0,'ember-theory',.55);give({reedfin:25,mooncarp:6,'glass-eel':1});}
        if(scene==='mid'){state.bossWins=16;finish(['bench-2','bench-3','tank-1','tank-2','tank-3','valve-1','filter-1','ember-theory','vein-mapping','knot-craft','soil-notes','arc-geometry']);run(0,'valve-2',.2);run(1,'lure-chemistry',.7);run(2,'spirit-diet',.4);state.fuel=410;give({reedfin:60,mooncarp:22,mudskipper:30,'bog-perch':12,'reed-pike':4,'marsh-lantern':1,'cinder-minnow':9,'ash-carp':4,'magma-eel':1});}
        if(scene==='late'){state.bossWins=18;finish(['bench-2','bench-3','bench-4','tank-1','tank-2','tank-3','valve-1','valve-2','filter-1','ember-theory','arc-geometry','vein-mapping','spirit-diet','knot-craft','lure-chemistry','soil-notes']);state.grimoire.tank=20;state.grimoire.speed=10;
            run(0,'deep-assay',.3);run(1,'storm-charts',.5);run(2,'battle-cadence',.8);run(3,'cauldron-flues',.1);state.fuel=9000;give({'cinder-minnow':80,'ash-carp':30,'magma-eel':9,'ember-koi':3,'gale-sprat':40,'sky-trout':15,'zephyr-ray':4,'storm-marlin':2});}
        ui.per=L.socketFuel(state);ui.n=nonEmpty();
        const url=new URL(location.href);url.searchParams.set('scene',scene);history.replaceState(null,'',url);
        marks();render();
    }

    // ---- Clock -------------------------------------------------------------------------------------------------------------
    // Driven by requestAnimationFrame and a timer, because a background frame or an embedded preview may not get animation frames.
    let last=performance.now(),simAcc=0;
    function frame(now){
        const dt=Math.min(.25,(now-last)/1000);if(dt<.012)return;last=now;
        simAcc+=dt;if(simAcc>=.2){if(!ui.sheet)advance(simAcc*ui.timeScale);simAcc=0;live();}
        drawMachine(now,dt);
    }
    const loop=now=>{frame(now);requestAnimationFrame(loop);};
    requestAnimationFrame(loop);setInterval(()=>frame(performance.now()),60);
    load(scenes.includes(new URLSearchParams(location.search).get('scene'))?new URLSearchParams(location.search).get('scene'):'start');
})();
