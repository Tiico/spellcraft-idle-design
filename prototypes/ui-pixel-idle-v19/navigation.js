/* Chosen floating navigation B and direct feature grid. */
const MageNavigation=(()=>{
    const current='B';
    const names={B:'B · Floating rune · selected'};
    const features=[['realm','Realm','portal'],['realmFinds','Realm finds','power'],['dungeons','Dungeons','golem'],['forge','Spellforge','workshop'],['spells','Spells','book'],['familiars','Familiars','moth'],['ventures','Ventures','mine'],['return','Idle rewards','time'],['map','Realm map','portal'],['recipes','Recipes','frost'],['builds','Loadouts','empty'],['account','Settings','settings'],['boss','Boss arena','golem'],['spirits','Spirits','spirit'],['shop','Shop','crowned']];
    const gridIcon=()=>'<span class="launcher-icon" aria-hidden="true">'+Array.from({length:9},()=>'<i></i>').join('')+'</span>';
    const art=name=>['portal','workshop','moth','mine','frost','golem','spirit'].includes(name)?sprite(name):ui(name);
    const headerLaunch=()=>false;
    function chrome(){return `<button class="floating-launcher" data-action="allFeatures" aria-label="Open all features">${gridIcon()}<span>All</span>${ShopGiftsUI.status().available?'<i class="free-gift-ready-flag" role="img" aria-label="Daily gift ready"></i>':''}</button>`;}
    function grid(){return `${state.view==='fight'?'<p class="compact-notice">Leaving ends this attempt. Retry is free.</p>':ActivePlay.dungeonStatus()?'<p class="compact-notice">Leaving ends this run. No daily reward is used.</p>':''}<div class="feature-grid">${features.map(([key,name,icon,future])=>`<button data-feature="${key}" aria-label="Open ${name}${future?', future feature study':''}">${art(icon)}<strong>${name}</strong>${key==='shop'&&ShopGiftsUI.status().available?'<small class="free-gift-hint">Free gift</small>':future?'<small>Future study</small>':''}</button>`).join('')}</div>`;}
    function select(key){
        if(!features.some(f=>f[0]===key))return;
        if(state.view==='fight')finishFight(false);
        if(key==='realmFinds')RealmDiscoveries.open(state.realm);
        else if(key==='spells'){state.collectionTab='spells';go('library');}
        else if(key==='familiars'){state.collectionTab='familiars';go('library');}
        else if(key==='recipes'){state.forgeTab='fusion';go('forge');}
        else if(key==='builds'){state.collectionTab='spells';state.build='idle';go('library');}
        else if(key==='map')openModal({type:'map'});
        else if(['ascension','research','achievements'].includes(key)){state.futureFeature=key;go('future');}
        else go(key);
    }
    function change(){const url=new URL(location.href);url.searchParams.set('nav','B');history.replaceState(null,'',url);render(true);}
    return {current:()=>current,names,features,gridIcon,headerLaunch,chrome,grid,select,change,label:()=>names[current]};
})();
