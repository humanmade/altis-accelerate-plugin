/* Fictional, isolated design prototype. No provider or WordPress requests. */
'use strict';
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const storageKey = 'accelerate-onboarding-finder-v1';
const candidates = {
  hero: {
    number:'01', name:'Homepage introduction', kind:'Group · heading, paragraph and link',
    excerpt:'A better home for your website.',
    staleExcerpt:'A clearer home for what comes next.',
    observed:'The first screen names the service, then invites a conversation.',
    hypothesis:'A more specific heading might help visitors decide whether to explore further.',
    next:'Try changing one heading or the existing “Let’s talk” link label yourself.',
    path:'Homepage → Introduction group', goal:'Clicks on the existing “Let’s talk” link'
  },
  services: {
    number:'02', name:'How we work', kind:'Group · heading, columns and link',
    excerpt:'Good websites begin with a good plan.',
    staleExcerpt:'A good plan comes first.',
    observed:'Strategy, migration and care already appear together in a three-part group.',
    hypothesis:'A clearer section heading might make those steps easier to scan.',
    next:'Try changing this group’s heading; keep the existing section link.',
    path:'Homepage → How we work group', goal:'Clicks on the existing “Explore our services” link'
  },
  contact: {
    number:'03', name:'Contact invitation', kind:'Group · heading and link',
    excerpt:'Let’s make something that moves you forward.',
    staleExcerpt:'Ready to make your next move?',
    observed:'The page closes with a short invitation and an existing contact link.',
    hypothesis:'A more direct invitation might help interested visitors take the next step.',
    next:'Try changing only the invitation heading or the contact link label.',
    path:'Homepage → Contact invitation group', goal:'Clicks on the existing contact link'
  }
};
const scenarios = {
  ready:'Ready', screenshot:'Screenshot unavailable', empty:'No candidates', permission:'Admin permission pending', connection:'Connection failed', shared:'Shared pattern', stale:'Page changed since review', unmapped:'Cannot map visual region'
};
const eventTypes = ['candidate_selected','candidate_located','manual_match_confirmed','editor_opened','connection_confirmed','saved','resumed'];
const defaults = {phase:'candidates', source:'wordpress', scenario:'ready', selected:'hero', sourceRevision:'initial', recovery:false, located:false, manualMatch:'', manualConfirmed:false, sharedAck:false, editorFocus:'heading', saved:false, help:true, events:[]};
let state = {...defaults};
try {
  const stored=JSON.parse(localStorage.getItem(storageKey));
  if (stored && typeof stored==='object') {
    for (const key of Object.keys(defaults)) if (!Array.isArray(defaults[key]) && typeof stored[key]===typeof defaults[key]) state[key]=stored[key];
    if (Array.isArray(stored.events)) state.events=stored.events.filter(item=>item && eventTypes.includes(item.type) && typeof item.at==='string').slice(-20).map(item=>({type:item.type,at:item.at.slice(0,24),candidate:candidates[item.candidate]?item.candidate:'none'}));
  }
} catch (_) { /* Local storage may be unavailable. */ }
if (!['candidates','locator','editor'].includes(state.phase)) state.phase='candidates';
if (!['wordpress','screenshot'].includes(state.source)) state.source='wordpress';
if (!scenarios[state.scenario]) state.scenario='ready';
if (state.selected && !candidates[state.selected]) state.selected='';
if (!['initial','refreshed'].includes(state.sourceRevision)) state.sourceRevision='initial';
if (!candidates[state.manualMatch]) state.manualMatch='';
if (!['heading','cta'].includes(state.editorFocus)) state.editorFocus='heading';
const button=(label,action,kind='primary',disabled=false)=>`<button type="button" class="btn ${kind}" data-action="${action}" ${disabled?'disabled':''}>${label}</button>`;
const excerpt=key=>state.sourceRevision==='refreshed'?candidates[key].staleExcerpt:candidates[key].excerpt;
const blocked=()=>['permission','connection'].includes(state.scenario)||(state.scenario==='shared'&&!state.sharedAck);
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(_){}}
function record(type){
  if(!eventTypes.includes(type))return;
  state.events.push({type,at:new Date().toISOString(),candidate:state.selected||'none'});
  state.events=state.events.slice(-20);
  persist();
}
let toastTimer;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
function focusHeading(){window.scrollTo({top:0,behavior:'instant'});const heading=$('#finder h1, #finder h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
function go(phase){state.phase=phase;render();focusHeading();}
function sourceLabel(){return state.source==='wordpress'?'WordPress content + page preview':'Screenshot only · visual hints';}
function receipt(){
  return `<details class="finder-notes"><summary>Prototype notes & local receipt</summary><p>A screenshot can suggest a visual region; the WordPress block tree establishes edit authority. Deep-linking and focus in the native editor still need integration. Firecrawl could supply a screenshot, but none is fetched here. No block, variant or experiment is generated.</p><ul>${state.events.length?state.events.slice().reverse().map(event=>`<li>${escapeHTML(event.at.slice(0,19).replace('T',' '))} · ${escapeHTML(event.type.replaceAll('_',' '))} · ${escapeHTML(event.candidate)}</li>`).join(''):'<li>No actions recorded yet.</li>'}</ul><p>The receipt stores only fixed event names, time and candidate IDs. It records locating and opening, not activation, editing or publishing.</p></details>`;
}
function siteSection(key,content,interactive=true){
  const active=state.selected===key;
  return `<section class="finder-site-section ${key} ${interactive&&active?'active':''}">${interactive?`<button type="button" class="finder-marker" data-action="candidate:${key}" aria-label="Select ${candidates[key].name}" aria-pressed="${active}">${candidates[key].number}</button>`:''}${content}</section>`;
}
function pagePreview(interactive=true){
  const screenshot=state.source==='screenshot';
  return `<div class="finder-browser"><div class="browser-head"><span class="browser-dots" aria-hidden="true">•••</span>northstar.example · ${screenshot?'screenshot example':'page preview'}</div><div class="finder-site"><div class="finder-site-nav"><b>northstar.</b><span>Our work　 Services　 About</span></div>${siteSection('hero',`<p class="finder-kicker">WordPress websites</p><h2>${escapeHTML(excerpt('hero'))}</h2><p>We design, build and care for WordPress websites. Let’s make something that moves you forward.</p><span class="finder-site-link">Let’s talk ↗</span>`,interactive)}${siteSection('services',`<h3>${escapeHTML(excerpt('services'))}</h3><div class="finder-steps"><div><b>Strategy</b><span>A clear way forward</span></div><div><b>Migration</b><span>A considered move</span></div><div><b>Care</b><span>Here for the long run</span></div></div><span class="finder-text-link">Explore our services ↗</span>`,interactive)}${siteSection('contact',`<p class="finder-kicker">Next step</p><h3>${escapeHTML(excerpt('contact'))}</h3><span class="finder-site-link">Get in touch ↗</span>`,interactive)}</div></div><p class="finder-caption">Original fictional page · ${interactive?'markers select regions':'browse existing blocks to continue'}; no new block or copy is applied.</p>`;
}
function candidateList(){
  if((state.scenario==='empty'&&!state.recovery)||(state.scenario==='screenshot'&&state.source==='screenshot'&&!state.recovery)){
    const failed=state.scenario==='screenshot';
    return `<div class="finder-empty"><h2>${failed?'Screenshot unavailable':'No suggested candidates'}</h2><p>${failed?'The image could not be loaded. Existing WordPress blocks remain available through the connected example.':'There is no ranked suggestion from this source. You can browse the existing page blocks yourself.'}</p>${button('Browse existing blocks','browse','primary')}</div>`;
  }
  return `<div class="finder-rows">${Object.entries(candidates).map(([key,item])=>`<button type="button" class="finder-row ${state.selected===key?'selected':''}" data-action="candidate:${key}" aria-pressed="${state.selected===key}"><span class="finder-row-number">${item.number}</span><span><strong>${item.name}</strong><small>${state.source==='screenshot'?'Visual region only':state.recovery?'Existing block · '+item.kind:'Possible starting point · '+item.kind}</small></span><span aria-hidden="true">↗</span></button>`).join('')}</div>`;
}
function selectedDetail(){
  if(!state.selected)return `<div class="finder-detail"><h2>Choose a section to inspect</h2><p>${state.scenario==='stale'?'The page changed since this review. Select a current section before opening its block.':'Choose an existing section from the list to inspect its original content.'}</p></div>`;
  const item=candidates[state.selected];
  const screenshot=state.source==='screenshot';
  return `<div class="finder-detail"><div class="finder-detail-title"><span>${item.number} / ${state.recovery?'Existing page block':screenshot?'Visual region only':'Suggested starting point'}</span><h2>${item.name}</h2></div><div class="finder-reasons"><div><b>What we saw</b><p>${item.observed}</p></div><div><b>Worth trying</b><p>${item.hypothesis}</p></div></div><p class="finder-next"><b>One next action:</b> ${item.next}</p>${button(screenshot?'Locate this region in WordPress':'Find this block in WordPress','locate','primary')}<details class="finder-goal"><summary>Measurement for a later test</summary><p>${item.goal}. A click does not prove an enquiry.</p></details><button class="plain finder-view-link" data-action="view-highlight">View highlighted page section ↓</button>${state.help?`<div class="finder-help"><span>Start with one existing block. You’ll make the edit in WordPress.</span><button class="plain" data-action="dismiss-help" aria-label="Dismiss help">Dismiss</button></div>`:''}</div>`;
}
function candidatesScreen(){
  const unavailable=!state.recovery && (state.scenario==='empty'||(state.scenario==='screenshot'&&state.source==='screenshot'));
  return `<section class="finder-top"><div><h1>${state.recovery?'Browse existing page blocks':'A good place to start is already on your page.'}</h1><p>${state.recovery?'Choose an existing section yourself; this is not a ranked recommendation.':'Three places worth a closer look. Pick one existing section, then edit it in WordPress.'}</p></div><span class="finder-connection">${state.source==='wordpress'?'Connected fictional fixture':'Screenshot example'}</span></section>
    <div class="finder-layout"><aside class="finder-list" aria-label="Page sections"><h2>${state.recovery?'Existing sections':'Suggested sections'}</h2><p class="finder-list-intro">${state.recovery?'Original page content':'Recommended first: the introduction'}</p>${candidateList()}${unavailable?'':selectedDetail()}</aside>
    <div class="finder-workspace"><div class="finder-source"><span>Source: ${sourceLabel()}</span><div role="group" aria-label="Source view"><button data-action="source:wordpress" aria-pressed="${state.source==='wordpress'}" class="${state.source==='wordpress'?'active':''}">WordPress + preview</button><button data-action="source:screenshot" aria-pressed="${state.source==='screenshot'}" class="${state.source==='screenshot'?'active':''}">Screenshot only</button></div></div>${state.scenario==='stale'?'<div class="finder-alert" role="status">The page changed since the earlier review. The excerpts below are current in this fictional fixture; choose a section again.</div>':''}${state.scenario==='screenshot'&&state.source==='screenshot'&&!state.recovery?'<div class="finder-preview-empty">Screenshot unavailable. Browse existing blocks to continue.</div>':pagePreview(!unavailable)}</div></div>`;
}
function connectPanel(){
  const failed=state.scenario==='connection';
  const pending=state.scenario==='permission';
  return `<div class="finder-locator-card"><h2>${pending?'Waiting for a site administrator':failed?'Production connection failed':'Connect before locating a block'}</h2><p>${pending?'Your role cannot grant scoped edit access. This visual hint stays saved while an administrator approves the connection.':failed?'The production WordPress installation could not be verified. Keep this hint and retry when access is available.':'A screenshot identifies a visual area, not a block ID or edit permission. A scoped production connection lets the WordPress block tree supply possible matches. The public page alone does not grant edit access.'}</p>${pending?`<p class="finder-warning">No editor handoff is available while approval is pending.</p>${button('Reviewer: simulate administrator approval','approve-admin','secondary')}`:button(failed?'Retry simulated connection':'Simulate scoped connection','connect','primary')}${button('Back to candidates','back','secondary')}</div>`;
}
function sharedPanel(){
  return `<div class="finder-locator-card"><h2>Review every use of this pattern</h2><p>This existing pattern may appear beyond the homepage. Editing the synced pattern can affect every placement. No placement is isolated here.</p><dl><div><dt>Selected use</dt><dd>Homepage → ${candidates[state.selected].name}</dd></div><div><dt>Other uses</dt><dd>Unknown in this fixture. Inspect the real pattern’s uses in WordPress before editing.</dd></div></dl><label class="finder-scope-ack"><input type="checkbox" id="shared-ack" ${state.sharedAck?'checked':''}> I understand the edit may affect every use and will review the real scope.</label>${button('Open existing pattern for scope review','open-editor','primary',!state.sharedAck)}${button('Choose another section','back','secondary')}</div>`;
}
function manualPanel(){
  return `<div class="finder-locator-card"><h2>Find the matching block in List View</h2><p>The visual region could not be mapped safely. Choose the existing block whose content matches the page, then confirm it yourself. This remains a manual match.</p><div class="finder-manual-list" role="group" aria-label="Existing blocks">${Object.entries(candidates).map(([key,item])=>`<button data-action="manual:${key}" aria-pressed="${state.manualMatch===key}" class="${state.manualMatch===key?'selected':''}"><b>${item.name}</b><span>${escapeHTML(excerpt(key))}</span></button>`).join('')}</div>${state.manualMatch?`<p class="finder-confirm">Selected: ${candidates[state.manualMatch].name}. Confirm only if this matches the region you intended to edit.</p>${button('I confirm this existing block','confirm-manual','primary')}`:''}${button('Back to candidates','back','secondary')}</div>`;
}
function locatorScreen(){
  const item=candidates[state.selected];
  if(!item && state.source==='screenshot' && state.recovery) return `<section class="finder-step"><div class="finder-step-header"><h1>Browse the existing WordPress blocks</h1><p>A screenshot cannot supply editable block IDs.</p></div><div class="finder-step-grid"><div class="finder-location-preview">${pagePreview(false)}</div>${connectPanel()}</div></section>`;
  if(!item)return candidatesScreen();
  let content;
  if(state.source==='screenshot'||['permission','connection'].includes(state.scenario)) content=connectPanel();
  else if(state.scenario==='unmapped'&&!state.manualConfirmed) content=manualPanel();
  else if(state.scenario==='shared') content=sharedPanel();
  else content=`<div class="finder-locator-card"><h2>${state.manualConfirmed?'Manually confirmed existing block':'Possible block path found'}</h2><dl><div><dt>Page and path</dt><dd>${item.path} ${state.manualConfirmed?'· confirmed by you':'· candidate path in the fictional fixture; confirm the exact block in WordPress'}</dd></div><div><dt>Original excerpt</dt><dd>“${escapeHTML(excerpt(state.selected))}”</dd></div><div><dt>Scope</dt><dd>Selected homepage group. Verify pattern uses before changing any shared block.</dd></div><div><dt>Access</dt><dd>Scoped edit permission is required before the real editor can open.</dd></div></dl><p>Check the original excerpt and location before editing. Open the existing block to inspect it; nothing is changed or started here.</p>${button('Open selected block','open-editor','primary')}${button('Back to candidates','back','secondary')}</div>`;
  return `<section class="finder-step"><div class="finder-step-header"><span>Selected section · ${item.number}</span><h1>Find the existing block</h1><p>${item.name} · ${sourceLabel()}</p></div><div class="finder-step-grid"><div class="finder-location-preview">${pagePreview()}</div>${content}</div></section>`;
}
function editorScreen(){
  const item=candidates[state.selected];
  return `<section class="finder-editor-wrap"><div class="finder-editor-heading"><div><span>WordPress editor · simulated handoff</span><h1>${state.scenario==='shared'?'Shared pattern · '+item.name:'Homepage'}</h1><p>${state.manualConfirmed?'You confirmed the matching existing block in List View.':'This simulated List View highlights a candidate existing block; confirm the exact match in WordPress.'} Nothing has been changed or published.</p></div>${button('Return to candidates','back','secondary')}</div>${state.scenario==='shared'?'<div class="finder-alert">Shared pattern: editing in the real editor may affect every use. Review the full list of placements before any change.</div>':''}<div class="finder-editor"><aside class="finder-list-view" aria-label="WordPress List View"><h2>List View</h2><div class="finder-tree-row">${state.scenario==='shared'?'Pattern content':'Homepage'}</div>${Object.entries(state.scenario==='shared'?{[state.selected]:item}:candidates).map(([key,candidate])=>`<div class="finder-tree-row ${state.selected===key?'selected':''}" ${state.selected===key?'aria-current="true"':''}>${candidate.name}</div>`).join('')}</aside><div class="finder-editor-canvas"><div class="finder-editor-toolbar">${state.scenario==='shared'?'Pattern · '+item.name:'Page · Homepage'} <span>Preview of native editor</span></div><div class="finder-editor-block"><span>Selected existing group · ${item.name}</span><h2>${escapeHTML(excerpt(state.selected))}</h2><p>${item.kind}</p><span class="finder-text-link">${state.selected==='services'?'Explore our services':state.selected==='contact'?'Get in touch':'Let’s talk'} ↗</span></div></div><aside class="finder-editor-guide"><h2>One small edit</h2><p>Choose what you would change yourself using WordPress controls:</p><div class="finder-choice" role="group" aria-label="Choose an edit"><button data-action="edit-focus:heading" aria-pressed="${state.editorFocus==='heading'}" class="${state.editorFocus==='heading'?'selected':''}">Heading</button><button data-action="edit-focus:cta" aria-pressed="${state.editorFocus==='cta'}" class="${state.editorFocus==='cta'?'selected':''}">Existing link</button></div><p class="finder-guide-note">${state.editorFocus==='heading'?'Select the heading inside this group and revise only its wording.':'Select the existing link in this group and revise only its label.'}</p><div class="finder-editor-goal"><b>If you later create a test</b><p>An ordinary group may need user-led synced-pattern conversion or experiment setup in the real WordPress editor first. If you create a test, use the supported in-block goal: ${item.goal}. Preview and approve there.</p></div><p class="fine">No edit, experiment or publish action runs in this prototype.</p></aside></div></section>`;
}
function render(){
  persist();
  if(state.saved){$('#finder').innerHTML=`<section class="finder-saved"><h1>Saved in this browser.</h1><p>${state.selected?candidates[state.selected].name:'No section selected'} · ${state.phase==='editor'?'Editor handoff preview':state.phase==='locator'?'Block locator':'Page candidates'}</p>${button('Resume where I left off','resume','primary')}${receipt()}</section>`;return;}
  $('#finder').innerHTML=({candidates:candidatesScreen,locator:locatorScreen,editor:editorScreen})[state.phase]()+`<footer class="finder-footer"><label for="review-scenario">Reviewer scenario <select id="review-scenario">${Object.entries(scenarios).map(([key,label])=>`<option value="${key}" ${state.scenario===key?'selected':''}>${label}</option>`).join('')}</select></label><span>Original content · no generated block</span>${receipt()}</footer>`;
}
document.addEventListener('change',event=>{
  if(event.target.id==='shared-ack'){state.sharedAck=event.target.checked;render();$('#shared-ack')?.focus();return;}
  if(event.target.id!=='review-scenario')return;
  state.scenario=event.target.value;
  state.phase='candidates';state.located=false;state.manualMatch='';state.manualConfirmed=false;state.sharedAck=false;state.recovery=false;
  if(state.scenario==='stale'){state.sourceRevision='refreshed';state.selected='';}
  render();$('#review-scenario')?.focus();
});
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');if(!target)return;
  const [action,value]=target.dataset.action.split(':');
  if(action==='restart'){state={...defaults,events:[]};render();window.scrollTo({top:0,behavior:'instant'});return;}
  if(action==='save'){state.saved=true;record('saved');render();focusHeading();return;}
  if(action==='resume'){state.saved=false;record('resumed');render();focusHeading();return;}
  if(action==='dismiss-help'){state.help=false;render();return;}
  if(action==='view-highlight'){$('.finder-site-section.active')?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return;}
  if(action==='source'){state.sharedAck=false;state.manualMatch='';state.source=value;state.phase='candidates';state.located=false;state.manualConfirmed=false;state.recovery=false;render();$(`[data-action="source:${value}"]`)?.focus();return;}
  if(action==='candidate'){if(!state.recovery&&(state.scenario==='empty'||(state.scenario==='screenshot'&&state.source==='screenshot')))return;state.selected=value;state.sharedAck=false;state.manualMatch='';state.manualConfirmed=false;state.located=false;state.phase='candidates';record('candidate_selected');render();$(`[data-action="candidate:${value}"]`)?.focus();return;}
  if(action==='browse'){
    state.recovery=true;state.selected='';
    if(state.source==='screenshot'){state.phase='locator';render();focusHeading();}
    else go('candidates');
    return;
  }
  if(action==='locate'){if(!state.selected)return;state.located=false;go('locator');return;}
  if(action==='back'){go('candidates');return;}
  if(action==='connect'){
    if(!['locator'].includes(state.phase)||state.scenario==='permission')return;
    if(state.scenario==='connection')state.scenario='ready';
    state.source='wordpress';record('connection_confirmed');if(state.recovery)state.phase='candidates';render();focusHeading();return;
  }
  if(action==='approve-admin'){if(state.phase!=='locator'||state.scenario!=='permission')return;state.scenario='ready';render();focusHeading();return;}
  if(action==='manual'){if(state.phase!=='locator'||state.scenario!=='unmapped')return;state.manualMatch=value;render();$(`[data-action="manual:${value}"]`)?.focus();return;}
  if(action==='confirm-manual'){if(state.phase!=='locator'||!state.manualMatch)return;state.selected=state.manualMatch;state.manualConfirmed=true;state.located=true;record('manual_match_confirmed');render();focusHeading();return;}
  if(action==='open-editor'){
    if(state.phase!=='locator'||state.source!=='wordpress'||blocked()||(state.scenario==='unmapped'&&!state.manualConfirmed))return;
    state.located=true;record('candidate_located');record('editor_opened');go('editor');return;
  }
  if(action==='edit-focus'){if(state.phase!=='editor')return;state.editorFocus=value;render();$(`[data-action="edit-focus:${value}"]`)?.focus();}
});
render();
