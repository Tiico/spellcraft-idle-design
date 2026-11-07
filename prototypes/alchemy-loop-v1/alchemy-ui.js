/* Review-only presentation for the alchemy loop. Rules live in alchemy-model.js; this file renders the garden bed, the
   harvest ring, the cauldrons, the formula book and the potion shelf, and feeds demo input. The clock is a fixed epoch plus
   elapsed time plus demo skips, so every scene is deterministic. */
(()=>{
    const A=SpellcraftAlchemy;
    const scenes=['start','window','late','brewing','return'];
    const sceneLabels={start:'Start · Första fröet',window:'Fönstret är öppet',late:'Försenad skörd',brewing:'Kittlar och formelbok',return:'Återkomst · 30 h borta'};
    const BASE=1800000000;
    let state,ui,serial=0,rng=seeded(11),offset=0,startedAt=performance.now();
    const now=()=>BASE+offset+(performance.now()-startedAt)/1000;
    const phone=document.querySelector('#phone');
    function seeded(seed){return()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};}
    const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const fmt=n=>Number.isInteger(n)?n.toLocaleString('en'):Number(n.toFixed(1)).toLocaleString('en');
    const fmtTime=s=>{s=Math.max(0,Math.ceil(s));if(s>=3600)return Math.floor(s/3600)+'h '+String(Math.floor(s%3600/60)).padStart(2,'0')+'m';if(s>=60)return Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s';return s+'s';};
    const signed=(v,unit)=>(v>0?'+':'')+fmt(v)+unit;
    const id=()=>'cmd-'+(++serial);
    const command=(action,target)=>{const t=now();const q=A.quote(state,action,target,t);const r=A.commit(state,{id:id(),action,target,token:q.token,now:t});if(!r.ok)toast(r.reason||q.reason||'Not possible');return r;};
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    const elementVar=p=>`--element:${A.elementColors[p.element]}`;
    const domainIcon={combat:'⚔',mine:'⛏',sea:'🎣',cross:'✦',none:'·'};
    const formulaColor=f=>({combat:'#d8404f',mine:'#efca66',sea:'#4f9fd1',cross:'#b58cff',none:'#6f7b94'})[A.effects[f.effects[0].stat].domain];

    /* Pixel art */
    const px=(x,y,fill,extra='')=>`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"${extra}/>`;
    const cells=(map,palette)=>{let out='';map.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='.')return;const f=typeof palette[ch]==='function'?palette[ch](x,y):palette[ch];if(f)out+=px(x,y,f);}));return out;};
    // Four growth stages of an 8×10 plant: s stem, l leaf, b bud/bloom, h highlight.
    const STAGES=[
        ['........','........','........','........','........','........','...s....','..ls....','...s....','........'],
        ['........','........','........','........','...s....','..lsl...','...s....','.l.s.l..','..lsl...','...s....'],
        ['........','...bb...','...bb...','...s....','..lsl...','.l.s.l..','...s....','..lsl...','.l.s.l..','...s....'],
        ['..hbbh..','.bbbbbb.','.bbbbbb.','..bbbb..','...s....','.l.s.l..','..lsl...','.l.s.l..','..lsl...','...s....']
    ];
    function plantSvg(p,stage,glow){
        const pal={s:'#4f8f4f',l:stage>=2?mix(p.color,'#4f8f4f',.5):'#6fb36f',b:p.color,h:'#fff6d6'};
        return `<svg class="plant-art pixel" viewBox="-2 0 12 14" shape-rendering="crispEdges" aria-hidden="true"><ellipse class="plant-glow" cx="4" cy="8" rx="7" ry="5" fill="${p.color}" opacity="${glow?.5:0}" style="shape-rendering:auto"/><rect x="-1" y="10" width="10" height="3" fill="#3a2a1a"/><rect x="0" y="10" width="8" height="1" fill="#5a4330"/><g class="sprout">${cells(STAGES[stage],pal)}</g></svg>`;
    }
    const soilSvg=`<svg class="plant-art pixel" viewBox="-2 0 12 14" shape-rendering="crispEdges" aria-hidden="true"><rect x="-1" y="9" width="10" height="4" fill="#3a2a1a"/><rect x="0" y="9" width="8" height="1" fill="#5a4330"/><rect x="2" y="11" width="1" height="1" fill="#5a4330"/><rect x="5" y="12" width="1" height="1" fill="#5a4330"/></svg>`;
    function ringSvg(p,g,s){
        const r=18,c=2*Math.PI*r,w=A.windowFraction(s),total=1+w;
        const fill=g?Math.min(1,g.rawFraction/total):0,windowLen=w/total;
        const color=g?g.phase==='late'?'#e0a84a':g.phase==='window'?'#b9f0a6':p.color:'#3a475f';
        return `<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="${r}" fill="#0b1220" opacity=".55"/><circle cx="22" cy="22" r="${r}" fill="none" stroke="#2d3a52" stroke-width="3"/>
<circle cx="22" cy="22" r="${r}" fill="none" stroke="#5f9a5f" stroke-width="3.6" stroke-dasharray="${(windowLen*c).toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${(-(1-windowLen)*c).toFixed(2)}" transform="rotate(-90 22 22)"/>
<circle class="arc" cx="22" cy="22" r="${r}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="butt" stroke-dasharray="${(fill*c).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 22 22)"/>
${g&&g.phase==='late'?`<circle cx="22" cy="22" r="13" fill="none" stroke="#e0a84a" stroke-width="2" stroke-dasharray="${(g.lost*2*Math.PI*13).toFixed(2)} ${(2*Math.PI*13).toFixed(2)}" transform="rotate(-90 22 22)" opacity=".8"/>`:''}
${(g?plantSvg(p,g.stage,g.phase==='window'):soilSvg).replace('<svg class="plant-art pixel"','<svg x="10" y="8" width="24" height="28" class="plant-art pixel"')}</svg>`;
    }
    const CAULDRON=['....bbbbbbbb....','..bbddddddddbb..','.bdLLLLLLLLLLdb.','.bLLLLLLLLLLLLb.','..bbbbbbbbbbbb..','..bkkkkkkkkkkb..','.bkkkkkkkkkkkkb.','.bkkkkkkkkkkkkb.','.bkkkkkkkkkkkkb.','.bkkkkkkkkkkkkb.','..bkkkkkkkkkkb..','...bbbbbbbbbb...','...b..b..b..b...','..bb..bb.bb.bb..','................','................'];
    function cauldronSvg(color,busy){
        const pal={b:'#1b1b24',d:mix(color,'#000',.35),L:color,k:'#2b2b36'};
        return `<svg class="cauldron-art pixel ${busy?'':'idle'}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${cells(CAULDRON,pal)}<rect x="3" y="7" width="1" height="3" fill="#3d3d4c"/><circle class="bubble" cx="6" cy="3" r="1" fill="#fff" opacity=".8"/><circle class="bubble" cx="9" cy="3" r=".8" fill="#fff" opacity=".8"/><circle class="bubble" cx="12" cy="3" r=".6" fill="#fff" opacity=".8"/></svg>`;
    }
    const potionSvg=(color,cls='potion-icon')=>`<svg class="${cls} pixel" viewBox="0 0 6 9" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="0" width="2" height="1" fill="#c7a66b"/><rect x="2" y="1" width="2" height="2" fill="#dfe6f2" opacity=".7"/><rect x="1" y="3" width="4" height="1" fill="#dfe6f2" opacity=".5"/><rect x="0" y="4" width="6" height="4" fill="${color}"/><rect x="1" y="8" width="4" height="1" fill="${mix(color,'#000',.4)}"/><rect x="1" y="5" width="1" height="2" fill="#fff" opacity=".6"/></svg>`;
    const FISH_MAP=['...cc.......','..cccc...c..','.cccccc.cc..','ccccecccccc.','.cccccc.cc..','..cccc...c..','...cc.......'];
    const fishColors={reedfin:'#9fd3c7',mooncarp:'#e8dca8','glass-eel':'#bfe6f2','star-koi':'#ff9a6a',mudskipper:'#8b9a5b','bog-perch':'#c0a060'};
    const fishIcon=fid=>`<svg class="fish pixel" viewBox="0 0 12 7" shape-rendering="crispEdges" aria-hidden="true">${cells(FISH_MAP,{c:fishColors[fid],e:'#0b0e14'})}</svg>`;
    const MAGE_MAP=['.....hhhhh......','....hhhhhhh.....','...hhhhhhhhh....','..hhhhhhhhhhh...','.ttttttttttttt..','....bssssb......','....bseessb.....','....bssssb......','.....ssss.......','....rrrrrr......','...rrrrrrrr.....','..rrrrrrrrrr....','..rrrrrrrrrrs...','..rrrrdrrrrr....','..rrrrdrrrrr....','..rrrrdrrrrr....','..rrrrdrrrrr....','..rrrrdrrrrr....','..rrrrdrrrrrr...','..rrrrdrrrrrr...','...ooo..ooo.....'];
    const BRAID=[[3,5],[3,6],[3,7],[3,8],[2,8],[2,9],[2,10],[2,11],[1,11],[1,12],[1,13]];
    const MAGE_FILL={h:'#2a1f45',t:'#d7b775',s:'#f1c9a5',e:'#1b1b24',r:'#3b2d5c',d:'#2b1f45',o:'#1f1a2b'};
    const CAN=['.....c..','....cc..','cccccc..','c.cccc.c','c.cccc.c','cccccc..','.cccc...'];
    function mageSvg(variant){
        const hair=variant==='braid'?'#c2783a':'#2b2b33';
        let body=cells(MAGE_MAP,{...MAGE_FILL,b:hair});
        if(variant==='braid')body+=BRAID.map(([x,y])=>px(x,y,hair)).join('')+px(1,14,'#d7b775');
        return `<g class="mage" style="transform:translate(${ui.mageAt[0]}px,${ui.mageAt[1]}px)"><g transform="scale(2.6)">${body}<g class="can" transform="translate(12 10)">${cells(CAN,{c:'#8392a8'})}</g></g></g>`;
    }
    function gardenSvg(){
        let fence='';for(let i=0;i<13;i++){const x=i*24+4;fence+=`<rect x="${x}" y="78" width="5" height="22" fill="#6b4a2b"/><rect x="${x+1}" y="76" width="3" height="3" fill="#8a5f36"/>`;}
        let soil='';for(let r=0;r<3;r++)for(let c=0;c<3;c++){const x=38+c*84,y=116+r*88;soil+=`<rect x="${x}" y="${y}" width="70" height="60" fill="#3a2a1a"/><rect x="${x}" y="${y}" width="70" height="4" fill="#5a4330"/><rect x="${x+6}" y="${y+18}" width="58" height="2" fill="#2d2014"/><rect x="${x+6}" y="${y+36}" width="58" height="2" fill="#2d2014"/>`;}
        let grass='';for(let i=0;i<40;i++){const x=(i*47)%296,y=104+(i*61)%290;grass+=`<rect x="${x}" y="${y}" width="2" height="3" fill="#3f7a3f" opacity=".7"/>`;}
        return `<svg class="garden-art pixel" viewBox="0 0 300 400" shape-rendering="crispEdges" aria-hidden="true">
<rect width="300" height="100" fill="#9fc4e8"/><rect y="60" width="300" height="40" fill="#2f5a3a"/><rect y="56" width="300" height="6" fill="#3f7a4a"/>${[20,70,130,190,250].map(x=>`<rect x="${x}" y="30" width="22" height="34" fill="#264a30"/><rect x="${x+6}" y="18" width="10" height="14" fill="#264a30"/>`).join('')}
<rect y="100" width="300" height="300" fill="#2f5a3a"/><rect y="100" width="300" height="2" fill="#4a8a4a"/>${grass}${fence}
<rect x="0" y="100" width="30" height="300" fill="#8a7a5a"/><rect x="30" y="100" width="2" height="300" fill="#6b5f46"/>
${soil}
<rect x="262" y="92" width="26" height="26" fill="#6b4a2b"/><rect x="266" y="88" width="18" height="6" fill="#8a5f36"/><rect x="270" y="100" width="10" height="10" fill="#4f9fd1"/>
${mageSvg(ui.mage)}
</svg>`;
    }
    function mix(a,b,t){const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const [x,y]=[p(a),p(b)];return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}

    /* Rendering */
    const PLOTS=[[24,36],[52,36],[80,36],[24,58],[52,58],[80,58],[24,80],[52,80],[80,80]];
    const MAGE_HOME=[2,250];
    const plotPixel=i=>[PLOTS[i][0]*3-52,PLOTS[i][1]*4-6];
    function effectChips(){
        A.expire(state,now());const list=A.activeEffects(state,now());
        return list.length?list.map(e=>`<span class="effect-chip ${e.cycle?'cycle':''}" data-effect="${e.stat}" title="${e.cycle?'Locked into cycles started while active':'Counts in real time'}">${domainIcon[A.effects[e.stat].domain]} <b>${signed(e.value,e.unit)}</b> ${e.name} <small>${fmtTime(e.remaining)}</small></span>`).join(''):'<span class="none">No potion active · drink from the shelf</span>';
    }
    function hud(){
        return `<header class="hud"><div class="hud-top">${cauldronSvg('#b58cff',true).replace('class="cauldron-art','style="width:42px;height:42px" class="hud-site cauldron-art')}<div><small>ALCHEMY · ${({garden:'GARDEN',brewing:'BREWING',book:'FORMULA BOOK',shelf:'POTION SHELF',tree:'SKILL TREE'})[ui.view]}</small><h1>${({garden:'Herb garden',brewing:'Cauldrons',book:'Formula book',shelf:'Potion shelf',tree:'Alchemy branch'})[ui.view]}</h1></div><span class="boss-chip">⚔ Boss wins <b>${state.bossWins}</b></span></div><div class="chips" id="effects">${effectChips()}</div></header>`;
    }
    function render(){
        if(!A.open(state)){phone.innerHTML=`${hud()}<section class="page"><div class="empty" style="padding-top:60px">Alchemy opens after the second realm (boss win ${A.ALCHEMY_BOSS_WINS}).<br>Boss wins so far: ${state.bossWins}.</div></section>${tabs()}`;renderState();return;}
        const view={garden:gardenView,brewing:brewingView,book:bookView,shelf:shelfView,tree:treeView}[ui.view]();
        phone.innerHTML=`${hud()}<section class="page">${view}</section>${tabs()}${sheetMarkup()}`;
        renderState();
        document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.scene===ui.scene)));
        document.querySelector('#scene-label').textContent=sceneLabels[ui.scene];
    }
    function tabs(){
        const t=now(),ready=state.plots.some(p=>p&&A.growth(state,p,t).phase!=='growing'),brewed=state.cauldrons.some(c=>c&&A.cauldronDone(c,t)),doses=Object.values(state.potions).some(n=>n>0),buyable=A.nodes.some(n=>A.quote(state,'buy',n.id).ok);
        return `<nav class="tabs" aria-label="Alchemy sections">${[['garden','🌱','Garden',ready],['brewing','⚗','Brewing',brewed],['book','📖','Book',false],['shelf','🧪','Potions',doses],['tree','✶','Tree',buyable]].map(([v,g,l,dot])=>`<button data-view="${v}" ${ui.view===v?'aria-current="page"':''}><span class="${dot?'dot':''}">${g}</span>${l}</button>`).join('')}</nav>`;
    }
    function renderState(){
        const t=now();
        document.querySelector('#state').textContent=JSON.stringify({scene:ui.scene,view:ui.view,bossWins:state.bossWins,unlockedSeeds:A.unlockedPlants(state).map(p=>p.id),plots:state.plots.map((p,i)=>{if(!p)return {plot:i,empty:true};const g=A.growth(state,p,t);return {plot:i,plant:p.plant,phase:g.phase,fraction:Math.round(g.rawFraction*1000)/1000,yield:g.yield,toWindow:Math.round(g.toWindow)};}),cauldrons:state.cauldrons.map((c,i)=>c?{cauldron:i,formula:c.formula,remaining:Math.round(A.cauldronRemaining(c,t))}:{cauldron:i,empty:true}),found:Object.keys(state.found),ingredients:Object.fromEntries(Object.entries(state.ingredients).filter(([,n])=>n>0)),potions:state.potions,effects:A.activeEffects(state,t).map(e=>({stat:e.stat,value:e.value,remaining:Math.round(e.remaining)})),book:Object.keys(state.book),nodes:Object.keys(state.nodes),fish:Object.fromEntries(Object.entries(state.fish).filter(([,n])=>n>0)),lastReceipt:state.receipts.at(-1)||null},null,2);
    }
    function plotLabel(g,p){
        if(!p)return {cls:'empty',text:'Plant'};
        if(g.phase==='growing')return {cls:'',text:g.toWindow>0?fmtTime(g.toWindow):'…'};
        if(g.phase==='window')return {cls:'ready',text:`Harvest ${g.yield} · ${fmtTime(g.windowRemaining)}`};
        return {cls:'late',text:`Harvest ${g.yield} · late`};
    }
    function gardenView(){
        const t=now(),count=A.plotCount(state);
        const plots=PLOTS.map(([x,y],i)=>{
            if(i>=count)return `<div class="plot locked" style="left:${x}%;top:${y}%" aria-label="Plot ${i+1} locked"><span class="ring">${ringSvg(A.plants[0],null,state)}</span><span class="label empty">Skill tree</span></div>`;
            const plot=state.plots[i],p=plot?A.plant(plot.plant):null,g=plot?A.growth(state,plot,t):null,l=plotLabel(g,plot);
            return `<button class="plot ${plot?g.phase:'empty'}" data-plot="${i}" style="left:${x}%;top:${y}%" aria-label="${plot?`${p.name}, ${g.phase==='growing'?fmtTime(g.toWindow)+' to the window':g.phase==='window'?'harvest window open':'late harvest'}`:`Empty plot ${i+1}`}"><span class="ring">${ringSvg(p||A.plants[0],g,state)}</span><span class="label ${l.cls}">${l.text}</span></button>`;
        }).join('');
        const unlocked=A.unlockedPlants(state).length,next=A.nextSeed(state);
        return `<div class="garden" id="garden">${gardenSvg()}${plots}</div>
        <div class="legend"><span><i style="background:#5f9a5f"></i>Harvest window ${Math.round(A.windowFraction(state)*100)} % of the growth time</span><span><i style="background:#e0a84a"></i>Late: yield falls to ${A.HARVEST_MIN} over ${A.decaySpan(state)}× the growth time</span></div>
        <p class="note"><b>${unlocked}</b> seed type${unlocked===1?'':'s'} unlocked; an unlocked type never runs out. ${next?`Next seed type <b>${next.name}</b> arrives at boss win ${next.unlockWin}.`:'Every seed type is unlocked.'} Perfect timing pays ${A.HARVEST_MAX}.</p>`;
    }
    function brewingView(){
        const t=now();
        const rows=state.cauldrons.map((c,i)=>{
            if(!c)return `<div class="card"><div class="row">${cauldronSvg('#3a475f',false)}<div class="grow"><b>Cauldron ${i+1}</b><small>Empty · two ingredients, one formula</small></div><button class="btn primary" data-brew="${i}">Brew</button></div></div>`;
            const f=A.formulaById(c.formula),done=A.cauldronDone(c,t),known=state.book[f.id],p=Math.min(1,(t-c.startedAt)/f.brewSeconds);
            return `<div class="card"><div class="row">${cauldronSvg(known?formulaColor(f):'#6f7b94',!done)}<div class="grow"><b>${known?f.name:'Unknown brew'}</b><small>${A.plant(f.a).name} + ${A.plant(f.b).name} · ${fmtTime(f.brewSeconds)} · level ${f.level}</small><div class="progress"><i style="width:${p*100}%"></i></div><span class="timer ${done?'ready':''}" data-cauldron-timer="${i}">${done?'Ready · 2 doses':fmtTime(A.cauldronRemaining(c,t))+' left'}</span></div><button class="btn ${done?'good':'ghost'}" data-collect="${i}" ${done?'':'disabled'}>${done?'Collect':'Brewing'}</button></div></div>`;
        }).join('');
        const owned=A.plants.filter(p=>state.ingredients[p.id]>0);
        return `<h2>Cauldrons <small>${A.cauldronCount(state)} of ${A.CAULDRONS_MAX} · ${A.DOSES} doses per brew</small></h2>${rows}
        <h2 style="margin-top:12px">Ingredients <small>${owned.reduce((a,p)=>a+state.ingredients[p.id],0)} in stock</small></h2>${owned.length?`<div class="ingredient-grid">${owned.map(p=>`<button disabled style="${elementVar(p)};opacity:1"><b>${p.name}</b><span class="tag"><i></i>${p.element}</span><span class="tag domain">${domainIcon[p.domain]} ${A.domainNames[p.domain]}</span><small>${state.ingredients[p.id]} in stock</small></button>`).join('')}</div>`:'<div class="empty">Harvest the garden to fill the shelf.</div>'}
        <p class="note">Formulas are secret until brewed. Affinities are the clue: a pure brew shows a plant's signature; two plants of one domain brew both signatures; two of one element brew a cross effect; the rest is murky, except a few specials.</p>`;
    }
    function bookView(){
        const known=A.formulas.filter(f=>state.book[f.id]);
        const line=f=>`<div class="bookline"><span>${potionSvg(formulaColor(f))}</span><div><b>${f.name}</b><br><small style="color:#9aa7bd">${A.plant(f.a).name}${f.a===f.b?' ×2':' + '+A.plant(f.b).name} · ${fmtTime(f.brewSeconds)} · ${f.kind}</small></div><span class="fx">${f.effects.map(e=>signed(A.effects[e.stat].perLevel*e.level,A.effects[e.stat].unit)+' '+A.effects[e.stat].name).join('<br>')}</span></div>`;
        return `<h2>Formula book <small>${known.length} of ${A.formulas.length} discovered</small></h2>${known.length?known.map(line).join(''):'<div class="empty">Nothing discovered yet. Brew two ingredients and the formula writes itself in here.</div>'}
        <h2 style="margin-top:14px">Affinities</h2><div class="card">${A.domains.map(d=>`<div class="bookline"><span>${domainIcon[d]}</span><div><b>${A.domainNames[d]}</b><br><small style="color:#9aa7bd">${A.plants.filter(p=>p.domain===d).map(p=>`<span class="tag" style="${elementVar(p)}"><i></i>${p.name}</span>`).join(' ')}</small></div><span></span></div>`).join('')}</div>
        <p class="note">${A.formulas.length - known.length} formulas remain. Pure brews (one plant twice) are the safest way to learn a plant.</p>`;
    }
    function shelfView(){
        const t=now(),list=Object.entries(state.potions).filter(([fid,n])=>n>0&&A.formulaById(fid)).map(([fid,n])=>({f:A.formulaById(fid),n})).sort((a,b)=>b.f.level-a.f.level);
        const active=A.activeEffects(state,t);
        return `<h2>Potion shelf <small>${list.reduce((a,x)=>a+x.n,0)} doses · ${fmtTime(A.potionSeconds(state))} each, up to ×${A.STACK_CAP}</small></h2>${list.length?list.map(({f,n})=>`<div class="card"><div class="row">${potionSvg(formulaColor(f))}<div class="grow"><b>${f.name}</b> <small style="display:inline">level ${f.level} · ${n} dose${n>1?'s':''}</small><small>${f.effects.map(e=>signed(A.effects[e.stat].perLevel*e.level,A.effects[e.stat].unit)+' '+A.effects[e.stat].name).join(' · ')}</small></div><button class="btn good" data-drink="${f.id}">Drink</button></div></div>`).join(''):'<div class="empty">No potions yet. Collect a finished cauldron.</div>'}
        <h2 style="margin-top:12px">Active now</h2>${active.length?active.map(e=>`<div class="card"><div class="row"><span>${domainIcon[A.effects[e.stat].domain]}</span><div class="grow"><b>${signed(e.value,e.unit)} ${e.name}</b><small>${e.cycle?'locked into cycles you start while it lasts':'counts in real time, also in absence'} · <span data-effect-timer="${e.stat}">${fmtTime(e.remaining)}</span> left</small></div></div></div>`).join(''):'<div class="empty">Nothing active. Effects apply in boss fights, practice, idle and ranked events, never in dungeons.</div>'}`;
    }
    function treeView(){
        const fishChips=A.fishNames.map(fid=>`<span class="effect-chip" style="background:#111a2c;border-color:var(--line);color:#c6cfe0">${fishIcon(fid)} <b>${fmt(state.fish[fid])}</b></span>`).join('');
        const nodes=A.nodes.map(n=>{
            const owned=A.bought(state,n.id),q=A.quote(state,'buy',n.id),missing=A.nodeLocked(state,n);
            const cost=Object.entries(n.cost).map(([fid,k])=>`<span class="${state.fish[fid]>=k?'':'poor'}">${fishIcon(fid)}${fmt(k)}</span>`).join('');
            return `<div class="card node ${owned?'owned':q.ok?'open':''} ${!owned&&missing?'locked':''}"><span class="pip"></span><div class="row"><div class="grow"><b>${n.name}</b><small>${n.text}</small>${owned?'<div class="where">Unlocked</div>':`<div class="cost">${cost}</div><div class="where">${missing?`Needs ${A.node(missing).name}`:'Paid in fish, like every branch'}</div>`}</div>${owned?'<span class="tag" style="--element:#b9f0a6">✓</span>':`<button class="btn ${q.ok?'good':'ghost'}" data-buy="${n.id}" ${q.ok?'':'disabled'} aria-label="Unlock ${n.name}">Unlock</button>`}</div></div>`;
        }).join('');
        return `<h2>Alchemy branch <small>${Object.keys(state.nodes).length} of ${A.nodes.length} unlocked</small></h2><div class="chips" style="margin-top:0">${fishChips}</div><p class="note">The fifth branch of the skill tree: plots ${A.PLOTS_START} → ${A.PLOTS_MAX}, cauldrons ${A.CAULDRONS_START} → ${A.CAULDRONS_MAX}, potion time, Greenhouse and Preserve. Binary nodes, no power.</p>${nodes}`;
    }
    function sheetMarkup(){
        const sh=ui.sheet;if(!sh)return '';
        let body='',title='';const t=now();
        if(sh.type==='plant'){
            title=`Plant in plot ${sh.plot+1}`;
            const options=A.plants.filter(p=>A.seedUnlocked(state,p.id)).map(p=>`<button data-seed="${p.id}" data-plot="${sh.plot}" style="${elementVar(p)}"><b>${p.name}</b><span class="tag"><i></i>${p.element} · ${domainIcon[p.domain]} ${A.domainNames[p.domain]}</span><small>${fmtTime(p.growth)} · tier ${p.tier}</small></button>`).join('');
            body=`<div class="ingredient-grid">${options}</div><p class="note">The window opens at 100 % and lasts ${Math.round(A.windowFraction(state)*100)} % of the growth time. You cannot harvest early.</p>`;
        }else if(sh.type==='plot'){
            const plot=state.plots[sh.plot],p=A.plant(plot.plant),g=A.growth(state,plot,t);title=`${p.name}`;
            body=`<div class="kv"><span>Affinity</span><b><span class="tag" style="${elementVar(p)}"><i></i>${p.element}</span> · ${domainIcon[p.domain]} ${A.domainNames[p.domain]}</b><span>Growth</span><b>${fmtTime(p.growth)} · tier ${p.tier}</b><span>Window opens in</span><b>${fmtTime(g.toWindow)}</b><span>Window lasts</span><b>${fmtTime(p.growth*A.windowFraction(state))}</b><span>Perfect yield</span><b>${A.HARVEST_MAX} ${p.name}</b></div><p class="note">The plant grows on the wall clock. Nothing replants it; come back for the window or accept a smaller late harvest.</p>`;
        }else if(sh.type==='brew'){
            const i=sh.cauldron,pick=sh.pick,owned=A.plants.filter(p=>state.ingredients[p.id]>0);title=`Cauldron ${i+1}`;
            const slot=(pid,k)=>{if(!pid)return `<div class="slot">Ingredient ${k}</div>`;const p=A.plant(pid);return `<div class="slot filled" style="${elementVar(p)}"><b>${p.name}</b><span class="tag"><i></i>${p.element} · ${domainIcon[p.domain]} ${A.domainNames[p.domain]}</span></div>`;};
            const complete=pick.length===2,f=complete?A.formula(pick[0],pick[1]):null,known=f&&state.book[f.id];
            const canBrew=complete&&A.quote(state,'brew',{cauldron:i,a:pick[0],b:pick[1]},t).ok;
            body=`<div class="pair">${slot(pick[0],1)}<span class="arrow">+</span>${slot(pick[1],2)}</div>
            <div class="ingredient-grid">${owned.map(p=>{const used=pick.filter(x=>x===p.id).length;return `<button data-pick="${p.id}" style="${elementVar(p)}" aria-pressed="${used>0}" ${state.ingredients[p.id]<=used&&!used?'disabled':''}><b>${p.name}</b><span class="tag"><i></i>${p.element} · ${domainIcon[p.domain]} ${A.domainNames[p.domain]}</span><small>${state.ingredients[p.id]-used} left</small></button>`;}).join('')}</div>
            ${complete?`<div class="card"><div class="row">${potionSvg(known?formulaColor(f):'#6f7b94')}<div class="grow"><b>${known?f.name:'Unknown formula'}</b><small>${fmtTime(f.brewSeconds)} · level ${f.level}${known?' · '+f.effects.map(e=>signed(A.effects[e.stat].perLevel*e.level,A.effects[e.stat].unit)+' '+A.effects[e.stat].name).join(', '):' · the effect shows when it is done'}</small></div></div></div>`:'<p class="note">Pick two ingredients. The same plant twice is a pure brew.</p>'}
            <button class="btn primary wide" data-start-brew="${i}" ${canBrew?'':'disabled'}>${complete?`Brew · ${fmtTime(f.brewSeconds)}`:'Brew'}</button>`;
        }else if(sh.type==='result'){
            const f=A.formulaById(sh.formula);title=sh.discovered?'New formula!':'Brew collected';
            body=`<div class="return-hero">${potionSvg(formulaColor(f),'potion-icon').replace('potion-icon','potion-icon" style="width:44px;height:60px')}<div class="return-time">${f.name}</div><small style="color:#9aa7bd">${A.plant(f.a).name}${f.a===f.b?' ×2':' + '+A.plant(f.b).name} · level ${f.level} · ${f.kind}</small></div><div class="card"><div class="kv">${f.effects.map(e=>`<span>${A.effects[e.stat].name}</span><b>${signed(A.effects[e.stat].perLevel*e.level,A.effects[e.stat].unit)} for ${fmtTime(A.potionSeconds(state))}</b>`).join('')}<span>Doses</span><b>+${sh.doses} (${state.potions[f.id]} on the shelf)</b></div></div><button class="btn primary wide" data-action="close">Done · on the potion shelf</button>`;
        }else if(sh.type==='return'){
            const s=sh.summary;title='Welcome back';
            const plots=s.plots.map(p=>`<div class="card"><div class="row"><span class="tag" style="${elementVar(p.plant)}"><i></i></span><div class="grow"><b>${p.plant.name}</b><small>Plot ${p.index+1} · ${p.phase==='growing'?fmtTime(p.toWindow)+' to the window':p.phase==='window'?'in the window now':`late · ${Math.round(p.lost*100)} % of the way down`}</small></div><b class="timer ${p.phase==='window'?'ready':''}">${p.phase==='growing'?'':p.yield+' '+p.plant.name}</b></div></div>`).join('');
            const brews=s.brews.map(b=>`<div class="card ${b.done?'':'locked'}"><div class="row">${potionSvg(state.book[b.formula.id]?formulaColor(b.formula):'#6f7b94')}<div class="grow"><b>${state.book[b.formula.id]?b.formula.name:'Unknown brew'}</b><small>Cauldron ${b.index+1} · ${b.done?'done':fmtTime(b.remaining)+' left'}</small></div></div></div>`).join('');
            const harvestable=s.plots.filter(p=>p.phase!=='growing').length,collectable=s.brews.filter(b=>b.done).length;
            body=`<div class="return-hero"><div class="return-time">${fmt(sh.hours)} h<small>away</small></div><small style="color:#9aa7bd">Plants and brews ran on the wall clock. Nothing was harvested or collected for you.</small></div>${plots}${brews}${harvestable||collectable?`<button class="btn primary wide" data-action="collect-all">Harvest ${harvestable} plot${harvestable===1?'':'s'}${collectable?` and collect ${collectable} brew${collectable===1?'':'s'}`:''}</button>`:'<button class="btn ghost wide" data-action="close">Back to the garden</button>'}`;
        }
        return `<div class="sheet-backdrop" data-action="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/<[^>]+>/g,''))}"><h2>${title}<button class="x" data-action="close" aria-label="Close">×</button></h2>${body}</div></div>`;
    }
    function toast(text){const t=document.createElement('div');t.className='toast';t.textContent=text;phone.append(t);setTimeout(()=>t.remove(),1900);}

    /* Live patching: rings, labels, timers and chips move without re-rendering the whole phone. */
    function frame(fromTimer){
        const t=now();
        const before=Object.keys(state.effects).length;A.expire(state,t);
        if(before!==Object.keys(state.effects).length)render();
        phone.querySelectorAll('.plot[data-plot]').forEach(el=>{
            const i=Number(el.dataset.plot),plot=state.plots[i];if(!plot)return;
            const p=A.plant(plot.plant),g=A.growth(state,plot,t),l=plotLabel(g,plot),label=el.querySelector('.label');
            if(!el.classList.contains(g.phase)){el.className=`plot ${g.phase}`;el.querySelector('.ring').innerHTML=ringSvg(p,g,state);}
            else{const arc=el.querySelector('.arc');if(arc){const r=18,c=2*Math.PI*r,fill=Math.min(1,g.rawFraction/(1+A.windowFraction(state)));arc.setAttribute('stroke-dasharray',`${(fill*c).toFixed(2)} ${c.toFixed(2)}`);}}
            if(label.textContent!==l.text){label.textContent=l.text;label.className='label '+l.cls;}
        });
        phone.querySelectorAll('[data-cauldron-timer]').forEach(el=>{const c=state.cauldrons[el.dataset.cauldronTimer];if(!c)return;const done=A.cauldronDone(c,t);const text=done?'Ready · 2 doses':fmtTime(A.cauldronRemaining(c,t))+' left';if(el.textContent!==text){el.textContent=text;el.classList.toggle('ready',done);if(done)render();}});
        phone.querySelectorAll('.effect-chip[data-effect] small').forEach(el=>{const e=state.effects[el.parentElement.dataset.effect];if(e)el.textContent=fmtTime(e.until-t);});
        phone.querySelectorAll('[data-effect-timer]').forEach(el=>{const e=state.effects[el.dataset.effectTimer];if(e)el.textContent=fmtTime(e.until-t);});
        if(!fromTimer)requestAnimationFrame(()=>frame(false));
    }
    function walkMage(i,then){
        const g=phone.querySelector('.garden-art .mage');if(!g||reduced()){then();return;}
        const [x,y]=plotPixel(i);ui.mageAt=[x-36,y-40];g.style.transform=`translate(${ui.mageAt[0]}px,${ui.mageAt[1]}px)`;
        setTimeout(then,1150);
    }
    function harvest(i){
        const plot=state.plots[i];if(!plot)return;
        const r=command('harvest',{plot:i});if(!r.ok)return;
        const p=A.plant(r.result.plant),el=phone.querySelector(`.plot[data-plot="${i}"]`);
        const finish=()=>{render();const spot=phone.querySelector(`.plot[data-plot="${i}"]`);if(spot&&!reduced()){const f=document.createElement('span');f.className='float'+(r.result.phase==='late'?' late':'');f.textContent=`+${r.result.yield} ${p.name}`;spot.append(f);setTimeout(()=>f.remove(),900);}toast(r.result.phase==='window'?`Perfect harvest: ${r.result.yield} ${p.name}`:`Late harvest: ${r.result.yield} ${p.name}`);};
        if(el)walkMage(i,finish);else finish();
    }
    function collect(i){const r=command('collect',{cauldron:i});if(r.ok){ui.sheet={type:'result',formula:r.result.formula,doses:r.result.doses,discovered:r.result.discovered};}return r;}

    /* Input */
    phone.addEventListener('click',e=>{
        const el=e.target.closest('[data-view],[data-plot],[data-seed],[data-brew],[data-pick],[data-start-brew],[data-collect],[data-drink],[data-buy],[data-action]');if(!el)return;
        if(el.dataset.action==='close'){if(e.target===el||e.target.closest('.x')||el.classList.contains('btn'))ui.sheet=null;else return;}
        else if(el.dataset.view){ui.view=el.dataset.view;}
        else if(el.dataset.plot!==undefined&&el.dataset.seed===undefined){const i=Number(el.dataset.plot),plot=state.plots[i];if(!plot)ui.sheet={type:'plant',plot:i};else{const g=A.growth(state,plot,now());if(g.phase==='growing')ui.sheet={type:'plot',plot:i};else{harvest(i);return;}}}
        else if(el.dataset.seed){const r=command('plant',{plot:Number(el.dataset.plot),plant:el.dataset.seed});if(r.ok){ui.sheet=null;toast(`${A.plant(el.dataset.seed).name} planted`);}}
        else if(el.dataset.brew!==undefined){ui.sheet={type:'brew',cauldron:Number(el.dataset.brew),pick:[]};}
        else if(el.dataset.pick){const pick=ui.sheet.pick,pid=el.dataset.pick;const at=pick.indexOf(pid);if(at>=0&&pick.filter(x=>x===pid).length===1&&state.ingredients[pid]>=2&&pick.length<2)pick.push(pid);else if(at>=0)pick.splice(at,1);else if(pick.length<2)pick.push(pid);else pick.splice(0,2,pick[1],pid);}
        else if(el.dataset.startBrew!==undefined){const [a,b]=ui.sheet.pick;const r=command('brew',{cauldron:Number(el.dataset.startBrew),a,b});if(r.ok){ui.sheet=null;toast(r.result.known?`${A.formulaById(r.result.formula).name} is brewing`:'An unknown formula is brewing');}}
        else if(el.dataset.collect!==undefined){collect(Number(el.dataset.collect));}
        else if(el.dataset.drink){const r=command('drink',el.dataset.drink);if(r.ok){ui.sheet=null;toast(`${A.formulaById(el.dataset.drink).name} · ${r.result.effects.map(x=>signed(A.effects[x.stat].perLevel*x.level,A.effects[x.stat].unit)+' '+A.effects[x.stat].name).join(', ')}`);}}
        else if(el.dataset.buy){const n=A.node(el.dataset.buy);if(command('buy',n.id).ok)toast(`${n.name} unlocked`);}
        else if(el.dataset.action==='collect-all'){const t=now();state.plots.forEach((p,i)=>{if(p&&A.growth(state,p,t).phase!=='growing')command('harvest',{plot:i});});let last=null;state.cauldrons.forEach((c,i)=>{if(c&&A.cauldronDone(c,t)){const r=command('collect',{cauldron:i});if(r.ok)last=r.result;}});ui.sheet=last?{type:'result',formula:last.formula,doses:last.doses,discovered:last.discovered}:null;ui.view='garden';toast('Harvested and collected');}
        render();
    });
    document.addEventListener('click',e=>{
        const demo=e.target.closest('[data-demo]'),scene=e.target.closest('[data-scene]');
        if(scene){load(scene.dataset.scene);return;}
        if(!demo)return;
        const d=demo.dataset.demo;
        if(d==='boss'){state.bossWins++;const p=A.plants.find(x=>x.unlockWin===state.bossWins);if(p){toast(`Boss win ${state.bossWins} · ${p.name} seeds unlocked`);}else toast(`Boss win ${state.bossWins}`);}
        if(d==='find'){const p=A.findSeed(state);toast(p?`Realm find: ${p.name} seeds unlocked early`:'Every seed type is already unlocked');}
        if(d==='fish'){for(const f of A.fishNames)state.fish[f]+=[40,25,12,6,30,15][A.fishNames.indexOf(f)];toast('Fish for the Alchemy branch');}
        if(d==='skip1m'){offset+=60;toast('+1 minute');}if(d==='skip10m'){offset+=600;toast('+10 minutes');}if(d==='skip1h'){offset+=3600;toast('+1 hour');}
        if(d==='skip30h'){offset+=30*3600;ui.sheet={type:'return',hours:30,summary:A.returnSummary(state,now())};}
        if(d==='mage'){ui.mage=ui.mage==='braid'?'short':'braid';toast(ui.mage==='braid'?'Mage with the braid':'Mage with short hair');}
        render();
    });
    document.querySelector('#previous').addEventListener('click',()=>load(scenes[(scenes.indexOf(ui.scene)+scenes.length-1)%scenes.length]));
    document.querySelector('#next').addEventListener('click',()=>load(scenes[(scenes.indexOf(ui.scene)+1)%scenes.length]));

    /* Scenes are deterministic: a fixed epoch, a fixed seed and plants timed relative to the load. */
    function load(scene){
        rng=seeded(11);serial=0;offset=0;startedAt=performance.now();state=A.fresh();
        ui={scene,view:'garden',sheet:null,mage:ui?.mage||'braid',mageAt:[...MAGE_HOME]};
        const t=now();
        const unlock=(...ids)=>{for(const id of ids)state.nodes[id]=true;while(state.plots.length<A.plotCount(state))state.plots.push(null);while(state.cauldrons.length<A.cauldronCount(state))state.cauldrons.push(null);};
        const sow=(plot,plant,elapsed)=>{state.plots[plot]={plant,plantedAt:t-elapsed};};
        const brew=(cauldron,a,b,elapsed)=>{const f=A.formula(a,b);state.cauldrons[cauldron]={formula:f.id,startedAt:t-elapsed,endsAt:t-elapsed+f.brewSeconds};};
        const give=(bag,amounts)=>{for(const [k,v]of Object.entries(amounts))state[bag][k]=(state[bag][k]||0)+v;};
        state.bossWins=A.ALCHEMY_BOSS_WINS;
        
        if(scene==='window'){state.bossWins=10;sow(0,'emberpetal',900+8);sow(1,'glacier-lichen',900-300);sow(2,'mudlotus',200);give('ingredients',{emberpetal:4});}
        if(scene==='late'||scene==='return'){state.bossWins=12;sow(0,'emberpetal',900+45+450);sow(1,'frostbell',3600+180+3600);sow(2,'ironcap',1200);give('ingredients',{emberpetal:3,'glacier-lichen':2});}
        if(scene==='brewing'){state.bossWins=13;unlock('cauldron-2','duration-5');give('ingredients',{emberpetal:6,frostbell:4,'glacier-lichen':5,ironcap:3,mudlotus:4,'foam-reed':2});give('fish',{reedfin:120,mooncarp:60,'glass-eel':20,'star-koi':6,mudskipper:70,'bog-perch':30});
            for(const [a,b]of [['emberpetal','emberpetal'],['glacier-lichen','glacier-lichen'],['mudlotus','mudlotus'],['emberpetal','frostbell'],['emberpetal','coral-pepper']])state.book[A.pairKey(a,b)]=true;
            state.potions={[A.pairKey('emberpetal','emberpetal')]:2,[A.pairKey('mudlotus','mudlotus')]:1,[A.pairKey('emberpetal','coral-pepper')]:1};state.effects={spellDamage:{until:t+140,level:1}};
            brew(0,'glacier-lichen','ironcap',600-200);brew(1,'glacier-lichen','glacier-lichen',400);sow(0,'emberpetal',500);sow(1,'frostbell',3000);ui.view='brewing';}
        if(scene==='return'){unlock('cauldron-2');brew(0,'emberpetal','emberpetal',0);give('ingredients',{emberpetal:-2});offset=30*3600;ui.sheet={type:'return',hours:30,summary:A.returnSummary(state,now())};}
        const url=new URL(location.href);url.searchParams.set('scene',scene);history.replaceState(null,'',url);
        render();
    }
    load(scenes.includes(new URLSearchParams(location.search).get('scene'))?new URLSearchParams(location.search).get('scene'):'start');
    requestAnimationFrame(()=>frame(false));
    setInterval(()=>frame(true),60);
})();
