/* THROWAWAY REVIEW BUILD. Local, accelerated simulation; no persistence or authoritative rewards. */
const params = new URLSearchParams(location.search);
const crestStudies = ['base', 'evolved', 'crowned'];
const variant = 'B';
let crestStudy = crestStudies.includes(params.get('crest')) ? params.get('crest') : 'base';
const phone = document.querySelector('#phone');
const realms = ['Fire', 'Ice', 'Earth', 'Wind'];
const rects = {
    mage:[37,27,251,295],casting:[318,16,348,306],slime:[684,123,232,203],hit:[975,96,254,236],
    golem:[12,330,353,344],moth:[397,414,244,234],fox:[686,423,257,229],spirit:[982,417,235,237],
    workshop:[13,680,326,309],mine:[346,683,307,315],pond:[671,672,296,329],portal:[977,686,265,312],
    fire:[52,1016,241,215],ice:[363,1035,246,196],frost:[674,1014,234,225],shards:[994,1027,219,202]
};
const sprite = (name, extra='') => {
    if(EncounterArt.frames[name])return EncounterArt.markup(name,extra);
    if(RealmSpellArt.placeholders.includes(name))return RealmSpellArt.markup(name,extra);
    if(['emberbloom','glacierlance','stoneburst','galespiral'].includes(name))return `<span class="sprite realm-spell-art ${name} ${extra}" data-sprite="${name}" aria-hidden="true">${name==='emberbloom'?[0,120,240].map(angle=>`<span style="--petal:${angle}deg">${sprite('fire')}</span>`).join(''):name==='glacierlance'?sprite('ice'):name==='stoneburst'?[0,120,240].map(angle=>`<span style="--petal:${angle}deg">${ui('earth')}</span>`).join(''):ui('wind')}</span>`;
    if(['ward','fireshield'].includes(name))return `<span class="sprite support-art ${name}" data-sprite="${name}" aria-hidden="true">${ui('crest')}${name==='fireshield'?`<span class="shield-flame">${sprite('fire')}</span>`:''}</span>`;
    if(name==='firecone'||name==='frostcone')return `<span class="sprite cone-art ${extra}" data-sprite="${name}" aria-hidden="true">${[-28,0,28].map(angle=>`<span class="cone-ray" style="--ray:${angle}deg">${sprite(name==='firecone'?'fire':'frost')}</span>`).join('')}</span>`;
    const bounds=rects[name] || rects.shards;
    let pose='';
    if(name==='mage'||name==='casting'){
        const [x,,w,h]=bounds,feetX=name==='mage'?164:488;
        pose=`;--pose-w:${(w+8)/303*94}%;--pose-h:${(h+8)/303*94}%;--pose-shift:${(x+w/2-feetX)/(w+8)*100}%`;
    }
    return `<span class="sprite ${extra}" data-sprite="${name}" aria-hidden="true" style="${MagePresentation.frameStyle(bounds,.94)}${pose}"><span class="sprite-art"></span></span>`;
};
// Keep visible pixels centered even when source atlas cells have uneven transparent gutters.
const {hudBounds,frameStyle,nextIdleSpell} = MagePresentation;
const ui = (name, extra='') => `<span class="ui-icon ${extra}" data-ui-icon="${name}" aria-hidden="true" style="${frameStyle(hudBounds[name] || hudBounds.crest)}"><span class="ui-art"></span></span>`;
const resourceIcon = () => realms[state.realm].toLowerCase();
const currencyText = text => text.replace(/\b(fire-shards|ice-shards|earth-shards|wind-shards|ore|pearls)\b/g, word => `${ui(({'fire-shards':'fire','ice-shards':'ice','earth-shards':'earth','wind-shards':'wind'})[word]||word, 'inline-icon')} ${word}`);
const spells = [
    {name:'Firebolt',art:'fire',element:'Fire',damage:24,cooldown:3,description:'A fire bolt at one enemy.'},
    {name:'Icebolt',art:'ice',element:'Ice',damage:20,cooldown:4,description:'An ice bolt at one enemy.'},
    {name:'Frostfire Bolt',art:'frost',element:'Fusion',damage:62,cooldown:3,description:'Fire and ice strike as one.'},
    {name:'Flame Cone',art:'firecone',element:'Fire',damage:22,cooldown:3,description:'Flame sweeps through a cone.'},
    {name:'Frostfire Cone',art:'frostcone',element:'Fusion',damage:62,cooldown:3,description:'Frostfire sweeps through a crowd.'},
    {name:'Frost Ward',art:'ward',kind:'shield',element:'Ice',damage:0,cooldown:8,description:'Absorbs incoming damage.'},
    {name:'Fire Shield',art:'fireshield',kind:'shield',element:'Fusion',damage:0,cooldown:8,description:'Absorbs hits, boosts offensive casts by 25% while intact and returns 3 bolts to the attacker.'}
];
spells.push(...MageIdleSpells.definitions.map(d=>({...d,element:realms[d.realm],acquisition:'realmIdle'})));
const fusionRecipes=[{id:'bolt',inputs:['Firebolt','Icebolt'],result:'Frostfire Bolt',level:2},{id:'cone',inputs:['Frostfire Bolt','Flame Cone'],result:'Frostfire Cone',level:3},{id:'shield',inputs:['Frost Ward','Firebolt'],result:'Fire Shield',level:2}];
let quoteSerial=0;
const fresh = () => ({
    inventory:MageRelics.fresh(),inventoryQuantity:1,characterMode:'idle',groundLoot:MageItemLoot.fresh(),lootFamiliars:[],freeGifts:MageFreeGifts.fresh(),giftReceipt:null,shopCategory:'gifts',ventureDevelopment:MageVentureDevelopment.fresh(),ventureSpirits:MageVentureSpirits.fresh(),shop:MageShop.fresh(),spiritFilter:'All',realmFinds:MageIdleSpells.fresh(),realmFindWindow:RealmDiscoveries.windowId(),dungeons:MageDungeons.fresh(DungeonUI.clock()),dungeonElement:0,dungeonSelected:'ore',dungeonReceipt:null,spellRarities:{},fusionReceipts:[],fusionQuote:null,fusionReceipt:null,
    idleEffects:MageEffects.create(),view:'realm',realm:0,won:[false,false,false,false],shards:[0,0,0,0],ore:120,pearls:80,
    idle:['Firebolt'],boss:['Firebolt'],autos:[true,true,true,true],unlocked:['Firebolt'],familiar:0,
    hpBonus:0,damageBonus:0,forgeLevel:1,mining:2,fishing:1,synergy:true,largeCollection:false,
    collectionTab:'spells',build:'idle',queries:{spells:'',familiars:''},filters:{spells:'All',familiars:'All'},pages:{spells:0,familiars:0},
    modal:null,seconds:0,kills:0,enemyHp:40,stageKills:0,connected:true,fight:null,returnPending:false,returnClaimed:false,returned:null
});
let state = fresh();
let toastTimer;
let toastText = '';
let lastFocus;
const glyph = (name) => `<span class="signal signal-${name}" aria-hidden="true">${({check:'✓',arrow:'→',info:'i',edit:'✎',play:'▶',back:'←'})[name]||''}</span>`;
const metric = (art,value,label) => `<span class="visual-metric" role="img" aria-label="${esc(label)}" title="${esc(label)}">${ui(art)}<b>${value}</b></span>`;
const esc = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const spell = name => spells.find(s=>s.name===name);
const rarityOf=name=>MageRarity.rank(state.spellRarities[name]);
const rarityTag=name=>`<span class="rarity-tag" style="--rarity:${MageRarity.colors[rarityOf(name)]}">${MageRarity.tiers[rarityOf(name)]}</span>`;
const spellDamage=name=>Math.round(spell(name).damage*MageRarity.damageScale[rarityOf(name)]);
const permanentHp = () => 100 + state.hpBonus;
const spellPower = () => 24 + state.damageBonus;
// Illustrative sum for this review only. No XP, threshold, reward or gate uses it.
const magePower = () => permanentHp() + spellPower();
const compactStat = value => new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(value);
const hpMax = () => Math.round((100 + state.hpBonus) * (state.view === 'fight' && state.familiar % 2 === 0 ? 1.1 : 1));
const power = () => (state.damageBonus + (state.view==='fight'?state.boss:state.idle).filter(Boolean).reduce((sum,name)=>sum+spellDamage(name),0))*MageEffects.multiplier(state.view==='fight'?state.fight?.effects:state.idleEffects,performance.now());
const combatPower = () => Math.round(power()*(state.view==='fight' && state.familiar % 2 === 1 ? 1.08 : 1));
const rate = () => (power()/24*.6).toFixed(1);
const gate = () => RealmProgression.atBoss();
const canVisit = r => MagePresentation.canVisitRealm(state.won,r);
const atCap = () => state.seconds>=43200;
const familiar = id => ({id,name:(id%2?'Ember fox':'Moon moth')+(id>1?` ${String(Math.floor(id/2)+1).padStart(3,'0')}`:''),art:id%2?'fox':'moth',buff:id%2?'+8% Spell damage':'+10% HP',type:id%2?'Damage':'HP'});
const btn = (text,action,secondary=false,disabled=false) => {
    const cost = text.match(/^(.*?) · (\d+) (fire-shards|ice-shards|earth-shards|wind-shards|ore|pearls)$/);
    const prefix = action==='buyHp'?ui('hp','inline-icon'):action==='buyDamage'?ui('power','inline-icon'):'';
    const body = cost ? `<span class="button-label">${prefix}${esc(cost[1])}</span><span class="button-cost">${ui(({'fire-shards':'fire','ice-shards':'ice','earth-shards':'earth','wind-shards':'wind'})[cost[3]]||cost[3])}<b>${cost[2]}</b></span>` : prefix+currencyText(text);
    return `<button class="rune-button ${secondary?'secondary':''} ${cost?'has-cost':''}" data-action="${action}" aria-label="${esc(text)}" ${disabled?'disabled':''}>${body}</button>`;
};
const icon = name => `<span class="spell-icon ${name?'':'empty'}">${name?sprite(spell(name).art):ui('empty')}</span>`;
function effectBadges(effects){const e=MageEffects.status(effects,performance.now());return `<div class="effect-badges">${e.shield?`<span role="img" aria-label="${e.shieldName}: ${Math.ceil(e.shield)} barrier, ${e.shieldSeconds} seconds${e.buff?', offensive damage plus 25 percent':''}">${sprite(e.shieldName==='Fire Shield'?'fireshield':'ward')}<b>${Math.ceil(e.shield)}</b>${e.buff?`${ui('power','inline-icon')}<b>+25%</b>`:''}${ui('time','inline-icon')} ${e.shieldSeconds}s</span>`:''}</div>`;}
function shieldHalo(effects){const e=MageEffects.status(effects,performance.now());return e.shield?`<span class="mage-barrier ${e.shieldName==='Fire Shield'?'fiery':''}" aria-hidden="true"></span>`:'';}
function hud() {
    const resources = [
        ['Fire shards',state.shards[0],'fire'],['Ice shards',state.shards[1],'ice'],
        ['Earth shards',state.shards[2],'earth'],['Wind shards',state.shards[3],'wind'],
        ['Ore',state.ore,'ore'],['Pearls',state.pearls,'pearls']
    ];
    const crest = crestStudy==='base'?'crest':crestStudy;
    const trial=state.view==='active'?ActivePlay.trialStatus():null;
    return `<header class="hud crest-hud" aria-label="Resources and permanent mage stats"><button class="mage-identity" data-action="powerInfo" aria-label="Mage Power ${magePower()}. View permanent stats and rating formula">${ui(crest,'mage-crest')}<span class="mage-power"><small>MAGE POWER</small><strong>${compactStat(magePower())}</strong></span></button><div class="permanent-stats"><span class="stat-number" aria-label="Permanent HP ${permanentHp()}">${ui('hp')}<b>${compactStat(permanentHp())}</b><small>HP</small></span><span class="stat-number" aria-label="Permanent Spell power ${spellPower()}">${ui('power')}<b>${compactStat(spellPower())}</b><small>Spell power</small></span></div><button class="icon-button hud-menu" data-action="menu" aria-label="${MageNavigation.headerLaunch()?'Open all features':'Open settings and prototype controls'}">${MageNavigation.headerLaunch()?MageNavigation.gridIcon():ui('settings')}</button><div class="resource-strip">${resources.map(([name,value,art])=>`<button class="resource" data-action="resources" aria-label="${name}: ${value}" title="${name}">${ui(art)}<span>${new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:0}).format(Math.floor(value))}</span></button>`).join('')}</div>${state.view==='fight'?`<div class="combat-health" role="progressbar" aria-label="Player health in this boss fight" aria-valuemin="0" aria-valuemax="${hpMax()}" aria-valuenow="${Math.ceil(state.fight.hp)}"><span class="combat-health-fill" style="width:${Math.max(0,state.fight.hp/hpMax())*100}%"></span><b>${ui('hp','inline-icon')} ${Math.ceil(state.fight.hp)} / ${hpMax()}</b></div>`:trial?`<div class="combat-health" role="progressbar" aria-label="Spell trial health" aria-valuemin="0" aria-valuemax="${trial.maxHp}" aria-valuenow="${trial.hp}"><span class="combat-health-fill" style="width:${trial.hp/trial.maxHp*100}%"></span><b>${ui('hp','inline-icon')} ${trial.hp} / ${trial.maxHp}</b></div>`:''}</header>`;
}

function nav() {return MageNavigation.chrome();}
const title = (name,kicker='') => `<div class="page-heading"><div>${kicker?`<div class="kicker">${kicker}</div>`:''}<h2>${name}</h2></div></div>`;
function scenery() { return `<div class="scenery ${state.realm===1?'ice':''}" style="--realm-x:${({0:0,2:50,3:100})[state.realm]||0}%"></div>`; }

function journeySheet() {
    const next=btn(gate()?'Challenge boss':'Realm journey',gate()?'boss':'map',true);
    return `<section class="journey-sheet"><div class="realm-utility">${metric(resourceIcon(),`+${rate()}/s`,`${realms[state.realm]} shards per second`)}<span class="idle-window">${ui('time','inline-icon')} ${Math.floor(state.seconds/3600)}h / 12h</span></div><div class="realm-actions">${btn('Play & earn','activePlay')}${next}</div></section>`;
}
function sceneLoadout(){return `<div class="mini-loadout scene-loadout" aria-label="Idle spell build · Select a slot to edit">${Array.from({length:4},(_,i)=>`<button class="idle-slot ${idleAnimation.activeSpell===state.idle[i]?'is-casting':''}" data-idle-spell="${state.idle[i]||''}" data-slot="${i}" data-build="idle" aria-label="Choose idle spell in slot ${i+1}${state.idle[i]?': '+esc(state.idle[i]):', empty'}">${icon(state.idle[i])}<span class="slot-number" aria-hidden="true">${i+1}</span></button>`).join('')}</div>`;}
function realmView() {
    const active = state.idle.includes(idleAnimation.activeSpell) ? idleAnimation.activeSpell : null;
    return `<section class="realm-page realm-${realms[state.realm].toLowerCase()}">
        <div class="scene">${scenery()}
            <div class="realm-location"><div class="location-context">${WorldMap.location()}${WorldMap.progress()}</div>${RealmDiscoveries.trigger()}</div>
            <div class="idle-label"><span class="status-dot" aria-hidden="true"></span> ${atCap()?'IDLE PAUSED':'IDLE'}</div>
            <div class="actor mage"><span class="actor-shadow"></span><span class="mage-body">${sprite('mage')}</span><span class="cast-glow"></span></div>
            <div class="actor enemy"><span class="actor-shadow"></span><div class="enemy-hp"><i style="width:${state.enemyHp/RealmProgression.enemyHp()*100}%"></i></div>${sprite(EncounterArt.enemy()[0])}<span class="enemy-name">${EncounterArt.enemy()[1]}</span></div>
            <div class="spell-flight" aria-hidden="true"><span class="spell-trail"></span><span class="flight-art"></span></div>
            <div class="impact-burst" aria-hidden="true"></div><span class="damage-float" aria-hidden="true"></span><span class="loot-label" aria-hidden="true"></span>
            <div class="cast-caption" aria-live="off"><span class="cast-icon">${active?sprite(spell(active).art):''}</span><span class="cast-name">${active||(state.idle.some(Boolean)?'':'Equip a spell to begin')}</span></div>
            ${GroundLoot.view()}${sceneLoadout()}<div class="scene-foot"><span></span><span>${state.kills} defeated</span></div>
        </div>${journeySheet()}
    </section>`;
}

function collectionTools(kind) {
    const options = kind==='spells'?['All','Unlocked','Realm finds','Fire','Ice','Earth','Wind','Fusion','Shield']:['All','HP','Damage'];
    return `<div class="collection-tools"><input data-search="${kind}" aria-label="Search ${kind}" placeholder="Search ${kind}…" value="${esc(state.queries[kind])}"><select data-filter="${kind}" aria-label="Filter ${kind}">${options.map(o=>`<option ${state.filters[kind]===o?'selected':''}>${o}</option>`).join('')}</select></div>`;
}
function grid(kind,picker=false) {
    const query = state.queries[kind].toLowerCase();
    const filter = state.filters[kind];
    let items = kind==='spells'?spells.map((s,id)=>({...s,id,locked:!state.unlocked.includes(s.name)})):(state.largeCollection?Array.from({length:240},(_,i)=>i):DungeonUI.familiarIds()).map(familiar);
    const total = items.length;
    items = items.filter(item=>item.name.toLowerCase().includes(query) && (filter==='All'||(kind==='spells'?(filter==='Unlocked'?!item.locked:filter===item.element||(filter==='Shield'&&item.kind==='shield')||(filter==='Realm finds'&&item.acquisition==='realmIdle')):item.type===filter)));
    const perPage = 18;
    const pages = Math.max(1,Math.ceil(items.length/perPage));
    state.pages[kind] = Math.min(state.pages[kind],pages-1);
    const page = state.pages[kind];
    return `<div class="collection-meta">${items.length} / ${total} ${kind}</div><div class="collection-grid">${items.slice(page*perPage,(page+1)*perPage).map(item=>{
        const selected = kind==='familiars'?state.familiar===item.id:state[state.build].includes(item.name);
        return `<button class="collection-card ${selected?'selected':''} ${item.locked?'locked':''}" data-card="${kind}" data-id="${item.id}" aria-label="${esc(item.name)}${selected?', selected':''}${item.locked?', not unlocked':''}" ${selected?'aria-pressed="true"':'aria-pressed="false"'}>${sprite(item.art)}<strong>${esc(item.name)}</strong>${kind==='spells'&&!item.locked?rarityTag(item.name):''}<small>${kind==='spells'?(item.acquisition==='realmIdle'?item.element+' idle':item.locked?ui('lock','inline-icon'):item.kind==='shield'?'Shield':`${spellDamage(item.name)} dmg`):item.buff}</small></button>`;
    }).join('')}</div>${items.length===0?'<div class="no-results">No matches. Try another name or filter.</div>':''}${pages>1?`<div class="pagination"><button data-page="-1" data-kind="${kind}" ${page===0?'disabled':''} aria-label="Previous page">←</button><span>${page+1} / ${pages}</span><button data-page="1" data-kind="${kind}" ${page===pages-1?'disabled':''} aria-label="Next page">→</button></div>`:''}`;
}
function slots(build,autos=false) {
    return `<div class="slots">${Array.from({length:4},(_,i)=>`<div class="slot"><button class="loadout-button" data-slot="${i}" data-build="${build}" aria-label="Choose ${build} spell in slot ${i+1}">${icon(state[build][i])}<span class="slot-number" aria-hidden="true">${i+1}</span></button>${autos?`<button class="toggle ${state[build][i]&&state.autos[i]?'on':''}" data-auto="${i}" ${state[build][i]?'':'disabled'} aria-label="Slot ${i+1} autocast" aria-pressed="${!!state[build][i]&&state.autos[i]}">${state[build][i]?(state.autos[i]?'Auto':'Manual'):'No spell'}</button>`:''}</div>`).join('')}</div>`;
}
function libraryView() {
    const kind=state.collectionTab;
    return `<section class="page collection-page">${title('Collection')}<div class="tabs"><button data-tab="spells" class="${kind==='spells'?'active':''}">${ui('book')} Spells</button><button data-tab="familiars" class="${kind==='familiars'?'active':''}">${sprite('moth')} Familiars</button></div>${kind==='spells'?`<div class="tabs build-tabs"><button data-build="idle" class="${state.build==='idle'?'active':''}">Idle build</button><button data-build="boss" class="${state.build==='boss'?'active':''}">Boss build</button></div>${slots(state.build)}`:`<button class="familiar-summary" data-action="chooseFamiliar">${sprite(familiar(state.familiar).art)}<span><strong>${esc(familiar(state.familiar).name)}</strong><small>${familiar(state.familiar).buff} · Boss only</small></span>${glyph('edit')}</button>`}${collectionTools(kind)}<div id="collection-results">${grid(kind)}</div></section>`;
}
function bossView() {return RealmProgression.bossView();}
function fusionQuote(recipe){
    const current=MageRarity.quote(recipe,state.spellRarities,'comparison');
    if(!state.fusionQuote||state.fusionQuote.recipeId!==recipe.id||(!state.fusionReceipt&&MageRarity.fingerprint(current)!==MageRarity.fingerprint(state.fusionQuote))){state.fusionQuote=MageRarity.quote(recipe,state.spellRarities,'quote-'+(++quoteSerial));state.fusionReceipt=null;}
    return state.fusionQuote;
}
function attemptFusion(id){
    const recipe=fusionRecipes.find(r=>r.id===id);if(!recipe)return;
    const shown=fusionQuote(recipe),previous=state.fusionReceipts.find(r=>r.quoteId===shown.id);
    if(previous){state.fusionReceipt=previous;render(true);return;}
    const out=MageRarity.attempt(state,recipe,shown,{requestId:'attempt-'+shown.id,sample:Math.random()});
    if(!out.ok)return notify(out.reason);
    state.fusionReceipt=out.receipt;render(true);
}
function forgeView() {
    const recipe=fusionRecipes.find(r=>r.id===state.fusionRecipe)||fusionRecipes[0],q=fusionQuote(recipe),receipt=state.fusionReceipt?.quoteId===q.id?state.fusionReceipt:null;
    const allowed=state.forgeLevel>=recipe.level&&recipe.inputs.every(n=>state.unlocked.includes(n)),afford=state.shards[0]>=q.cost.fire&&state.ore>=q.cost.ore;
    return `<section class="page forge-page rarity-forge"><div class="forge-heading"><button class="forge-title" data-action="forgeInfo" aria-label="View forge level and upgrades"><strong>Spellforge</strong><small>Forge ${state.forgeLevel} ⌄</small></button><div class="tabs"><button data-forge-tab="craft" class="${state.forgeTab!=='fusion'?'active':''}">Craft</button><button data-forge-tab="fusion" class="${state.forgeTab==='fusion'?'active':''}">Fusion</button></div></div>${state.forgeTab!=='fusion'?`<div class="collection-grid">${spells.map((s,id)=>({s,id})).filter(({s})=>s.element!=='Fusion'&&s.acquisition!=='realmIdle').map(({s,id})=>`<button class="collection-card ${state.unlocked.includes(s.name)?'selected':''}" data-craft-card="${id}">${sprite(s.art)}<strong>${s.name}</strong><small>${state.unlocked.includes(s.name)?rarityTag(s.name):ui(s.element==='Ice'?'ice':'fire','inline-icon')+(s.name==='Icebolt'?5:10)}</small></button>`).join('')}</div>`:receipt?`<div class="fusion-outcome" style="--rarity:${MageRarity.colors[receipt.rarity]}"><span class="kicker">FUSION COMPLETE</span>${sprite(spell(receipt.result).art)}<h3>${receipt.result}</h3><strong class="outcome-rarity">${MageRarity.tiers[receipt.rarity]}</strong>${receipt.keptBest?`<p class="compact-notice">Your ${MageRarity.tiers[receipt.best]} version stays.</p>`:''}<div class="cost-summary"><span>Spent</span>${metric('fire',receipt.cost.fire,'Fire shards spent')}${receipt.cost.ore?metric('ore',receipt.cost.ore,'Ore spent'):''}</div><p class="ingredient-safety">${ui('lock','inline-icon')} Both ingredients kept</p></div><div class="primary-dock stack">${btn('Continue','realm')}${btn('Prepare another attempt','prepareFusion',true)}</div>`:`<button class="fusion-equation" data-action="chooseFusionRecipe" aria-label="Choose fusion ingredients">${recipe.inputs.map((name,i)=>`<span class="fusion-parent" style="--rarity:${MageRarity.colors[rarityOf(name)]}">${sprite(spell(name).art)}<strong>${name}</strong>${rarityTag(name)}</span>${i===0?'<b aria-hidden="true">+</b>':''}`).join('')}${glyph('arrow')}<span class="fusion-unknown">${sprite(state.unlocked.includes(recipe.result)?spell(recipe.result).art:'shards')}<small>${state.unlocked.includes(recipe.result)?recipe.result:'New spell'}</small></span><span class="equation-edit" aria-hidden="true">⌄</span></button><div class="rarity-odds"><div class="row between"><strong>Result rarity</strong><small>100% total</small></div><div class="odds-bar" aria-hidden="true">${q.odds.map((n,i)=>n?`<i style="width:${n/100}%;background:${MageRarity.colors[i]}"></i>`:'').join('')}</div><div class="odds-grid">${q.odds.map((n,i)=>`<div class="${n?'':'zero-odds'}" style="--rarity:${MageRarity.colors[i]}"><span>${MageRarity.tiers[i]}</span><b>${n/100}%</b></div>`).join('')}</div></div><div class="cost-summary"><span>Each attempt</span>${metric('fire',q.cost.fire,'Fire shards charged per attempt')}${q.cost.ore?metric('ore',q.cost.ore,'Ore charged per attempt'):''}</div><div class="fusion-risk"><span>${ui('lock','inline-icon')} Both spells kept</span><small>Cost applies to every rarity outcome.</small></div>${state.unlocked.includes(recipe.result)?`<p class="best-owned">Best owned: ${rarityTag(recipe.result)} · Never downgraded</p>`:''}${!allowed?`<p class="compact-notice">${state.forgeLevel<recipe.level?'Requires forge '+recipe.level:'Unlock both ingredients first'}</p>`:''}<div class="primary-dock">${btn('Fuse',recipe.id==='bolt'?'fuse':recipe.id==='cone'?'fuseCone':'fuseShield',false,!allowed||!afford)}</div>`}</section>`;
}
function venturesView(){return VentureShopUI.ventures();}
function fightView() {
    const f = state.fight;
    return `<section class="fight-page"><header class="fight-head"><div class="row between"><h2>${f.journeyName}</h2><strong class="gold">${ui('time','inline-icon')} ${90-f.elapsed}s</strong></div><div class="boss-track" aria-label="Boss health"><i style="width:${f.bossHp/(f.bossMax||600)*100}%"></i></div><span class="tiny muted">${Math.ceil(f.bossHp)} / ${f.bossMax||600} HP · ${familiar(state.familiar).buff} active</span></header><div class="fight-arena" aria-label="Drag or tap to move the mage">${scenery()}${sprite(f.journeyTarget?EncounterArt.boss(f.realm,Number(f.journeyTarget.split(':').at(-1))):'golem','boss-actor')}${f.swarm?SwarmBoss.view(f):''}${effectBadges(f.effects)}${SwarmBoss.responseView(f)}<div class="danger" aria-hidden="true"></div><span class="fight-mage" style="left:${f.x}%;top:${f.y}%">${sprite('mage')}${shieldHalo(f.effects)}</span><div class="arena-hint">Drag to move · Avoid the mark</div></div><section class="fight-bottom"><div class="slots">${Array.from({length:4},(_,i)=>state.boss[i]?`<button class="cast-button" data-cast="${i}" ${f.cooldowns[i]>0||state.autos[i]?'disabled':''}>${sprite(spell(state.boss[i]).art)}<span>${f.cooldowns[i]>0?f.cooldowns[i]+'s':state.autos[i]?'Auto':'Cast'}</span></button>`:`<div class="spell-icon empty">${ui('empty')}</div>`).join('')}</div><button class="text-button" data-action="retreat">Leave attempt</button></section></section>`;
}
function resultView() {return RealmProgression.resultView();}
function returnView() {
    const r=state.returned;
    if(!r)return `<section class="page return-page center">${title('Idle rewards')}${sprite('mage','return-mage')}<h3>All caught up</h3><p class="muted">Your mage is farming.</p><div class="return-time">${ui('time')}<span>Up to <b>12h</b> per visit</span></div><div class="primary-dock">${btn('Continue','realm')}</div></section>`;
    const counted=Math.min(12,r.hours),claimed=state.returnClaimed,rewardRealm=r.realm??state.realm;
    return `<section class="page return-page">${title(claimed?'Rewards collected':'Welcome back')}<div class="return-hero">${sprite('mage','return-mage')}<div><span class="kicker">IDLE REWARDS</span><div class="return-time">${ui('time')}<strong>${counted}h</strong><span>/ 12h</span>${counted===12?'<span class="status-chip">MAX</span>':''}</div><small class="muted">${r.hours}h away${r.materials?' · '+Object.keys(r.materials).map(id=>MageVentureDevelopment.find(id).name).join(' + '):''}</small></div></div><div class="reward-grid">${[[realms[rewardRealm].toLowerCase(),realms[rewardRealm]+' shards',r.shards],['ore','Ore',r.ore],['pearls','Pearls',r.pearls]].map(([art,name,value])=>`<div class="reward-tile">${ui(art)}<b>+${value.toLocaleString('en')}</b><span>${name}</span></div>`).join('')}</div>${WorldMap.returned(r)}${RealmDiscoveries.returnMarkup()}<button class="text-button reward-details" data-action="returnDetails">${glyph('info')} Reward details</button><div class="primary-dock">${btn(claimed?'Continue':'Collect resources','claimReturn')}</div></section>`;
}
function accountView() {
    return `<section class="page account-page">${title('Account')}${sprite('portal','result-art')}<div class="panel"><h3>Platform account</h3><p class="muted">Save & restore · Preview</p></div><div class="stack">${btn('Connection test','disconnect',true)}${btn('Idle rewards','return',true)}</div></section>`;
}
function futureView(){const f=MageNavigation.features.find(f=>f[0]===state.futureFeature);return `<section class="page future-page center">${ui('book','result-art')}${title(f?.[1]||'Feature')}<p class="muted">Future feature study</p>${btn('All features','allFeatures',true)}</section>`;}
const views = {ventureDetail:()=>VentureDevelopmentUI.detail(),inventory:()=>RelicInventoryUI.inventory(),character:()=>RelicInventoryUI.character(),shop:()=>VentureShopUI.shop(),spirits:()=>VentureShopUI.spirits(),dungeons:()=>DungeonUI.view(),dungeonDetail:()=>DungeonUI.detail(),dungeonResult:()=>DungeonUI.result(),future:futureView,active:()=>ActivePlay.view(),realm:realmView,library:libraryView,boss:bossView,forge:forgeView,ventures:venturesView,fight:fightView,result:resultView,return:returnView,account:accountView};
function modalView() {
    if (!state.modal) return '';
    let body = '', heading = '';
    const craftRequirement = name => !state.won[0]&&['Icebolt','Flame Cone','Frost Ward'].includes(name)?'Defeat the Fire boss first':'';
    const m = state.modal;
    if(['inventoryItem','inventoryResult','inventoryRules','trait'].includes(m.type)){({heading,body}=RelicInventoryUI.modal(m));
    }else if(m.type==='groundItems'){heading='Waiting items';body=GroundLoot.modal();
    }else if(m.type==='spirit'||m.type==='spiritDrop'||m.type==='shopProduct'){({heading,body}=VentureShopUI.modal(m));
    }else if(m.type==='realmDiscovery'){heading='Realm discovery';body=RealmDiscoveries.detail();
    }else if(m.type==='dungeonInfo'){heading='Daily dungeons';body=DungeonUI.info();
    }else if(m.type==='forgeInfo'){heading='Forge '+state.forgeLevel;body=state.forgeLevel<3?`<p class="compact-notice">${!state.won[state.forgeLevel]?'Defeat the '+realms[state.forgeLevel]+' boss to upgrade.':'New fusion recipes await.'}</p>${btn('Forge '+(state.forgeLevel+1)+' · 10 fire-shards','upgradeForge',false,!state.won[state.forgeLevel]||state.shards[0]<10)}`:'<p class="muted">All prototype forge tiers unlocked.</p>';
    }else if(m.type==='features'){heading='All features';body=MageNavigation.grid();
    }else if(m.type==='fusionRecipes'){heading='Fusion ingredients';body=`<div class="recipe-picker">${fusionRecipes.map(r=>`<button data-recipe="${r.id}">${r.inputs.map(n=>sprite(spell(n).art)).join('+')}<span>${r.inputs.join(' + ')}</span><small>Forge ${r.level}</small></button>`).join('')}</div>`;
    }else if (m.type==='power') {
        heading = 'Mage Power';
        body = `<div class="power-explainer"><div>${ui('crest','power-crest')}<strong>${magePower()}</strong><span>MAGE POWER</span></div><div class="power-equation"><span>${ui('hp')}<b>${permanentHp()}</b><small>Permanent HP</small></span><i>+</i><span>${ui('power')}<b>${compactStat(spellPower())}</b><small>Spell power</small></span></div></div><p class="muted center">Permanent strength · Improve it in Ventures.</p>${btn('Ventures','ventures',true)}`;
    } else if (m.type==='resources') {
        heading = 'Resources';
        const entries = [['fire','Fire shards',state.shards[0]],['ice','Ice shards',state.shards[1]],['earth','Earth shards',state.shards[2]],['wind','Wind shards',state.shards[3]],['ore','Ore',state.ore],['pearls','Pearls',state.pearls]];
        body = `<div class="resource-balances">${entries.map(([art,name,value])=>`<div>${ui(art)}<span>${name}</span><strong>${value.toLocaleString('en')}</strong></div>`).join('')}</div>${VentureDevelopmentUI.balances()}`;
    } else if (m.type==='menu') {
        heading = 'Menu';
        body = `<div class="menu-grid">${[['Play & earn','activePlay','fire'],['Realms','map','portal'],['Collection','library','book'],['Account','account','crest'],['Idle rewards','return','time']].map(([name,action,art])=>`<button data-action="${action}">${['portal','fire'].includes(art)?sprite(art):ui(art)}<span>${name}</span></button>`).join('')}</div><details class="prototype-controls"><summary>Prototype controls</summary><p>Accelerated · No progress saved</p><p>B · Floating rune selected</p><div class="stack">${MageFreeGifts.tiers.map(t=>`<button class="rune-button secondary" data-experience="chest${t.name}">Preview ${t.name} chest</button>`).join('')}<button class="rune-button secondary" data-chest-replay ${ShopGiftsUI.status().receipt?'':'disabled'}>Replay chest reveal · No reward</button><button class="rune-button secondary" data-gift-hour>Advance 1 hour · Chest charge</button>${[['discovery','Realm drop chance'],['discoveryReady','Guaranteed next roll'],['discoveryFound','Spell discovered'],['discoveryIce','Ice realm progress'],['places','Realm atlas'],['dungeons','Daily dungeons'],['dungeonsDone','Daily rewards used'],['oneDungeonDaily','One daily reward study'],['familiarGoal','Familiar fragments · nearly there'],['rarity','Mixed rarity fusion'],['matchedRarity','Matched rarity fusion'],['start','New mage'],['gate','Boss gate'],['ice','Craft Icebolt'],['shieldSwarm','B · Shield + buff'],['shieldTrial','Fire Shield trial'],['shieldForge','Forge Fire Shield'],['shieldBoss','Shield boss'],['revisit','Revisit realms'],['collection','240 familiars'],['return','20h return']].map(([key,label])=>`<button class="rune-button secondary" data-scenario="${key}">${label}</button>`).join('')}${btn('Next farming stage','advance',true)}${btn('Boss victory','demoWin',true)}${btn('Boss defeat','demoLose',true)}${btn('12h cap','demoCap',true)}${btn('Simulate daily reset','nextDungeonDay',true)}</div></details>`;
    } else if (m.type==='map') {
        heading = 'World map';
        body = WorldMap.view();
    } else if (m.type==='picker') {
        heading = m.kind==='spells'?`Choose spell · Slot ${m.slot+1}`:'Choose one familiar';
        body = `${collectionTools(m.kind)}<div id="collection-results">${grid(m.kind,true)}</div>${m.kind==='spells'&&state[m.build][m.slot]?btn('Remove this spell','removeSlot',true):''}`;
    } else if (m.type==='card') {
        const item = m.kind==='spells'?spells[m.id]:familiar(m.id);
        heading = item.name;
        const unlocked = state.unlocked.includes(item.name);
        body = `<div class="spell-detail-hero">${sprite(item.art)}<p>${m.kind==='familiars'?item.buff+' · Boss only':item.name==='Frostfire Cone'&&!unlocked?'Discover a new shape fusion.':item.description}</p></div>${m.kind==='familiars'?btn(state.familiar===item.id?'Selected':'Select familiar','selectFamiliar',false,state.familiar===item.id):`${m.kind==='spells'&&unlocked?rarityTag(item.name):''}<div class="detail-stats"><div>${ui(item.kind==='shield'?'crest':'power','inline-icon')} ${item.kind?'Effect':'Damage'}<b>${item.kind==='shield'?'60 · 6s':spellDamage(item.name)}</b></div><div>${ui('time','inline-icon')} Cooldown<b>${item.cooldown}s</b></div></div>${!unlocked&&item.acquisition==='realmIdle'?`<p class="find-source">${ui(item.element.toLowerCase())} ${item.element} idle only</p>`:''}${!unlocked&&craftRequirement(item.name)?`<p class="compact-notice">${craftRequirement(item.name)}</p>`:''}${unlocked?`<div class="stack">${btn(state[state.build].includes(item.name)?'Unequip · '+state.build:'Equip · '+state.build,'equipSpell')}${btn('Try spell','trySpell',true)}</div>`:item.acquisition==='realmIdle'?btn('View discovery','realmDiscoveryForCard',true):item.name==='Icebolt'?btn('Craft · 5 ice-shards','craftIce',false,state.shards[1]<5||!state.won[0]):item.name==='Flame Cone'?btn('Craft · 10 fire-shards','craftFlame',false,state.shards[0]<10||!state.won[0]):item.name==='Frost Ward'?btn('Craft · 10 ice-shards','craftWard',false,!state.won[0]||state.shards[1]<10):btn('View recipe','inspectFusion',true)}`}`;
    } else if(m.type==='returnDetails') {
        heading='Reward details';
        const r=state.returned,counted=Math.min(12,r.hours);
        body=`<div class="return-line"><span>Time away</span><b>${r.hours}h</b></div><div class="return-line"><span>Time rewarded</span><b>${counted}h / 12h</b></div>${VentureDevelopmentUI.returnMaterials()}<p class="note">Mage and venture rewards run in parallel, up to 12 hours. Bosses wait for you.</p><p class="muted">${state.returnClaimed?'Already collected.':'Ready to collect.'}</p>`;
    } else if(m.type==='ventureInfo') {
        heading=m.mine?'Moonstone mine':'Silverfin pond';body=VentureShopUI.productionInfo(m.mine?'mine':'pond');

    }
    return `<div class="overlay"><section class="sheet sheet-${m.type}" role="dialog" aria-modal="true" aria-label="${esc(heading)}"><div class="row between" style="margin-bottom:12px"><h3>${esc(heading)}</h3><button class="sheet-close" data-action="close" aria-label="Close dialog">×</button></div>${body}</section></div>`;
}
function inspector() {
    document.querySelector('#state').textContent = JSON.stringify({ventureDevelopment:state.ventureDevelopment,inventory:state.inventory,groundLoot:state.groundLoot,freeGifts:state.freeGifts,ventureSpirits:state.ventureSpirits,ventureRates:MageVentureSpirits.production(state,state.ventureSpirits),shop:state.shop,mapStudy:RealmMapStudy.inspect(),realmProgression:RealmProgression.inspect(),variant,nav:MageNavigation.current(),dungeons:state.dungeons,realmFinds:{bank:state.realmFinds.bank,misses:state.realmFinds.misses,unseen:state.realmFinds.unseen,creditedWindows:state.realmFinds.windows,lastReceipt:state.realmFinds.receipts.at(-1)},spellRarities:state.spellRarities,fusionReceipt:state.fusionReceipt,crestStudy,activity:ActivePlay.inspect(),activeBonus:state.activeBonus||0,magePower:magePower(),permanentHp:permanentHp(),spellPower:spellPower(),ratingFormula:'Permanent HP + Spell power (illustrative)',view:state.view,realm:realms[state.realm],section:WorldMap.current().name,tier:RealmProgression.inspect().tier,node:RealmProgression.inspect().node,bossGate:gate(),won:state.won,idle:state.idle,boss:state.boss,autos:state.autos,familiar:familiar(state.familiar).name,shards:state.shards,ore:state.ore,pearls:state.pearls,countedHours:state.seconds/3600,cap:atCap(),returnClaimed:state.returnClaimed,collectionSize:state.largeCollection?240:DungeonUI.familiarIds().length},null,2);
}
function render(preserveScroll=false) {
    GroundLoot.syncDiscoveries();
    const url=new URL(location.href);url.searchParams.set('nav','B');if(state.view==='active')url.searchParams.set('view','active');else url.searchParams.delete('view');history.replaceState(null,'',url);
    const scroll = preserveScroll ? phone.querySelector('.game-content')?.scrollTop || 0 : 0;
    phone.dataset.nav=MageNavigation.current();
    document.body.classList.toggle('map-review-context',RealmProgression.reviewing()&&(state.modal?.type==='map'||state.view==='realm'&&!state.modal));
    document.body.classList.toggle('progression-context',RealmProgression.reviewing()&&state.view==='realm'&&!state.modal);
    phone.innerHTML = hud()+`<div class="game-content">${(views[state.view]||realmView)()}</div>`+nav()+modalView()+(toastText?`<div class="toast" role="status">${esc(toastText)}</div>`:'')+(!state.connected?`<section class="blocking"><h2>Connection lost</h2><p class="muted">Reconnect to continue.</p>${btn('Reconnect','reconnect')}</section>`:'');
    if(state.modal?.type==='map')phone.querySelector('.sheet-map>.row')?.remove();
    phone.querySelector('.game-content').scrollTop=scroll;
    phone.style.setProperty('--hud-height',phone.querySelector('.hud').offsetHeight+'px');
    VentureShopUI.decorate();
    document.querySelector('#variant-label').textContent = VentureShopUI.reviewEnabled()?VentureShopUI.label():RealmProgression.reviewing()?RealmMapStudy.label():state.modal?.type==='realmDiscovery'?'Realm-exclusive spell · Drop chance':state.modal?.type==='map'?'Realm atlas · Named places':'Realm discoveries · Compact idle';
    document.querySelector('#review-links').innerHTML = ['realm','inventory','character','dungeons','forge','boss','ventures','spirits','shop','library','return','account'].map(v=>`<button data-view="${v}">${({library:'Collection',return:'Return'})[v]||v[0].toUpperCase()+v.slice(1)}</button>`).join('');
    document.querySelectorAll('[data-progression-variant]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.progressionVariant===new URLSearchParams(location.search).get('progression')));
    inspector();
    if(state.modal)phone.querySelector('.sheet-close')?.focus({preventScroll:true});
}
function refreshHud() {
    phone.querySelector('.hud').outerHTML = hud();
    phone.style.setProperty('--hud-height',phone.querySelector('.hud').offsetHeight+'px');
}
function notify(message) {
    toastText=message; clearTimeout(toastTimer); render(true);
    toastTimer=setTimeout(()=>{toastText='';phone.querySelector('.toast')?.remove();},3000);
}
function go(view) { if(state.view==='active'&&view!=='active')ActivePlay.onLeave();state.view=view;state.modal=null;render(); }
function openModal(modal) { if(modal.type==='map'&&modal.realm===undefined)modal.realm=state.realm;lastFocus=document.activeElement;state.modal=modal;render(true);phone.querySelector('.sheet-close')?.focus(); }
function closeModal() {state.modal=null;render(true);if(lastFocus?.dataset.action)phone.querySelector(`[data-action="${lastFocus.dataset.action}"]`)?.focus();}
function scenario(key) {
    if(key==='buffSwarm')key='shieldSwarm'; // Explicit legacy review shortcut; no buff-only spell remains.
    const returnVentures=key==='return'?structuredClone({ventureDevelopment:state.ventureDevelopment,ventureSpirits:state.ventureSpirits,mining:state.mining,fishing:state.fishing,synergy:state.synergy}):null;
    ActivePlay.reset();
    DungeonUI.resetClock();
    resetIdleAnimation();
    state=fresh();if(returnVentures)Object.assign(state,returnVentures);toastText='';
    let node=1;const journey=()=>{const kills=state.stageKills;RealmProgression.adopt(state.realm,node);state.stageKills=kills;};
    if(key==='gate'){node=25;state.shards[0]=35;}
    if(key==='ice'){state.realm=1;state.shards[1]=5;}
    if(key==='revisit'){node=3;state.realm=1;state.stageKills=2;state.shards=[35,12,0,0];state.unlocked=['Firebolt','Icebolt'];state.idle=['Firebolt','Icebolt'];}
    if(key==='active'){state.unlocked=spells.slice(0,3).map(s=>s.name);state.idle=['Firebolt','Icebolt'];state.realm=2;state.forgeLevel=2;state.view='active';}
    if(key==='spells'){state.realm=2;state.unlocked=spells.slice(0,3).map(s=>s.name);state.idle=spells.slice(0,3).map(s=>s.name);state.boss=['Firebolt','Icebolt'];state.forgeLevel=2;}
    if(['swarmBasic','swarmCone','swarmBoss','coneForge'].includes(key)){
        node=25;state.realm=3;state.forgeLevel=3;state.shards=[40,10,10,10];state.hpBonus=200;
        state.unlocked=spells.slice(0,4).map(s=>s.name);state.idle=['Firebolt','Icebolt','Frostfire Bolt'];state.boss=['Firebolt','Icebolt','Frostfire Bolt','Flame Cone'];state.view='active';
        if(key==='swarmCone'){state.unlocked.push('Frostfire Cone');state.idle=['Firebolt','Icebolt','Frostfire Bolt','Frostfire Cone'];state.boss=[...state.idle];}
        if(key==='coneForge'){state.view='forge';state.forgeTab='fusion';state.fusionRecipe='cone';}
        if(key==='swarmBoss')state.view='boss';
    }
    if(['shieldSwarm','shieldTrial','shieldBoss','shieldForge'].includes(key)){
        node=25;state.realm=3;state.forgeLevel=3;state.hpBonus=200;state.shards=[40,20,20,10];
        state.unlocked=spells.filter(s=>s.name!=='Fire Shield').map(s=>s.name);state.idle=['Firebolt','Frostfire Bolt','Frostfire Cone','Frost Ward'];state.boss=[...state.idle];state.view='active';
        if(key!=='shieldForge'){state.unlocked.push('Fire Shield');state.idle[3]='Fire Shield';state.boss[3]='Fire Shield';}
        if(key==='shieldForge'){state.view='forge';state.forgeTab='fusion';state.fusionRecipe='shield';}
        if(key==='shieldBoss')state.view='boss';
    }
    if(key==='collection'){state.largeCollection=true;state.view='library';state.collectionTab='familiars';}
    if(key==='return'){
        node=25;state.seconds=43200;state.returnPending=true;state.view='return';
        state.returned={hours:20,realm:0,startNode:1,endNode:24,shards:Math.round(.6*43200),ore:Math.round(MageVentureSpirits.production(state,state.ventureSpirits).ore*720),pearls:Math.round(MageVentureSpirits.production(state,state.ventureSpirits).pearls*720),materials:MageVentureDevelopment.preview(state.ventureDevelopment,MageVentureSpirits.production(state,state.ventureSpirits),43200)};
    }
    if(['rarity','matchedRarity'].includes(key)){state.realm=2;state.forgeLevel=2;state.unlocked=['Firebolt','Icebolt'];state.idle=['Firebolt','Icebolt'];state.boss=['Firebolt','Icebolt'];state.shards=[120,20,0,0];state.ore=120;state.spellRarities={Firebolt:4,Icebolt:key==='matchedRarity'?4:0};state.view='forge';state.forgeTab='fusion';state.fusionRecipe='bolt';}
    if(['dungeons','dungeonsDone','oneDungeonDaily','familiarGoal'].includes(key)){state.realm=2;state.forgeLevel=2;state.unlocked=['Firebolt','Icebolt','Frostfire Bolt'];state.idle=[...state.unlocked];state.boss=['Firebolt','Icebolt'];state.shards=[40,20,20,0];state.dungeonElement=2;state.view='dungeons';if(key==='dungeonsDone')state.dungeons.claims=Object.fromEntries(MageDungeons.definitions.map(d=>[d.id,2]));if(key==='oneDungeonDaily')state.dungeons.limit=1;if(key==='familiarGoal'){state.dungeons.fragments=15;state.dungeonSelected='familiar';state.view='dungeonDetail';}}
    if(key==='places'){state.view='realm';state.realm=2;node=4;state.shards=[40,20,20,0];state.unlocked=['Firebolt','Icebolt','Frostfire Bolt'];state.idle=[...state.unlocked];journey();openModal({type:'map',realm:2});return;}
    if(key==='discovery'){state.realmFinds.misses[0]=10;state.realmFinds.bank[0]=1195;journey();openModal({type:'realmDiscovery',realm:0});return;}
    if(key==='discoveryReady'){state.realmFinds.misses[0]=11;state.realmFinds.bank[0]=1199;}
    if(key==='discoveryFound'){state.realmFinds.misses[0]=11;MageIdleSpells.credit(state,{id:'found-review',windowId:state.realmFindWindow,realm:0,seconds:1200,samples:[.99,0]});}
    if(key==='discoveryPool'){state.unlocked.push('Ember Bloom');state.realmFinds.misses[0]=11;MageIdleSpells.credit(state,{id:'pool-review',windowId:state.realmFindWindow,realm:0,seconds:1200,samples:[.99,0]});state.realmFinds.misses[0]=4;state.realmFinds.bank[0]=600;journey();openModal({type:'realmDiscovery',realm:0});return;}
    if(key==='discoveryIce'){state.realm=1;state.realmFinds.misses[1]=9;state.realmFinds.bank[1]=1080;}
    journey();
    if(state.returned)RealmDiscoveries.prepareReturn();
    if(key==='shieldTrial'){ActivePlay.open('Fire Shield');return;}
    render();
}
function advance() {return RealmProgression.advanceIdle();}
function startFight() {
    if(!gate()||!state.boss.some(Boolean))return;
    state.view='fight';state.modal=null;
    state.fight={realm:state.realm,elapsed:0,bossHp:600,hp:hpMax(),cooldowns:[0,0,0,0],x:52,y:72,result:null,effects:MageEffects.create(),attackSerial:0,lastResponse:null};
    RealmProgression.prepareFight();
    if(state.realm===3)SwarmBoss.start(state.fight);
    render();
}
function finishFight(won,force=false) {return RealmProgression.finishFight(won,force);}
function cast(i) {
    const f=state.fight,s=spell(state.boss[i]);
    if(!f||f.result||!s||f.cooldowns[i]>0)return;
    if(MageEffects.cast(f.effects,s.name,performance.now())){f.cooldowns[i]=s.cooldown;return;}
    const damage=Math.round((spellDamage(s.name)+state.damageBonus)*(state.familiar%2?1.08:1)*MageEffects.multiplier(f.effects,performance.now()));
    if(f.swarm)SwarmBoss.cast(f,s,damage);else f.bossHp=Math.max(0,f.bossHp-damage);
    f.cooldowns[i]=s.cooldown;
    if(!f.bossHp)finishFight(true);
}
const actions={
    realmDiscoveryForCard:()=>RealmDiscoveries.open(spells[state.modal.id].realm),farmRealmFind:()=>RealmDiscoveries.farm(),
    dungeons:()=>go('dungeons'),enterDungeon:()=>DungeonUI.enter(),dungeonInfo:()=>openModal({type:'dungeonInfo'}),nextDungeonDay:()=>DungeonUI.nextDay(),
    activePlay:()=>ActivePlay.open(),apAgain:()=>ActivePlay.start(),apRealm:()=>go('realm'),
    trySpell:()=>{const name=spells[state.modal.id].name;ActivePlay.open(name);},
    powerInfo:()=>openModal({type:'power'}),resources:()=>openModal({type:'resources'}),allFeatures:()=>openModal({type:'features'}),forgeInfo:()=>openModal({type:'forgeInfo'}),chooseFusionRecipe:()=>openModal({type:'fusionRecipes'}),prepareFusion:()=>{state.fusionQuote=null;state.fusionReceipt=null;render();},returnDetails:()=>openModal({type:'returnDetails'}),mineInfo:()=>openModal({type:'ventureInfo',mine:true}),pondInfo:()=>openModal({type:'ventureInfo',mine:false}),ventures:()=>go('ventures'),menu:()=>openModal({type:MageNavigation.headerLaunch()?'features':'menu'}),map:()=>openModal({type:'map'}),close:closeModal,
    realm:()=>go('realm'),forge:()=>go('forge'),boss:()=>go('boss'),library:()=>go('library'),account:()=>go('account'),return:()=>go('return'),
    idleBuild:()=>{state.collectionTab='spells';state.build='idle';go('library');},
    chooseFamiliar:()=>openModal({type:'picker',kind:'familiars'}),
    startFight,retreat:()=>finishFight(false),
    advance:()=>{state.modal=null;advance();render(true);},demoWin:()=>finishFight(true,true),demoLose:()=>finishFight(false,true),demoCap:()=>{state.seconds=43200;state.modal=null;render();},
    selectFamiliar:()=>{state.familiar=state.modal.id;state.modal=null;notify('Familiar selected');},
    equipSpell:()=>{
        const name=spells[state.modal.id].name,build=state[state.build];
        if(build.includes(name))build[build.indexOf(name)]=null;else{const empty=Array.from({length:4},(_,i)=>i).find(i=>!build[i]);if(empty===undefined)return notify('Build full · Remove a spell first');while(build.length<=empty)build.push(null);build[empty]=name;}while(build.length&&!build.at(-1))build.pop();
        state.modal=null;notify(''+state.build[0].toUpperCase()+state.build.slice(1)+' build updated.');
    },
    removeSlot:()=>{const m=state.modal,build=state[m.build];build[m.slot]=null;while(build.length&&!build.at(-1))build.pop();state.modal=null;render(true);phone.querySelector('[data-slot="'+m.slot+'"][data-build="'+m.build+'"]')?.focus();},
    craftIce:()=>{
        if(state.shards[1]<5||state.unlocked.includes('Icebolt')||!state.won[0])return;
        state.shards[1]-=5;state.unlocked.push('Icebolt');state.modal=null;state.build='idle';state.collectionTab='spells';state.view='library';notify('Icebolt unlocked');
    },
    inspectFusion:()=>{state.forgeTab='fusion';state.fusionRecipe=({2:'bolt',4:'cone',6:'shield'})[state.modal.id]||'bolt';go('forge');},
    upgradeForge:()=>{if(state.forgeLevel>=3||!state.won[state.forgeLevel]||state.shards[0]<10)return;state.shards[0]-=10;state.forgeLevel++;notify('Forge '+state.forgeLevel+' unlocked');},
    fuse:()=>attemptFusion('bolt'),
    buyDamage:()=>{if(state.ore<40)return;state.ore-=40;state.damageBonus+=5;notify('Spell power +5 · Mage Power +5');},
    craftWard:()=>{if(!state.won[0]||state.shards[1]<10||state.unlocked.includes('Frost Ward'))return;state.shards[1]-=10;state.unlocked.push('Frost Ward');go('library');notify('Frost Ward unlocked');},
    fuseShield:()=>attemptFusion('shield'),
    craftFlame:()=>{if(!state.won[0]||state.shards[0]<10||state.unlocked.includes('Flame Cone'))return;state.shards[0]-=10;state.unlocked.push('Flame Cone');state.modal=null;go('library');notify('Flame Cone unlocked');},
    fuseCone:()=>attemptFusion('cone'),
    buyHp:()=>{if(state.pearls<30)return;state.pearls-=30;state.hpBonus+=10;notify('HP +10 · Mage Power +10');},
    upgradeMine:()=>{if(state.ore<60)return;state.ore-=60;state.mining++;render(true);},
    synergy:()=>{if(state.synergy||state.pearls<50)return;state.pearls-=50;state.synergy=true;render(true);},
    claimReturn:()=>{
        if(state.returnClaimed)return go('realm');
        if(!state.returned||!state.returnPending)return;
        if(!RealmDiscoveries.claimReturn())return notify('Could not confirm idle discoveries');
        state.shards[state.returned.realm??state.realm]+=state.returned.shards;state.ore+=state.returned.ore;state.pearls+=state.returned.pearls;MageVentureDevelopment.credit(state.ventureDevelopment,state.returned.materials||{});state.returnClaimed=true;state.returnPending=false;
        state.seconds=0;state.realmFindWindow=RealmDiscoveries.windowId();go('realm');notify('Rewards collected');
    },
    resetWindow:()=>{state.seconds=0;state.realmFindWindow=RealmDiscoveries.windowId();notify('Idle restarted');},
    disconnect:()=>{state.connected=false;render();},reconnect:()=>{state.connected=true;notify('Reconnected');}
};
function handleClick(event) {
    const el=event.target.closest('button');if(!el||el.disabled)return;
    if(!state.connected&&el.closest('#phone')&&el.dataset.action!=='reconnect')return;
    if(RelicInventoryUI.handle(el))return;
    if(VentureShopUI.handle(el))return;
    if(RealmMapStudy.handle(el))return;
    if(RealmProgression.handle(el))return;
    if(el.dataset.discoveryRealm!==undefined)return RealmDiscoveries.open(Number(el.dataset.discoveryRealm));
    if(RealmDiscoveries.handle(el))return;
    if(el.dataset.dungeon){state.dungeonSelected=el.dataset.dungeon;return go('dungeonDetail');}
    if(el.dataset.dungeonElement!==undefined){state.dungeonElement=Number(el.dataset.dungeonElement);return render(true);}
    if(el.dataset.navStudy)return MageNavigation.change(el.dataset.navStudy);
    if(el.dataset.feature)return MageNavigation.select(el.dataset.feature);
    if(el.dataset.scenario)return scenario(el.dataset.scenario);
    if(el.dataset.demo){if(el.dataset.demo==='advance'){advance();render(true);}else if(el.dataset.demo==='cap'){state.seconds=43200;render(true);}else finishFight(el.dataset.demo==='win',true);return;}
    if(!state.connected&&el.dataset.action!=='reconnect')return;
    if(ActivePlay.handleButton(el))return;
    if(el.dataset.action){actions[el.dataset.action]?.();return;}
    if(el.dataset.view)return go(el.dataset.view);
    if(el.dataset.tab){state.collectionTab=el.dataset.tab;return render();}
    if(el.dataset.slot!==undefined){state.build=el.dataset.build;return openModal({type:'picker',kind:'spells',slot:Number(el.dataset.slot),build:el.dataset.build});}
    if(el.dataset.build){state.build=el.dataset.build;return render();}
    if(el.dataset.auto!==undefined){const i=Number(el.dataset.auto);state.autos[i]=!state.autos[i];return render(true);}
    if(el.dataset.card){
        const kind=el.dataset.card,id=Number(el.dataset.id);
        if(state.modal?.type==='picker'&&kind==='spells'){
            const name=spells[id].name;if(!state.unlocked.includes(name))return notify('Unlock at the Spellforge');
            const m=state.modal,build=state[m.build];
            if(build.includes(name)&&build[m.slot]!==name)return notify('Already equipped');
            while(build.length<=m.slot)build.push(null);build[m.slot]=name;state.modal=null;notify('Spell equipped');phone.querySelector('[data-slot="'+m.slot+'"][data-build="'+m.build+'"]')?.focus({preventScroll:true});return;
        }
        if(kind==='spells')state.realmFinds.unseen=state.realmFinds.unseen.filter(n=>n!==spells[id].name);
        return openModal({type:'card',kind,id});
    }
    if(el.dataset.page){state.pages[el.dataset.kind]+=Number(el.dataset.page);refreshCollection();return;}
    if(el.dataset.craftCard!==undefined)return openModal({type:'card',kind:'spells',id:Number(el.dataset.craftCard)});
    if(el.dataset.recipe){state.fusionRecipe=el.dataset.recipe;state.fusionQuote=null;state.fusionReceipt=null;state.modal=null;return render(true);}
    if(el.dataset.forgeTab){state.forgeTab=el.dataset.forgeTab;return render(true);}
    if(el.dataset.cast!==undefined){cast(Number(el.dataset.cast));return render(true);}
}
function refreshCollection() {
    const kind=state.modal?.kind||state.collectionTab;
    const results=phone.querySelector('#collection-results');if(results)results.innerHTML=grid(kind,state.modal?.type==='picker');inspector();
}
document.addEventListener('click',handleClick);
document.addEventListener('input',event=>{const kind=event.target.dataset.search;if(kind){state.queries[kind]=event.target.value;state.pages[kind]=0;refreshCollection();}});
document.addEventListener('change',event=>{const kind=event.target.dataset.filter;if(kind){state.filters[kind]=event.target.value;state.pages[kind]=0;refreshCollection();}});
let reviewStudy=0;
function switchVariant(delta){if(VentureShopUI.reviewEnabled())return VentureShopUI.change(delta);if(RealmProgression.reviewing())return RealmProgression.change(delta);const studies=['start','discovery','discoveryReady','discoveryFound','return'];reviewStudy=(reviewStudy+delta+studies.length)%studies.length;scenario(studies[reviewStudy]);const url=new URL(location.href);url.searchParams.set('study',studies[reviewStudy]);history.replaceState(null,'',url);}
document.querySelector('#previous').onclick=()=>switchVariant(-1);
document.querySelector('#next').onclick=()=>switchVariant(1);
document.addEventListener('keydown',event=>{
    if(state.modal&&event.key==='Escape'){event.preventDefault();closeModal();return;}
    if(state.modal&&event.key==='Tab'){
        const focusables=[...phone.querySelectorAll('.sheet button:not(:disabled),.sheet input,.sheet select,.sheet a')];
        const first=focusables[0],last=focusables.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}return;
    }
    if(event.target.closest('input,textarea,select,[contenteditable="true"]')||state.view==='fight'||(state.modal&&state.modal.type!=='map'))return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();switchVariant(event.key==='ArrowLeft'?-1:1);}
});
window.addEventListener('popstate',()=>{const value=new URLSearchParams(location.search).get('crest');crestStudy=crestStudies.includes(value)?value:'base';render(true);});
let dragging=false;
function moveMage(event) {
    const arena=event.target.closest('.fight-arena');if(!arena||state.view!=='fight'||!state.connected)return;
    const box=arena.getBoundingClientRect();state.fight.x=Math.max(8,Math.min(92,(event.clientX-box.left)/box.width*100));state.fight.y=Math.max(40,Math.min(88,(event.clientY-box.top)/box.height*100));
    const mage=arena.querySelector('.fight-mage');mage.style.left=state.fight.x+'%';mage.style.top=state.fight.y+'%';
}
phone.addEventListener('pointerdown',event=>{if(event.target.closest('.fight-arena')){dragging=true;event.target.closest('.fight-arena').setPointerCapture(event.pointerId);moveMage(event);}});
phone.addEventListener('pointermove',event=>{if(dragging)moveMage(event);});
phone.addEventListener('pointerup',()=>{dragging=false;});
phone.addEventListener('pointercancel',()=>{dragging=false;});
const idleAnimation = { previous:null, activeSpell:null, nextAt:0, phase:'rest', timers:[] };
function resetIdleAnimation() {
    idleAnimation.timers.forEach(clearTimeout);
    idleAnimation.timers=[];idleAnimation.previous=null;idleAnimation.activeSpell=null;idleAnimation.phase='rest';idleAnimation.nextAt=performance.now()+350;
}
function updateIdlePanels() {
    refreshHud();
    if(state.modal?.type==='map'){WorldMap.refreshAtlas();inspector();return;}
    if(state.view!=='realm'||state.modal)return;
    const sheet=phone.querySelector('.journey-sheet');if(sheet)sheet.outerHTML=journeySheet();
    const kills=phone.querySelector('.scene-foot span:last-child');if(kills)kills.textContent=state.kills+' defeated';
    const label=phone.querySelector('.idle-label');if(label)label.innerHTML='<span class="status-dot" aria-hidden="true"></span> '+(atCap()?'IDLE PAUSED':'IDLE');
    WorldMap.refresh();
    inspector();
}
function runIdleAttack() {
    if(!state.connected||document.hidden||state.returnPending||atCap()||state.view==='fight'||idleAnimation.phase!=='rest')return;
    const name=nextIdleSpell(state.idle,idleAnimation.previous);if(!name)return;
    const selected=spell(name);if(!selected)return;
    const session=state,realm=state.realm;
    const current=()=>state===session&&state.realm===realm&&state.connected&&!state.returnPending&&!atCap()&&state.view!=='fight'&&state.idle.includes(name);
    const scene=state.view==='realm'&&!state.modal?phone.querySelector('.scene'):null;
    const visual=()=>scene?.isConnected&&state.view==='realm'&&!state.modal;
    idleAnimation.previous=name;idleAnimation.activeSpell=name;idleAnimation.phase='windup';const idleSpeed=MageRelics.modifiers(state.inventory,DungeonUI.clock()).idleSpeed;idleAnimation.nextAt=performance.now()+1600/idleSpeed;
    function later(delay,fn){idleAnimation.timers.push(setTimeout(fn,delay/idleSpeed));}
    if(visual()){
        scene.dataset.casting=selected.art;scene.dataset.spell=name;
        scene.querySelector('.cast-icon').innerHTML=sprite(selected.art);scene.querySelector('.cast-name').textContent=name;
        scene.querySelector('.mage').classList.add('is-winding');
        phone.querySelectorAll('.idle-slot').forEach(el=>el.classList.toggle('is-casting',el.dataset.idleSpell===name));
    }
    if(selected.kind){
        MageEffects.cast(state.idleEffects,name,performance.now());
        if(visual()){scene.classList.toggle('has-ward',!!MageEffects.status(state.idleEffects,performance.now()).shield);scene.classList.toggle('shield-empowered',MageEffects.multiplier(state.idleEffects,performance.now())>1);}
        later(800,()=>{if(visual())scene.querySelector('.mage').classList.remove('is-winding');idleAnimation.phase='rest';idleAnimation.timers=[];updateIdlePanels();});
        return;
    }
    later(180,()=>{
        if(!current())return;
        idleAnimation.phase='flight';
        if(!visual())return;
        const mage=scene.querySelector('.mage'),enemy=scene.querySelector('.enemy'),flight=scene.querySelector('.spell-flight'),bounds=scene.getBoundingClientRect();
        const from=mage.getBoundingClientRect(),to=enemy.getBoundingClientRect();
        const x=from.right-bounds.left-10,y=from.top-bounds.top+32;
        flight.style.cssText=`left:${x}px;top:${y}px;--dx:${to.left+to.width/2-bounds.left-x}px;--dy:${to.top+to.height/2-bounds.top-y-8}px`;
        flight.querySelector('.flight-art').innerHTML=sprite(selected.art);
        mage.classList.remove('is-winding');mage.classList.add('is-casting');mage.querySelector('.sprite').outerHTML=sprite('casting');
        flight.classList.add('is-flying');
    });
    later(660,()=>{
        if(!current())return;
        idleAnimation.phase='impact';
        const mods=MageRelics.modifiers(state.inventory,DungeonUI.clock()),crit=Math.random()<mods.idleCrit,doubled=Math.random()<mods.idleDouble;
        const damage=(spellDamage(selected.name)+state.damageBonus)*MageEffects.multiplier(state.idleEffects,performance.now())*(crit?mods.idleCritical:1)*(doubled?2:1);
        state.enemyHp=Math.max(0,state.enemyHp-damage);
        const defeated=state.enemyHp===0;
        if(defeated){state.kills++;state.shards[realm]+=MageRelics.modifiers(state.inventory,DungeonUI.clock()).idleYield;RelicInventoryUI.onKills('idle',1);state.stageKills++;if(state.stageKills>=3&&!state.heldLevel)advance();state.enemyHp=RealmProgression.enemyHp();GroundLoot.dropFromKill();}
        if(visual()){
            const enemy=scene.querySelector('.enemy');
            scene.querySelector('.spell-flight').classList.remove('is-flying');enemy.classList.add('is-hit');if(defeated)enemy.classList.add('is-defeated');
            const blast=scene.querySelector('.impact-burst'),target=enemy.getBoundingClientRect(),bounds=scene.getBoundingClientRect();blast.style.left=target.left+target.width/2-bounds.left+'px';blast.style.top=target.top+target.height/2-bounds.top-8+'px';blast.classList.add('is-visible');
            const value=scene.querySelector('.damage-float');value.style.left=target.left+target.width/2-bounds.left+'px';value.style.top=target.top-bounds.top-10+'px';value.textContent=damage;value.classList.remove('is-visible');void value.offsetWidth;value.classList.add('is-visible');
            scene.querySelector('.enemy-hp i').style.width=defeated?'0%':state.enemyHp/RealmProgression.enemyHp()*100+'%';
            if(defeated){scene.querySelector('.loot-label').classList.remove('is-visible');void scene.querySelector('.loot-label').offsetWidth;scene.querySelector('.loot-label').textContent='+1 '+realms[realm].toLowerCase()+' shard';scene.querySelector('.loot-label').classList.add('is-visible');}
        }
        updateIdlePanels();
        later(300,()=>{if(!visual())return;const enemy=scene.querySelector('.enemy');enemy.classList.remove('is-hit','is-defeated');if(defeated){enemy.classList.add('is-spawning');enemy.querySelector(':scope>.sprite').outerHTML=sprite(EncounterArt.enemy()[0]);enemy.querySelector('.enemy-name').textContent=EncounterArt.enemy()[1];scene.querySelector('.enemy-hp i').style.width='100%';}scene.querySelector('.impact-burst').classList.remove('is-visible');});
    });
    later(1140,()=>{
        if(visual()){const mage=scene.querySelector('.mage');mage.classList.remove('is-casting','is-winding');mage.querySelector('.sprite').outerHTML=sprite('mage');scene.querySelector('.enemy').classList.remove('is-spawning');}
        idleAnimation.phase='rest';idleAnimation.timers=[];
    });
}
setInterval(()=>{if(performance.now()>=idleAnimation.nextAt)runIdleAttack();if(state.view==='realm'){const scene=phone.querySelector('.scene'),effects=MageEffects.status(state.idleEffects,performance.now());scene?.classList.toggle('has-ward',effects.shield>0);scene?.classList.toggle('shield-empowered',effects.buff>0);}},100);
let tick=0;
setInterval(()=>{
    if(!state.connected||document.hidden||state.returnPending)return;
    DungeonUI.tick();ShopGiftsUI.tick();
    if(state.view==='fight'){
        const f=state.fight;if(f.result)return;
        f.elapsed++;if(f.elapsed>=90)return finishFight(false);
        f.cooldowns=f.cooldowns.map(c=>Math.max(0,c-1));
        state.boss.forEach((_,i)=>{if(state.autos[i])cast(i);});
        if(f.result)return;
        if(f.swarm)SwarmBoss.tick(f);
        if(f.elapsed%5===0)SwarmBoss.receive(f,'guardian',f.x<48&&f.y>53?18:4);
        if(!f.hp)return finishFight(false);if(!f.bossHp)return finishFight(true);
        render(true);return;
    }
    if(atCap())return;
    state.seconds++;tick++;RealmDiscoveries.tick();
    MageVentureDevelopment.credit(state.ventureDevelopment,MageVentureDevelopment.preview(state.ventureDevelopment,MageVentureSpirits.production(state,state.ventureSpirits),1));
    if(tick%5===0&&['ventures','ventureDetail'].includes(state.view)&&!state.modal)VentureDevelopmentUI.refresh();
    if(tick%60===0){const rates=MageVentureSpirits.production(state,state.ventureSpirits);state.ore+=Math.round(rates.ore);state.pearls+=Math.round(rates.pearls);refreshHud();}
    if(atCap())render(true);inspector();
},1000);
document.querySelector('.prototype-switcher').hidden = false; // Public prototype review build.
if(['discovery','discoveryReady','discoveryFound','discoveryPool','discoveryIce','places','dungeons','dungeonsDone','oneDungeonDaily','familiarGoal','rarity','matchedRarity','start','return','gate','revisit','collection','ice','coneForge','swarmBoss','spells','swarmCone','shieldSwarm','shieldTrial','shieldBoss','shieldForge'].includes(params.get('study')))scenario(params.get('study'));else if(params.get('view')==='active')ActivePlay.open();else render();

RealmProgression.start();

RealmMapStudy.start();
VentureShopUI.start();RelicInventoryUI.start();
