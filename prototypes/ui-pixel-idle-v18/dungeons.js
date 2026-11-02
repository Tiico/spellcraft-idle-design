/* Daily dungeon UX study: four targets, individual quotas and existing spell-clearing. */
const DungeonUI=(()=>{
    let offset=0,serial=0;
    const clock=()=>Date.now()+offset;
    const defs=MageDungeons.definitions;
    const find=id=>defs.find(d=>d.id===id);
    const refresh=()=>MageDungeons.refresh(state.dungeons,clock());
    const remaining=id=>MageDungeons.remaining(state.dungeons,id);
    const rewardIcon=r=>r.type==='shards'?ui(realms[r.element].toLowerCase()):r.type==='fragments'?sprite('moth'):ui(r.type);
    const rewardName=r=>r.type==='shards'?realms[r.element]+' shards':r.type==='fragments'?'Familiar fragments':r.type==='ore'?'Moonstone ore':'Silverfin pearls';
    const rewardFor=def=>({type:def.type,amount:def.amount,element:def.type==='shards'?state.dungeonElement:null});
    const pips=left=>`<span class="daily-pips" aria-label="${left} of ${state.dungeons.limit} daily rewards left">${Array.from({length:state.dungeons.limit},(_,i)=>`<i class="${i<left?'available':''}"></i>`).join('')}</span>`;
    function resetText(){const seconds=Math.max(0,Math.ceil((MageDungeons.nextReset(state.dungeons)-clock())/1000));return 'Resets in '+Math.floor(seconds/3600)+'h '+Math.floor(seconds%3600/60)+'m';}
    function view(){
        refresh();const open=MageDungeons.unlocked(state);
        return `<section class="page dungeon-page">${title('Dungeons')}<div class="dungeon-daily-heading"><span>${state.dungeons.limit} daily rewards each</span><button class="info-button" data-action="dungeonInfo" aria-label="Dungeon rewards and daily reset rules">${glyph('info')}</button></div>${!open?'<p class="compact-notice">Defeat the Ice boss to unlock.</p>':''}<div class="dungeon-grid">${defs.map(def=>{const left=remaining(def.id),r=rewardFor(def);return `<button class="dungeon-card ${!left?'depleted':''}" data-dungeon="${def.id}" aria-label="${def.name}. ${r.amount} ${rewardName(r)}. ${open?left+' daily rewards left':'Unlock after the Ice boss'}">${sprite(def.art)}<strong>${def.name}</strong><span class="dungeon-yield">${rewardIcon(r)}<b>+${r.amount}</b></span><small>${rewardName(r)}</small><span class="dungeon-card-quota">${pips(open?left:0)}<b>${open?left+'/'+state.dungeons.limit:ui('lock','inline-icon')}</b></span></button>`}).join('')}</div><div class="dungeon-reset">${ui('time','inline-icon')}<span data-dungeon-reset>${resetText()}</span></div></section>`;
    }
    function detail(){
        refresh();const def=find(state.dungeonSelected)||defs[0],r=rewardFor(def),left=remaining(def.id),open=MageDungeons.unlocked(state),progress=state.dungeons.fragments%20,earned=Math.floor(state.dungeons.fragments/20);
        return `<section class="page dungeon-detail"><div class="row between"><button class="text-button" data-view="dungeons" aria-label="Back to dungeons">${glyph('back')}</button><span class="kicker">DAILY DUNGEON</span><button class="info-button" data-action="dungeonInfo" aria-label="Daily dungeon rules">${glyph('info')}</button></div><div class="dungeon-hero">${sprite(def.art)}<h2>${def.name}</h2></div><div class="dungeon-reward-preview">${rewardIcon(r)}<b>+${r.amount}</b><span>${rewardName(r)}</span></div>${def.type==='shards'?`<div class="dungeon-elements" aria-label="Choose element">${realms.map((name,i)=>`<button data-dungeon-element="${i}" aria-pressed="${state.dungeonElement===i}" ${MageDungeons.elementUnlocked(state,i)?'':'disabled'} aria-label="${name} shards${MageDungeons.elementUnlocked(state,i)?'':', realm locked'}">${ui(name.toLowerCase())}<span>${name}</span></button>`).join('')}</div>`:''}${def.type==='fragments'?`<div class="familiar-goal">${sprite('moth')}<div><strong>Moon moth ${String(earned+2).padStart(3,'0')}</strong><span>${progress} / 20 fragments</span><div class="progress-track"><i style="width:${progress/20*100}%"></i></div></div></div>`:''}<div class="dungeon-rules-row"><span>Clear 24 monsters</span><span>${pips(left)} ${left}/${state.dungeons.limit}</span></div>${!open?'<p class="compact-notice">Defeat the Ice boss to unlock.</p>':''}<div class="primary-dock">${btn(!left?'Done for today':'Enter','enterDungeon',false,!open||!left)}</div><div class="dungeon-reset">${ui('time','inline-icon')}<span data-dungeon-reset>${resetText()}</span></div></section>`;
    }
    function result(){
        const receipt=state.dungeonReceipt,def=find(receipt.dungeonId),r=receipt.reward,progress=receipt.fragments%20;
        return `<section class="page dungeon-result center">${sprite(def.art,'result-art')}${title('Dungeon cleared')}<span class="kicker">${def.name}</span><div class="dungeon-result-reward">${rewardIcon(r)}<strong>+${r.amount}</strong><span>${rewardName(r)}</span></div><span class="status-chip">Collected</span>${r.type==='fragments'?`<p class="fragment-result">${progress===0&&receipt.fragments>0?'Moon moth discovered':progress+' / 20 familiar fragments'}</p>`:''}<p class="tiny muted">${remaining(def.id)} daily rewards left here</p><div class="primary-dock">${btn('Continue','dungeons')}</div></section>`;
    }
    function enter(){
        const out=MageDungeons.begin(state,{id:'dungeon-'+(++serial),dungeonId:state.dungeonSelected,element:state.dungeonElement,now:clock()});
        if(!out.ok)return notify(out.reason);ActivePlay.openDungeon(out.run);
    }
    function complete(context,popped){const out=MageDungeons.complete(state,{id:context.id,popped,now:clock()});if(!out.ok)return notify(out.reason);state.dungeonReceipt=out.receipt;go('dungeonResult');}
    function info(){return `<p class="note">${state.dungeons.limit} rewarded clears per dungeon each day. A successful clear grants the reward and uses one daily reward together.</p><p class="muted">Leaving a run gives no dungeon reward and uses no daily reward.</p><div class="return-line"><span>Daily reset</span><b>00:00 UTC</b></div><p class="tiny muted">Unused daily rewards do not carry over. Counts and rewards are prototype proposals.</p>`;}
    function tick(){if(!['dungeons','dungeonDetail','dungeonResult','active'].includes(state.view))return;const changed=refresh();if(changed&&state.view!=='active')render(true);else phone.querySelectorAll('[data-dungeon-reset]').forEach(el=>el.textContent=resetText());}
    const ids=()=>[0,1,...Array.from({length:Math.floor(state.dungeons.fragments/20)},(_,i)=>2+i*2)];
    return {clock,view,detail,result,enter,complete,info,tick,find,rewardIcon,rewardName,rewardFor,remaining,familiarIds:ids,nextDay(){offset+=MageDungeons.dayMs;refresh();render(true);},resetClock(){offset=0;},label:()=>state.view.startsWith('dungeon')?'Daily dungeons · B selected':'Idle overlay · B selected'};
})();
