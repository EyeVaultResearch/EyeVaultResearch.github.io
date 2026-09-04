(function(){
"use strict";
const DATA = window.EYEVAULT_DATA;
if(!DATA){
  document.getElementById('grid').innerHTML =
    '<div class="empty"><p>Dataset failed to load.</p>'+
    '<small>data.js did not load. Check it sits next to index.html.</small></div>';
  return;
}
const RECS = DATA.records, META = DATA.meta;
const FIELDS = META.reportFields;            // 21 attribute labels, most→least reported
const NF = FIELDS.length;
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- search blobs ---------- */
RECS.forEach(r=>{
  const bits=[r.name,r.paper,r.hardware,r.task,r.nRaw,r.freqRaw,r.setting,r.mobility,r.authorLine]
    .concat(r.modality||[]).concat(r.trackerBrands||[]);
  r.groups.forEach(g=>g.items.forEach(i=>{ if(i.reported) bits.push(i.value); }));
  r._blob = bits.join(' \u00b7 ').toLowerCase();
});

/* ---------- state ---------- */
const YEARS = META.years, Y0 = YEARS[0], Y1 = YEARS[YEARS.length-1];
const state = { q:'', qTokens:[], sort:'name', yr:[Y0,Y1], f:{}, reports:new Set() };

const FACETS = [
  {key:'availability', label:'Availability', multi:true,
   order:['Available','On request','Link broken','Not available','Unclear'], open:true},
  {key:'modality', label:'Platform', multi:true, arr:true,
   order:['Screen-based','Wearable / head-mounted','VR / AR headset','Phone / tablet','RGB camera','Other / unclear','Not stated'], open:true},
  {key:'trackerBrands', label:'Eye tracker', multi:true, arr:true,
   order:['EyeLink (SR Research)','Tobii','Pupil Labs','SMI','HTC Vive','Oculus',
          'Webcam / consumer camera','Research / custom rig','Microsoft HoloLens',
          'FOVE','Gazepoint','Dikablis','ASL','Other / unclear','Not stated']},
  {key:'mobility', label:'Static or mobile', multi:true, order:['Static','Mobile','Both','Unclear']},
  {key:'setting', label:'Setting', multi:true, order:['Lab','In the wild','Lab and field','Remote / online','Unclear']},
  {key:'nBucket', label:'Participants', multi:true, order:['1\u20139','10\u201319','20\u201349','50\u201399','100+','Not stated']},
  {key:'freqBucket', label:'Sampling rate', multi:true,
   order:['Under 60 Hz','60\u2013119 Hz','120\u2013249 Hz','250\u2013999 Hz','1000 Hz and above','Not stated']},
  {key:'posture', label:'Posture', multi:true, arr:true, order:['Sitting','Standing','Walking']},
  {key:'calibration', label:'Calibration', multi:true, order:['Yes','No','Not stated']},
  {key:'chinrest', label:'Head restraint', multi:true, order:['Yes','No','Not stated']},
  {key:'envCam', label:'Scene camera', multi:true, order:['Yes','No','Not stated']},
  {key:'privacy', label:'Privacy mentioned', multi:true, order:['Yes','No','Not stated']},
  {key:'etra', label:'Venue', multi:true, order:['ETRA','Other venue']},
];
FACETS.forEach(f=>state.f[f.key]=new Set());

function setQuery(v){
  state.q = v.trim();
  state.qTokens = state.q.toLowerCase().split(/\s+/).filter(Boolean);
}

/* ---------- matching ---------- */
function matchFacet(r,f){
  const sel = state.f[f.key];
  if(!sel.size) return true;
  if(f.arr){ const v=r[f.key]||[]; for(const s of sel) if(v.includes(s)) return true; return false; }
  return sel.has(r[f.key]);
}
function matchAll(r, skipKey, skipReports){
  if(state.qTokens.length){
    for(const t of state.qTokens){ if(!r._blob.includes(t)) return false; }
  }
  if(r.year!=null && (r.year<state.yr[0] || r.year>state.yr[1])) return false;
  for(const f of FACETS){ if(f.key!==skipKey && !matchFacet(r,f)) return false; }
  if(!skipReports) for(const k of state.reports){ if(!r.reports[k]) return false; }
  return true;
}
const filtered = () => RECS.filter(r=>matchAll(r,null,false));

function sortRecs(list){
  const s=state.sort, by=[...list];
  const cmpName=(a,b)=>a.name.localeCompare(b.name);
  if(s==='score') by.sort((a,b)=>b.score-a.score||cmpName(a,b));
  else if(s==='scoreAsc') by.sort((a,b)=>a.score-b.score||cmpName(a,b));
  else if(s==='yearDesc') by.sort((a,b)=>(b.year||0)-(a.year||0)||cmpName(a,b));
  else if(s==='yearAsc') by.sort((a,b)=>(a.year||9999)-(b.year||9999)||cmpName(a,b));
  else if(s==='nDesc') by.sort((a,b)=>(b.n||-1)-(a.n||-1)||cmpName(a,b));
  else by.sort(cmpName);
  return by;
}

/* ---------- ledger ---------- */
(function ledger(){
  const avail = RECS.filter(r=>r.availability==='Available').length;
  const brands = new Set();
  RECS.forEach(r=>(r.trackerBrands||[]).forEach(b=>{ if(b!=='Not stated') brands.add(b); }));
  const items = [
    [RECS.length, 'datasets indexed'],
    [Y0+'\u2013'+Y1, 'years covered'],
    [avail, 'with a live download link'],
    [brands.size, 'eye tracker brands catalogued'],
  ];
  $('#ledger').innerHTML = items.map(([b,s])=>
    `<div><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('');
})();

/* ---------- coverage wall ---------- */
const WALL_ROWS = [...RECS].sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name));
const COLW=38, ROWH=3.6, HEAD=145, GAP=1.1;
function drawWall(){
  const W=NF*COLW, H=WALL_ROWS.length*ROWH;
  let cells='';
  WALL_ROWS.forEach((r,ri)=>{
    FIELDS.forEach((f,ci)=>{
      const on=r.reports[f];
      cells+=`<rect class="${on?'cell-on':'cell-off'}" x="${(ci*COLW).toFixed(1)}" y="${(HEAD+ri*ROWH).toFixed(1)}" width="${(COLW-GAP).toFixed(1)}" height="${(ROWH-.55).toFixed(2)}"/>`;
    });
  });
  let heads='';
  FIELDS.forEach((f,ci)=>{
    const x=ci*COLW, n=META.coverage[f];
    heads+=`<g class="wc-hit" role="button" tabindex="0" aria-pressed="false" data-field="${esc(f)}">`
      +`<rect class="wc-band" x="${x}" y="0" width="${COLW-GAP}" height="${HEAD+H}" fill="transparent"/>`
      +`<text class="wc-label" transform="translate(${x+COLW/2-3.5},${HEAD-24}) rotate(-90)" text-anchor="start">${esc(f)}</text>`
      +`<text class="wc-count" x="${x+COLW/2-3.5}" y="${HEAD-9}" text-anchor="middle">${n}</text>`
      +`</g>`;
  });
  let rows='';
  WALL_ROWS.forEach((r,ri)=>{
    rows+=`<rect class="row-hit" data-id="${r.id}" x="-6" y="${(HEAD+ri*ROWH).toFixed(1)}" width="${W+12}" height="${ROWH.toFixed(1)}"><title>${esc(r.name)} \u2014 ${r.score} of ${NF}</title></rect>`;
  });
  $('#wall').innerHTML =
    `<svg viewBox="-8 0 ${W+16} ${HEAD+H+6}" role="img" aria-label="Grid of 109 datasets by 21 reported participant attributes">`
    +heads+cells+rows+`</svg>`;

  $('#wallBars').innerHTML = FIELDS.map(f=>{
    const n=META.coverage[f], pct=(n/RECS.length*100).toFixed(1);
    return `<button class="bar-row" data-field="${esc(f)}" aria-pressed="false">`
      +`<span><span class="bar-name">${esc(f)}</span>`
      +`<span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span></span>`
      +`<span class="bar-num">${n}</span></button>`;
  }).join('');
}
function syncReports(){
  document.querySelectorAll('.wc-hit,.bar-row').forEach(el=>{
    el.setAttribute('aria-pressed', state.reports.has(el.dataset.field)?'true':'false');
  });
  document.querySelectorAll('#facets [data-report]').forEach(cb=>{
    cb.checked = state.reports.has(cb.value);
  });
}
function toggleReport(f){
  state.reports.has(f) ? state.reports.delete(f) : state.reports.add(f);
  syncReports(); render();
  vizAttr = state.reports.has(f) ? f : lastOf(state.reports);
  updateDatavizLink();
}

/* ---------- link to dataviz.html, pointed at the last attribute toggled ---------- */
let vizAttr = null;
function lastOf(set){ let v = null; for(const x of set) v = x; return v; }
function updateDatavizLink(){
  const link = document.getElementById('datavizLink');
  if(!link) return;
  link.href = vizAttr ? ('dataviz.html?attr=' + encodeURIComponent(vizAttr)) : 'dataviz.html';
}

/* ---------- facet sidebar ---------- */
function buildFacets(){
  let html='';
  html+=`<details class="fgroup" open><summary>Year</summary><div class="yearbox">
    <div class="yearvals"><span id="yrLo">${Y0}</span><span id="yrHi">${Y1}</span></div>
    <div class="yr"><label for="yrA">from</label><input id="yrA" type="range" min="${Y0}" max="${Y1}" value="${Y0}" aria-label="Earliest year"></div>
    <div class="yr"><label for="yrB">to</label><input id="yrB" type="range" min="${Y0}" max="${Y1}" value="${Y1}" aria-label="Latest year"></div>
  </div></details>`;
  FACETS.forEach(f=>{
    html+=`<details class="fgroup"${f.open?' open':''}><summary>${esc(f.label)}</summary><div data-facet="${f.key}">`;
    f.order.forEach(v=>{
      const id='f_'+f.key+'_'+v.replace(/\W/g,'');
      html+=`<label class="opt" data-val="${esc(v)}"><input type="checkbox" id="${id}" data-key="${f.key}" value="${esc(v)}">`
        +`<span class="lbl">${esc(v)}</span><span class="cnt"></span></label>`;
    });
    html+=`</div></details>`;
  });
  html+=`<details class="fgroup"><summary>Reports attribute</summary><div data-facet="__reports">`;
  FIELDS.forEach(f=>{
    html+=`<label class="opt" data-val="${esc(f)}"><input type="checkbox" data-report="${esc(f)}" value="${esc(f)}">`
      +`<span class="lbl">${esc(f)}</span><span class="cnt"></span></label>`;
  });
  html+=`</div></details><button class="reset" id="reset">Clear all filters</button>`;
  $('#facets').innerHTML=html;
}
function updateCounts(){
  FACETS.forEach(f=>{
    const pool = RECS.filter(r=>matchAll(r,f.key,false));
    const tally={};
    pool.forEach(r=>{
      const v=r[f.key];
      (Array.isArray(v)?v:[v]).forEach(x=>{ if(x!=null) tally[x]=(tally[x]||0)+1; });
    });
    document.querySelectorAll(`[data-facet="${f.key}"] .opt`).forEach(o=>{
      const n=tally[o.dataset.val]||0;
      o.querySelector('.cnt').textContent=n;
      o.classList.toggle('zero', n===0 && !state.f[f.key].has(o.dataset.val));
    });
  });
  const poolR = RECS.filter(r=>matchAll(r,null,true));
  document.querySelectorAll('[data-facet="__reports"] .opt').forEach(o=>{
    const f=o.dataset.val;
    const n=poolR.filter(r=>{
      for(const k of state.reports){ if(k!==f && !r.reports[k]) return false; }
      return r.reports[f];
    }).length;
    o.querySelector('.cnt').textContent=n;
    o.classList.toggle('zero', n===0 && !state.reports.has(f));
  });
}

/* ---------- chips ---------- */
function activeChips(){
  const out=[];
  FACETS.forEach(f=>state.f[f.key].forEach(v=>out.push({t:f.label,v,key:f.key})));
  state.reports.forEach(v=>out.push({t:'Reports',v,key:'__reports'}));
  if(state.yr[0]!==Y0||state.yr[1]!==Y1) out.push({t:'Year',v:state.yr[0]+'\u2013'+state.yr[1],key:'__year'});
  if(state.q) out.push({t:'Search',v:state.q,key:'__q'});
  return out;
}
function renderChips(){
  const chips=activeChips();
  $('#chips').innerHTML = chips.map(c=>
    `<button class="chip" data-key="${esc(c.key)}" data-val="${esc(c.v)}" `
    +`aria-label="Remove filter ${esc(c.t)}: ${esc(c.v)}">`
    +`<b>${esc(c.t)}</b> ${esc(c.v)} <span aria-hidden="true">&times;</span></button>`).join('');
  $('#reset').disabled = chips.length===0;
}

/* ---------- cards ---------- */
function glyph(r){
  const c=7, w=9.5, h=9.5;
  let s=`<svg width="${c*w}" height="${Math.ceil(NF/c)*h}" viewBox="0 0 ${c*w} ${Math.ceil(NF/c)*h}" aria-hidden="true">`;
  FIELDS.forEach((f,i)=>{
    const x=(i%c)*w, y=Math.floor(i/c)*h;
    s+=`<rect x="${x}" y="${y}" width="${w-2.4}" height="${h-2.4}" fill="${r.reports[f]?'var(--mark)':'#D8DBD1'}"/>`;
  });
  return s+'</svg>';
}
function authorsLine(r){
  if(!r.authorCount) return `<p class="authors">Authors not stated</p>`;
  const n = r.authorCount, word = n===1?'author':'authors';
  return `<p class="authors">${esc(r.authorLine)} <span class="dot" aria-hidden="true">&middot;</span> ${n} ${word}</p>`;
}
const AVAIL_CLASS = {
  'Available':'tag success', 'On request':'tag info', 'Link broken':'tag danger',
  'Not available':'tag warning', 'Unclear':'tag neutral'
};
function cardHTML(r){
  const tags=[];
  tags.push(`<span class="${AVAIL_CLASS[r.availability]||'tag'}">${esc(r.availability)}</span>`);
  (r.modality||[]).slice(0,2).forEach(m=>tags.push(`<span class="tag neutral">${esc(m)}</span>`));
  if(r.setting && r.setting!=='Unclear') tags.push(`<span class="tag neutral">${esc(r.setting)}</span>`);
  if(r.etra==='ETRA') tags.push(`<span class="tag info">ETRA</span>`);
  return `<article class="card" data-id="${r.id}">
    <h3><button class="card-open">${esc(r.name)}</button></h3>
    <p class="paper-t">${esc(r.paper||'\u2014')}</p>
    ${authorsLine(r)}
    <div class="meta">${tags.join('')}</div>
    <dl class="spec">
      <dt>Year</dt><dd>${r.year||'\u2014'}</dd>
      <dt>Participants</dt><dd>${r.n!=null?r.n:'not stated'}</dd>
      <dt>Tracker</dt><dd title="${esc(r.hardware||'')}">${esc(r.hardware||'not stated')}</dd>
    </dl>
    <div class="cardfoot"><div class="glyph">${glyph(r)}
      <small>Reports ${r.score} of ${NF}<br>participant attributes</small></div></div>
  </article>`;
}
function render(){
  const list=sortRecs(filtered());
  $('#count').textContent = list.length===RECS.length
    ? `All ${RECS.length} datasets`
    : `${list.length} of ${RECS.length} datasets`;
  $('#grid').innerHTML = list.length ? list.map(cardHTML).join('')
    : `<div class="empty"><p>No dataset matches every filter.</p>
       <small>Try removing one of the chips above, or widen the year range.</small></div>`;
  renderChips(); updateCounts();
}

/* ---------- detail panel ---------- */
const AVAIL_NOTE={
  'Available':'The dataset link was live when this survey was compiled.',
  'Link broken':'The recorded dataset link no longer resolves.',
  'Not available':'No public dataset was released.',
  'On request':'Available from the authors on request.',
  'Unclear':'The paper is ambiguous about whether the data was released.'
};
let lastFocus=null;
function openPanel(id){
  const r=RECS.find(x=>x.id===+id); if(!r) return;
  lastFocus=document.activeElement;
  const link=(href,txt)=> href
    ? `<a class="plink" href="${esc(href)}" target="_blank" rel="noopener">${txt}</a>`
    : `<button class="plink" disabled>${txt}</button>`;
  const groups=r.groups.map(g=>`<div class="dgroup"><h3>${esc(g.name)}</h3>${
    g.items.map(i=>`<dl class="drow${i.reported?'':' missing'}"><dt>${esc(i.label)}</dt>
      <dd>${i.reported?esc(i.value):'not stated'}</dd></dl>`).join('')
  }</div>`).join('');
  const bibs=[['Dataset',r.datasetBib],['Paper',r.paperBib]]
    .filter(b=>b[1]).map((b,i)=>`<div class="bib"><h3>${b[0]} citation</h3>
      <pre id="bib${i}">${esc(b[1])}</pre>
      <button class="copy" data-bib="bib${i}">Copy BibTeX</button></div>`).join('');
  $('#panel').innerHTML=`
    <div class="phead">
      <button class="pclose" id="pClose" aria-label="Close">&times;</button>
      <h2 id="pTitle">${esc(r.name)}</h2>
      <p class="paper-t">${esc(r.paper||'')}</p>
      ${authorsLine(r)}
      <div class="plinks">
        ${link(r.datasetLink,'Dataset')}
        ${link(r.paperLink,'Paper')}
        ${link(r.pubLink,'Dataset publication')}
      </div>
    </div>
    <div class="pbody" id="pBody">
      <div class="pscore">${glyph(r)}
        <p><b>${r.score} of ${NF}</b> participant attributes reported.
        ${esc(AVAIL_NOTE[r.availability]||'')}</p>
      </div>
      <label class="pcontrol"><input type="checkbox" id="hideMissing"> Hide attributes the paper did not state</label>
      ${groups}${bibs}
    </div>`;
  $('#scrim').classList.add('open'); $('#panel').classList.add('open');
  document.body.style.overflow='hidden';
  $('#panel').focus();
}
function closePanel(){
  $('#scrim').classList.remove('open'); $('#panel').classList.remove('open');
  document.body.style.overflow='';
  if(lastFocus) lastFocus.focus();
}

/* ---------- tooltip on wall rows ---------- */
const tip=$('#tip');
function showTip(e,txt){
  tip.textContent=txt; tip.classList.add('on');
  const x=Math.min(e.clientX+14, innerWidth-tip.offsetWidth-10);
  tip.style.left=x+'px'; tip.style.top=(e.clientY+16)+'px';
}
const hideTip=()=>tip.classList.remove('on');

/* ---------- events ---------- */
drawWall(); buildFacets(); render();

/* ---------- open a specific dataset when linked from dataviz.html ---------- */
(function openFromQuery(){
  const id = new URLSearchParams(window.location.search).get('open');
  if(id === null) return;
  const rec = RECS.find(r => String(r.id) === id);
  if(rec) openPanel(rec.id);
  // tidy the address bar so back/reload doesn't keep reopening it; some
  // environments (e.g. strict file:// origins) block history.replaceState,
  // so this is best-effort and never allowed to break the page.
  try{
    if(window.history && window.history.replaceState){
      window.history.replaceState(null, '', window.location.pathname);
    }
  }catch(err){ /* ignore */ }
})();

$('#wall').addEventListener('click',e=>{
  const col=e.target.closest('.wc-hit'); if(col) return toggleReport(col.dataset.field);
  const row=e.target.closest('.row-hit'); if(row) openPanel(row.dataset.id);
});
$('#wall').addEventListener('keydown',e=>{
  const col=e.target.closest('.wc-hit');
  if(col&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); toggleReport(col.dataset.field); }
});
$('#wall').addEventListener('mousemove',e=>{
  const row=e.target.closest('.row-hit');
  if(row){ const r=RECS.find(x=>x.id===+row.dataset.id);
    showTip(e, r.name+' \u2014 reports '+r.score+' of '+NF); } else hideTip();
});
$('#wall').addEventListener('mouseleave',hideTip);
$('#wallBars').addEventListener('click',e=>{
  const b=e.target.closest('.bar-row'); if(b) toggleReport(b.dataset.field);
});

$('#facets').addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.key){ const s=state.f[t.dataset.key]; t.checked?s.add(t.value):s.delete(t.value); render(); }
  else if(t.dataset.report){ toggleReport(t.value); }
});
$('#facets').addEventListener('input',e=>{
  if(e.target.id==='yrA'||e.target.id==='yrB'){
    let a=+$('#yrA').value, b=+$('#yrB').value;
    if(a>b){ if(e.target.id==='yrA') b=a; else a=b; $('#yrA').value=a; $('#yrB').value=b; }
    state.yr=[a,b]; $('#yrLo').textContent=a; $('#yrHi').textContent=b; render();
  }
});
$('#reset').addEventListener('click',resetAll);
function resetAll(){
  FACETS.forEach(f=>state.f[f.key].clear());
  state.reports.clear(); setQuery(''); state.yr=[Y0,Y1];
  $('#q').value=''; $('#qClear').hidden=true;
  $('#yrA').value=Y0; $('#yrB').value=Y1; $('#yrLo').textContent=Y0; $('#yrHi').textContent=Y1;
  document.querySelectorAll('#facets input[type=checkbox]').forEach(c=>c.checked=false);
  syncReports(); render();
  vizAttr = null; updateDatavizLink();
}

let qt;
$('#q').addEventListener('input',e=>{
  $('#qClear').hidden = !e.target.value;
  clearTimeout(qt); qt=setTimeout(()=>{ setQuery(e.target.value); render(); },140);
});
$('#qClear').addEventListener('click',()=>{
  $('#q').value=''; setQuery(''); $('#qClear').hidden=true; $('#q').focus(); render();
});
$('#sort').addEventListener('change',e=>{ state.sort=e.target.value; render(); });
$('#facetToggle').addEventListener('click',e=>{
  const open=$('#facets').classList.toggle('show');
  e.target.setAttribute('aria-expanded',open);
});
$('#grid').addEventListener('click',e=>{
  const c=e.target.closest('.card'); if(c) openPanel(c.dataset.id);
});
$('#chips').addEventListener('click',e=>{
  const c=e.target.closest('.chip'); if(!c) return;
  const {key,val}=c.dataset;
  if(key==='__q'){ $('#q').value=''; setQuery(''); $('#qClear').hidden=true; }
  else if(key==='__year'){ state.yr=[Y0,Y1]; $('#yrA').value=Y0; $('#yrB').value=Y1;
    $('#yrLo').textContent=Y0; $('#yrHi').textContent=Y1; }
  else if(key==='__reports'){ state.reports.delete(val); syncReports();
    vizAttr = lastOf(state.reports); updateDatavizLink(); }
  else { state.f[key].delete(val);
    document.querySelectorAll(`[data-key="${key}"]`).forEach(i=>{ if(i.value===val) i.checked=false; }); }
  render();
});
$('#scrim').addEventListener('click',closePanel);
$('#panel').addEventListener('click',e=>{
  if(e.target.id==='pClose') return closePanel();
  const cp=e.target.closest('.copy');
  if(cp){
    const txt=document.getElementById(cp.dataset.bib).textContent;
    const done=()=>{ cp.textContent='Copied'; setTimeout(()=>cp.textContent='Copy BibTeX',1600); };
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(done,()=>fallbackCopy(txt,done));
    } else fallbackCopy(txt,done);
  }
});
function fallbackCopy(txt,cb){
  const ta=document.createElement('textarea'); ta.value=txt;
  ta.style.cssText='position:fixed;opacity:0'; document.body.appendChild(ta);
  ta.select(); try{document.execCommand('copy'); cb();}catch(_){}
  document.body.removeChild(ta);
}
$('#panel').addEventListener('change',e=>{
  if(e.target.id==='hideMissing') $('#pBody').classList.toggle('hide-missing', e.target.checked);
});
const FOCUSABLE='a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';
document.addEventListener('keydown',e=>{
  const open=$('#panel').classList.contains('open');
  if(e.key==='Escape' && open) return closePanel();
  if(e.key==='Tab' && open){
    const els=[...$('#panel').querySelectorAll(FOCUSABLE)].filter(el=>el.offsetParent!==null);
    if(!els.length) return;
    const first=els[0], last=els[els.length-1];
    if(e.shiftKey && (document.activeElement===first||document.activeElement===$('#panel'))){
      e.preventDefault(); last.focus();
    } else if(!e.shiftKey && document.activeElement===last){
      e.preventDefault(); first.focus();
    }
    return;
  }
  if(e.key==='/' && !open && document.activeElement!==$('#q')){ e.preventDefault(); $('#q').focus(); }
});

/* ---------- bridge for charts.js (bubble-click -> open dataset) ---------- */
window.EyeVaultApp = { openPanel };
})();
