/* Isolated design prototype. No network, provider, analytics, or WordPress writes. */
'use strict';
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const storageKey = 'accelerate-onboarding-studio-v2';
const original = {
  hero: {heading:'A better home\nfor your website.', body:'We design, build and care for WordPress websites. Let’s make something that moves you forward.', cta:'Let’s talk'},
  process: {heading:'Good websites begin with a good plan.', cta:'Explore our services'}
};
const originalSteps = [['Strategy','A clear way forward'],['Migration','A considered move'],['Care','Here for the long run']];
const treatments = {
  clarity: {name:'Make the offer clear', detail:'Lead with the services already named on the page.', hero:'Strategy, migration and care for your WordPress site.', campaign:'Planning a website move?\nStart with a clear next step.', body:'We design, build and care for WordPress websites. Explore a considered route for your next move.', cta:'Explore our services', process:'From plan to ongoing care.', steps:[['Strategy','Shape a clear plan'],['Migration','Make a considered move'],['Care','Keep improving']]},
  journey: {name:'Show the path', detail:'Put the existing strategy, migration and care steps in order.', hero:'Plan your next website,\nthen make the move.', campaign:'Planning a campaign?\nSee the website path.', body:'Start with a plan, move your website, then keep improving it with ongoing care.', cta:'See how we work', process:'Plan. Move. Keep improving.', steps:[['Plan','Set priorities'],['Move','Move your site'],['Improve','Keep it cared for']]},
  invitation: {name:'Start a conversation', detail:'Make the existing invitation to speak more prominent.', hero:'Your next website\nstarts with a conversation.', campaign:'A campaign needs a home.\nLet’s talk about yours.', body:'We design, build and care for WordPress websites. Tell us what you want to move forward.', cta:'Let’s talk', process:'Let’s plan what comes next.', steps:[['Talk','Share your goals'],['Plan','Choose the next step'],['Care','Keep in touch']]}
};
const scenarios = {
  ready:'Ready to launch', admin:'Admin approval pending', denied:'Permission denied', connection:'Connection failed', staging:'Staging connection', shared:'Shared pattern', stale:'Content changed since draft', unmapped:'Unmapped template', inference:'Suggestion unavailable', 'no-draft':'No cached draft', 'no-traffic':'No eligible traffic', consent:'Consent blocks tracking', publish:'Publish verification fails'
};
const eventTypes = ['first_value_reached','onboarding_resumed','draft_changed','draft_reviewed','proposal_approved','suggestion_prepared','setup_skipped','permission_denied','connection_verified','launch_attempted','launch_verified','launch_failed','valid_exposure','test_paused','test_resumed','restored','collection_checked'];
const defaults = {phase:'draft', section:'hero', context:'all', treatment:'clarity', view:'proposal', customHeading:'', assisted:false, manualOriginal:false, approvedSignature:'', reviewedSignature:'', scenario:'ready', isolated:false, exposed:false, paused:false, saved:false, setupSkipped:false, practice:false, notification:false, editing:false, events:[], failure:'', collectionChecked:false, sourceSection:'hero', sourceHeading:''};
let state = {...defaults};
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(defaults)) if (typeof stored[key] === typeof defaults[key] && !Array.isArray(defaults[key])) state[key] = stored[key];
    if (Array.isArray(stored.events)) state.events = stored.events.filter(item => item && eventTypes.includes(item.type) && typeof item.at === 'string').slice(-24).map(item => ({type:item.type, at:item.at.slice(0,24), section:item.section==='process'?'process':'hero', context:item.context==='campaign'?'campaign':'all'}));
  }
} catch (_) { /* Local storage is optional. */ }
if (!['draft','review','live','learn'].includes(state.phase)) state.phase='draft';
if (!['hero','process'].includes(state.section)) state.section='hero';
if (!['all','campaign'].includes(state.context)) state.context='all';
if (!treatments[state.treatment]) state.treatment='clarity';
if (!scenarios[state.scenario]) state.scenario='ready';
if (!['original','proposal'].includes(state.view)) state.view='proposal';
if (state.context==='campaign') state.paused=false;
const source = section => ({...original[section], heading:state.sourceHeading && state.sourceSection===section ? state.sourceHeading : original[section].heading});
const sectionName = () => state.section === 'hero' ? 'Homepage introduction' : 'How we work';
const audience = () => state.context === 'all' ? 'All eligible visitors: original and proposal assigned as a controlled A/B test' : 'Consented visits with a recorded utm_campaign=migration, including remembered campaign visits: proposal; other visits: original';
const proposal = () => {
  const chosen = treatments[state.treatment];
  if (state.manualOriginal) return {...source(state.section), heading:state.customHeading || source(state.section).heading, steps:originalSteps};
  return {heading: state.customHeading || (state.section === 'process' ? chosen.process : state.context === 'campaign' ? chosen.campaign : chosen.hero), body:chosen.body, cta:chosen.cta, steps:chosen.steps};
};
const signature = () => JSON.stringify([state.section,state.context,state.treatment,state.customHeading,state.manualOriginal,state.isolated]);
const approved = () => state.approvedSignature === signature();
const changed = () => {
  const before=source(state.section), after=proposal();
  return before.heading!==after.heading || before.cta!==after.cta || (state.section==='hero' ? before.body!==after.body : JSON.stringify(originalSteps)!==JSON.stringify(after.steps));
};
const canLaunch = () => ['ready','no-traffic','consent','publish'].includes(state.scenario);
function persist() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (_) {} }
function record(type) {
  // Only fixed event names and enum values are accepted. Never copy page text, URLs or prompts here.
  if (!eventTypes.includes(type)) return;
  state.events.push({type, at:new Date().toISOString(), section:state.section, context:state.context});
  state.events = state.events.slice(-24);
  persist();
}
function invalidate() { state.approvedSignature = ''; state.reviewedSignature = ''; state.failure = ''; }
let toastTimer;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent=message; $('#toast').classList.add('visible'); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500); }
const button = (label, action, kind='primary full', disabled=false) => `<button type="button" class="btn ${kind}" data-action="${action}" ${disabled?'disabled':''}>${label}</button>`;
function checklist() {
  if (state.setupSkipped) return `<div class="milestones"><span class="fine">Optional setup skipped.</span> <button class="plain" data-action="show-setup">Show checklist</button></div>`;
  const connected=!['admin','denied','connection','staging'].includes(state.scenario);
  const reviewed=state.reviewedSignature===signature();
  return `<details class="milestones"><summary>Optional setup · ${[connected,reviewed,['live','learn'].includes(state.phase),state.exposed].filter(Boolean).length} of 4 milestones</summary><ol><li class="${connected?'done':''}">Production connection ${connected?'checked in this example':'needs attention'}</li><li class="${reviewed?'done':''}">Review this exact draft</li><li class="${state.phase==='live'||state.phase==='learn'?'done':''}">Approve and verify launch</li><li class="${state.exposed?'done':''}">Record a valid exposure</li></ol></details>`;
}
function notes() {
  return `<details class="evidence"><summary>Design notes & local activity</summary><p>Fictional content and simulated checks. No provider requests, email, or WordPress changes occur. The event receipt stays in this browser and keeps only event names, time and fixed scope labels.</p><ul class="receipt">${state.events.length ? state.events.slice().reverse().map(event => `<li><time>${escapeHTML(event.at.slice(0,19).replace('T',' '))}</time> · ${escapeHTML(event.type.replaceAll('_',' '))} · ${escapeHTML(event.section)} / ${escapeHTML(event.context)}</li>`).join('') : '<li>No actions recorded yet.</li>'}</ul><p>Implementation still needs authenticated connection, safe block mapping, consent aware measurement, verified publish and recovery.</p></details>`;
}
function contextChooser() {
  return `<label class="field-label" for="visitor-context">Audience</label><select id="visitor-context"><option value="all" ${state.context==='all'?'selected':''}>All eligible visitors · A/B test (recommended)</option><option value="campaign" ${state.context==='campaign'?'selected':''}>Migration campaign only · tailored view</option></select><p class="context-note">${audience()}. Preview and admin visits are excluded from the proposed measurement.</p>`;
}
function canvas() {
  const changed=state.view==='proposal' && !state.paused;
  const chosen=proposal();
  const hero=changed && state.section==='hero';
  const process=changed && state.section==='process';
  return `<section class="canvas-area" aria-label="Website canvas"><div class="canvas-toolbar"><div class="segments" role="group" aria-label="Compare original and proposal"><button data-action="view:original" class="${state.view==='original'?'active':''}" aria-pressed="${state.view==='original'}">Original</button><button data-action="view:proposal" ${state.paused?'disabled title="Resume the test to preview the proposal"':''} class="${state.view==='proposal'?'active':''}" aria-pressed="${state.view==='proposal'}">Recommended proposal</button></div><span class="preview-context">${state.context==='campaign'?'Campaign audience preview':'All visitors preview'}</span></div><div class="browser"><div class="browser-head"><span class="browser-dots" aria-hidden="true">•••</span>northstar.example · ${state.phase==='live'||state.phase==='learn'?'verified publish example':'preview only'}</div><div class="site"><div class="site-nav"><span class="site-logo">northstar.</span><div class="site-links"><span>Our work</span><span>Services</span><span>About</span></div></div><section class="site-section site-hero ${state.section==='hero'?'chosen':''}"><button class="section-pick" data-action="section:hero" aria-label="Edit homepage introduction" ${state.phase==='live'||state.phase==='learn'?'disabled title="Restore original to edit this experience"':''}>${state.section==='hero'?'✓ ':''}Introduction</button>${hero&&state.context==='campaign'?'<div class="site-kicker">For migration campaign visits</div>':''}<h2>${escapeHTML(hero?chosen.heading:source('hero').heading)}</h2><p>${escapeHTML(hero?chosen.body:source('hero').body)}</p><span class="site-cta">${escapeHTML(hero?chosen.cta:source('hero').cta)} <span aria-hidden="true">↗</span></span></section><section class="site-section site-process ${state.section==='process'?'chosen':''}"><button class="section-pick" data-action="section:process" aria-label="Edit how we work section" ${state.phase==='live'||state.phase==='learn'?'disabled title="Restore original to edit this experience"':''}>${state.section==='process'?'✓ ':''}How we work</button><h3>${escapeHTML(process?chosen.heading:source('process').heading)}</h3><div class="process-grid">${(process?chosen.steps:[['Strategy','A clear way forward'],['Migration','A considered move'],['Care','Here for the long run']]).map(([name,detail])=>`<div><b>${escapeHTML(name)}</b><p>${escapeHTML(detail)}</p></div>`).join('')}</div><span class="process-cta">${escapeHTML(process?chosen.cta:source('process').cta)} ↗</span></section></div></div><div class="canvas-caption"><span>${changed?(state.manualOriginal?'Manual draft · ':'Recommended prepared treatment · ')+sectionName():'Original page · no proposal shown'}${state.paused?' · original restored while paused':''}</span><span>Fictional site</span></div></section>`;
}
function draftPanel() {
  return `<span class="eyebrow">First useful draft</span><h2>A starting point on your page.</h2><p>Compare the prepared treatment with Original, then choose a direction.</p><div class="practice"><b>Try this: switch to Original, then back.</b><p>See the changed heading and link in ${sectionName().toLowerCase()}. The other section stays as it was. This preview is for ${state.context==='campaign'?'consented visits with a recorded migration campaign, including remembered visits':'all visitors in a controlled A/B test'}.</p>${state.practice?'<span class="fine">Comparison tried ✓</span>':''}</div>${button('Review changes →','review')}<div class="review-row"><span>Selected section</span><strong>${sectionName()}</strong></div>${Object.entries(treatments).map(([key,item])=>`<button class="concept ${!state.manualOriginal&&state.treatment===key?'selected':''}" data-action="treatment:${key}" aria-pressed="${!state.manualOriginal&&state.treatment===key}"><b>${escapeHTML(item.name)}${key==='clarity'?' · Recommended':''}</b><span>${escapeHTML(item.detail)}</span></button>`).join('')}${contextChooser()}<div class="assistant-option"><label><input type="checkbox" id="assisted" ${state.assisted?'checked':''}> Opt in to assisted suggestions</label><p>${state.assisted?'Assisted generation would read the selected section and offer another draft for review. This prototype uses prepared examples; nothing is sent to a provider.':'Manual editing remains available from this prepared draft.'}</p>${state.assisted?button('Prepare another treatment','prepare-treatment','small',state.scenario==='inference'||state.scenario==='no-draft'):''}</div><div class="manual-actions"><button class="plain" data-action="manual-original">Start from original copy</button><button class="plain" data-action="edit">Edit heading manually</button></div><label class="field-label" for="headline" ${state.editing?'':'hidden'}>Proposed heading</label>${state.editing?`<textarea id="headline" maxlength="150">${escapeHTML(proposal().heading)}</textarea>${button('Update preview','edit-save','small')}`:''}${state.setupSkipped?'':'<button class="plain" data-action="skip">Skip setup for now</button>'}${checklist()}${notes()}`;
}
function summary() {
  const before=source(state.section), after=proposal();
  const detail=(copy,steps) => state.section==='hero' ? `<small>Body: ${escapeHTML(copy.body)}</small>` : `<small>Steps: ${steps.map(([name,text])=>`${escapeHTML(name)} — ${escapeHTML(text)}`).join(' · ')}</small>`;
  return `<div class="change-summary"><div><span>BEFORE · ${sectionName()}</span><strong>${escapeHTML(before.heading)}</strong>${detail(before,originalSteps)}<small>CTA: ${escapeHTML(before.cta)}</small></div><div><span>AFTER · ${sectionName()}</span><strong>${escapeHTML(after.heading)}</strong>${detail(after,after.steps)}<small>CTA: ${escapeHTML(after.cta)}</small></div></div><p class="context-note">Only ${sectionName().toLowerCase()} changes; other sections and the existing link destination stay as they are. Measure clicks on that link, not completed enquiries.</p>`;
}
function readiness() {
  const cases={
    admin:['Admin approval is pending','Your editor role cannot grant site access. A site administrator must grant scoped edit and publish access. The draft is safe here while you wait.','Simulate admin approval','resolve-admin'],
    denied:['Permission was denied','Accelerate needs scoped edit and publish access to update only this placement and verify it. A denial leaves the site unchanged.','Request access again','request-permission'],
    connection:['Connection failed','The production WordPress connection could not be verified. Keep the draft and retry the connection.','Retry connection','resolve-connection'],
    staging:['Connected to staging','The public page does not grant production access. Connect the production WordPress installation before launch.','Simulate production connection','resolve-staging'],
    shared:['This pattern is shared','Changing it directly could alter other pages. Isolate this placement before approval.','Isolate this placement','resolve-shared'],
    stale:['Page content changed','The source changed since this draft was prepared. Recheck the current copy and prepare a fresh proposal before approval.','Refresh from current content','resolve-stale'],
    unmapped:['This template is not mapped','There is no safe editable placement for the selected section. Switch to the mapped introduction or save this draft.','Use mapped introduction','resolve-unmapped'],
    inference:['Suggestions are unavailable','The prepared draft remains available. Continue manually; no provider result is required for review.','Use prepared draft','resolve-inference'],
    'no-draft':['No saved suggestion is available','Generation is unavailable and there is no cached suggestion. Start from the original copy and edit it manually.','Start from original copy','resolve-no-draft']
  };
  if (!cases[state.scenario]) return `<ul class="check-list"><li>Connected example fixture</li><li>${state.isolated?'Isolated placement':'Selected placement checked'}</li><li>Original and recovery preview available</li><li>Existing link click measurement proposed</li></ul>`;
  const [title,detail,label,action]=cases[state.scenario];
  return `<div class="callout" role="status"><h3>${title}</h3><p>${detail}</p>${button(label,action,'small')}</div>`;
}
function reviewPanel() {
  return `<span class="eyebrow">Review before launch</span><h2>Approve this exact change.</h2><p>First useful draft complete. Launch setup is optional until you are ready; publish still requires your approval.</p>${summary()}<div class="review-row"><span>Placement and audience</span><strong>Homepage / ${sectionName()} · ${audience()}</strong></div><p class="context-note">Connection: scoped edit and publish access lets Accelerate update this placement and verify the result. A site administrator may need to grant it; reading the public page alone is insufficient.</p>${readiness()}${!changed()?'<div class="callout"><h3>No change to publish yet</h3><p>Edit the original copy or choose a treatment before launch.</p></div>':''}${state.failure?`<div class="callout" role="alert"><h3>Publish status is unknown</h3><p>Verification failed after the launch attempt. Check the installation before trying again; this preview cannot prove whether the page changed.</p>${button('Simulate installation check','resolve-publish','small')}</div>`:''}<label class="approval"><input type="checkbox" id="approval" ${approved()?'checked':''} ${!canLaunch()||!changed()||!!state.failure?'disabled':''}><span>I reviewed this exact proposal and approve publishing it to the selected audience.</span></label>${button('Launch and verify →','launch','primary full',!approved()||!canLaunch()||!changed()||!!state.failure)}${state.failure?'<p class="fine">Resolve the publish status before editing or skipping setup.</p>':`<div class="inspector-actions"><button class="plain" data-action="back-draft">← Edit draft</button><span class="fine">Original kept for restore</span></div>${state.setupSkipped?'':'<button class="plain" data-action="skip">Skip setup for now</button>'}`}${checklist()}${notes()}`;
}
function livePanel() {
  return `<span class="eyebrow">${state.paused?'Paused':'Publish verified · simulated'}</span><h2>${state.paused?'The original is showing.':state.exposed?'A valid visit was recorded.':'The experience is published.'}</h2><p>${state.exposed?'This example has sample activity. Clicks are an intent signal, not conversions or a winner.':'The publish check passed in this simulation. We have no valid visitor exposure yet.'}</p><div class="live-stats"><div><b>${state.exposed?'43':'0'}</b><span>Eligible section views</span></div><div><b>${state.exposed?'2':'0'}</b><span>Link clicks</span></div></div><p class="fine">Illustrative events. Preview and admin visits excluded. Consent and collection still govern real data.</p>${!state.exposed&&!state.paused&&state.scenario!=='no-traffic'&&state.scenario!=='consent'?button('Simulate valid exposure','expose','full'):''}${button('Open return view →','learn')}${state.context==='all'?button(state.paused?'Resume test':'Pause test','pause','full'):''}${button('Restore original to edit this experience','restore','full')}<label class="notification"><input id="notification" type="checkbox" ${state.notification?'checked':''}> Remind me when there is useful activity</label><p class="fine">Preference saved in this demo; no email is sent.</p>${notes()}`;
}
function learnPanel() {
  const noData=!state.exposed || state.scenario==='no-traffic' || state.scenario==='consent';
  return `<span class="eyebrow">Return visit · simulated</span><h2>${noData?'No valid exposure yet.':state.context==='campaign'?'The audience has activity.':'There is activity, but no winner.'}</h2><p>${noData?'The experience may be published, but there is no consented eligible section view to report. Check delivery and collection before drawing a conclusion.':state.context==='campaign'?'These are observations for different audiences; they do not establish causal lift.':'The small click difference cannot establish a winning version.'}</p>${noData?`<div class="callout"><h3>${state.scenario==='consent'?'Consent blocked measurement':'No eligible traffic recorded'}</h3><p>Check production connection, consent, audience eligibility and section visibility. Do not count preview or admin visits.</p>${button('Run collection check','check-collection','small')}${state.collectionChecked?'<p>Simulated check: connection present, but no valid consented section event was received.</p>':''}</div>`:`<table class="data-table"><thead><tr><th>${state.context==='campaign'?'Audience':'Version'}</th><th>Views</th><th>Clicks</th></tr></thead><tbody><tr><td>${state.context==='campaign'?'Migration campaign · proposal':'Original'}</td><td>158</td><td>4</td></tr><tr><td>${state.context==='campaign'?'Other visits':'Proposal'}</td><td>154</td><td>5</td></tr></tbody></table><p class="context-note">Illustrative section views and link clicks only. ${state.context==='campaign'?'Audience mix can explain differences.':'More data and a sound decision rule are needed before calling a winner.'}</p>`}${button('Back to live controls','back-live')}${notes()}`;
}
function render() {
  persist();
  const restart=$('[data-action="restart"]');
  if(restart) restart.disabled=['live','learn'].includes(state.phase);
  if (state.saved) {
    $('#studio').innerHTML=`<section class="saved"><span class="eyebrow">Saved in this browser</span><h1>Pick up where you left off.</h1><p>The prepared proposal, review state and local activity receipt are here for this fictional example.</p><div class="saved-detail"><h3>${sectionName()}</h3><p>${state.failure?'Publish status needs checking':state.phase==='live'||state.phase==='learn'?'Verified publish example':'Draft'} · ${state.context==='campaign'?'Migration campaign':'A/B test'}</p></div>${button('Resume experience →','resume','primary')}${state.failure||state.phase==='live'||state.phase==='learn'?'':button(state.setupSkipped?'Show optional setup checklist':'Rerun setup from draft',state.setupSkipped?'show-setup':'rerun','full')}${notes()}</section>`;
    return;
  }
  $('#studio').innerHTML=`<section class="studio-top"><div><h1>${state.phase==='draft'?'Your first draft is ready.':state.phase==='review'?'A clear change, ready for your call.':state.phase==='live'?'Your experience is in place.':'Return to the evidence.'}</h1><p>${state.phase==='draft'?'Compare it with the original and shape one moment on your page.':'Work from the same page, with the original always available.'}</p></div><span class="site-status"><span class="dot"></span>northstar.example · ${['admin','denied','connection','staging'].includes(state.scenario)?'connection needs attention':'connected example'}</span></section><div class="studio-grid"><aside class="page-rail" aria-label="Site context"><div class="eyebrow">Your website</div><div class="page-item selected">Homepage<span>/ · current canvas</span></div><div class="rail-section"><h3>Editable sections</h3><p>Introduction<br>How we work</p></div><div class="rail-bottom"><span class="eyebrow">Source</span><p>WordPress design, build and care are present in the fictional page copy.</p><p>No performance data yet.</p></div></aside>${canvas()}<aside class="inspector" aria-label="Experience controls">${({draft:draftPanel,review:reviewPanel,live:livePanel,learn:learnPanel})[state.phase]()}</aside></div><footer class="bottom-tools"><span>Interactive prototype · simulated actions</span><label for="scenario">Reviewer scenario <select id="scenario">${Object.entries(scenarios).map(([key,label])=>`<option value="${key}" ${state.scenario===key?'selected':''}>${label}</option>`).join('')}</select></label>${state.phase==='live'||state.phase==='learn'?'':`<button class="plain" data-action="rerun">Rerun setup</button>`}<a href="onboarding-routes.html#pressure-test">Pressure test ↗</a></footer>`;
}
function move(phase) { state.phase=phase; render(); if(window.innerWidth<=640 && phase!=='draft')$('.inspector')?.scrollIntoView({block:'start',behavior:'instant'}); const title=$('.inspector h2'); if(title){title.tabIndex=-1;title.focus({preventScroll:true});} }
document.addEventListener('change', event => {
  if (event.target.id==='visitor-context') {if(state.phase!=='draft')return;state.context=event.target.value;state.customHeading='';invalidate();record('draft_changed');render();$('#visitor-context')?.focus();}
  if (event.target.id==='assisted') {state.assisted=event.target.checked;render();$('#assisted')?.focus();}
  if (event.target.id==='approval') {if(state.phase!=='review'||!canLaunch()||!changed()||state.failure)return;state.approvedSignature=event.target.checked?signature():'';if(event.target.checked)record('proposal_approved');render();$('#approval')?.focus();}
  if (event.target.id==='notification') {state.notification=event.target.checked;persist();toast('Demo preference saved. No email will be sent.');}
  if (event.target.id==='scenario') {
    if(state.failure){event.target.value=state.scenario;toast('Check the uncertain publish result before changing scenarios.');return;}
    if(['live','learn'].includes(state.phase) && !['no-traffic','consent'].includes(event.target.value)){event.target.value=state.scenario;toast('Restore the original before reviewing another launch scenario.');return;}
    state.scenario=event.target.value;
    if(!['live','learn'].includes(state.phase))invalidate();
    state.collectionChecked=false;
    if(state.scenario==='denied')record('permission_denied');
    if(['no-traffic','consent'].includes(state.scenario) && ['live','learn'].includes(state.phase)){state.exposed=false;move('learn');}
    else render();
    $('#scenario')?.focus();
  }
});
document.addEventListener('click', event => {
  const target=event.target.closest('[data-action]'); if(!target)return;
  const [action,value]=target.dataset.action.split(':');
  if(state.failure==='unknown' && !['save','resume','view','resolve-publish'].includes(action)){toast('Check the uncertain publish result before making another change.');return;}
  if(action==='restart'){if(['live','learn'].includes(state.phase)){toast('Restore the original before restarting setup.');return;}state={...defaults,events:[]};record('first_value_reached');render();window.scrollTo({top:0,behavior:'instant'});return;}
  if(action==='save'){state.saved=true;render();return;}
  if(action==='resume'){state.saved=false;record('onboarding_resumed');render();return;}
  if(action==='show-setup'){state.saved=false;state.setupSkipped=false;render();return;}
  if(action==='rerun'){if(['live','learn'].includes(state.phase)){toast('Restore the original before rerunning setup.');return;}state.saved=false;state.setupSkipped=false;state.phase='draft';state.view='proposal';invalidate();render();return;}
  if(action==='skip'){if(!['draft','review'].includes(state.phase))return;state.setupSkipped=true;state.saved=true;record('setup_skipped');render();return;}
  if(action==='section'){if(['live','learn'].includes(state.phase)){toast('Restore the original to edit this experience.');return;}if(state.section!==value){state.section=value;state.customHeading='';invalidate();state.phase='draft';state.view='proposal';record('draft_changed');render();}return;}
  if(action==='view'){state.view=value;if(value==='original')state.practice=true;render();$(`[data-action="view:${value}"]`)?.focus();return;}
  if(action==='treatment'){if(state.phase!=='draft')return;state.treatment=value;state.manualOriginal=false;state.customHeading='';state.view='proposal';invalidate();record('draft_changed');render();$(`[data-action="treatment:${value}"]`)?.focus();return;}
  if(action==='prepare-treatment'){if(state.phase!=='draft'||!state.assisted||['inference','no-draft'].includes(state.scenario))return;state.treatment=({clarity:'journey',journey:'invitation',invitation:'clarity'})[state.treatment];state.manualOriginal=false;state.customHeading='';state.view='proposal';invalidate();record('suggestion_prepared');record('draft_changed');render();return;}
  if(action==='manual-original'){if(state.phase!=='draft')return;state.manualOriginal=true;state.customHeading='';state.view='proposal';invalidate();record('draft_changed');render();toast('Original copy is ready to edit.');return;}
  if(action==='edit'){if(state.phase!=='draft')return;state.editing=true;render();$('#headline')?.focus();return;}
  if(action==='edit-save'){if(state.phase!=='draft')return;const heading=$('#headline')?.value.trim();if(!heading){toast('Enter a heading to update the preview.');return;}state.customHeading=heading;state.editing=false;state.view='proposal';invalidate();record('draft_changed');render();return;}
  if(action==='review'){if(state.phase!=='draft')return;state.editing=false;state.reviewedSignature=signature();record('draft_reviewed');move('review');return;}
  if(action==='back-draft'){if(state.phase!=='review')return;move('draft');return;}
  if(action==='launch'){
    if(state.phase!=='review'||!approved()||!canLaunch()||!changed()||state.failure)return;
    record('launch_attempted');
    if(state.scenario==='publish'){state.failure='unknown';state.approvedSignature='';record('launch_failed');render();return;}
    state.failure='';state.exposed=false;state.paused=false;state.view='proposal';record('launch_verified');move('live');return;
  }
  if(action.startsWith('resolve-')){
    if(action==='resolve-publish'){if(state.failure!=='unknown')return;state.scenario='ready';state.failure='';state.approvedSignature='';render();toast('Simulated installation check found the original unchanged. Review and approve again.');return;}
    if(action==='resolve-shared')state.isolated=true;
    if(action==='resolve-unmapped'){state.section='hero';state.customHeading='';}
    if(action==='resolve-no-draft'){state.manualOriginal=true;state.customHeading='';state.phase='draft';}
    if(action==='resolve-stale'){state.sourceSection=state.section;state.sourceHeading=state.section==='hero'?'Your website, ready for what comes next.':'A clear plan for your next website.';state.customHeading='';state.phase='draft';state.view='original';}
    state.scenario='ready';invalidate();if(['resolve-admin','resolve-connection','resolve-staging'].includes(action))record('connection_verified');render();return;
  }
  if(action==='request-permission'){record('permission_denied');state.scenario='admin';invalidate();render();return;}
  if(action==='expose'){if(state.phase!=='live'||state.paused)return;state.exposed=true;record('valid_exposure');render();return;}
  if(action==='pause'){if(state.phase!=='live'||state.context!=='all')return;state.paused=!state.paused;state.view=state.paused?'original':'proposal';record(state.paused?'test_paused':'test_resumed');render();return;}
  if(action==='restore'){if(!['live','learn'].includes(state.phase))return;record('restored');state.approvedSignature='';state.paused=false;state.exposed=false;state.view='original';move('draft');return;}
  if(action==='learn'){if(state.phase!=='live')return;move('learn');return;}
  if(action==='back-live'){if(state.phase!=='learn')return;move('live');return;}
  if(action==='check-collection'){state.collectionChecked=true;record('collection_checked');render();return;}
});
if(!state.events.some(event=>event.type==='first_value_reached'))record('first_value_reached');
render();
