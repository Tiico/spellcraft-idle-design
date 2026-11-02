/* Compact world context in the scene; the tier-node journey owns the map and named sections. */
const WorldMap=(()=>{
    const current=()=>RealmProgression.current();
    const location=()=>RealmProgression.location();
    const progress=()=>RealmProgression.progress();
    const refresh=()=>RealmProgression.refresh();
    const view=()=>RealmMapStudy.view();
    const refreshAtlas=()=>RealmMapStudy.refreshAtlas();
    function returned(r){const realm=r.realm??state.realm,J=MageRealms.journey,from=J.section(realm,r.startNode||1),to=J.section(realm,r.endNode||1);return `<div class="return-destination">${sprite('portal')}<div><span class="kicker">${realms[realm]} realm · Node ${r.endNode||1}</span><span>${from.name} ${glyph('arrow')}</span><strong>${to.name}</strong></div><span class="status-chip">Boss waiting</span></div>`;}
    return {location,progress,refresh,refreshAtlas,view,returned,current};
})();
