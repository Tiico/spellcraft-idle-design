/* REVIEW PROTOTYPE boss-mechanics v1 (#374): the phone view of one fight. The model owns every rule; this file draws its state
   each frame and turns its events into the telegraphs and effects that ADR 0015 lists per building block. */
(function(){
    'use strict';
    const B=window.SpellcraftBossMechanics;
    const W=B.ARENA.width,H=B.ARENA.height;
    const scenes=['watcher','warden','knight','knight-phase2'];
    const sceneInfo={
        watcher:{boss:'ember-watcher',label:'Ember Watcher · laddad attack',phase:0},
        warden:{boss:'cinder-warden',label:'Cinder Warden · sköld och faser',phase:0},
        knight:{boss:'ashen-knight',label:'Ashen Knight · flank och pyloner',phase:0},
        'knight-phase2':{boss:'ashen-knight',label:'Ashen Knight · fas 2',phase:1}
    };
    const bossArt={'ember-watcher':['assets/boss-watcher.png',150],'cinder-warden':['assets/boss-warden.png',150],'ashen-knight':['assets/boss-knight.png',104]};
    const spellArt={'flare-javelin':'assets/flare-javelin.png','frost-fang':'assets/frost-fang.png','ember-ring':'assets/ember-ring.png','frostfire-cone':'assets/frostfire-cone.png'};
    const colorOf=spell=>spell.elements.length>1?'#c9a7ff':spell.elements[0]==='ice'?'#8fdcff':'#ff9a4a';
    const wardLook=w=>w.breaksBy.element==='ice'?{color:'#8fdcff',badge:'❄ ICE',hint:'Ice breaks it'}:{color:'#ffd36b',badge:'◎ AREA',hint:'Area spells break it'};
    const params=new URLSearchParams(location.search);
    const phone=document.querySelector('#phone');
    let f,ui={scene:'watcher',tier:1,paused:false,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,target:null,acc:0,last:0,result:null,addNodes:new Map()};

    const pct=(v,of)=>(v/of*100).toFixed(3)+'%';
    const left=x=>pct(x,W),top=y=>pct(H-y,H);
    const svgY=y=>H-y;
    const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
    const clock=ms=>{const s=Math.max(0,Math.ceil((B.TIME_LIMIT_MS-ms)/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};

    function build(){
        const boss=f.boss,[src,width]=bossArt[boss.id];
        phone.innerHTML=`
        <header class="hud">
            <div class="hud-top"><div><small>${boss.realm.toUpperCase()} · NODE ${boss.node} · TIER ${boss.tier}</small><h1>${boss.name}</h1></div><b class="clock" aria-label="Time left"></b></div>
            <div class="boss-bar" role="img" aria-label="Boss HP"><i class="hp"></i><i class="ward-fill"></i><span class="ticks">${boss.phases.map(p=>`<u style="left:${p.atHpBp/100}%"></u>`).join('')}</span><em></em></div>
            <div class="status-row"><span class="pips"${boss.phases.length?'':' hidden'}>${[0,...boss.phases].map((_,i)=>`<i data-pip="${i}"></i>`).join('')}</span><span class="status"></span></div>
        </header>
        <div class="arena-wrap"><div class="arena" id="arena" tabindex="0" aria-label="Arena: drag to move the mage">
            <svg class="floor" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
                <defs><pattern id="tiles" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#ffffff0c"/></pattern></defs>
                <rect width="${W}" height="${H}" fill="url(#tiles)"/>
                <g class="flank"></g><g class="tethers"></g><g class="telegraph"></g><g class="marks"></g>
            </svg>
            <div class="boss-spot" style="left:${left(B.BOSS_AT.x)};top:${top(B.BOSS_AT.y)};width:${pct(width,W)}">
                <div class="ward-ring"><b></b></div>
                <img class="boss pixel" src="${src}" alt="${boss.name}">
                <i class="reticle" aria-hidden="true"></i>
                <span class="fort" hidden></span>
                <div class="charge-card" hidden><b></b><span class="meter"><i></i></span><small></small></div>
            </div>
            <div class="adds"></div>
            <img class="mage pixel" src="assets/mage.png" alt="Mage">
            <svg class="fx-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"></svg>
            <div class="fx" aria-hidden="true"></div>
            <p class="banner" role="status" aria-live="polite"></p>
        </div></div>
        <div class="mage-bar"><span>Mage</span><b><i></i></b><em></em></div>
        <nav class="spells" aria-label="Spells">${f.slots.map((s,i)=>{const sp=B.spells[s.spell];return `
            <div class="slot" data-slot="${i}">
                <button class="cast" data-cast="${i}" aria-label="Cast ${sp.name}" style="--c:${colorOf(sp)}"><img class="pixel" src="${spellArt[sp.id]}" alt=""><i class="cd"></i><b class="tag"></b></button>
                <button class="auto" data-auto="${i}" aria-pressed="true">AUTO</button>
            </div>`;}).join('')}</nav>
        <p class="hint"></p>
        <div class="sheet" hidden></div>`;
        ui.addNodes=new Map();
        fit();
        const arena=phone.querySelector('#arena');
        const point=e=>{const r=arena.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:H-(e.clientY-r.top)/r.height*H};};
        let held=false;
        arena.addEventListener('pointerdown',e=>{held=true;arena.setPointerCapture?.(e.pointerId);ui.target=point(e);});
        arena.addEventListener('pointermove',e=>{if(held)ui.target=point(e);});
        arena.addEventListener('pointerup',()=>{held=false;});
        arena.addEventListener('pointercancel',()=>{held=false;});
        arena.addEventListener('keydown',e=>{
            const step={ArrowLeft:[-40,0],ArrowRight:[40,0],ArrowUp:[0,40],ArrowDown:[0,-40]}[e.key];
            if(!step)return;e.preventDefault();
            const from=ui.target||f.mage;ui.target={x:from.x+step[0],y:from.y+step[1]};
        });
    }

    /* The arena keeps the model's 360 × 400 proportions and fits the space between the HUD and the spell bar. */
    function fit(){
        const wrap=phone.querySelector('.arena-wrap'),arena=phone.querySelector('#arena');
        if(!wrap)return;
        const cs=getComputedStyle(wrap);
        const innerW=wrap.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),innerH=wrap.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
        const w=Math.floor(Math.min(innerW,innerH*W/H));
        arena.style.width=w+'px';arena.style.height=(w*H/W)+'px';
        arena.style.setProperty('--u',(w/W)+'px');
    }

    function render(){
        const boss=f.boss,t=f.t,q=s=>phone.querySelector(s);
        q('.clock').textContent=clock(t);
        q('.boss-bar .hp').style.width=pct(f.hp,boss.hp);
        q('.boss-bar .ward-fill').style.width=f.ward?pct(f.ward.hp,f.ward.max):'0%';
        q('.boss-bar .ward-fill').style.background=f.ward?wardLook(f.ward).color:'';
        q('.boss-bar em').textContent=f.ward?`${f.ward.name} ${f.ward.hp} / ${f.ward.max}`:`${f.hp} / ${boss.hp}`;
        phone.querySelectorAll('[data-pip]').forEach(p=>p.classList.toggle('on',Number(p.dataset.pip)<=f.phase));
        const invulnerable=t<f.invulnerableUntil,staggered=t<f.staggerUntil,open=!f.ward&&!invulnerable&&B.exposed(f);
        const wp=boss.weakPoint;
        let status;
        if(invulnerable)status='<b class="immune">IMMUNE</b> phase change';
        else if(f.ward)status=`<b class="warded" style="--c:${wardLook(f.ward).color}">${wardLook(f.ward).badge}</b> ${wardLook(f.ward).hint}; others deal 25 %`;
        else if(staggered)status='<b class="weak">STAGGERED</b> full damage, no attacks';
        else if(wp&&open)status=`<b class="weak">WEAK POINT</b> full damage`;
        else if(wp)status=`<b class="armor">ARMOURED</b> ${100-wp.armorBp/100} % less damage${wp.kind==='flank'?' · stand on the gold side':' · dodge or interrupt the slam'}`;
        else status='Full damage';
        const fort=B.pylonBp(f);
        if(fort<B.FULL&&!f.ward)status+=` · <b class="armor">PYLONS −${100-fort/100} %</b>`;
        q('.status').innerHTML=status;
        // Boss state.
        const spot=q('.boss-spot');
        spot.classList.toggle('exposed',open);spot.classList.toggle('staggered',staggered);spot.classList.toggle('immune',invulnerable);
        spot.classList.toggle('charging',!!f.charge);
        spot.dataset.side=wp?.kind==='flank'?B.flankSide(f):'centre';
        const ring=q('.ward-ring');ring.hidden=!f.ward;
        if(f.ward){const look=wardLook(f.ward);ring.style.setProperty('--c',look.color);ring.style.setProperty('--w',f.ward.hp/f.ward.max);ring.querySelector('b').textContent=look.badge;}
        const fortEl=q('.fort');fortEl.hidden=!(fort<B.FULL);fortEl.textContent=`−${100-fort/100} %`;
        const card=q('.charge-card');card.hidden=!f.charge;
        if(f.charge){
            const need=f.charge.def.interruptDamage,left=Math.max(0,f.charge.landsAt-t);
            card.querySelector('b').textContent=f.charge.def.name;
            card.querySelector('.meter i').style.width=pct(Math.min(need,f.charge.dealt),need);
            card.querySelector('small').textContent=`Interrupt ${f.charge.dealt} / ${need} · ${(left/1000).toFixed(1)} s`;
        }
        // Floor: flank zone, tethers, charge telegraph and marks.
        const flank=q('.floor .flank');
        if(wp?.kind==='flank'&&!f.ward&&!invulnerable&&!staggered){
            const dz=B.units(wp.deadZoneBp),side=B.flankSide(f),x=side==='left'?0:B.BOSS_AT.x+dz,width=B.BOSS_AT.x-dz;
            const soon=wp.switchMs-(t%wp.switchMs)<1500;
            flank.innerHTML=`<rect class="weak-zone${soon?' soon':''}" x="${x}" y="${svgY(B.BOSS_AT.y-40)}" width="${width}" height="${B.BOSS_AT.y-56}"/><text class="zone-label" x="${x+width/2}" y="${svgY(40)}">WEAK SIDE</text>`;
        }else flank.innerHTML='';
        q('.floor .tethers').innerHTML=f.adds.filter(a=>a.behaviour==='pylon'||a.behaviour==='mender'&&a.channeling).map(a=>
            `<line class="${a.behaviour==='pylon'?'tether':'beam'}" x1="${a.x}" y1="${svgY(a.y)}" x2="${B.BOSS_AT.x}" y2="${svgY(B.BOSS_AT.y-30)}"/>`).join('');
        const tele=q('.floor .telegraph');
        if(f.charge){
            const c=f.charge,a=c.area,p=Math.min(1,(t-c.startedAt)/(c.landsAt-c.startedAt));
            if(a.kind==='target')tele.innerHTML=`<circle class="danger" cx="${a.x}" cy="${svgY(a.y)}" r="${a.radius}"/><circle class="danger-fill" cx="${a.x}" cy="${svgY(a.y)}" r="${a.radius*p}"/>`;
            else{const x=a.side==='left'?0:B.BOSS_AT.x,height=B.BOSS_AT.y-50;tele.innerHTML=`<rect class="danger" x="${x}" y="${svgY(B.BOSS_AT.y-50)}" width="${B.BOSS_AT.x}" height="${height}"/><rect class="danger-fill" x="${x}" y="${svgY(B.BOSS_AT.y-50)}" width="${B.BOSS_AT.x}" height="${height*p}"/>`;}
        }else tele.innerHTML='';
        q('.floor .marks').innerHTML=f.marks.map(m=>{const p=Math.min(1,(t-m.appears)/(m.lands-m.appears));return `<circle class="mark" cx="${m.x}" cy="${svgY(m.y)}" r="${m.radius}" style="opacity:${ui.reduced?.6:.25+.35*p}"/><circle class="mark-ring" cx="${m.x}" cy="${svgY(m.y)}" r="${m.radius*(1.6-.6*p)}"/>`;}).join('');
        // Adds.
        const adds=q('.adds'),alive=new Set();
        for(const a of f.adds){
            alive.add(a.id);
            let node=ui.addNodes.get(a.id);
            if(!node){
                node=el('div','add '+a.behaviour,(a.behaviour==='pylon'?'<svg viewBox="0 0 20 34" class="pylon-art"><path d="M10 1 17 12 14 31H6L3 12Z" fill="#3a2a35" stroke="#120b16"/><path d="M10 4 14 12 10 27 6 12Z" fill="#ff7a3d"/><path d="M10 6 12 12 10 20Z" fill="#ffd36b"/></svg>':
                    `<img class="pixel" src="${a.behaviour==='mender'?'assets/mob-bat.png':'assets/mob-imp.png'}" alt="">`)+'<span class="add-hp"><i></i></span><small></small>');
                node.style.left=left(a.x);node.style.top=top(a.y);
                adds.append(node);ui.addNodes.set(a.id,node);
            }
            node.querySelector('.add-hp i').style.width=pct(a.hp,a.max);
            node.querySelector('small').textContent=a.behaviour==='pylon'?'PYLON':a.behaviour==='mender'?(a.channeling?'HEALING':'MENDER'):'';
            node.classList.toggle('channeling',!!a.channeling);
        }
        for(const [id,node] of ui.addNodes)if(!alive.has(id)){node.remove();ui.addNodes.delete(id);}
        // Mage.
        const mage=q('.mage');mage.style.left=left(f.mage.x);mage.style.top=top(f.mage.y);
        q('.mage-bar b i').style.width=pct(f.mage.hp,f.mage.max);
        q('.mage-bar em').textContent=`${f.mage.hp} / ${f.mage.max}`;
        // Spells.
        f.slots.forEach((s,i)=>{
            const sp=B.spells[s.spell],slot=phone.querySelector(`[data-slot="${i}"]`);
            const left=Math.max(0,s.readyAt-t);
            slot.querySelector('.cd').style.setProperty('--p',left/sp.cooldownMs);
            slot.querySelector('.cast').classList.toggle('ready',left===0);
            slot.querySelector('.cast').disabled=!!f.over;
            const breaks=f.ward&&B.breaksWard(f.ward,sp);
            slot.querySelector('.tag').textContent=breaks?'BREAKS':left>0?(left/1000).toFixed(1):'';
            slot.querySelector('.cast').classList.toggle('breaks',!!breaks);
            const auto=slot.querySelector('.auto');auto.setAttribute('aria-pressed',String(s.auto));auto.textContent=s.auto?'AUTO':'TAP';
        });
        q('.hint').textContent=f.charge?(f.charge.area.kind==='sweep'?'Cross to the other half, or burst it down to interrupt.':'Step out of the red circle, or burst it down to interrupt.'):
            invulnerable?'The boss changes phase.':f.ward?'Break the ward with its counter.':'Drag in the arena to move. Tap AUTO to hold a spell for a manual cast.';
        phone.classList.toggle('reduced',ui.reduced);
        document.querySelector('#state').textContent=JSON.stringify(snapshot(),null,2);
    }

    function snapshot(){
        return {scene:ui.scene,tier:f.boss.tier,t:f.t,paused:ui.paused,reduced:ui.reduced,boss:{id:f.boss.id,hp:f.hp,max:f.boss.hp,phase:f.phase+1,exposed:B.exposed(f),invulnerable:f.t<f.invulnerableUntil,staggered:f.t<f.staggerUntil},
            ward:f.ward&&{name:f.ward.name,hp:f.ward.hp,max:f.ward.max,breaksBy:f.ward.breaksBy},charge:f.charge&&{name:f.charge.def.name,area:f.charge.area.kind,dealt:f.charge.dealt,need:f.charge.def.interruptDamage},
            adds:f.adds.map(a=>({id:a.id,behaviour:a.behaviour,hp:a.hp})),mage:{hp:f.mage.hp,x:Math.round(f.mage.x),y:Math.round(f.mage.y)},
            slots:f.slots.map(s=>({spell:s.spell,auto:s.auto,casts:s.casts,damage:s.damage})),over:f.over,result:ui.result};
    }

    /* Effects: one short-lived element per event, drawn on top of the arena. */
    function float(x,y,text,cls,ms=900){
        const e=el('span','float '+cls,text);e.style.left=left(x);e.style.top=top(y);
        phone.querySelector('.fx').append(e);setTimeout(()=>e.remove(),ui.reduced?Math.min(ms,700):ms);
    }
    function banner(text,cls=''){
        const b=phone.querySelector('.banner');b.className='banner show '+cls;b.textContent=text;
        clearTimeout(banner.timer);banner.timer=setTimeout(()=>{b.className='banner';},1300);
    }
    function svgFx(markup,ms){
        const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.innerHTML=markup;
        phone.querySelector('.fx-svg').append(g);setTimeout(()=>g.remove(),ms);
    }
    function coneMarkup(spell,mage){
        const range=spell.rangeBp*W/B.FULL,half=spell.angleDegrees/2*Math.PI/180;
        const dir=Math.atan2(B.BOSS_AT.y-mage.y,B.BOSS_AT.x-mage.x);
        const p=a=>`${mage.x+Math.cos(a)*range} ${svgY(mage.y+Math.sin(a)*range)}`;
        return `<path class="cone" style="--c:${colorOf(spell)}" d="M${mage.x} ${svgY(mage.y)} L${p(dir-half)} A${range} ${range} 0 0 0 ${p(dir+half)} Z"/>`;
    }
    const shake=cls=>{const s=phone.querySelector('.boss-spot');s.classList.remove(cls);void s.offsetWidth;s.classList.add(cls);};

    function consume(events){
        for(const e of events){
            const sp=e.slot!=null?B.spells[f.slots[e.slot].spell]:null,jitter=(e.at/10%5)*10-20;
            switch(e.kind){
                case 'cast':
                    if(ui.reduced)break;
                    if(sp.shape==='cone')svgFx(coneMarkup(sp,f.mage),260);
                    else{const p=el('i','bolt');p.style.setProperty('--c',colorOf(sp));p.style.left=left(f.mage.x);p.style.top=top(f.mage.y);
                        const u=phone.querySelector('#arena').clientWidth/W;p.style.setProperty('--dx',((B.BOSS_AT.x-f.mage.x)*u)+'px');p.style.setProperty('--dy',(-(B.BOSS_AT.y-30-f.mage.y)*u)+'px');
                        phone.querySelector('.fx').append(p);setTimeout(()=>p.remove(),220);}
                    phone.querySelector(`[data-slot="${e.slot}"] .cast`).classList.add('fired');
                    setTimeout(()=>phone.querySelector(`[data-slot="${e.slot}"] .cast`)?.classList.remove('fired'),180);
                    break;
                case 'bossHit':
                    if(e.weak)float(B.BOSS_AT.x+jitter,B.BOSS_AT.y-10,e.amount,'weak');
                    else float(B.BOSS_AT.x+jitter,B.BOSS_AT.y-10,e.amount,e.armored||e.fortified?'armored':'normal');
                    break;
                case 'wardHit':float(B.BOSS_AT.x+jitter,B.BOSS_AT.y+20,e.amount,e.breaks?'ward-strong':'ward-weak');if(e.breaks)shake('ward-flash');break;
                case 'wardRaised':banner(`${e.name} raised`,'ward');break;
                case 'wardBroken':banner(`${e.name} broken!`,'ward');shake('shatter');break;
                case 'immune':float(B.BOSS_AT.x,B.BOSS_AT.y-10,'IMMUNE','armored');break;
                case 'chargeStart':banner(`${e.name}!`,'danger');break;
                case 'interrupted':banner('Interrupted!','weak');shake('stun');break;
                case 'chargeLanded':
                    if(!ui.reduced)svgFx(e.hit?'<rect class="hitflash" width="360" height="400"/>':'',250);
                    if(!e.hit)float(f.mage.x,f.mage.y+30,'Dodged','dodge');
                    shake('slam');
                    break;
                case 'mageHit':float(f.mage.x,f.mage.y+26,'−'+e.amount,'hurt');phone.querySelector('.mage').classList.add('hurt');setTimeout(()=>phone.querySelector('.mage')?.classList.remove('hurt'),200);break;
                case 'dodged':float(f.mage.x,f.mage.y+30,'Dodged','dodge',600);break;
                case 'heal':if(e.amount>0)float(B.BOSS_AT.x+30,B.BOSS_AT.y,'+'+e.amount,'heal');break;
                case 'addDefeated':{const a=ui.addNodes.get(e.id);if(a){a.classList.add('poof');ui.addNodes.delete(e.id);setTimeout(()=>a.remove(),300);}
                    if(e.behaviour==='pylon')banner('Pylon down');if(e.behaviour==='mender')banner('Mender down');break;}
                case 'phase':banner(`Phase ${e.phase}`,'phase');shake('phase-flash');break;
                case 'victory':case 'defeat':showResult();break;
            }
        }
    }

    function showResult(){
        const rep=B.report(f),check=B.plausible(rep,f.boss.id,f.boss.tier);
        ui.result={outcome:rep.outcome,reason:rep.reason,combatTimeMs:rep.combatTimeMs,serverOk:check.ok,total:check.total??null,effectiveHp:B.effectiveHp(f.boss)};
        const sheet=phone.querySelector('.sheet');
        const title=rep.outcome==='victory'?'Victory':rep.reason==='death'?'Defeated':'Out of time';
        sheet.innerHTML=`<div class="card ${rep.outcome}">
            <p class="eyebrow">${f.boss.name.toUpperCase()} · TIER ${f.boss.tier}</p>
            <h2>${title}</h2><p class="time">${(rep.combatTimeMs/1000).toFixed(1)} s</p>
            <table><thead><tr><th>Spell</th><th>Casts</th><th>Damage</th></tr></thead><tbody>${rep.slots.map(s=>`<tr><td>${B.spells[s.spell].name}</td><td>${s.casts}</td><td>${s.damage}</td></tr>`).join('')}</tbody></table>
            <div class="check ${check.ok?'ok':'bad'}"><b>Server check: ${check.ok?'accepted':'rejected'}</b>
            ${rep.outcome==='victory'?`<small>Damage ${check.total} ≥ effective HP ${check.effectiveHp} (HP + wards) · fastest possible ${(check.minimumMs/1000).toFixed(1)} s · report unchanged from ADR 0006</small>`:'<small>Defeats need no bound.</small>'}</div>
            <div class="sheet-actions"><button data-action="again">Fight again</button><button data-action="next">Next boss</button></div></div>`;
        sheet.hidden=false;
    }

    /* The demo autopilot plays like the scripted test player: it dodges marks and charges and stands on the weak flank. */
    function autopilot(){
        const target={x:f.boss.weakPoint?.kind==='flank'?(B.flankSide(f)==='left'?70:290):(f.mage.x<180?70:290),y:150};
        if(f.charge){const a=f.charge.area;if(a.kind==='sweep')target.x=a.side==='left'?300:60;else target.x=a.x<180?a.x+90:a.x-90;}
        for(const m of f.marks)if(Math.hypot(m.x-f.mage.x,m.y-f.mage.y)<55)target.y=m.y>150?m.y-70:m.y+70;
        return target;
    }

    function loop(now){
        if(!ui.last)ui.last=now;
        const dt=Math.min(100,now-ui.last);ui.last=now;
        if(!ui.paused&&!f.over){ui.acc+=dt;const ms=Math.floor(ui.acc/B.STEP_MS)*B.STEP_MS;if(ms>0){ui.acc-=ms;B.advance(f,ms,ui.target);}}
        consume(B.takeEvents(f));
        render();
        requestAnimationFrame(loop);
    }

    function load(scene,tier=ui.tier){
        const info=sceneInfo[scene];
        ui.scene=scene;ui.tier=tier;ui.target=null;ui.acc=0;ui.result=null;
        f=B.create(info.boss,{tier,startPhase:info.phase});
        build();
        document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.scene===scene)));
        document.querySelectorAll('[data-tier]').forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.tier)===tier)));
        document.querySelector('#scene-label').textContent=info.label+(tier>1?` · tier ${tier}`:'');
        const url=new URL(location.href);url.searchParams.set('scene',scene);url.searchParams.set('tier',tier);history.replaceState(null,'',url);
        consume(B.takeEvents(f));render();
    }

    phone.addEventListener('click',e=>{
        const c=e.target.closest('[data-cast]'),a=e.target.closest('[data-auto]'),act=e.target.closest('[data-action]');
        if(c){B.castManually(f,Number(c.dataset.cast));consume(B.takeEvents(f));render();}
        if(a){const i=Number(a.dataset.auto);B.setAuto(f,i,!f.slots[i].auto);render();}
        if(act?.dataset.action==='again')load(ui.scene);
        if(act?.dataset.action==='next')load(scenes[(scenes.indexOf(ui.scene)+1)%scenes.length]);
    });
    document.addEventListener('click',e=>{
        const scene=e.target.closest('[data-scene]'),tier=e.target.closest('[data-tier]'),demo=e.target.closest('[data-demo]');
        if(scene)load(scene.dataset.scene);
        if(tier)load(ui.scene,Number(tier.dataset.tier));
        if(!demo)return;
        const d=demo.dataset.demo;
        if(d==='pause')ui.paused=!ui.paused;
        if(d==='restart')load(ui.scene);
        if(d==='reduced')ui.reduced=!ui.reduced;
        if(d==='half'&&!f.over){f.ward=null;f.hp=Math.min(f.hp,Math.ceil(f.boss.hp*.51));}
        if(d==='win'){while(!f.over){B.advance(f,100,autopilot());B.takeEvents(f);}consume([{kind:f.over.outcome}]);}
        render();
    });
    document.querySelector('#previous').addEventListener('click',()=>load(scenes[(scenes.indexOf(ui.scene)+scenes.length-1)%scenes.length]));
    document.querySelector('#next').addEventListener('click',()=>load(scenes[(scenes.indexOf(ui.scene)+1)%scenes.length]));
    addEventListener('resize',fit);

    /* Hooks for the browser fixture: step the same model the loop steps, without waiting for real time. */
    window.bossProto={advance(ms,target){if(target)ui.target=target;B.advance(f,ms,ui.target);consume(B.takeEvents(f));render();},fight:()=>f,autopilot,
        pause(on=true){ui.paused=on;render();}};

    const scene=scenes.includes(params.get('scene'))?params.get('scene'):'watcher';
    const tier=[1,2,3].includes(Number(params.get('tier')))?Number(params.get('tier')):1;
    ui.paused=params.get('paused')==='1';
    load(scene,tier);
    requestAnimationFrame(loop);
})();
