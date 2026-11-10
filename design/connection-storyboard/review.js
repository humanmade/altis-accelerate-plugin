(() => {
  const screens = window.storyScreens;
  const params = new URLSearchParams(location.search);
  let current = screens.find(s => s.id === params.get('screen')) || screens[0];
  let state = current.states.find(s => s[0] === params.get('state'))?.[0] || current.states[0][0];
  let palette = ['mixed', 'purple', 'charcoal'].includes(params.get('palette')) ? params.get('palette') : 'mixed';
  let entry = params.get('entry') === 'plugin' || state === 'plugin' ? 'plugin' : 'website';
  let compare = params.get('compare') === '1';
  let mobile = params.get('mobile') === '1';
  const $ = id => document.getElementById(id);
  function frameUrl(colour) { return `frame.html?screen=${current.id}&state=${state}&palette=${colour}&entry=${entry}`; }
  function render() {
    let group = '';
    $('frames').innerHTML = screens.map((s, i) => {
      let heading = group !== s.group ? `<p class="nav-group">${s.group}</p>` : '';
      group = s.group;
      return `${heading}<button data-screen="${s.id}" ${s.id === current.id ? 'aria-current="step"' : ''}><span>${String(i + 1).padStart(2, '0')}</span>${s.title}</button>`;
    }).join('');
    $('chapter').textContent = current.group;
    $('screen-title').textContent = current.title;
    $('screen-description').textContent = current.description;
    $('screen-count').textContent = `${String(screens.indexOf(current) + 1).padStart(2,'0')} / ${screens.length}`;
    $('state').innerHTML = current.states.map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
    $('state').value = state;
    $('palette').value = palette;
    $('compare').setAttribute('aria-pressed', String(compare));
    $('mobile').setAttribute('aria-pressed', String(mobile));
    $('open-frame').href = frameUrl(palette);
    $('preview').className = `preview${compare ? ' compare' : ''}${mobile ? ' mobile' : ''}`;
    const variants = compare ? ['charcoal', 'purple'] : [palette];
    $('preview').innerHTML = variants.map(c => `<div class="artboard">${compare ? `<p>${c === 'charcoal' ? 'A · Charcoal primary' : 'B · Purple primary'} · identical content</p>` : ''}<iframe title="${current.title} — ${c}" src="${frameUrl(c)}"></iframe></div>`).join('');
    $('change-note').textContent = current.change;
    $('contract-note').textContent = current.contract;
    $('next').textContent = screens.indexOf(current) === screens.length - 1 ? 'Back to first screen →' : 'Next screen →';
    history.replaceState(null, '', `?screen=${current.id}&state=${state}&palette=${palette}&entry=${entry}${compare ? '&compare=1' : ''}${mobile ? '&mobile=1' : ''}`);
    document.title = `${current.title} · Accelerate storyboard`;
  }
  function navigate(id, nextState, nextEntry) {
    const found = screens.find(s => s.id === id);
    if (!found) return;
    entry = nextEntry || (id === 'signin-plugin' || id === 'create' || nextState === 'plugin' ? 'plugin' : id === 'signin-web' || id === 'reset' ? 'website' : entry);
    current = found;
    state = current.states.find(s => s[0] === nextState)?.[0] || current.states[0][0];
    render();
  }
  $('frames').addEventListener('click', e => { const b = e.target.closest('[data-screen]'); if (b) navigate(b.dataset.screen); });
  $('next').onclick = () => navigate(screens[(screens.indexOf(current) + 1) % screens.length].id);
  $('state').onchange = e => {state = e.target.value; if (current.id === 'reset' && ['plugin','default'].includes(state)) entry = state === 'plugin' ? 'plugin' : 'website'; render();};
  $('palette').onchange = e => {palette = e.target.value; render();};
  $('compare').onclick = () => {compare = !compare; render();};
  $('mobile').onclick = () => {mobile = !mobile; render();};
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || ![...document.querySelectorAll('iframe')].some(f => f.contentWindow === e.source)) return;
    if (e.data?.type === 'storyboard:navigate') navigate(e.data.screen, e.data.state, e.data.entry);
  });
  render();
})();
