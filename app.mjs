import { metadata, spells, realms, withConeProposal, withShieldProposal } from './catalog.mjs';
import { analyzeCatalog } from './analysis.mjs';
import { normalizeWorkspace, workspaceDocument, layoutCatalog } from './model.mjs';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const storageKey = 'spellforge-design-workspace-v1';
const stageNames = ['Before Fire boss','Before Ice boss','Before Earth boss','Before Wind boss','After Wind boss'];
const query = new URLSearchParams(location.search);
let selected = query.get('spell') || '';
let milestone = /^[0-4]$/.test(query.get('stage')) ? Number(query.get('stage')) : 4;
let view = query.get('view') === 'recipes' ? 'recipes' : 'map';
let catalog = normalizeWorkspace(workspaceDocument(spells));
let rarityInputs=[4,0];
let analysis, choiceA = 'fire', choiceB = 'ice', editingId = null;
let storageAvailable = true;
let startupNotice = '';
try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
        const imported = normalizeWorkspace(JSON.parse(saved));
        const report = analyzeCatalog(imported);
        if (report.issues.length) throw new Error(report.issues.join(' '));
        catalog = imported;
    }
} catch (error) {
    startupNotice = `Could not restore browser drafts: ${error.message} Import an exported workspace to recover them.`;
    storageAvailable = false;
}
const find = id => catalog.find(spell => spell.id === id);
const decision = spell => spell.draft ? 'Local draft' : spell.known ? 'PRD decision' : 'Catalog proposal';
const badge = spell => `<span class="tag ${spell.draft?'draft':spell.known?'approved':''}">${decision(spell)}</span>`;
function sprite(name) {
    if(name==='ward'||name==='fire-shield')return `<span class="shield-pixel-icon">${sprite('ice')}${name==='fire-shield'?`<span class="fire-overlay">${sprite('fire')}</span>`:''}</span>`;
    if(name==='arcane-surge')return `<span class="surge-pixel-icon">${sprite('frostfire')}</span>`;

    if(name==='flame-cone'||name==='frostfire-cone')return `<span class="cone-pixel-icon">${[-28,0,28].map(angle=>`<span style="--ray:${angle}deg">${sprite(name==='flame-cone'?'fire':'frostfire')}</span>`).join('')}</span>`;
    const rect = {fire:[18,1016,289,235],ice:[338,1007,309,242],frostfire:[666,1008,287,243]}[name];
    if (!rect) return '';
    const [x,y,w,h] = rect;
    return `<span class="pixel-sprite" style="--sx:${x/(1254-w)*100}%;--sy:${y/(1254-h)*100}%;--sw:${1254/w*100}%;--sh:${1254/h*100}%"></span>`;
}
const icon = spell => `<span class="icon" style="--spell-color:${spell.color}" aria-hidden="true">${sprite(spell.id) || escape(spell.symbol)}</span>`;
const spellButton = id => { const spell = find(id); return `<button class="link-spell" data-select="${spell.id}">${icon(spell)}${escape(spell.name)} <span aria-hidden="true">Ôåù</span></button>`; };
function notify(message, error = false) { $('notice').textContent = message; $('notice').className = error ? 'error' : ''; }
function linkView() {
    const url = new URL(location.href);
    for (const key of ['scenario','mode','selected','analysisStage']) url.searchParams.delete(key);
    url.searchParams.set('spell',selected);
    url.searchParams.set('stage',milestone);
    url.searchParams.set('view',view);
    history.replaceState(null,'',url);
}
function trace(id, result = new Set()) {
    if (result.has(id)) return result;
    result.add(id);
    find(id)?.inputs?.forEach(input => trace(input,result));
    return result;
}
function selectSpell(id) {
    const origin = document.activeElement?.closest('[data-select]')?.parentElement?.id;
    selected = find(id) ? id : '';
    renderLibrary(); renderConnections(); renderInspector(); linkView();
    if (origin && selected) $(origin)?.querySelector(`[data-select="${selected}"]`)?.focus({preventScroll:true});
}
function renderLibrary() {
    const text = $('search').value.trim().toLowerCase();
    const filter = $('library-filter').value;
    const matching = catalog.filter(spell => `${spell.name} ${spell.role}`.toLowerCase().includes(text) &&
        (filter==='all' || filter==='base'&&!spell.inputs || filter==='fusion'&&spell.inputs ||
            filter==='draft'&&spell.draft || filter==='known'&&spell.known));
    $('spell-count').textContent = `${matching.length} / ${catalog.length}`;
    $('library').innerHTML = ['base','fusion'].map(kind => {
        const group = matching.filter(spell => (spell.inputs?'fusion':'base') === kind);
        return group.length ? `<h3 class="library-group">${kind==='base'?'Base spells':'Fusions'} / ${group.length}</h3>` + group.map(spell => `<button class="spell-row ${selected===spell.id?'selected':''}" data-select="${spell.id}" aria-pressed="${selected===spell.id}">${icon(spell)}<span class="spell-label"><strong>${escape(spell.name)}</strong><small>${spell.draft?'Ôùå Local draft':spell.known?'ÔùÅ PRD decision':'Ôùç Catalog proposal'} ┬À Forge ${spell.level}</small></span></button>`).join('') : '';
    }).join('') || '<p class="empty">No matching spells. Try another search or filter.</p>';
}
function renderConnections() {
    const available = new Set(analysis.stages[milestone].reachable);
    const traced = selected ? trace(selected) : new Set();
    const layout = layoutCatalog(catalog);
    const positions = new Map(layout.nodes.map(spell => [spell.id,spell]));
    const edges = layout.nodes.filter(spell => spell.inputs).flatMap(spell => spell.inputs.map(id => {
        const from = positions.get(id), active = traced.has(spell.id) && traced.has(id);
        return `<path class="edge ${spell.known?'':'proposal'} ${active?'highlight':selected?'dim':''}" d="M ${from.x+82} ${from.y} C ${from.x+170} ${from.y},${spell.x-170} ${spell.y},${spell.x-82} ${spell.y}"/>`;
    })).join('');
    $('map').style.width = `${layout.width}px`; $('map').style.height = `${layout.height}px`;
    $('map').innerHTML = Array.from({length:layout.columns},(_,column) => `<span class="column-label" style="left:${34+240*column}px">${String(column+1).padStart(2,'0')} / ${column===0?'BASE SPELLS':column===1?'FIRST FUSION':`FUSION DEPTH ${column}`}</span>`).join('') +
        `<svg viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">${edges}</svg>` + layout.nodes.map(spell => `<button class="node ${spell.draft?'draft':spell.known?'approved':''} ${selected===spell.id?'selected':''} ${selected&&!traced.has(spell.id)?'dim':''} ${available.has(spell.id)?'':'gated'}" style="left:${spell.x}px;top:${spell.y}px" data-select="${spell.id}" aria-pressed="${selected===spell.id}" aria-label="${escape(spell.name)} ┬À ${decision(spell)} ┬À ${available.has(spell.id)?'Available':'Gated'}">${icon(spell)}<span><strong>${escape(spell.name)}</strong><small class="${spell.draft?'draft-label':''}">${spell.draft?'Draft ┬À ':''}Forge ${spell.level} ┬À ${available.has(spell.id)?'Available':'Gated'}</small></span></button>`).join('');
    $('recipes').innerHTML = `<table><thead><tr><th>Ingredients</th><th>Result</th><th>Forge</th><th>Earliest availability</th><th>Status</th></tr></thead><tbody>${catalog.filter(spell => spell.inputs).map(spell => `<tr><td>${spell.inputs.map(id => escape(find(id).name)).join(' + ')}</td><td><button data-select="${spell.id}">${escape(spell.name)}</button></td><td>${spell.level}</td><td>${stageNames[analysis.bySpell[spell.id].earliestStage] || 'Unreachable'}</td><td>${decision(spell)}</td></tr>`).join('')}</tbody></table>`;
    $('map-scroll').hidden = view !== 'map'; $('recipes').hidden = view !== 'recipes';
    $('map-view').setAttribute('aria-pressed',view==='map'); $('table-view').setAttribute('aria-pressed',view==='recipes');
    $('milestone').value = milestone;
    $('availability-summary').textContent = `${available.size} / ${catalog.length} available ┬À Forge cap ${analysis.stages[milestone].forge} ┬À ${stageNames[milestone]}`;
}
function rarityPreview(spell){
    if(!spell.inputs)return '';
    const q=MageRarity.quote({id:spell.id,result:spell.id,level:spell.level,inputs:spell.inputs},Object.fromEntries(spell.inputs.map((id,i)=>[id,rarityInputs[i]])));
    return `<section class="rarity-preview"><h3>Rarity risk ┬À proposal</h3><p>Both ingredients stay. Every valid attempt costs resources. A lower outcome never downgrades your best owned version.</p><div class="rarity-inputs">${spell.inputs.map((id,i)=>`<label>${escape(find(id).name)}<select data-rarity-input="${i}">${MageRarity.tiers.map((t,n)=>`<option value="${n}" ${rarityInputs[i]===n?'selected':''}>${t}</option>`).join('')}</select></label>`).join('')}</div><div class="rarity-probabilities">${q.odds.map((n,i)=>`<span style="--rarity:${MageRarity.colors[i]}"><small>${MageRarity.tiers[i]}</small><b>${n/100}%</b></span>`).join('')}</div><p><b>Per attempt: ${q.cost.fire} Fire shards${q.cost.ore?' + '+q.cost.ore+' ore':''}</b></p><small>100% total ┬À Illustrative costs and probabilities. The forge path analysis does not simulate rarity rolls.</small></section>`;
}
function renderInspector() {
    const spell = find(selected);
    if (!spell) {
        $('inspector').innerHTML = '<span class="eyebrow">Spell details</span><h2>Follow a connection.</h2><p>Select a spell to see its ingredients, acquisition route and every recipe that uses it.</p><p>Solid borders mark PRD decisions. Dashed borders mark proposals. Purple marks your local drafts.</p>';
        return;
    }
    const details = analysis.bySpell[spell.id], available = analysis.stages[milestone].reachable.includes(spell.id);
    $('inspector').innerHTML = `<span class="eyebrow">Spell details</span>${badge(spell)}<div class="inspector-hero">${icon(spell)}</div><h2>${escape(spell.name)}</h2><p>${escape(spell.role)}</p><dl class="facts"><div><dt>Type</dt><dd>${spell.inputs?'Fusion':'Base spell'}</dd></div><div><dt>Forge requirement</dt><dd>${spell.level}</dd></div><div><dt>Earliest availability</dt><dd>${stageNames[details.earliestStage]||'Unreachable'}</dd></div><div><dt>Selected milestone</dt><dd>${available?'Available':'Gated'}</dd></div>${!spell.inputs?`<div><dt>Acquisition</dt><dd>${spell.id==='fire'&&spell.level===0?'Starting spell':`${spell.cost} ${realms[spell.realm].toLowerCase()} shards`}</dd></div>`:''}</dl><h3>${spell.inputs?'Made from':'Acquisition route'}</h3>${spell.inputs?spell.inputs.map(spellButton).join(''):'<p>Shard crafting and finished-spell drops. Elemental Rift is an optional daily shard source after the Ice boss, for unlocked realms only (proposal). No spell levels.</p>'}<h3>Used in ${details.usedBy.length} ${details.usedBy.length===1?'recipe':'recipes'}</h3>${details.usedBy.length?details.usedBy.map(spellButton).join(''):'<p>No further fusion in this catalog yet.</p>'}<div class="inspector-actions"><button id="edit-spell" class="primary">${spell.draft?'Edit draft':'Edit as local draft'}</button><button id="extend-spell">+ Build a fusion with this spell</button>${spell.draft?'<button id="remove-draft">'+(spells.some(item=>item.id===spell.id)?'Restore catalog version':'Remove draft')+'</button>':''}</div>${rarityPreview(spell)}`;
    $('inspector').querySelectorAll('[data-rarity-input]').forEach(el=>el.onchange=()=>{rarityInputs[Number(el.dataset.rarityInput)]=Number(el.value);renderInspector();});
    $('edit-spell').onclick = () => openEditor(spell);
    $('extend-spell').onclick = () => openEditor(null,[spell.id,'']);
    if (spell.draft) $('remove-draft').onclick = () => {
        const original = spells.find(item => item.id === spell.id);
        if (!original && details.usedBy.length) return notify(`Remove dependent drafts first: ${details.usedBy.map(id => find(id).name).join(', ')}.`,true);
        const next = catalog.filter(item => item.id !== spell.id);
        if (original) next.splice(catalog.indexOf(spell),0,original);
        if (applyCatalog(next)) { if (!original) selectSpell(''); notify(original?'Catalog spell restored.':'Draft removed.'); }
    };
}
function renderBench() {
    const options = '<option value="">Choose a spellÔÇª</option>' + catalog.map(spell => `<option value="${spell.id}">${escape(spell.name)}${spell.draft?' ┬À Draft':''}</option>`).join('');
    if (!find(choiceA)) choiceA = ''; if (!find(choiceB)) choiceB = '';
    $('ingredient-a').innerHTML = options; $('ingredient-b').innerHTML = options;
    $('ingredient-a').value = choiceA; $('ingredient-b').value = choiceB;
    renderPair();
}
function renderPair() {
    const pair = [choiceA,choiceB];
    const match = catalog.find(spell => spell.inputs?.every(id => pair.includes(id)));
    if (!choiceA || !choiceB) $('pair-result').innerHTML = '<p>Choose two different spells to explore their combination.</p>';
    else if (choiceA === choiceB) $('pair-result').innerHTML = '<p>Choose two different spells. A recipe needs two distinct ingredients.</p>';
    else if (match) {
        $('pair-result').innerHTML = `<div><strong>${escape(match.name)}</strong><span class="result-label">Existing recipe ┬À ${decision(match)} ┬À Forge ${match.level}</span></div><button id="inspect-pair">Inspect recipe ÔåÆ</button>`;
        $('inspect-pair').onclick = () => selectSpell(match.id);
    } else {
        $('pair-result').innerHTML = '<div><strong>No recipe yet.</strong><span class="result-label">Explore a new connection as a local draft.</span></div><button class="primary" id="create-pair">+ Create fusion</button>';
        $('create-pair').onclick = () => openEditor(null,pair);
    }
}
function renderAnalysis() {
    $('analysis-summary').textContent = analysis.issues.length ? `${analysis.issues.length} structure issues` : 'Ô£ô No circular or unreachable recipes';
    $('analysis-detail').innerHTML = `<p>${analysis.baseCount} base spells ┬À ${analysis.fusionCount} fusions ┬À ${analysis.multiStepCount} multi-step fusions.</p><p>Checks every boss milestone for missing ingredients, repeated pairs, circular dependencies and unreachable forge requirements.</p>${analysis.issues.length?`<ul>${analysis.issues.map(issue=>`<li>${escape(issue)}</li>`).join('')}</ul>`:''}<p>Shared target: six base spells and six fusions, including a multi-step chain (AC-12ÔÇô13). Local drafts can extend this scope for discussion. A valid structure does not prove combat balance or economy.</p>`;
}
function render() {
    analysis = analyzeCatalog(catalog);
    if (!find(selected)) selected = '';
    renderLibrary(); renderConnections(); renderInspector(); renderBench(); renderAnalysis();
    const drafts = catalog.filter(spell => spell.draft).length;
    $('save-state').textContent = drafts ? `${drafts} local ${drafts===1?'draft':'drafts'} ┬À ${storageAvailable?'saved in this browser':'memory only; export to keep'}` : 'Shared catalog ┬À no local drafts';
    $('reset').disabled = !drafts;
    linkView();
}
function applyCatalog(next) {
    try {
        const normalized = normalizeWorkspace(workspaceDocument(next));
        const report = analyzeCatalog(normalized);
        if (report.issues.length) throw new Error(report.issues.join('\n'));
        catalog = normalized;
    } catch (error) { notify(error.message,true); return false; }
    try { localStorage.setItem(storageKey,JSON.stringify(workspaceDocument(catalog))); storageAvailable = true; }
    catch { storageAvailable = false; notify('Browser storage is unavailable. Export your workspace to keep these drafts.',true); }
    render(); return true;
}
function openEditor(spell = null, pair = null) {
    editingId = spell?.id || null;
    const form = $('spell-form'); form.reset();
    const fields = form.elements;
    $('editor-title').textContent = spell ? `Edit ${spell.name}` : pair ? 'New fusion' : 'New spell';
    $('editor-note').textContent = spell?.known ? 'Editing a PRD decision creates a local proposal. The approved shared catalog stays unchanged.' : 'Drafts are saved in this browser. Export a workspace to share your ideas.';
    fields.id.readOnly = !!spell;
    for (const field of ['name','id','role','symbol','color','level','realm','cost']) {
        if (spell?.[field] !== undefined) fields[field].value = spell[field];
    }
    fields.kind.value = spell?.inputs || pair ? 'fusion' : 'base';
    const options = '<option value="">Choose a spellÔÇª</option>' + catalog.filter(item => item.id !== editingId).map(item => `<option value="${item.id}">${escape(item.name)}</option>`).join('');
    fields.inputA.innerHTML = options; fields.inputB.innerHTML = options;
    fields.inputA.value = spell?.inputs?.[0] || pair?.[0] || '';
    fields.inputB.value = spell?.inputs?.[1] || pair?.[1] || '';
    if (!spell) fields.level.value = pair ? Math.max(1,...pair.map(id => find(id)?.level || 0)) : 1;
    $('form-error').textContent = ''; toggleKind(); $('editor').showModal();
}
function toggleKind() {
    const fusion = $('spell-form').elements.kind.value === 'fusion';
    $('base-fields').hidden = fusion; $('fusion-fields').hidden = !fusion;
    for (const name of ['realm','cost']) $('spell-form').elements[name].disabled = fusion;
    for (const name of ['inputA','inputB']) { $('spell-form').elements[name].disabled = !fusion; $('spell-form').elements[name].required = fusion; }
}
$('spell-form').elements.kind.onchange = toggleKind;
$('spell-form').onsubmit = event => {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const spell = {id:fields.id,name:fields.name,role:fields.role,symbol:fields.symbol,color:fields.color,level:Number(fields.level)};
    if (fields.kind === 'fusion') spell.inputs = [fields.inputA,fields.inputB];
    else Object.assign(spell,{realm:Number(fields.realm),cost:Number(fields.cost)});
    try {
        if (!editingId && find(spell.id)) throw new Error('This stable ID already exists. Choose a new ID.');
        const next = editingId ? catalog.map(item => item.id===editingId?spell:item) : [...catalog,spell];
        const normalized = normalizeWorkspace(workspaceDocument(next));
        const report = analyzeCatalog(normalized);
        if (report.issues.length) throw new Error(report.issues.join('\n'));
        if (!applyCatalog(normalized)) return;
        selectSpell(spell.id); $('editor').close();
        notify(`${spell.name} saved as a local draft.${storageAvailable?'':' Browser storage unavailable; export to keep it.'}`);
    } catch (error) { $('form-error').textContent = error.message; }
};
for (const id of ['close-editor','cancel-editor']) $(id).onclick = () => $('editor').close();
$('new-spell').onclick = () => openEditor();
$('search').oninput = renderLibrary; $('library-filter').onchange = renderLibrary;
$('milestone').onchange = event => { milestone = Number(event.target.value); renderConnections(); renderInspector(); linkView(); };
$('clear-trace').onclick = () => selectSpell('');
$('map-view').onclick = () => { view = 'map'; renderConnections(); linkView(); };
$('table-view').onclick = () => { view = 'recipes'; renderConnections(); linkView(); };
$('ingredient-a').onchange = event => { choiceA = event.target.value; renderPair(); };
$('ingredient-b').onchange = event => { choiceB = event.target.value; renderPair(); };
document.addEventListener('click',event => { const button = event.target.closest('[data-select]'); if (button) selectSpell(button.dataset.select); });
$('reset').onclick = () => $('reset-dialog').showModal();
$('cancel-reset').onclick = () => $('reset-dialog').close();
$('confirm-reset').onclick = () => { if (applyCatalog(spells)) { $('reset-dialog').close(); notify('Shared catalog restored. Local drafts cleared.'); } };
$('export').onclick = () => {
    const report = {...workspaceDocument(catalog),analysis,selectedMilestone:stageNames[milestone],limits:'Local content proposals. Structural checks only; no combat or economy balance.'};
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = `spellforge-workspace-${metadata.version}.json`; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify('Workspace exported. Share the JSON file to share local drafts; a page link only shares the selected spell and milestone.');
};
$('import').onclick = () => $('import-file').click();
$('import-file').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
        if (file.size > 500000) throw new Error('Workspace file is too large (maximum 500 KB).');
        const document = JSON.parse(await file.text());
        const incoming = normalizeWorkspace(document);
        const report = analyzeCatalog(incoming);
        if (report.issues.length) throw new Error(report.issues.join(' '));
        // Merge rather than silently discard drafts already in this browser.
        const next = [...catalog];
        for (const spell of incoming) {
            const index = next.findIndex(item => item.id===spell.id);
            if (index < 0) next.push(spell);
            else if (spell.draft && next[index].draft && JSON.stringify(spell)!==JSON.stringify(next[index])) {
                throw new Error(`Conflicting local draft: ${spell.name}. Export or reset your current drafts before importing this file.`);
            } else if (spell.draft) next[index] = spell;
        }
        if (applyCatalog(next)) notify(`Workspace imported; existing local drafts retained.${storageAvailable?'':' Export to keep; browser storage unavailable.'}`);
    } catch (error) { notify(`Import failed: ${error.message}`,true); }
    event.target.value = '';
};
$('cone-proposal').onclick=()=>{try{const next=withConeProposal(catalog);if(applyCatalog(next)){selected='frostfire-cone';milestone=3;view='map';render();notify('PO swarm proposal added as local drafts. Existing drafts and the shared 6 + 6 catalog were kept.');}}catch(error){notify(error.message,true);}};
$('shield-proposal').onclick=()=>{try{const next=withShieldProposal(catalog);if(applyCatalog(next)){selected='fire-shield';milestone=2;view='map';render();notify('Shield proposal added: barrier + buff + retaliation in one spell. Existing drafts and the shared 6 + 6 structure were kept.');}}catch(error){notify(error.message,true);}};
$('catalog-version').textContent = `CATALOG ${metadata.version}`;
render();
if (startupNotice) notify(startupNotice,true);
else if(query.get('proposal')==='swarm-cone')notify('PO proposal: Frostfire Bolt + a cone-shaped spell ÔåÆ Frostfire Cone. Use ÔÇ£Add swarm proposalÔÇØ to explore it as local drafts; your current workspace is kept.');

if(query.get('proposal')==='shield-buff'&&!startupNotice)notify('PO proposal: buffs belong to shields. Frost Ward + Firebolt ÔåÆ Fire Shield combines barrier, buff and retaliation. Use ÔÇ£Add shield proposalÔÇØ to explore local drafts; your saved workspace is kept.');

if(query.get('proposal')==='rarity-risk'&&!startupNotice)notify('Rarity study: select a fusion to inspect odds and costs. Both ingredients stay. Existing drafts are kept.');

$('daily-sources').innerHTML = '<h2>Daily dungeons ┬À proposal</h2><p>Optional resource paths after the Ice boss. Two rewarded clears per dungeon per UTC day; one-clear comparison in the UI. Counts, reset and rewards are proposals, not forge gates.</p><div class="daily-source-grid">'+MageDungeons.definitions.map(d=>`<article><h3>${escape(d.name)}</h3><b>+${d.amount} ${escape(d.label)}</b><p>${d.type==='shards'?'Choose an unlocked realm element.':d.type==='fragments'?'20 fragments ÔåÆ a familiar. Boss-only passive buffs; no automatic equip.':'Existing venture resource; no new currency.'}</p></article>`).join('')+'</div><p>The shared 6 + 6 spell structure, introduction, boss gates and local drafts stay unchanged. The path analysis does not spend daily quotas or simulate reward balance.</p>';

$('realm-sources').innerHTML='<h2>Realm tiers ┬À selected A</h2><p>A tier is one circuit: Fire ÔåÆ Ice ÔåÆ Earth ÔåÆ Wind. Completing Wind tier 1 opens Fire tier 2 with stronger enemies and new loot. Tier and node are separate: Fire ┬À Tier 1 ┬À Node 12 / 25. The named places name the four node sections between bosses; the section split per realm is a proposal.</p><div class="realm-source-grid">'+MageRealms.realms.map(r=>`<article><h3>${escape(r.name)} ┬À every tier</h3><p>${MageRealms.journey.nodeCount} nodes ┬À bosses at ${MageRealms.journey.bossNodes.join(', ')}</p><ol>${r.sections.map((s,i)=>`<li${i===r.sections.length-1?' class="realm-source-boss"':''}>${escape(s.name)} ┬À nodes ${s.from}ÔÇô${s.to} ┬À ${escape(s.boss)}${i===r.sections.length-1?' (guardian)':''}</li>`).join('')}</ol></article>`).join('')+'</div><p>First-tier realm guardians keep the introduction and forge milestones represented by this tool. Its 0ÔÇô4 analysis covers those four initial milestones, not the complete recurring game. Intermediate bosses and later tiers add no invented forge gates here. Node counts, boss positions, scaling and new loot pools are proposals; the UI demonstrates the shared journey rules. Existing spell graph, acquisition guarantees and saved drafts are preserved.</p>';

$('realm-idle-sources').innerHTML='<h2>Realm-exclusive idle spells ┬À proposal</h2><p>PO decision (#25, 2026-11-02): three spells per realm, twelve in total, found through random idle drops. Each realm pool shares one pity track; a find is a random spell the player does not own yet, so there are no duplicates before the pool is complete. These complement the six shard-farmable base spells; they are not shard crafting or boss rewards.</p><div class="idle-source-grid">'+realms.map((realm,r)=>`<article><h3>${realm} pool</h3>${MageIdleSpells.pool(r).map(d=>`<p><strong>${escape(d.name)}</strong> ┬À ${escape(d.description)}</p>`).join('')}</article>`).join('')+'</div><h3>Next-roll probability after each miss</h3><div class="idle-odds-preview">'+Array.from({length:MageIdleSpells.hardLimit},(_,i)=>`<span><small>Roll ${i+1}</small><b>${Math.round(MageIdleSpells.chance(i)*100)}%</b></span>`).join('')+'</div><p>One roll per '+MageIdleSpells.interval/60+' minutes of credited idle; guaranteed by roll '+MageIdleSpells.hardLimit+' (about '+MageIdleSpells.interval*MageIdleSpells.hardLimit/3600+'h). Remaining idle after a find keeps rolling for the rest of the pool, so a full 12h window can complete one realm pool. Open-game and absence idle share the 12h cap. Travel keeps realm progress; manual bonus kills and replayed reports add no rolls.</p><p>Names, effects, art, timing and probabilities are proposals; the eight new spells use placeholder art. A found spell stays pending on the idle field until explicit pickup and is reserved against repeat rolls. Pickups do not downgrade owned rarity or auto-equip spells. The core recipe graph and saved local drafts stay unchanged.</p>';

$('venture-spirit-sources').innerHTML='<h2>Assigned venture spirits</h2><p>Base spirits keep working automatically. Dropped loot spirits are stronger specialists; assign each instance to one compatible venture. All assigned copies stack, including duplicates; unassigned copies stay inactive. PO decision: no active slot cap per venture.</p><div class="daily-source-grid">'+MageVentureSpirits.definitions.map(d=>`<article><h3>${escape(d.name)}</h3><strong>${d.ventures.join(' / ')} ┬À ${d.rarity}</strong><p>2├ù base-spirit output ┬À ${escape(d.perk)}</p></article>`).join('')+'</div><p>Illustrative output: (base workers + assigned loot output) ├ù (1 + summed spirit bonuses), then purchased cross-venture multipliers, plus any flat side finds. Assignments cannot duplicate an instance or consume a spirit. Names, values and drop rates are proposals; the forge analysis does not model venture balance.</p><p>Business model (PRD ┬º11.3, ┬º14): Gems are bought through the platform store and earned in play, mainly in Daily Popped events. Gems may buy most shop items, but meaningful amounts must be earnable and the game must not feel too pay-to-win; resources, production, drop chances, spells, spirits, slots, attempts and the idle cap are judged per item in the gem catalog. Boss wins cannot be bought and payment never changes shown chest or fusion odds. The first version has no ads. The gem catalog, prices and earning rates are open; shop examples are proposals. Recipe graph, acquisition gates and local drafts are unchanged.</p>';

$('loot-gift-sources').innerHTML='<h2>Item drops & free gifts</h2><p>PO decisions: idle item drops require a tap to collect. Spells, familiars and loot spirits wait on the field with rarity light; shards, ore and pearls remain automatic idle income. Travel, other views, bosses and the 12h cap do not discard pending items. Large backlogs use an item grid for individual or bulk pickup. The server will preserve pending drops and deduplicate report/pickup receipts.</p><h3>Free chest ┬À PO decisions and proposals</h3><p>The emporium is categorised into Free gifts, Cosmetics and Comfort. PO decisions 2026-11-02: one chest charge per whole trusted UTC hour, at most '+MageFreeGifts.baseCap+' stored (an explicit cap parameter a later venture upgrade may raise); a full store earns nothing more until a charge is used, so absence beyond three hours yields at most three. No own daily reset; UTC midnight still applies to dungeons and Daily Popped. Locked chest odds: '+MageFreeGifts.tiers.map(t=>t.name+' '+t.odds/100+'%').join(' ┬À ')+' (total 100%). Locked reveal times: '+MageFreeGifts.tiers.map(t=>t.duration/1000+'s').join(' / ')+', maximum 2 seconds including every effect; reduced motion uses a calm 0.2s reveal. Locked rarity multipliers: '+MageFreeGifts.tiers.map(t=>t.name+' ├ù'+t.multiplier).join(' ┬À ')+'. Proposal: base '+MageFreeGifts.base.ore+' Ore / '+MageFreeGifts.base.pearls+' Pearls per claim ├ù rarity multiplier ├ù '+MageFrontier.perTier+'^(step/4), where the server passes the progression frontier {tier, realm} and step = (tier ÔêÆ 1) ├ù 4 + realm. Fire tier 1: '+MageFreeGifts.preview({tier:1,realm:0}).map(r=>r.ore+'/'+r.pearls).join(' ┬À ')+' Ore/Pearls; Fire tier 2: '+MageFreeGifts.preview({tier:2,realm:0}).map(r=>r.ore+'/'+r.pearls).join(' ┬À ')+'. Each charge has an idempotent receipt; duplicate or concurrent claims and time before the last settled hour grant nothing extra. Captured receipts never reroll through navigation, interruption or presentation replay. No purchase, ad or streak requirement; no paid power or resources are introduced. Base amounts, frontier growth and common-item drop cadence are proposals.</p><p>The prototype simulates item and gift receipts in memory. Absence rolls keep the shared 12h cap and realm-specific pity; item ownership starts only after pickup. Recipe graph, acquisition gates, local drafts and unlimited assigned-spirit stacking remain unchanged.</p>';

$('relic-inventory-sources').innerHTML='<h2>Relic chests & stack inventory</h2><p>PO: earned chests unlock permanent traits grouped into Idle and Active. Stronger mechanics use higher rarities. All buying and selling uses earned currency. Trait values, caps, prices and drop cadence below are review proposals.</p><div class="relic-source-grid">'+['idle','active'].map(mode=>'<article><h3>'+mode.toUpperCase()+'</h3>'+MageRelics.stats.filter(s=>s.mode===mode).map(s=>'<p style="color:'+MageRarity.colors[s.rarity]+'">'+MageRarity.tiers[s.rarity]+' ┬À '+s.name+' +'+s.step+'% / find ┬À Cap '+s.cap+'%</p>').join('')+'</article>').join('')+'</div><p>One trait per relic chest; Idle/Active50/50. Higher chest rarities have access to stronger traits. Capped finds convert to 20% of the chest price ('+MageRelics.definitions.filter(d=>d.kind==='chest').map(d=>d.conversion).join('/')+' Ore), never more than the chest costs. Milestones: every '+MageRelics.milestoneIntervals.idle+' idle kills or '+MageRelics.milestoneIntervals.active+' active kills; chest mix per milestone unchanged. Chest odds: '+MageRelics.chestOdds.map((o,i)=>MageRarity.tiers[i]+' ['+o.map(n=>n/100+'%').join(' / ')+']').join(' ┬À ')+'.</p><p>17 stack types demonstrate bulk handling. Buy, sell, open, use and pick up in1/2/5/10/25/Max or All with exact totals and atomic receipts. Time Scroll consumes remaining12h production budget without advancing nodes, boss clears, realm spell rolls or UTC resets. Focus Incense adds20% active area for stacked time; Echo Sigil adds charges. Earned-resource scroll prices scale with production value. Payment never changes the shown chest odds.</p>';

$('venture-development-sources').innerHTML='<h2>Venture development ┬À playable proposal</h2><p>PO requirement: each venture has a distinct activity, and expansions unlock real new resources. Resource names, recipes, habitat bonuses and costs below are review proposals.</p><div class="daily-source-grid">'+['mine','pond'].map(id=>'<article><h3>'+(id==='mine'?'Mine ┬À Refinery':'Pond ┬À Sanctuary')+'</h3><p>'+MageVentureDevelopment.resources.filter(r=>r.venture===id).map(r=>r.level+': '+r.name).join(' ÔåÆ ')+'</p><p>'+(id==='mine'?'Choose a vein, retain older metals, and combine two metals into permanent Spell power. Each expansion adds a base spirit.':'Choose a habitat and shelter five fish of each species once. Each sheltered species gives +5% Mine output; all four also give ├ù1.25 Pearls.')+'</p></article>').join('')+'</div><p>Refinery: '+MageVentureDevelopment.recipes.map(r=>r.name+' = '+Object.entries(r.cost).map(([id,n])=>n+' '+MageVentureDevelopment.find(id).name).join(' + ')+' ÔåÆ +'+r.power+' permanent Spell power').join(' ┬À ')+'. Repeated recipes scale material cost. Existing Ore/Pearls remain venture income for existing purchases and dungeon rewards; new material balances are separate. Live income, capped absence and Time Scrolls use the selected materials and current spirit/habitat bonuses.</p><p><a href="https://tiico.github.io/untitled-mage-game-design/prototypes/ui-pixel-idle-v22/?nav=B&progression=A&experience=ventures">Play the venture proposal ┬À 0.39.0</a>. Server persistence and final economy are not implemented by the review model. The spell graph and local drafts are unchanged.</p>';
