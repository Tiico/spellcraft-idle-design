/* Review-only presentation for the fishing loop. Rules live in fishing-model.js; this file renders the pier, animates the
   rod and feeds demo input. The clock is a fixed epoch plus elapsed time plus demo skips, so every scene is deterministic. */
(()=>{
    const F=SpellcraftFishing;
    const scenes=['start','nets','tree','late','return'];
    const sceneLabels={start:'Start · Silver Lake',nets:'Tre nät · Tre zoner',tree:'Skill tree · Fyra grenar',late:'Sent spel · Åtta zoner',return:'Återkomst · 30 h borta'};
    const BASE=1800000000;
    let state,ui,serial=0,rng=seeded(11),offset=0,startedAt=performance.now();
    const now=()=>BASE+offset+(performance.now()-startedAt)/1000;
    const phone=document.querySelector('#phone');
    function seeded(seed){return()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};}
    const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const fmt=n=>Number.isInteger(n)?n.toLocaleString('en'):Number(n.toFixed(1)).toLocaleString('en');
    const fmtTime=s=>{s=Math.max(0,Math.ceil(s));if(s>=3600)return Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';if(s>=60)return Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s';return s+'s';};
    const id=()=>'cmd-'+(++serial);
    const command=(action,target,extra={})=>{const t=now();const q=F.quote(state,action,target,t);const r=F.commit(state,{id:id(),action,target,token:q.token,rng,now:t,...extra});if(!r.ok)toast(r.reason||q.reason||'Not possible');return r;};
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    const zoneOf=()=>F.zone(state.zone);
    const rarityVar=f=>`--rarity:${F.rarityColors[f.rarity]}`;

    /* Pixel art */
    const px=(x,y,fill,extra='')=>`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"${extra}/>`;
    const FISH_MAP=['...cc.......','..cccc...c..','.cccccc.cc..','ccccecccccc.','.cccccc.cc..','..cccc...c..','...cc.......'];
    function fishIcon(f,cls='fish'){
        if(f.art)return `<img class="pixel ${cls}" src="assets/${f.art}.png" alt="">`;
        let cells='';FISH_MAP.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='.')return;cells+=px(x,y,ch==='e'?'#0b0e14':f.color);}));
        return `<svg class="${cls} pixel" viewBox="0 0 12 7" shape-rendering="crispEdges" aria-hidden="true">${cells}${px(3,2,'#fff',' opacity=".55"')}</svg>`;
    }
    const MAGE_MAP=['.....hhhhh......','....hhhhhhh.....','...hhhhhhhhh....','..hhhhhhhhhhh...','.ttttttttttttt..','....bssssb......','....bseessb.....','....bssssb......','.....ssss.......','....rrrrrr......','...rrrrrrrr.....','..rrrrrrrrrr....','..rrrrrrrrrrs...','..rrrrdrrrrr....','..rrrrdrrrrr....','..rrrrdrrrrr....','..rrrrdrrrrr....','..rrrrdrrrrr....','..rrrrdrrrrrr...','..rrrrdrrrrrr...','...ooo..ooo.....'];
    const BRAID=[[3,5],[3,6],[3,7],[3,8],[2,8],[2,9],[2,10],[2,11],[1,11],[1,12],[1,13]];
    const MAGE_FILL={h:'#2a1f45',t:'#d7b775',s:'#f1c9a5',e:'#1b1b24',r:'#3b2d5c',d:'#2b1f45',o:'#1f1a2b'};
    function mageSvg(variant){
        const hair=variant==='braid'?'#c2783a':'#2b2b33';let cells='';
        MAGE_MAP.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='.')return;cells+=px(x,y,ch==='b'?hair:MAGE_FILL[ch]);}));
        if(variant==='braid')cells+=BRAID.map(([x,y])=>px(x,y,hair)).join('')+px(1,14,'#d7b775');
        cells+=px(5,1,'#3b2d5c')+px(9,2,'#d7b775',' opacity=".8"');
        return `<g class="mage" transform="translate(26 187) scale(3)">${cells}</g>`;
    }
    const BOBBER=`<g class="bobber"><rect x="-3" y="-9" width="6" height="4" fill="#d8404f"/><rect x="-3" y="-5" width="6" height="5" fill="#f4f1e6"/><rect x="-1" y="-11" width="2" height="2" fill="#f4f1e6"/><circle class="ripple" r="9" style="display:none"/></g>`;
    const buoySvg=(ready)=>`<svg viewBox="0 0 11 13" shape-rendering="crispEdges" aria-hidden="true"><rect x="5" y="0" width="1" height="7" fill="#e8dcc6"/><rect x="6" y="1" width="4" height="3" fill="${ready?'#b9f0a6':'#ff9f5a'}"/><rect x="2" y="7" width="7" height="3" fill="#d8404f"/><rect x="1" y="10" width="9" height="2" fill="#f4f1e6"/><rect x="3" y="12" width="5" height="1" fill="#0b0e14" opacity=".5"/></svg>`;
    function pierSvg(z){
        const c=z.colors,bands=[[118,42,c.water],[160,100,mix(c.water,c.deep,.4)],[260,140,c.deep]];
        let clouds='';for(let i=0;i<4;i++){const x=20+i*72,y=22+(i%2)*26;clouds+=`<rect x="${x}" y="${y}" width="34" height="6" fill="#fff" opacity=".35"/><rect x="${x+8}" y="${y-5}" width="18" height="5" fill="#fff" opacity=".3"/>`;}
        // Far shore: a dark treeline of stepped silhouettes against the sky, then a thin pale strand above the water.
        const tree=mix(c.deep,'#000',.35),treeLight=mix(c.deep,c.sky,.15);let shore='';
        for(let i=0;i<22;i++){const x=i*14+(i%3)*2,h=7+((i*7)%11),w=7+(i%2)*3;shore+=`<rect x="${x}" y="${106-h}" width="${w}" height="${h}" fill="${i%4===1?treeLight:tree}"/><rect x="${x+Math.floor(w/2)-1}" y="${102-h}" width="${2+(i%2)}" height="4" fill="${i%4===1?treeLight:tree}"/>`;}
        shore+=`<rect y="106" width="300" height="12" fill="${mix(c.shore,c.deep,.45)}"/><rect y="113" width="300" height="5" fill="${c.shore}" opacity=".9"/>`;
        let waves='';for(let g=0;g<3;g++){let rows='';for(let r=0;r<4;r++){const y=146+g*14+r*42;rows+=`<line x1="-30" y1="${y}" x2="330" y2="${y}" stroke="#fff" stroke-opacity=".${g===1?'22':'14'}" stroke-width="1" stroke-dasharray="${6+g*3} ${18+g*4}"/>`;}waves+=`<g>${rows}</g>`;}
        const sun=z.element==='fire'?`<circle cx="236" cy="40" r="16" fill="#ffd27a" opacity=".85"/>`:z.element==='ice'?`<circle cx="236" cy="38" r="12" fill="#fff" opacity=".8"/>`:`<circle cx="236" cy="40" r="13" fill="#fff6d6" opacity=".55"/>`;
        return `<svg class="pier-art pixel" viewBox="0 0 300 400" shape-rendering="crispEdges" aria-hidden="true">
<rect width="300" height="120" fill="${c.sky}"/>${sun}${clouds}${shore}
${bands.map(([y,h,f])=>`<rect y="${y}" width="300" height="${h}" fill="${f}"/>`).join('')}<rect y="118" width="300" height="2" fill="#fff" opacity=".35"/>
<g class="waves">${waves}</g>
<rect x="0" y="262" width="150" height="40" fill="#000" opacity=".18"/>
<rect x="18" y="256" width="6" height="46" fill="#3b2715"/><rect x="68" y="256" width="6" height="40" fill="#3b2715"/><rect x="118" y="256" width="6" height="34" fill="#3b2715"/>
<rect x="0" y="246" width="150" height="10" fill="#6b4a2b"/><rect x="0" y="256" width="150" height="4" fill="#4a311b"/>${[22,46,70,94,118,142].map(x=>`<rect x="${x}" y="246" width="1" height="10" fill="#4a311b"/>`).join('')}
<rect x="140" y="214" width="4" height="32" fill="#3b2715"/><rect x="136" y="206" width="12" height="10" fill="#d7b775"/><rect x="139" y="209" width="6" height="5" fill="#fff3a8"/><circle cx="142" cy="211" r="18" fill="#ffd36b" opacity=".12"/>
${mageSvg(ui.mage)}
<g class="rod" style="transform-origin:62px 223px"><line x1="62" y1="223" x2="134" y2="223" stroke="#8a5f36" stroke-width="2.6" stroke-linecap="round"/><line x1="100" y1="223" x2="134" y2="223" stroke="#c7a66b" stroke-width="1.2"/><rect x="60" y="221" width="4" height="4" fill="#d7b775"/></g>
<path class="line" d="" fill="none" stroke="#f4f1e6" stroke-opacity=".75" stroke-width="1"/>
${BOBBER}
</svg>`;
    }
    function mix(a,b,t){const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const [x,y]=[p(a),p(b)];return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}

    /* Rod state machine (presentation only; the model decides species, size and credit) */
    const rod={phase:'idle',t0:0,ratio:0,pending:null,flightStart:0,biteAt:0,windowEnd:0,hit:null,resultUntil:0,result:null};
    const ROD_ORIGIN=[62,223],ROD_LENGTH=72;
    const rodAngle=()=>({idle:-35,charging:-35-45*rod.ratio,flying:-8,waiting:-22,bite:-30,result:-62})[rod.phase];
    const rodTip=()=>{const a=rodAngle()*Math.PI/180;return [ROD_ORIGIN[0]+ROD_LENGTH*Math.cos(a),ROD_ORIGIN[1]+ROD_LENGTH*Math.sin(a)];};
    const target=()=>[125+150*rod.ratio,238-62*rod.ratio];
    function bobberPos(t){
        if(rod.phase==='flying'){const k=Math.min(1,(t-rod.flightStart)/550),e=1-Math.pow(1-k,3),[tx,ty]=rodTip(),[bx,by]=target();return [tx+(bx-tx)*e,ty+(by-ty)*e-Math.sin(k*Math.PI)*40];}
        if(rod.phase==='waiting'||rod.phase==='bite'){const [bx,by]=target();return [bx,by+(rod.phase==='bite'?0:Math.sin(t/600)*1.5)];}
        return rodTip();
    }
    function startCharge(){
        if(rod.phase!=='idle'||ui.sheet)return;
        const q=F.quote(state,'cast',{charge:1},now());
        if(!q.ok){toast(q.reason);return;}
        rod.phase='charging';rod.t0=performance.now();rod.ratio=0;phaseClass();
    }
    function releaseCharge(){
        if(rod.phase!=='charging')return;
        const charge=Math.min(F.chargeMax(state),(performance.now()-rod.t0)/1000);
        const r=command('cast',{charge});
        if(!r.ok){rod.phase='idle';phaseClass();return;}
        rod.pending=r.result;rod.ratio=charge/F.chargeMax(state);rod.phase='flying';rod.flightStart=performance.now();
        rod.biteAt=rod.flightStart+550+rod.pending.bite*1000;rod.windowEnd=rod.biteAt+rod.pending.window*1000;
        phaseClass();refreshHud();
    }
    function resolve(hit){
        if(rod.phase!=='bite'||!rod.pending)return;
        const r=command('hook',{catch:rod.pending.id,hit});
        rod.phase='result';rod.result=r.ok?r.result:null;rod.hit=hit;rod.resultUntil=performance.now()+1500;rod.pending=null;phaseClass();
        const pier=phone.querySelector('#pier');
        if(pier&&rod.result){const f=F.fish(rod.result.species);pier.insertAdjacentHTML('beforeend',`<div class="catch ${hit?'':'miss'}">${fishIcon(f)}<div><b>+${rod.result.count} ${f.name}</b><small>${F.sizeNames[rod.result.size]}${hit?` · hooked +${rod.result.bonus}`:' · missed the bite, kept the fish'}</small></div></div>`);}
        refreshHud(true);
    }
    function phaseClass(){const pier=phone.querySelector('#pier');if(!pier)return;pier.className='pier '+rod.phase+(rod.phase==='flying'?' cast':'');const hint=pier.querySelector('.hint');if(hint)hint.textContent=hintText();}
    const hintText=()=>({idle:state.pending?'Reel in first':F.settleBait(state,now())<1?`Out of bait · next in ${fmtTime(F.baitNextIn(state,now()))}`:'Hold the water to charge, release to cast',charging:'Release to cast · longer hold, bigger fish',flying:'…',waiting:'Wait for the bite',bite:ui.autoHook?'Auto-hook!':'Tap now! +'+F.hitBonus(state)+' if you hook it',result:''})[rod.phase];
    // The rod logic runs from a timer as well as from requestAnimationFrame, so a throttled or hidden frame still bites.
    function frame(fromTimer){
        const t=performance.now();
        if(rod.phase==='charging'){rod.ratio=Math.min(1,(t-rod.t0)/1000/F.chargeMax(state));}
        if(rod.phase==='flying'&&t>=rod.flightStart+550){rod.phase='waiting';phaseClass();}
        if(rod.phase==='waiting'&&t>=rod.biteAt){rod.phase='bite';phaseClass();if(!reduced()&&navigator.userActivation?.hasBeenActive)navigator.vibrate?.(30);if(ui.autoHook)setTimeout(()=>resolve(true),350);}
        if(rod.phase==='bite'&&t>=rod.windowEnd&&!ui.autoHook)resolve(false);
        if(rod.phase==='result'&&t>=rod.resultUntil){rod.phase='idle';rod.result=null;phaseClass();phone.querySelector('#pier .catch')?.remove();}
        const pier=phone.querySelector('#pier');
        if(pier){
            const g=pier.querySelector('.rod');if(g)g.style.transform=`rotate(${rodAngle()}deg)`;
            const [bx,by]=bobberPos(t),bob=pier.querySelector('.bobber'),line=pier.querySelector('.line');
            if(bob){bob.style.transform=`translate(${bx}px,${by}px)`;const rip=bob.querySelector('.ripple');if(rip)rip.style.display=rod.phase==='bite'&&!reduced()?'block':'none';}
            if(line){const [tx,ty]=rodTip();line.setAttribute('d',rod.phase==='idle'||rod.phase==='charging'?'':`M ${tx} ${ty} Q ${(tx+bx)/2} ${Math.max(ty,by)+16} ${bx} ${by}`);}
            const bar=pier.querySelector('.charge i');if(bar)bar.style.width=(rod.ratio*100)+'%';
            let bubble=pier.querySelector('.bubble');
            if(rod.phase==='bite'){if(!bubble){bubble=document.createElement('div');bubble.className='bubble';bubble.textContent='!';pier.append(bubble);}bubble.style.left=(bx/3)+'%';bubble.style.top=(by/4)+'%';}else bubble?.remove();
            let win=pier.querySelector('.window');
            if(rod.phase==='bite'&&!ui.autoHook){if(!win){win=document.createElement('div');win.className='window';win.innerHTML='<i></i>';pier.append(win);}win.querySelector('i').style.transform=`scaleX(${Math.max(0,(rod.windowEnd-t)/(rod.pending.window*1000))})`;}else win?.remove();
            pier.querySelectorAll('.buoy[data-slot]').forEach(b=>{const net=state.nets[b.dataset.slot];if(!net)return;const done=F.netDone(net,now());b.classList.toggle('ready',done);b.querySelector('b').textContent=done?'Ready':fmtTime(F.netRemaining(net,now()));});
        }
        phone.querySelectorAll('[data-remaining]').forEach(el=>{const net=state.nets[el.dataset.remaining];if(!net)return;const done=F.netDone(net,now());el.textContent=done?'Ready to collect':fmtTime(F.netRemaining(net,now()))+' left';el.classList.toggle('ready',done);});
        const baitChip=phone.querySelector('.chip-stock.bait');if(baitChip){const before=state.bait.charges;F.settleBait(state,now());if(before!==state.bait.charges)refreshHud(true);else{const s=baitChip.querySelector('small');if(s)s.textContent=state.bait.charges>=F.baitCap(state)?'full':'+1 in '+fmtTime(F.baitNextIn(state,now()));}}
        if(!fromTimer)requestAnimationFrame(()=>frame(false));
    }

    /* Rendering */
    function hud(){
        const z=zoneOf();F.settleBait(state,now());
        const chips=z.species.map(f=>`<span class="chip-stock" data-fish="${f.id}" title="${f.name} · ${F.rarities[f.rarity]}" style="${rarityVar(f)}">${fishIcon(f)}<span>${f.name}</span><b>${fmt(state.stock[f.id])}</b></span>`).join('');
        return `<header class="hud"><div class="hud-top"><img class="hud-site pixel" src="assets/site-pond.png" alt=""><div><small>FISHING · ZONE ${z.index+1}</small><h1>${z.name}</h1></div><span class="boss-chip">⚔ Boss wins <b>${state.bossWins}</b></span></div><div class="chips"><span class="chip-stock bait" title="Bait returns every ${fmtTime(F.baitRegen(state))}">🪝<span>Bait</span><b>${state.bait.charges}/${F.baitCap(state)}</b><small>${state.bait.charges>=F.baitCap(state)?'full':'+1 in '+fmtTime(F.baitNextIn(state,now()))}</small></span>${chips}</div></header>`;
    }
    function render(){
        const view={pier:pierView,zones:zonesView,nets:netsView,tree:treeView}[ui.view]();
        const ready=state.nets.some(n=>n&&F.netDone(n,now())),buyable=F.nodes.some(n=>F.quote(state,'buy',n.id).ok);
        phone.innerHTML=`${hud()}<section class="page">${view}</section>
        <nav class="tabs" aria-label="Fishing sections">${[['pier','🎣','Pier',false],['zones','◈','Zones',false],['nets','⌗','Nets',ready],['tree','✶','Skill tree',buyable]].map(([v,g,l,dot])=>`<button data-view="${v}" ${ui.view===v?'aria-current="page"':''}><span class="${dot?'dot':''}">${g}</span>${l}</button>`).join('')}</nav>
        ${sheetMarkup()}`;
        phaseClass();renderState();
        document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.scene===ui.scene)));
        document.querySelector('#scene-label').textContent=sceneLabels[ui.scene];
    }
    function renderState(){
        document.querySelector('#state').textContent=JSON.stringify({scene:ui.scene,view:ui.view,zone:zoneOf().id,bossWins:state.bossWins,openZones:F.openZones(state).length,bait:{...state.bait,cap:F.baitCap(state)},nets:state.nets.map((n,slot)=>n?{slot,zone:F.zone(n.zone).id,type:n.type,remaining:Math.round(F.netRemaining(n,now()))}:{slot,empty:true}),pending:state.pending,rod:rod.phase,autoHook:ui.autoHook,stock:Object.fromEntries(Object.entries(state.stock).filter(([,n])=>n>0)),nodes:Object.keys(state.nodes),lastReceipt:state.receipts.at(-1)||null},null,2);
    }
    const BUOYS=[[58,72],[81,60],[66,87],[89,79]];
    function pierView(){
        const z=zoneOf();
        const buoys=state.nets.map((net,slot)=>net&&net.zone===z.index?`<button class="buoy ${F.netDone(net,now())?'ready':''}" data-slot="${slot}" style="left:${BUOYS[slot][0]}%;top:${BUOYS[slot][1]}%" aria-label="${F.netType(net.type).name} in slot ${slot+1}">${buoySvg(F.netDone(net,now()))}<b>${F.netDone(net,now())?'Ready':fmtTime(F.netRemaining(net,now()))}</b></button>`:'').join('');
        const slots=state.nets.map((net,slot)=>{if(!net)return `<button class="btn ghost" data-set-net="${slot}">⌗ Set net · slot ${slot+1}</button>`;if(net.zone===z.index)return '';return `<button class="btn ghost" data-net="${slot}">Slot ${slot+1} · ${F.zone(net.zone).name}</button>`;}).join('');
        const haul=F.bought(state,'haul-all')&&state.nets.some(n=>n&&F.netDone(n,now()))?`<button class="btn good" data-action="haul-all">Haul all</button>`:'';
        const next=F.nextZone(state);
        return `<div class="zone-head"><span class="element" style="--element:${z.colors.water}"></span><div><b>${z.name}</b><small>${z.element} · ${F.netSlots(state)} net slot${F.netSlots(state)>1?'s':''}${ui.autoHook?' · auto-hook on':''}</small></div><button class="btn ghost" data-view="zones">Zones</button></div>
        <div class="pier ${rod.phase}" id="pier">${pierSvg(z)}<button class="water-zone" aria-label="Hold to charge the cast, release to cast, tap again when the bobber dips"></button>${buoys}<div class="charge"><i></i></div><div class="hint">${hintText()}</div></div>
        <div class="net-row">${slots}${haul}</div>
        <p class="note">Hold the water up to ${fmt(F.chargeMax(state))} s: short hold Small (1), medium (2), full Large (3). Hook the bite within ${fmt(F.biteWindow(state))} s for +${F.hitBonus(state)}. ${next?`Next zone <b>${next.name}</b> opens at boss win ${next.threshold}.`:'Every zone is open.'}</p>`;
    }
    function zonesView(){
        return `<h2>Zones <small>${F.openZones(state).length} of ${F.ZONES} open</small></h2>`+F.zones.map(z=>{
            const open=F.zoneOpen(state,z.index),here=state.nets.filter(n=>n&&n.zone===z.index).length;
            return `<div class="card ${open?'':'locked'} ${state.zone===z.index?'current':''}"><div class="row"><span class="element" style="--element:${z.colors.water}"></span><div class="grow"><b>${z.name}</b><small>Zone ${z.index+1} · ${z.element}${open?here?` · ${here} net${here>1?'s':''} here`:'':` · opens at boss win ${z.threshold}`}</small></div>${open?state.zone===z.index?'<span class="rarity">HERE</span>':`<button class="btn primary" data-zone="${z.index}">Fish here</button>`:'<span class="rarity">🔒</span>'}</div><div class="species-row">${z.species.map(f=>`<span style="${rarityVar(f)}" title="${F.rarities[f.rarity]}">${fishIcon(f)}${f.name}${open?` <b>${fmt(state.stock[f.id])}</b>`:''}</span>`).join('')}</div></div>`;
        }).join('')+`<p class="note">Zones open for free at boss wins. Rod and nets draw the same four species of a zone; the net stays where you set it when you move on.</p>`;
    }
    function netsView(){
        const rows=state.nets.map((net,slot)=>{
            if(!net)return `<div class="card"><div class="row"><div class="grow"><b>Slot ${slot+1}</b><small>Empty</small></div><button class="btn primary" data-set-net="${slot}">Set in ${zoneOf().name}</button></div></div>`;
            const t=F.netType(net.type),z=F.zone(net.zone),done=F.netDone(net,now()),p=Math.min(1,(now()-net.startedAt)/t.seconds);
            return `<div class="card"><div class="row"><span class="element" style="--element:${z.colors.water}"></span><div class="grow"><b>${t.name} · ${z.name}</b><small>Slot ${slot+1} · ${F.netYield(t)} fish at the end · ${fmtTime(t.seconds)} on the wall clock</small><div class="progress"><i style="width:${p*100}%"></i></div><span class="timer ${done?'ready':''}" data-remaining="${slot}">${done?'Ready to collect':fmtTime(F.netRemaining(net,now()))+' left'}</span></div><button class="btn ${done?'good':'ghost'}" data-net="${slot}">${done?'Collect':'Details'}</button></div></div>`;
        }).join('');
        const locked=F.nodes.filter(n=>n.effect.kind==='netSlot'&&!F.bought(state,n.id)).length;
        return `<h2>Nets <small>${F.netSlots(state)} slot${F.netSlots(state)>1?'s':''} · ${F.unlockedNetTypes(state).map(t=>fmtTime(t.seconds)).join(', ')}</small></h2>${rows}${locked?`<p class="note">${locked} more slot${locked>1?'s':''} and longer nets wait in the skill tree. A started net always finishes on the wall clock; nothing restarts by itself.</p>`:''}${F.bought(state,'haul-all')&&state.nets.some(n=>n&&F.netDone(n,now()))?'<button class="btn good wide" data-action="haul-all">Haul all finished nets</button>':''}`;
    }
    function treeView(){
        const branch=F.branches.find(b=>b.id===ui.branch);
        const tabs=F.branches.map(b=>{const open=F.nodes.some(n=>n.branch===b.id&&F.quote(state,'buy',n.id).ok);return `<button role="tab" aria-selected="${ui.branch===b.id}" data-branch="${b.id}"><span class="${open?'dot':''}">${b.icon}</span>${b.name}</button>`;}).join('');
        const nodes=F.nodes.filter(n=>n.branch===ui.branch).map(n=>{
            const owned=F.bought(state,n.id),q=F.quote(state,'buy',n.id),missing=F.nodeLocked(state,n);
            const cost=Object.entries(n.cost).map(([fid,k])=>{const f=F.fish(fid);return `<span class="${state.stock[fid]>=k?'':'poor'}" title="${f.name} · ${F.zone(f.zone).name}">${fishIcon(f)}${fmt(k)}</span>`;}).join('');
            const where=n.effect.kind==='rule'?`Rule recorded here · lives in the ${n.effect.system}`:'Changes this prototype';
            return `<div class="card node ${owned?'owned':q.ok?'open':''} ${!owned&&missing?'locked':''}"><span class="pip"></span><div class="row"><div class="grow"><b>${n.name}</b><small>${n.text}</small>${owned?'<div class="where">Unlocked</div>':`<div class="cost">${cost}</div><div class="where">${missing?`Needs ${F.node(missing).name}`:where}</div>`}</div>${owned?'<span class="rarity" style="--rarity:#b9f0a6">✓</span>':`<button class="btn ${q.ok?'good':'ghost'}" data-buy="${n.id}" ${q.ok?'':'disabled'} aria-label="Unlock ${n.name}">Unlock</button>`}</div></div>`;
        }).join('');
        return `<h2>Skill tree <small>${Object.keys(state.nodes).length} of ${F.nodes.length} unlocked</small></h2><div class="branch-tabs" role="tablist">${tabs}</div><p class="note"><b>${branch.name}.</b> ${branch.text}</p>${nodes}`;
    }
    function sheetMarkup(){
        const sh=ui.sheet;if(!sh)return '';
        let body='',title='';
        if(sh.type==='setNet'){
            const slot=sh.slot,z=zoneOf();title=`Set a net in ${z.name}`;
            body=`<p class="note">Slot ${slot+1}. The net stays in ${z.name} until you collect it. Rod and net share the zone's species.</p><div class="type-grid">${F.netTypes.map(t=>{const ok=F.unlockedNetTypes(state).some(x=>x.id===t.id);return `<button data-net-type="${t.id}" data-slot="${slot}" ${ok?'':'disabled'}><b>${t.name}</b>${fmtTime(t.seconds)} · ${F.netYield(t)} fish<br><small>${ok?'6 per hour':'Skill tree'}</small></button>`;}).join('')}</div>`;
        }else if(sh.type==='net'){
            const slot=sh.slot,net=state.nets[slot],t=F.netType(net.type),z=F.zone(net.zone),done=F.netDone(net,now());
            title=`${t.name} · ${z.name}`;
            body=`<div class="kv"><span>Slot</span><b>${slot+1}</b><span>Set</span><b>${fmtTime(now()-net.startedAt)} ago</b><span>Finishes</span><b>${done?'Done':fmtTime(F.netRemaining(net,now()))}</b><span>Haul</span><b>${F.netYield(t)} fish by weight</b></div><div class="species-row">${z.species.map(f=>`<span style="${rarityVar(f)}">${fishIcon(f)}${f.name} <b>${f.weight}%</b></span>`).join('')}</div><div class="row" style="margin-top:10px">${done?`<button class="btn good grow" data-collect="${slot}">Collect ${F.netYield(t)} fish</button>`:'<span class="note grow" style="margin:0">A started net finishes on the wall clock, also past the 12 h cap. It will not restart itself.</span>'}<button class="btn ghost" data-zone-go="${z.index}">Go there</button></div>`;
        }else if(sh.type==='return'){
            const s=sh.summary,hours=sh.hours;title='Welcome back';
            body=`<div class="return-hero"><img class="pixel" src="assets/site-pond.png" alt=""><div class="return-time">${fmt(hours)} h<small>away</small></div><small style="color:#9aa7bd">Nets ran on the wall clock · bait refilled to ${state.bait.charges}/${F.baitCap(state)}</small></div>${s.finished.length?s.finished.map(n=>`<div class="card"><div class="row"><span class="element" style="--element:${F.zone(n.zone).colors.water}"></span><div class="grow"><b>${F.netType(n.type).name} · ${F.zone(n.zone).name}</b><small>Slot ${n.slot+1} · finished</small></div><b class="timer ready">${n.count} fish</b></div></div>`).join(''):'<div class="empty">No net finished while you were away.</div>'}${s.running.map(n=>`<div class="card locked"><div class="row"><div class="grow"><b>${F.netType(n.type).name} · ${F.zone(n.zone).name}</b><small>Slot ${n.slot+1} · ${fmtTime(n.remaining)} left</small></div></div></div>`).join('')}${s.finished.length?`<button class="btn primary wide" data-action="collect-all">Collect ${s.finished.reduce((a,n)=>a+n.count,0)} fish</button>`:'<button class="btn ghost wide" data-action="close">Back to the pier</button>'}`;
        }else if(sh.type==='haul'){
            title='Hauled in';
            body=sh.hauls.map(h=>`<div class="card"><div class="row"><div class="grow"><b>${F.netType(h.type).name} · ${F.zone(h.zone).name}</b><div class="haul">${Object.entries(h.haul).map(([fid,k])=>`<span>${fishIcon(F.fish(fid))}${F.fish(fid).name} <b>+${k}</b></span>`).join('')}</div></div></div></div>`).join('')+`<button class="btn primary wide" data-action="close">Done</button>`;
        }
        return `<div class="sheet-backdrop" data-action="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/<[^>]+>/g,''))}"><h2>${title}<button class="x" data-action="close" aria-label="Close">×</button></h2>${body}</div></div>`;
    }
    function toast(text){const t=document.createElement('div');t.className='toast';t.textContent=text;phone.append(t);setTimeout(()=>t.remove(),1900);}
    function refreshHud(bump){const z=zoneOf();phone.querySelectorAll('.chip-stock[data-fish]').forEach(el=>{const b=el.querySelector('b'),v=fmt(state.stock[el.dataset.fish]);if(b.textContent!==v){b.textContent=v;if(bump){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}}});const bait=phone.querySelector('.chip-stock.bait b');if(bait)bait.textContent=`${state.bait.charges}/${F.baitCap(state)}`;void z;renderState();}
    function collectSlots(slots){const hauls=[];for(const slot of slots){const net=state.nets[slot];const r=command('collectNet',{slot});if(r.ok)hauls.push({...r.result,type:net.type});}return hauls;}

    /* Input */
    phone.addEventListener('pointerdown',e=>{
        if(e.target.closest('.water-zone')){e.preventDefault();if(rod.phase==='bite')resolve(true);else if(rod.phase==='idle')startCharge();}
    });
    document.addEventListener('pointerup',()=>{if(rod.phase==='charging')releaseCharge();});
    document.addEventListener('pointercancel',()=>{if(rod.phase==='charging')releaseCharge();});
    phone.addEventListener('keydown',e=>{if(!e.target.closest('.water-zone')||e.repeat||(e.key!==' '&&e.key!=='Enter'))return;e.preventDefault();if(rod.phase==='bite')resolve(true);else if(rod.phase==='idle')startCharge();});
    phone.addEventListener('keyup',e=>{if(!e.target.closest('.water-zone')||(e.key!==' '&&e.key!=='Enter'))return;e.preventDefault();if(rod.phase==='charging')releaseCharge();});
    phone.addEventListener('click',e=>{
        if(e.target.closest('.water-zone'))return;
        const el=e.target.closest('[data-view],[data-zone],[data-zone-go],[data-branch],[data-buy],[data-set-net],[data-net-type],[data-net],[data-collect],[data-slot],[data-action]');if(!el)return;
        if(el.dataset.action==='close'){if(e.target===el||e.target.closest('.x')||el.classList.contains('btn'))ui.sheet=null;else return;}
        else if(el.dataset.view){ui.view=el.dataset.view;}
        else if(el.dataset.zone!==undefined){if(command('zone',Number(el.dataset.zone)).ok){ui.view='pier';toast(`Now fishing ${zoneOf().name}`);}}
        else if(el.dataset.zoneGo!==undefined){if(command('zone',Number(el.dataset.zoneGo)).ok){ui.sheet=null;ui.view='pier';}}
        else if(el.dataset.branch){ui.branch=el.dataset.branch;}
        else if(el.dataset.buy){const n=F.node(el.dataset.buy);if(command('buy',n.id).ok)toast(`${n.name} unlocked`);}
        else if(el.dataset.setNet!==undefined){ui.sheet={type:'setNet',slot:Number(el.dataset.setNet)};}
        else if(el.dataset.netType){const r=command('setNet',{slot:Number(el.dataset.slot),type:el.dataset.netType});if(r.ok){ui.sheet=null;ui.view='pier';toast(`${F.netType(el.dataset.netType).name} set in ${zoneOf().name}`);}}
        else if(el.dataset.net!==undefined||el.dataset.slot!==undefined){const slot=Number(el.dataset.net??el.dataset.slot);const net=state.nets[slot];if(net&&F.netDone(net,now())&&el.dataset.net!==undefined&&el.classList.contains('good')){ui.sheet={type:'haul',hauls:collectSlots([slot])};}else ui.sheet={type:'net',slot};}
        else if(el.dataset.collect!==undefined){ui.sheet={type:'haul',hauls:collectSlots([Number(el.dataset.collect)])};}
        else if(el.dataset.action==='haul-all'||el.dataset.action==='collect-all'){const slots=state.nets.map((n,i)=>n&&F.netDone(n,now())?i:null).filter(i=>i!==null);ui.sheet={type:'haul',hauls:collectSlots(slots)};}
        render();
    });
    document.addEventListener('click',e=>{
        const demo=e.target.closest('[data-demo]'),scene=e.target.closest('[data-scene]');
        if(scene){load(scene.dataset.scene);return;}
        if(!demo)return;
        const d=demo.dataset.demo;
        if(d==='boss'){state.bossWins++;const opened=F.zones.find(z=>z.threshold===state.bossWins);toast(opened?`Boss win ${state.bossWins} · ${opened.name} opens`:`Boss win ${state.bossWins}`);if(opened)ui.view='zones';}
        if(d==='fish'){const z=zoneOf();z.species.forEach(f=>{state.stock[f.id]+=[40,15,6,2][f.rarity];});toast(`More fish from ${z.name}`);}
        if(d==='skip10')offset+=600;if(d==='skip1h')offset+=3600;
        if(d==='skip30h'){offset+=30*3600;ui.sheet={type:'return',hours:30,summary:F.returnSummary(state,now())};}
        if(d==='mage'){ui.mage=ui.mage==='braid'?'short':'braid';toast(ui.mage==='braid'?'Mage with the braid':'Mage with short hair');}
        if(d==='autohook'){ui.autoHook=!ui.autoHook;toast(ui.autoHook?'Auto-hook on · the bite hooks itself':'Auto-hook off');}
        if(d.startsWith('skip'))toast(d==='skip10'?'+10 minutes':d==='skip1h'?'+1 hour':'30 hours later');
        render();
    });
    document.querySelector('#previous').addEventListener('click',()=>load(scenes[(scenes.indexOf(ui.scene)+scenes.length-1)%scenes.length]));
    document.querySelector('#next').addEventListener('click',()=>load(scenes[(scenes.indexOf(ui.scene)+1)%scenes.length]));

    /* Scenes are deterministic: a fixed epoch, a fixed seed and nets timed relative to the load. */
    function load(scene){
        rng=seeded(11);serial=0;offset=0;startedAt=performance.now();state=F.fresh();
        ui={scene,view:'pier',branch:'fishing',sheet:null,mage:ui?.mage||'braid',autoHook:ui?.autoHook||false};
        Object.assign(rod,{phase:'idle',pending:null,result:null,ratio:0});
        const t=now();
        const unlock=(...ids)=>{for(const id of ids)state.nodes[id]=true;while(state.nets.length<F.netSlots(state))state.nets.push(null);};
        const net=(slot,zone,type,elapsed)=>{const nt=F.netType(type);state.nets[slot]={zone,type,startedAt:t-elapsed,endsAt:t-elapsed+nt.seconds};};
        const give=amounts=>{for(const [k,v]of Object.entries(amounts))state.stock[k]+=v;};
        state.bossWins=F.FISHING_BOSS_WINS;state.bait.last=t;
        if(scene==='nets'||scene==='return'){state.bossWins=8;unlock('net-hour','net-long','net-slot-2','net-slot-3','bait-pouch');net(0,0,'short',700);net(1,1,'hour',2400);net(2,2,'long',3*3600);give({reedfin:34,mooncarp:12,'glass-eel':3,mudskipper:18,'bog-perch':4,'cinder-minnow':9});state.zone=1;ui.view='nets';}
        if(scene==='tree'){state.bossWins=8;unlock('bait-pouch');give({reedfin:120,mooncarp:60,'glass-eel':25,'star-koi':8,mudskipper:50,'bog-perch':20,'reed-pike':10,'marsh-lantern':3,'cinder-minnow':40,'ash-carp':15});ui.view='tree';}
        if(scene==='late'){state.bossWins=18;unlock('net-hour','net-long','net-day','net-slot-2','net-slot-3','net-slot-4','bait-pouch','keen-eye','steady-hands','bait-keeper','double-hook','twin-pick','carry-over','chest-cap','haul-all','fast-travel','second-slot','recipe-sight');state.zone=6;net(0,6,'day',12*3600);net(1,3,'long',9*3600);net(2,5,'hour',50*60);net(3,6,'short',900);state.bait.charges=23;give(Object.fromEntries(F.species.filter(f=>f.zone<8).map(f=>[f.id,Math.round([90,40,14,5][f.rarity]*(1-f.zone*.1))])));}
        if(scene==='return'){offset=30*3600;state.bait.charges=9;state.bait.last=t-30*3600;unlock('net-day');net(2,2,'day',-(6*3600+600));ui.view='pier';ui.sheet={type:'return',hours:30,summary:F.returnSummary(state,now())};}
        const url=new URL(location.href);url.searchParams.set('scene',scene);history.replaceState(null,'',url);
        render();
    }
    load(scenes.includes(new URLSearchParams(location.search).get('scene'))?new URLSearchParams(location.search).get('scene'):'start');
    requestAnimationFrame(()=>frame(false));
    setInterval(()=>frame(true),60);
})();
