/* Review-only presentation for the mine loop. Rules live in mine-model.js; this file renders, animates and feeds demo input. */
(()=>{
    const M=MageMine;
    const scenes=['start','built','deep','prestige','return'];
    const sceneLabels={start:'Start · Första veinen',built:'Fem veins · Nya spirits',deep:'Djup 2 · Träd & fusion',prestige:'Legendary · Prestige',return:'Frånvaro · 20 h borta'};
    let state,ui,serial=0,lastTick=performance.now(),rng=seeded(11);
    const phone=document.querySelector('#phone');
    function seeded(seed){return()=>{seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296;};}
    const fmt=n=>Number(n.toFixed(Math.abs(n)>=100?0:1)).toLocaleString('en');
    const perMin=rate=>fmt(rate*60)+'/min';
    const id=()=>'cmd-'+(++serial);
    const command=(action,target,extra)=>{const q=M.quote(state,action,target);const r=M.commit(state,{id:id(),action,target,token:q.token,rng,...extra});if(!r.ok)toast(r.reason||q.reason||'Not possible');return r;};
    const rarityVar=sp=>`--rarity:${M.rarityColors[sp.rarity]}`;
    const stars=sp=>sp.stars?`<span class="stars" aria-label="${sp.stars} prestige stars">${'★'.repeat(sp.stars)}</span>`:'';
    const spiritName=sp=>`${M.kind(sp.kind).name}`;
    const total=prod=>Object.values(prod).reduce((a,b)=>a+b,0);
    const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

    /* Pixel art */
    // Pixel maps keep every edge crisp: r rock, h highlight, d dark side, s floor shadow.
    const ROCK_MAP=['......rrrrr.....','....rrhhrrrr....','...rhhrrrrrrr...','..rrhrrrrrrrrr..','..rrrrrrrrrrrrr.','.rrrrrrrrrrrrrrd','.rrrrrrrrrrrrrdd','rrrrrrrrrrrrrddd','rrrrrrrrrrrrdddd','.dddddddddddddd.','..ssssssssssss..'];
    const ROCK_FILL={r:['#353c4d','#3d455a','#2f3545'],h:'#4d566c',d:'#1f2531',s:'#06090f'};
    const ORE=[[5,2],[9,3],[3,5],[11,6],[7,7],[13,4],[2,7],[8,4]];
    const CRACKS=[[[7,1],[7,2],[8,3],[7,4],[6,5],[7,6],[7,7],[8,8]],[[2,4],[3,5],[4,5],[5,4],[12,3],[11,4],[10,5],[11,6],[12,7],[4,7],[3,8]]];
    const px=(x,y,fill,extra='')=>`<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"${extra}/>`;
    function rockSvg(m,hpFraction){
        let cells='';
        ROCK_MAP.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='.')return;const fill=ch==='r'?ROCK_FILL.r[(x*5+y*3+m.index)%3]:ROCK_FILL[ch];cells+=px(x,y,fill,ch==='s'?' opacity=".55"':'');}));
        const ore=ORE.slice(0,3+Math.floor(m.slot/2)).map(([x,y])=>px(x,y,m.color)+px(x+1,y,m.color)+px(x,y+1,m.color)+px(x+1,y+1,m.color,' opacity=".7"')+`<rect x="${x}" y="${y}" width=".5" height=".5" fill="#fff" opacity=".75"/>`).join('');
        const stage=hpFraction<.33?2:hpFraction<.66?1:0;
        const cracks=CRACKS.slice(0,stage).flat().map(([x,y])=>px(x,y,'#0b0e14')).join('');
        return `<svg class="rock pixel" viewBox="0 0 16 11" shape-rendering="crispEdges" aria-hidden="true">${cells}${ore}${cracks}</svg>`;
    }
    function caveSvg(depth){
        const wall=['#0c1018','#111726','#14192b'][depth],floor=['#1b2233','#1a1f30','#1d1b2e'][depth],teeth=['#0a0d14','#0d1120','#120f1f'][depth];
        let rows='';
        for(let i=0;i<14;i++){const x=i*9+(i%2?3:0),h=4+((i*7)%5);rows+=`<rect x="${x}" y="0" width="4" height="${h}" fill="${teeth}"/><rect x="${x+1}" y="${h}" width="2" height="2" fill="${teeth}"/>`;}
        let pebbles='';
        for(let i=0;i<26;i++){const x=(i*37)%118,y=30+(i*53)%125;pebbles+=`<rect x="${x}" y="${y}" width="${1+(i%2)}" height="1" fill="#2a3246" opacity=".7"/>`;}
        return `<svg class="cave-art pixel" viewBox="0 0 120 160" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true"><rect width="120" height="160" fill="${wall}"/><rect y="26" width="120" height="134" fill="${floor}"/><rect y="26" width="120" height="1" fill="#2a3246"/><rect y="70" width="120" height="1" fill="#232b3d" opacity=".6"/><rect y="115" width="120" height="1" fill="#232b3d" opacity=".6"/><rect width="6" height="160" fill="#0a0d14" opacity=".5"/><rect x="114" width="6" height="160" fill="#0a0d14" opacity=".5"/>${rows}${pebbles}</svg>`;
    }
    const gemSvg=m=>`<svg class="gem pixel" viewBox="0 0 6 6" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="0" width="4" height="1" fill="${m.color}"/><rect x="0" y="1" width="6" height="2" fill="${m.color}"/><rect x="1" y="3" width="4" height="1" fill="${m.color}" opacity=".8"/><rect x="2" y="4" width="2" height="1" fill="${m.color}" opacity=".6"/><rect x="2" y="5" width="1" height="1" fill="${m.color}" opacity=".4"/><rect x="1" y="1" width="1" height="1" fill="#fff" opacity=".7"/></svg>`;
    const pickSvg=`<svg class="pick pixel" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${[[1,10],[2,9],[3,8],[4,7],[5,6],[6,5]].map(([x,y])=>px(x,y,y>7?'#6b4a2b':'#8a5f36')).join('')}${px(7,4,'#6b4a2b')}${[[5,3],[6,2],[7,2],[8,2],[9,2],[10,3],[10,4],[4,4],[9,1],[8,1]].map(([x,y])=>px(x,y,'#c7d1df')).join('')}${px(7,1,'#eef3f9')}${px(10,5,'#8392a8')}${px(3,5,'#8392a8')}</svg>`;
    const spiritImg=sp=>`<img class="pixel" src="assets/${M.kind(sp.kind).art}.png" alt="">`;

    /* Rendering */
    function render(){
        const depth=M.depths[ui.depth];
        const chips=M.materials.filter(m=>m.depth===ui.depth).map(m=>{const built=state.veins[m.index].built;return `<span class="mat ${built?'':'locked'}" data-mat="${m.id}" title="${m.name}">${gemSvg(m)}<span>${m.name}</span><b>${fmt(state.stock[m.id])}</b></span>`;}).join('');
        const view={mine:mineView,spirits:spiritsView,tree:treeView,forge:forgeView}[ui.view]();
        const pairs=M.fusionUnlocked(state)&&M.fusionPairs(state).length;
        phone.innerHTML=`<header class="hud"><div class="hud-top"><img class="hud-site pixel" src="assets/site-mine.png" alt=""><div><small>THE MINE</small><h1>${depth.name}</h1></div><span class="boss-chip">⚔ Boss wins <b>${state.bossWins}</b></span></div><div class="materials">${chips}</div></header>
        <section class="page">${view}</section>
        <nav class="tabs" aria-label="Mine sections">${[['mine','⛏','Mine'],['spirits','✧','Spirits'],['tree','▲','Upgrades'],['forge','⚗','Forge']].map(([v,g,l])=>`<button data-view="${v}" ${ui.view===v?'aria-current="page"':''}><span class="${v==='forge'&&pairs?'dot':''}">${g}</span>${l}</button>`).join('')}</nav>
        ${sheetMarkup()}`;
        document.querySelector('#state').textContent=JSON.stringify({scene:ui.scene,view:ui.view,depth:ui.depth,bossWins:state.bossWins,veins:state.veins.filter(v=>v.built).map(v=>({material:M.material(v.index).id,hp:Math.round(v.hp*10)/10,spirit:M.assigned(state,v.index)?.id||null})),stock:Object.fromEntries(Object.entries(state.stock).filter(([,n])=>n>0).map(([k,n])=>[k,Math.round(n*10)/10])),production:Object.fromEntries(Object.entries(M.production(state)).map(([k,r])=>[k,perMin(r)])),spirits:state.spirits,tree:state.tree,fusionUnlocked:M.fusionUnlocked(state),lastReceipt:state.receipts.at(-1)||null},null,2);
        document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.scene===ui.scene)));
        document.querySelector('#scene-label').textContent=sceneLabels[ui.scene];
    }
    // Nine floor spots per depth: three rows receding into the cave, the front row drawn largest.
    const SPOTS=[[18,31,.82],[50,28,.82],[82,31,.82],[16,61,.95],[50,59,.95],[84,61,.95],[18,94,1.1],[50,92,1.1],[82,94,1.1]];
    const spotStyle=slot=>{const [x,y,s]=SPOTS[slot];return `left:${x}%;top:${y}%;--scale:${s};z-index:${slot+1}`;};
    function veinSpot(i){
        const v=state.veins[i],m=M.material(i),sp=M.assigned(state,i),style=spotStyle(m.slot);
        if(v.built){
            const st=M.stats(state,i);
            return `<button class="spot ${sp?'':'empty'}" data-vein="${i}" style="${style};${sp?rarityVar(sp):''}" aria-label="${m.name} vein${sp?', '+spiritName(sp):', no spirit'}"><span class="tag"><b style="color:${m.color}">${m.name}</b>${sp?`<i>${perMin(st.rate)}</i>`:''}</span>${rockSvg(m,v.hp/m.hp)}${sp?`<span class="spirit">${spiritImg(sp)}</span>${pickSvg}<span class="fx"></span>`:`<span class="sign">Assign a spirit</span>`}<span class="hpbar"><i style="width:${v.hp/m.hp*100}%;background:${m.color}"></i></span></button>`;
        }
        const next=M.nextVein(state);
        if(next&&next.index===i){
            const q=M.quote(state,'build',i),cost=M.veinCost(i),costText=Object.entries(cost).map(([id,n])=>`${fmt(n)} ${M.materials.find(x=>x.id===id).name}`).join(' + ');
            if(i<=state.bossWins)return `<button class="spot next ${q.ok?'':'poor'}" data-build="${i}" style="${style}" aria-label="Build ${m.name} vein for ${costText}"><span class="tag"><b style="color:${m.color}">${m.name}</b></span>${rockSvg(m,1)}<span class="sign">⛏ Build · ${costText}</span></button>`;
            return `<div class="spot locked" style="${style}" aria-label="${m.name} vein unlocks at boss win ${i}">${rockSvg(m,1)}<span class="sign">⚔ Boss win ${i}</span></div>`;
        }
        return `<div class="spot locked faint" style="${style}" aria-label="${m.name} vein, locked">${rockSvg(m,1)}</div>`;
    }
    function mineView(){
        const tabs=M.depths.map((d,i)=>{const open=M.depthOpen(state,i);return `<button role="tab" aria-selected="${ui.depth===i}" class="${open?'':'locked'}" data-depth="${i}" ${open?'':'disabled'}>${open?'':'🔒 '}Depth ${i+1}</button>`;}).join('');
        const spots=M.materials.filter(m=>m.depth===ui.depth).map(m=>veinSpot(m.index)).join('');
        const next=M.nextVein(state),hint=!next?'Every vein is built.':next.index<=state.bossWins?`Next: build <b>${M.material(next.index).name}</b> (vein ${next.index%9+1} of depth ${M.material(next.index).depth+1}).`:`Next: win boss ${next.index} to open <b>${M.material(next.index).name}</b>${next.index%9===0?' and dig down to depth '+(M.material(next.index).depth+1):''}.`;
        return `<div class="depth-tabs" role="tablist">${tabs}</div><div class="cave">${caveSvg(ui.depth)}${spots}</div><p class="note">${hint}</p>`;
    }
    function spiritCard(sp,actions){
        const vein=sp.vein===null?'Unassigned':`Vein · ${M.material(sp.vein).name}`;
        return `<div class="card" style="${rarityVar(sp)}"><div class="row"><span class="spirit-face">${spiritImg(sp)}${sp.stars?`<span class="star-badge">★${sp.stars}</span>`:''}</span><div class="grow"><div class="row"><b>${spiritName(sp)}</b><span class="rarity">${M.rarities[sp.rarity].toUpperCase()}</span>${stars(sp)}</div><small>${vein}</small><div class="statline"><span>Power <b>+${fmt(sp.bonus)}%</b></span>${Object.entries(sp.extras).map(([k,v])=>`<span>${M.extraLabels[k]} <b>+${fmt(v)}%</b></span>`).join('')}</div></div>${actions||''}</div></div>`;
    }
    function spiritsView(){
        const list=[...state.spirits].sort((a,b)=>b.rarity-a.rarity||b.stars-a.stars||b.bonus-a.bonus);
        return `<h2>Spirits <small>${state.spirits.length} owned · ${state.spirits.filter(s=>s.vein!==null).length} working</small></h2>${list.map(sp=>spiritCard(sp,`<button class="btn ghost" data-place="${sp.id}">${sp.vein===null?'Place':'Move'}</button>`)).join('')}<p class="note">Spirits drop from idle and bosses. One spirit works one vein; unassigned spirits add nothing.</p>`;
    }
    function treeView(){
        return `<h2>Upgrades <small>cap ${M.TREE_CAP} · tier opens at ${M.TREE_GATE}</small></h2>`+M.tree.map((tier,t)=>{
            const gate=t>0&&tier.some(()=>M.tree[t-1].some(p=>state.tree[p.id]<M.TREE_GATE)),depthGate=!M.depthOpen(state,t);
            const why=gate?`Raise every tier ${t} upgrade to ${M.TREE_GATE}`:depthGate?`Dig down to ${M.depths[t].name}`:`Costs ${M.depths[t].name} materials`;
            return `<section class="tier ${gate||depthGate?'locked':''}"><h3>TIER ${t+1}<span>${why}</span></h3>${tier.map(u=>{
                const level=state.tree[u.id],q=M.quote(state,'upgrade',u.id),cost=level<M.TREE_CAP?M.upgradeCost(u.id,level):null;
                const costText=cost?Object.entries(cost).map(([id,n])=>`${gemSvg(M.materials.find(x=>x.id===id))} ${fmt(n)} ${M.materials.find(x=>x.id===id).name}`).join(''):'MAX';
                return `<div class="card"><div class="row"><div class="grow"><div class="row"><b>${u.name}</b><small>${u.unit} per level</small></div><div class="level"><i style="width:${level/M.TREE_CAP*100}%"></i></div><div class="row"><small>Level ${level} / ${M.TREE_CAP}</small><span class="cost ${q.ok||!cost?'':'poor'}">${costText}</span></div></div><button class="btn ${q.ok?'good':'ghost'}" data-upgrade="${u.id}" ${q.ok?'':'disabled'} aria-label="Upgrade ${u.name}">+1</button></div></div>`;
            }).join('')}</section>`;
        }).join('');
    }
    function forgeView(){
        if(!M.fusionUnlocked(state))return `<h2>Spirit Forge</h2><div class="empty">The forge opens after boss win ${M.FUSION_BOSS_WINS} (first realm milestone).<br>Boss wins so far: ${state.bossWins}.</div>`;
        const selected=ui.fuse.map(id=>M.spirit(state,id)).filter(Boolean);
        const candidates=[...state.spirits].filter(sp=>sp.rarity<M.rarities.length-1).sort((a,b)=>b.rarity-a.rarity||b.stars-a.stars||b.bonus-a.bonus);
        const chips=candidates.map(sp=>{const compatible=!selected[0]||selected[0].id===sp.id||(selected[0].rarity===sp.rarity&&selected[0].stars===sp.stars);return `<button class="chip" style="${rarityVar(sp)}" data-fuse="${sp.id}" aria-pressed="${ui.fuse.includes(sp.id)}" ${compatible?'':'disabled'}>${spiritName(sp)} · <span class="rarity">${M.rarities[sp.rarity]}</span>${sp.stars?' ★'+sp.stars:''} · +${fmt(sp.bonus)}%</button>`;}).join('');
        let preview='';
        if(selected.length===2){
            const p=M.fusionPreview(state,selected[0].id,selected[1].id);
            preview=p.ok?`<div class="card" style="--rarity:${M.rarityColors[p.rarity]}"><div class="pair"><div><span class="rarity">${M.rarities[selected[0].rarity].toUpperCase()}</span><br>+${fmt(selected[0].bonus)}% · +${fmt(selected[1].bonus)}%</div><span class="arrow">→</span><div><span class="rarity">${M.rarities[p.rarity].toUpperCase()}</span>${p.stars?' ★'+p.stars:''}<br><b>+${fmt(p.bonus)}% power</b></div></div><div class="statline">${Object.entries(p.extras).map(([k,v])=>`<span>${M.extraLabels[k]} <b>+${fmt(v)}%</b></span>`).join('')}${p.newStat?`<span>New: ${M.extraLabels[p.newStat]} <b>+${p.newBand[0]}–${p.newBand[1]}%</b> rolled</span>`:''}</div><p class="note">Both spirits are consumed. The result keeps ${selected[0].vein!==null?'the vein of the first spirit':'no vein'}.</p><button class="btn primary wide" data-action="fuse">Fuse spirits</button></div>`:`<p class="note">${p.reason}</p>`;
        }
        const legendaries=state.spirits.filter(sp=>sp.rarity===M.rarities.length-1);
        return `<h2>Spirit Forge <small>same rarity and stars</small></h2><div class="pick-list">${chips||'<span class="empty">No spirits to fuse yet.</span>'}</div>${preview}<h2 style="margin-top:14px">Prestige <small>Legendary → Common ★</small></h2>${legendaries.length?legendaries.map(sp=>spiritCard(sp,`<button class="btn ${sp.stars<M.MAX_STARS?'primary':'ghost'}" data-prestige="${sp.id}" ${sp.stars<M.MAX_STARS?'':'disabled'}>${sp.stars<M.MAX_STARS?'Prestige':'5★ max'}</button>`)).join(''):'<div class="empty">Fuse a spirit up to Legendary to prestige it. Every stat is kept and a star is added.</div>'}`;
    }
    function sheetMarkup(){
        const sh=ui.sheet;if(!sh)return '';
        let body='',title='';
        if(sh.type==='vein'){
            const i=sh.index,m=M.material(i),v=state.veins[i],sp=M.assigned(state,i),st=M.stats(state,i);
            title=`${gemSvg(m)} ${m.name} vein`;
            body=`<div class="kv"><span>Vein HP</span><b>${fmt(v.hp)} / ${m.hp}</b><span>Yield per break</span><b>${m.yield} × ${fmt(st.yieldMultiplier||1)}</b>${sp?`<span>Spirit</span><b>${spiritName(sp)} · ${M.rarities[sp.rarity]}${sp.stars?' ★'+sp.stars:''}</b><span>Mining power</span><b>${fmt(st.power)} per swing</b><span>Swing every</span><b>${fmt(st.interval)} s</b><span>Crit</span><b>${fmt(st.critChance*100)}% · ×${fmt(1+st.critDamage)}</b><span>Expected</span><b>${perMin(st.rate)}</b>`:''}</div><div class="row"><button class="btn primary grow" data-assign-to="${i}">${sp?'Swap spirit':'Assign spirit'}</button>${sp?`<button class="btn ghost" data-unassign="${sp.id}">Remove</button>`:''}</div>`;
        }else if(sh.type==='assign'){
            const i=sh.vein,m=M.material(i),current=M.assigned(state,i);
            title=`Choose a spirit for ${m.name}`;
            const rows=[...state.spirits].filter(sp=>sp.id!==current?.id).map(sp=>{const p=M.assignPreview(state,sp.id,i);const d=total(p.after)-total(p.before);return {sp,d,p};}).sort((a,b)=>b.d-a.d);
            body=rows.length?rows.map(({sp,d,p})=>spiritCard(sp,`<div style="text-align:right"><span class="delta ${d>0?'up':d<0?'down':'flat'}">${d>=0?'+':''}${fmt(d*60)}/min</span><br><button class="btn good" data-assign="${sp.id}" data-vein="${i}">${p.displaced?sp.vein===null?'Replace':'Swap':'Place'}</button>${p.displaced?`<br><small>${sp.vein===null?spiritName(M.spirit(state,p.displaced))+' goes idle':'swaps with '+spiritName(M.spirit(state,p.displaced))}</small>`:''}</div>`)).join(''):'<div class="empty">No other spirits. Win bosses and farm idle to find more.</div>';
        }else if(sh.type==='place'){
            const sp=M.spirit(state,sh.spirit);title=`Place ${spiritName(sp)}`;
            const rows=state.veins.filter(v=>v.built&&v.index!==sp.vein).map(v=>{const p=M.assignPreview(state,sp.id,v.index);const d=total(p.after)-total(p.before);const m=M.material(v.index),occ=M.assigned(state,v.index);return `<div class="card"><div class="row">${gemSvg(m)}<div class="grow"><b>${m.name}</b><small>Depth ${m.depth+1} · ${occ?'now '+spiritName(occ)+' · '+perMin(M.stats(state,v.index).rate):'empty'}</small></div><span class="delta ${d>0?'up':d<0?'down':'flat'}">${d>=0?'+':''}${fmt(d*60)}/min</span><button class="btn good" data-assign="${sp.id}" data-vein="${v.index}">${occ?'Swap':'Place'}</button></div></div>`;}).join('');
            body=rows||'<div class="empty">Build another vein first.</div>';
        }else if(sh.type==='return'){
            const hours=sh.hours,counted=Math.min(12,hours),amounts=sh.amounts,entries=Object.entries(amounts).filter(([,n])=>n>=.05);
            title='Welcome back';
            body=`<div class="return-hero"><img class="pixel" src="assets/site-mine.png" alt=""><div class="return-time">${fmt(counted)} h<small>/ 12 h</small>${counted===12?' <span class="cap-chip">MAX</span>':''}</div><small style="color:#9aa7bd">${fmt(hours)} h away · expected mining with your current spirits</small></div><div class="reward-grid">${entries.map(([id,n])=>{const m=M.materials.find(x=>x.id===id);return `<div class="reward-tile">${gemSvg(m)}<b>+${fmt(n)}</b><span>${m.name}</span></div>`;}).join('')||'<div class="empty" style="grid-column:1/-1">No spirit was working.</div>'}</div><button class="btn primary wide" data-action="collect">Collect materials</button>`;
        }
        return `<div class="sheet-backdrop" data-action="close"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title.replace(/<[^>]+>/g,''))}"><h2>${title}<button class="x" data-action="close" aria-label="Close">×</button></h2>${body}</div></div>`;
    }
    function toast(text){const t=document.createElement('div');t.className='toast';t.textContent=text;phone.append(t);setTimeout(()=>t.remove(),1900);}

    /* Live loop: light refresh keeps animations alive without re-rendering the whole phone. */
    function tick(now){
        const dt=Math.min(.5,(now-lastTick)/1000);lastTick=now;
        if(!ui.sheet||ui.sheet.type!=='return'){
            const events=M.advance(state,dt,rng);
            for(const e of events)animate(e);
            if(events.length)refreshStock();
        }
        requestAnimationFrame(tick);
    }
    const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
    function burst(fx,className,count,color,spread){for(let n=0;n<count;n++){const i=document.createElement('i');i.className=className;i.style.setProperty('--dx',((rng()-.5)*spread).toFixed(0)+'px');i.style.setProperty('--dy',(className==='shard'?rng()*spread*.6+6:(rng()-.6)*spread).toFixed(0)+'px');i.style.background=n%3===0?'#fff6d6':color;fx.append(i);setTimeout(()=>i.remove(),520);}}
    function flyGem(el,m){
        const chip=phone.querySelector(`.mat[data-mat="${m.id}"]`),rock=el.querySelector('.rock');if(!chip||!rock)return;
        const from=rock.getBoundingClientRect(),to=chip.getBoundingClientRect(),base=phone.getBoundingClientRect();
        const g=document.createElement('span');g.className='fly';g.innerHTML=gemSvg(m);g.style.left=(from.left+from.width/2-base.left)+'px';g.style.top=(from.top+from.height/2-base.top)+'px';phone.append(g);
        requestAnimationFrame(()=>{g.style.transform=`translate(${to.left+to.width/2-(from.left+from.width/2)}px,${to.top+to.height/2-(from.top+from.height/2)}px) scale(.8)`;g.style.opacity='0.2';});
        setTimeout(()=>{g.remove();chip.classList.remove('bump');void chip.offsetWidth;chip.classList.add('bump');},560);
    }
    function animate(e){
        const el=phone.querySelector(`[data-vein="${e.vein}"]`);if(!el)return;
        const v=state.veins[e.vein],m=M.material(e.vein);
        el.classList.remove('hit','crit','broke');void el.offsetWidth;el.classList.add('hit');if(e.crit)el.classList.add('crit');if(e.broke)el.classList.add('broke');
        const bar=el.querySelector('.hpbar i');if(bar)bar.style.width=(v.hp/m.hp*100)+'%';
        const rock=el.querySelector('.rock');if(rock){const next=rockSvg(m,v.hp/m.hp);if(rock.outerHTML.length!==next.length)rock.outerHTML=next;}
        if(reduced())return;
        const fx=el.querySelector('.fx');
        if(fx){burst(fx,'spark',e.crit?7:4,m.color,e.crit?34:22);if(e.broke)burst(fx,'shard',6,ROCK_FILL.r[1],30);}
        const f=document.createElement('span');f.className='float'+(e.broke?' gain':e.crit?' crit':'');f.textContent=e.broke?`+${fmt(e.gained)}`:(e.crit?'✦ ':'')+fmt(e.damage);el.append(f);setTimeout(()=>f.remove(),720);
        if(e.broke)flyGem(el,m);
    }
    function refreshStock(){phone.querySelectorAll('.mat[data-mat]').forEach(el=>{el.querySelector('b').textContent=fmt(state.stock[el.dataset.mat]);});const vein=ui.sheet?.type==='vein'?phone.querySelector('.kv b'):null;if(vein){const i=ui.sheet.index;vein.textContent=`${fmt(state.veins[i].hp)} / ${M.material(i).hp}`;}}

    /* Input */
    phone.addEventListener('click',e=>{
        const el=e.target.closest('[data-view],[data-depth],[data-vein],[data-build],[data-upgrade],[data-place],[data-assign],[data-assign-to],[data-unassign],[data-fuse],[data-prestige],[data-action]');if(!el)return;
        if(el.dataset.action==='close'){if(e.target===el||e.target.closest('.x'))ui.sheet=null;else return;}
        else if(el.dataset.view){ui.view=el.dataset.view;}
        else if(el.dataset.depth){ui.depth=Number(el.dataset.depth);}
        else if(el.dataset.vein&&!el.dataset.assign){ui.sheet={type:'vein',index:Number(el.dataset.vein)};}
        else if(el.dataset.build){const i=Number(el.dataset.build);if(command('build',i).ok){toast(`${M.material(i).name} vein built`);}}
        else if(el.dataset.upgrade){const u=M.upgrade(el.dataset.upgrade);if(command('upgrade',u.id).ok)toast(`${u.name} → level ${state.tree[u.id]}`);}
        else if(el.dataset.place){ui.sheet={type:'place',spirit:el.dataset.place};}
        else if(el.dataset.assignTo){ui.sheet={type:'assign',vein:Number(el.dataset.assignTo)};}
        else if(el.dataset.assign){const r=command('assign',{spirit:el.dataset.assign,vein:Number(el.dataset.vein)});if(r.ok){ui.sheet=null;ui.view='mine';ui.depth=M.material(Number(el.dataset.vein)).depth;toast('Spirit placed');}}
        else if(el.dataset.unassign){if(command('assign',{spirit:el.dataset.unassign,vein:null}).ok){ui.sheet=null;toast('Spirit removed');}}
        else if(el.dataset.fuse){const id=el.dataset.fuse;ui.fuse=ui.fuse.includes(id)?ui.fuse.filter(x=>x!==id):[...ui.fuse,id].slice(-2);}
        else if(el.dataset.action==='fuse'){const r=command('fuse',[...ui.fuse]);if(r.ok){ui.fuse=[];toast(`${M.rarities[r.result.rarity]} ${spiritName(r.result)} · +${fmt(r.result.bonus)}%`);}}
        else if(el.dataset.prestige){const r=command('prestige',el.dataset.prestige);if(r.ok)toast(`Prestige ★${r.result.stars} · stats kept`);}
        else if(el.dataset.action==='collect'){M.credit(state,ui.sheet.amounts);ui.sheet=null;toast('Materials collected');}
        render();
    });
    document.addEventListener('click',e=>{
        const demo=e.target.closest('[data-demo]'),scene=e.target.closest('[data-scene]');
        if(scene){load(scene.dataset.scene);return;}
        if(!demo)return;
        const d=demo.dataset.demo;
        if(d==='boss'){state.bossWins++;toast(`Boss win ${state.bossWins}`);ui.view='mine';const next=M.nextVein(state);if(next)ui.depth=M.material(next.index).depth;}
        if(d==='drop'){const sp=M.drop(state,{id:'drop-'+(++serial),rng});toast(`New spirit: ${M.rarities[sp.rarity]} ${spiritName(sp)} +${fmt(sp.bonus)}%`);ui.view='spirits';}
        if(d==='away1'||d==='away20'){const hours=d==='away1'?1:20;ui.sheet={type:'return',hours,amounts:M.preview(state,hours*3600)};}
        if(d==='materials'){for(const v of state.veins)if(v.built)state.stock[M.material(v.index).id]+=50;toast('+50 of every built material');}
        render();
    });
    document.querySelector('#previous').addEventListener('click',()=>load(scenes[(scenes.indexOf(ui.scene)+scenes.length-1)%scenes.length]));
    document.querySelector('#next').addEventListener('click',()=>load(scenes[(scenes.indexOf(ui.scene)+1)%scenes.length]));

    /* Scenes are deterministic: the same seed builds the same spirits every time. */
    function load(scene){
        rng=seeded(11);serial=0;state=M.fresh();ui={scene,view:'mine',depth:0,sheet:null,fuse:[]};
        const build=upTo=>{state.bossWins=Math.max(state.bossWins,upTo);for(let i=1;i<=upTo;i++){state.stock[M.material(i-1).id]+=400;command('build',i);}};
        const give=(rarity,kindId,vein)=>{const sp=M.drop(state,{id:'spirit-'+(++serial),rng,rarity,kindId});if(vein!==undefined)sp.vein=vein;return sp;};
        if(scene==='built'||scene==='return'){build(5);state.bossWins=5;give(1,'weaver',1);give(2,'echo',2);give(0,'delver',3);give(1,'delver');for(const m of M.materials.slice(0,5))state.stock[m.id]=Math.round(20+rng()*40);}
        if(scene==='deep'||scene==='prestige'){build(12);state.bossWins=12;for(const u of M.tree[0])state.tree[u.id]=5;state.tree.power=8;state.tree.critChance=3;give(2,'weaver',1);give(2,'echo',2);give(1,'delver',4);give(1,'delver',5);give(3,'echo',9);give(0,'weaver',10);give(1,'weaver');give(1,'echo');for(const m of M.materials.slice(0,12))state.stock[m.id]=Math.round(30+rng()*90);ui.view=scene==='deep'?'tree':'forge';}
        if(scene==='prestige'){give(4,'delver',11);const l=give(4,'echo',3);l.stars=2;}
        if(scene==='return'){ui.sheet={type:'return',hours:20,amounts:M.preview(state,20*3600)};}
        const url=new URL(location.href);url.searchParams.set('scene',scene);history.replaceState(null,'',url);
        render();
    }
    load(scenes.includes(new URLSearchParams(location.search).get('scene'))?new URLSearchParams(location.search).get('scene'):'start');
    requestAnimationFrame(tick);
})();
