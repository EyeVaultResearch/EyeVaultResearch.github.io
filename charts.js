(function(){
"use strict";
const DATA = window.EYEVAULT_DATA;
const d3 = window.d3;
if(!DATA || !d3){
  ['trendChart','landscapeChart','timelineChart'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.innerHTML = '<p class="chart-fallback">Chart library did not load. '
      + 'Check your connection and reload.</p>';
  });
  return;
}
const RECS = DATA.records;
const FIELDS = DATA.meta.reportFields;
const NF = FIELDS.length;
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- shared tooltip (reuses the #tip element from index.html) ---------- */
const tipEl = document.getElementById('tip');
function showTip(evt, html){
  tipEl.innerHTML = html; tipEl.classList.add('on');
  const x = Math.min(evt.clientX + 14, window.innerWidth - tipEl.offsetWidth - 12);
  tipEl.style.left = x + 'px'; tipEl.style.top = (evt.clientY + 16) + 'px';
}
function hideTip(){ tipEl.classList.remove('on'); }

/* ---------- shared style helper: read a CSS custom property as a real color ---------- */
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function svgRoot(containerId, ariaLabel){
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  const width = Math.max(el.clientWidth || 720, 320);
  return { el, width, svg: d3.select(el).append('svg')
    .attr('viewBox', `0 0 ${width} 1`) // height fixed per-chart, viewBox reset there
    .attr('role', 'img').attr('aria-label', ariaLabel).attr('width', '100%') };
}

/* =========================================================================
   CHART 1 — Reporting over time
   Percentage of that year's datasets reporting a chosen participant attribute.
   ========================================================================= */
function computeTrend(field){
  const byYear = new Map();
  RECS.forEach(r=>{
    if(r.year == null) return;
    if(!byYear.has(r.year)) byYear.set(r.year, {total:0, hit:0});
    const o = byYear.get(r.year);
    o.total++; if(r.reports[field]) o.hit++;
  });
  return Array.from(byYear, ([year,o]) => ({year, pct: o.hit/o.total*100, n:o.total}))
    .sort((a,b)=>a.year-b.year);
}

let trendField = 'Gender';
function drawTrend(field){
  trendField = field;
  const height = 300, margin = {top:16, right:24, bottom:34, left:46};
  const { el, width } = svgRoot('trendChart',
    `Percent of datasets reporting ${field}, by year`);
  const data = computeTrend(field);
  const svg = d3.select(el).select('svg').attr('viewBox', `0 0 ${width} ${height}`);

  if(data.length < 2){
    svg.append('text').attr('x', width/2).attr('y', height/2)
      .attr('text-anchor','middle').attr('fill', cssVar('--ink-3')).attr('font-size', 13)
      .text('Not enough dated datasets to plot a trend for this attribute.');
    return;
  }

  const x = d3.scaleLinear().domain(d3.extent(data, d=>d.year)).range([margin.left, width-margin.right]);
  const y = d3.scaleLinear().domain([0,100]).range([height-margin.bottom, margin.top]);
  const rad = d3.scaleSqrt().domain([0, d3.max(data, d=>d.n)]).range([3, 9]);

  svg.append('g').selectAll('line').data(y.ticks(5)).join('line')
    .attr('x1', margin.left).attr('x2', width-margin.right)
    .attr('y1', d=>y(d)).attr('y2', d=>y(d))
    .attr('stroke', cssVar('--rule-soft'));

  const yearTicks = data.map(d=>d.year);
  svg.append('g').attr('transform', `translate(0,${height-margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(yearTicks.filter((_,i)=>yearTicks.length<=10 || i%2===0)).tickFormat(d3.format('d')))
    .call(g=>g.select('.domain').attr('stroke', cssVar('--rule')))
    .call(g=>g.selectAll('line').attr('stroke', cssVar('--rule')))
    .call(g=>g.selectAll('text').attr('fill', cssVar('--ink-3')).attr('font-size', 11));

  svg.append('g').attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(d=>d+'%'))
    .call(g=>g.select('.domain').remove())
    .call(g=>g.selectAll('line').remove())
    .call(g=>g.selectAll('text').attr('fill', cssVar('--ink-3')).attr('font-size', 11));

  const line = d3.line().x(d=>x(d.year)).y(d=>y(d.pct)).curve(d3.curveMonotoneX);
  const area = d3.area().x(d=>x(d.year)).y0(y(0)).y1(d=>y(d.pct)).curve(d3.curveMonotoneX);

  svg.append('path').datum(data).attr('d', area)
    .attr('fill', cssVar('--accent-soft')).attr('opacity', 0.7);
  svg.append('path').datum(data).attr('d', line)
    .attr('fill', 'none').attr('stroke', cssVar('--accent')).attr('stroke-width', 2.2);

  svg.append('g').attr('class', 'trend-dots').selectAll('circle').data(data).join('circle')
    .attr('cx', d=>x(d.year)).attr('cy', d=>y(d.pct)).attr('r', d=>rad(d.n))
    .attr('fill', cssVar('--raised')).attr('stroke', cssVar('--accent')).attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mousemove', (evt,d)=> showTip(evt,
      `<b>${d.year}</b><br>${d.pct.toFixed(0)}% reported ${esc(field)}<br>`
      + `<span style="opacity:.75">n = ${d.n} dated dataset${d.n===1?'':'s'}</span>`))
    .on('mouseleave', hideTip);
}

(function initTrend(){
  const select = document.getElementById('trendAttr');
  FIELDS.forEach(f=>{
    const o = document.createElement('option'); o.value = f; o.textContent = f;
    select.appendChild(o);
  });
  const requested = new URLSearchParams(window.location.search).get('attr');
  if(requested && FIELDS.includes(requested)) trendField = requested;
  select.value = trendField;
  select.addEventListener('change', e=>drawTrend(e.target.value));
  drawTrend(trendField);
})();

/* Every dataset has a stable id; charts.js never shares a page with app.js
   (it only runs on dataviz.html), so a click always navigates to the
   dataset index and asks it to open that record. */
function datasetHref(id){
  return 'index.html?open=' + encodeURIComponent(id);
}

window.EyeVaultCharts = {
  setTrendAttribute(field){
    const select = document.getElementById('trendAttr');
    if(select) select.value = field;
    drawTrend(field);
  },
  datasetHref
};

/* =========================================================================
   CHART 2 — Dataset landscape
   Year (x) vs participant-reporting completeness (y), bubble size = N,
   color = availability.
   ========================================================================= */
const AVAIL_ORDER = ['Available','On request','Link broken','Not available','Unclear'];
const AVAIL_FILL = {
  'Available':'--success-bg', 'On request':'--info-bg',
  'Link broken':'--danger-bg', 'Not available':'--warning-bg', 'Unclear':'--secondary-bg'
};
const AVAIL_STROKE = {
  'Available':'--success-text', 'On request':'--info-text',
  'Link broken':'--danger-text', 'Not available':'--warning-text', 'Unclear':'--secondary-text'
};

function drawLandscape(){
  const height = 380, margin = {top:16, right:24, bottom:36, left:46};
  const { el, width } = svgRoot('landscapeChart',
    'Dataset year versus participant-reporting completeness, sized by sample size');
  const data = RECS.filter(r=>r.year != null);
  const svg = d3.select(el).select('svg').attr('viewBox', `0 0 ${width} ${height}`);

  const x = d3.scaleLinear().domain(d3.extent(data, d=>d.year)).nice().range([margin.left, width-margin.right]);
  const y = d3.scaleLinear().domain([0,100]).range([height-margin.bottom, margin.top]);
  const rad = d3.scaleSqrt().domain([0, d3.max(data, d=>d.n||0)]).range([3, 22]);

  svg.append('g').selectAll('line').data(y.ticks(5)).join('line')
    .attr('x1', margin.left).attr('x2', width-margin.right)
    .attr('y1', d=>y(d)).attr('y2', d=>y(d))
    .attr('stroke', cssVar('--rule-soft'));

  svg.append('g').attr('transform', `translate(0,${height-margin.bottom})`)
    .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d')))
    .call(g=>g.select('.domain').attr('stroke', cssVar('--rule')))
    .call(g=>g.selectAll('line').attr('stroke', cssVar('--rule')))
    .call(g=>g.selectAll('text').attr('fill', cssVar('--ink-3')).attr('font-size', 11));

  svg.append('g').attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(d=>d+'%'))
    .call(g=>g.select('.domain').remove())
    .call(g=>g.selectAll('line').remove())
    .call(g=>g.selectAll('text').attr('fill', cssVar('--ink-3')).attr('font-size', 11));

  svg.append('g').attr('class','landscape-dots').selectAll('circle').data(data).join('circle')
    .attr('cx', d=>x(d.year)).attr('cy', d=>y(d.score/NF*100))
    .attr('r', d=>rad(d.n||0))
    .attr('fill', d=>cssVar(AVAIL_FILL[d.availability] || '--secondary-bg'))
    .attr('stroke', d=>cssVar(AVAIL_STROKE[d.availability] || '--secondary-text'))
    .attr('stroke-width', 1.3).attr('opacity', 0.88)
    .style('cursor', 'pointer')
    .on('mousemove', (evt,d)=> showTip(evt,
      `<b>${esc(d.name)}</b><br>${d.year} &middot; reports ${d.score} of ${NF} attributes<br>`
      + `${d.n!=null ? d.n+' participants' : 'participant count not stated'} &middot; ${esc(d.availability)}`))
    .on('mouseleave', hideTip)
    .on('click', (evt,d)=>{ window.location.href = datasetHref(d.id); });

  const legend = document.getElementById('landscapeLegend');
  legend.innerHTML = AVAIL_ORDER.map(a =>
    `<span class="chart-key"><i style="background:${cssVar(AVAIL_FILL[a])};`
    + `border-color:${cssVar(AVAIL_STROKE[a])}"></i>${esc(a)}</span>`).join('');
}
drawLandscape();

/* =========================================================================
   CHART 3 — Eye-tracker timeline
   When the most-used explicitly named tracker models appear in the collection.
   ========================================================================= */
const BRAND_KEY = [
  [/eyelink/i, 'EyeLink',  '--accent'],
  [/tobii/i,   'Tobii',    '--success-text'],
  [/smi/i,     'SMI',      '--warning-text'],
  [/pupil/i,   'Pupil Labs','--info-text'],
  [/vive/i,    'HTC Vive', '--secondary-text'],
];
function brandOf(model){
  const hit = BRAND_KEY.find(([re]) => re.test(model));
  return hit ? hit[1] : 'Other';
}
function brandColor(model){
  const hit = BRAND_KEY.find(([re]) => re.test(model));
  return cssVar(hit ? hit[2] : '--ink-3');
}

function drawTimeline(){
  const byModel = new Map();
  RECS.forEach(r=>{
    if(r.year == null) return;
    (r.trackerModels || []).forEach(m=>{
      if(!byModel.has(m)) byModel.set(m, new Map());
      const years = byModel.get(m);
      if(!years.has(r.year)) years.set(r.year, []);
      years.get(r.year).push(r.name);
    });
  });

  let models = Array.from(byModel, ([model, years]) => ({
    model,
    total: Array.from(years.values()).reduce((a,v)=>a+v.length, 0),
    points: Array.from(years, ([year,names]) => ({year, names})).sort((a,b)=>a.year-b.year)
  }));
  models = models.filter(m=>m.total >= 1).sort((a,b)=> b.total - a.total).slice(0, 12);
  // display rows chronologically by first appearance, most-used still guaranteed present
  models.sort((a,b)=> d3.min(a.points, d=>d.year) - d3.min(b.points, d=>d.year));

  const rowH = 30, margin = {top:16, right:24, bottom:34, left:150};
  const height = margin.top + margin.bottom + models.length*rowH;
  const { el, width } = svgRoot('timelineChart',
    'Years in which the most-used named eye-tracker models appear in the collection');
  const svg = d3.select(el).select('svg').attr('viewBox', `0 0 ${width} ${height}`);

  if(!models.length){
    svg.append('text').attr('x', width/2).attr('y', height/2).attr('text-anchor','middle')
      .attr('fill', cssVar('--ink-3')).attr('font-size', 13)
      .text('No explicitly named tracker models were extracted from the hardware field.');
    return;
  }

  const allYears = models.flatMap(m=>m.points.map(p=>p.year));
  const x = d3.scaleLinear().domain(d3.extent(allYears)).nice().range([margin.left, width-margin.right]);
  const y = d3.scaleBand().domain(models.map(m=>m.model)).range([margin.top, height-margin.bottom]).padding(0.35);
  const rad = d3.scaleSqrt().domain([1, d3.max(models, m=>d3.max(m.points, p=>p.names.length)) || 1]).range([4, 10]);

  svg.append('g').attr('transform', `translate(0,${height-margin.bottom})`)
    .call(d3.axisBottom(x).ticks(Math.min(allYears.length, 10)).tickFormat(d3.format('d')))
    .call(g=>g.select('.domain').attr('stroke', cssVar('--rule')))
    .call(g=>g.selectAll('line').attr('stroke', cssVar('--rule')))
    .call(g=>g.selectAll('text').attr('fill', cssVar('--ink-3')).attr('font-size', 11));

  const rows = svg.append('g').selectAll('g').data(models).join('g')
    .attr('transform', d=>`translate(0,${y(d.model) + y.bandwidth()/2})`);

  rows.append('line')
    .attr('x1', margin.left).attr('x2', width-margin.right)
    .attr('stroke', cssVar('--rule-soft'));

  rows.append('text')
    .attr('class', 'timeline-row-label')
    .attr('x', margin.left - 12).attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
    .attr('fill', cssVar('--ink-2')).attr('font-size', 12.5)
    .text(d=>d.model);

  rows.each(function(d){
    d3.select(this).selectAll('circle').data(d.points).join('circle')
      .attr('cx', p=>x(p.year)).attr('cy', 0).attr('r', p=>rad(p.names.length))
      .attr('fill', brandColor(d.model)).attr('opacity', 0.88)
      .style('cursor', 'pointer')
      .on('mousemove', (evt,p)=>{
        const shown = p.names.slice(0,3).map(esc).join(', ');
        const extra = p.names.length > 3 ? ` +${p.names.length-3} more` : '';
        showTip(evt, `<b>${esc(d.model)}</b> &middot; ${p.year}<br>${shown}${extra}`);
      })
      .on('mouseleave', hideTip);
  });

  const legend = document.getElementById('timelineLegend');
  const brandsShown = Array.from(new Set(models.map(m=>brandOf(m.model))));
  legend.innerHTML = brandsShown.map(b=>{
    const entry = BRAND_KEY.find(e=>e[1]===b);
    const color = cssVar(entry ? entry[2] : '--ink-3');
    return `<span class="chart-key"><i style="background:${color};border-color:${color}"></i>${esc(b)}</span>`;
  }).join('');
}
drawTimeline();

/* =========================================================================
   CHART 4 — Reporting by category
   Same 21 participant attributes as the trend chart, but sliced by a chosen
   study characteristic instead of by year: for each category, the percent
   of its datasets reporting each attribute.
   ========================================================================= */
const GROUPING_DIMS = [
  { key:'setting',     label:'Study setting',    order:['Lab','In the wild','Lab and field','Remote / online','Unclear'] },
  { key:'mobility',     label:'Static vs mobile', order:['Static','Mobile','Both','Unclear'] },
  { key:'availability', label:'Availability',     order:['Available','On request','Link broken','Not available','Unclear'] },
  { key:'etra',         label:'Venue',            order:['ETRA','Other venue'] },
  { key:'nBucket',      label:'Participants',     order:['1\u20139','10\u201319','20\u201349','50\u201399','100+','Not stated'] },
  { key:'freqBucket',   label:'Sampling rate',    order:['Under 60 Hz','60\u2013119 Hz','120\u2013249 Hz','250\u2013999 Hz','1000 Hz and above','Not stated'] },
];
const HEAT_ROWS = [...FIELDS].sort((a,b)=> DATA.meta.coverage[b] - DATA.meta.coverage[a]);

function computeHeatmap(dimKey){
  const dim = GROUPING_DIMS.find(d=>d.key===dimKey);
  const cats = dim.order.filter(cat => RECS.some(r=>r[dimKey]===cat));
  return {
    dim,
    cats,
    cells: cats.map(cat=>{
      const pool = RECS.filter(r=>r[dimKey]===cat);
      return {
        cat, total: pool.length,
        byField: HEAT_ROWS.map(f=>{
          const hit = pool.filter(r=>r.reports[f]).length;
          return { field:f, hit, total: pool.length, pct: pool.length ? hit/pool.length*100 : 0 };
        })
      };
    })
  };
}

function drawHeatmap(dimKey){
  const rowH = 17, colW = 92, margin = {top:56, right:20, bottom:10, left:172};
  const { cats, cells } = computeHeatmap(dimKey);
  const width = Math.max(margin.left + cats.length*colW + margin.right, 420);
  const height = margin.top + HEAT_ROWS.length*rowH + margin.bottom;
  const { el } = svgRoot('heatmapChart',
    `Percent of datasets reporting each participant attribute, grouped by ${dimKey}`);
  const svg = d3.select(el).select('svg').attr('viewBox', `0 0 ${width} ${height}`);

  const color = d3.scaleLinear().domain([0,100])
    .range([cssVar('--accent-soft'), cssVar('--accent')]).interpolate(d3.interpolateRgb);

  svg.append('g').selectAll('text.row').data(HEAT_ROWS).join('text')
    .attr('class','row').attr('x', margin.left - 10).attr('text-anchor','end')
    .attr('y', (d,i)=> margin.top + i*rowH + rowH/2 + 4)
    .attr('fill', cssVar('--ink-2')).attr('font-size', 11.5)
    .text(d=>d);

  const cols = svg.append('g').selectAll('g').data(cells).join('g')
    .attr('transform', (d,i)=>`translate(${margin.left + i*colW},0)`);

  cols.append('text').attr('x', colW/2 - 3).attr('y', margin.top - 34)
    .attr('text-anchor','middle').attr('fill', cssVar('--ink')).attr('font-size', 12).attr('font-weight', 600)
    .text(d=>d.cat);
  cols.append('text').attr('x', colW/2 - 3).attr('y', margin.top - 20)
    .attr('text-anchor','middle').attr('fill', cssVar('--ink-3')).attr('font-size', 10.5)
    .text(d=>`n = ${d.total}`);

  cols.each(function(colDatum){
    d3.select(this).selectAll('rect').data(colDatum.byField).join('rect')
      .attr('x', 0).attr('y', (d,i)=> margin.top + i*rowH)
      .attr('width', colW - 6).attr('height', rowH - 3)
      .attr('fill', d=> d.total ? color(d.pct) : cssVar('--rule-soft'))
      .style('cursor', d=>d.total ? 'pointer' : 'default')
      .on('mousemove', (evt,d)=> showTip(evt,
        `<b>${esc(d.field)}</b> &middot; ${esc(colDatum.cat)}<br>`
        + `${d.total ? d.pct.toFixed(0)+'% reported' : 'no datasets in this group'}`
        + (d.total ? `<br><span style="opacity:.75">${d.hit} of ${d.total} datasets</span>` : '')))
      .on('mouseleave', hideTip);
  });

  const legend = document.getElementById('heatmapLegend');
  legend.innerHTML = `<span class="chart-key">0%</span>`
    + `<span class="heat-gradient" style="background:linear-gradient(to right, ${color(0)}, ${color(50)}, ${color(100)})"></span>`
    + `<span class="chart-key">100% of the group reports it</span>`;
}

(function initHeatmap(){
  const select = document.getElementById('heatmapDim');
  GROUPING_DIMS.forEach(d=>{
    const o = document.createElement('option'); o.value = d.key; o.textContent = d.label;
    select.appendChild(o);
  });
  select.value = 'setting';
  select.addEventListener('change', e=>drawHeatmap(e.target.value));
  drawHeatmap('setting');
})();

/* =========================================================================
   CHART 5 — Explore the data (build-your-own scatter)
   Pick any two metrics for the axes and a category to color by.
   ========================================================================= */
const METRICS = [
  { key:'year',          label:'Publication year',            type:'linear', get:r=>r.year },
  { key:'n',             label:'Participants (log scale)',    type:'log',    get:r=>(r.n>0?r.n:null) },
  { key:'freq',          label:'Sampling rate, Hz (log scale)', type:'log',  get:r=>(r.freq>0?r.freq:null) },
  { key:'completeness',  label:'Reporting completeness (%)',  type:'linear', get:r=>r.score/NF*100 },
];
const COLOR_DIMS = [
  { key:'availability', label:'Availability',    get:r=>r.availability },
  { key:'setting',      label:'Study setting',   get:r=>r.setting },
  { key:'mobility',     label:'Static vs mobile',get:r=>r.mobility },
  { key:'etra',         label:'Venue',           get:r=>r.etra },
];
const CAT_ORDER = { availability:['Available','On request','Link broken','Not available','Unclear'],
  setting:['Lab','In the wild','Lab and field','Remote / online','Unclear'],
  mobility:['Static','Mobile','Both','Unclear'], etra:['ETRA','Other venue'] };
const TABLEAU10 = ['#4E79A7','#F28E2B','#E15759','#76B7B2','#59A14F','#EDC948','#B07AA1','#FF9DA7','#9C755F','#BAB0AC'];

function scaleFor(metric, data){
  const vals = data.map(metric.get).filter(v=>v!=null);
  if(metric.type === 'log'){
    return d3.scaleLog().domain([Math.max(1, d3.min(vals)), d3.max(vals)]).nice();
  }
  return d3.scaleLinear().domain(d3.extent(vals)).nice();
}

function drawExplorer(xKey, yKey, colorKey){
  const height = 400, margin = {top:16, right:24, bottom:44, left:56};
  const { el, width } = svgRoot('explorerChart', `Custom scatter plot: ${xKey} versus ${yKey}, colored by ${colorKey}`);
  const xm = METRICS.find(m=>m.key===xKey), ym = METRICS.find(m=>m.key===yKey);
  const cm = COLOR_DIMS.find(c=>c.key===colorKey);
  const data = RECS.filter(r => xm.get(r) != null && ym.get(r) != null);
  const svg = d3.select(el).select('svg').attr('viewBox', `0 0 ${width} ${height}`);

  if(!data.length){
    svg.append('text').attr('x', width/2).attr('y', height/2).attr('text-anchor','middle')
      .attr('fill', cssVar('--ink-3')).attr('font-size', 13)
      .text('No datasets have both selected values.');
    return;
  }

  const x = scaleFor(xm, data).range([margin.left, width-margin.right]);
  const y = scaleFor(ym, data).range([height-margin.bottom, margin.top]);
  const cats = (CAT_ORDER[colorKey] || Array.from(new Set(data.map(cm.get)))).filter(c=>data.some(r=>cm.get(r)===c));
  const color = d3.scaleOrdinal().domain(cats).range(TABLEAU10);

  svg.append('g').selectAll('line').data(y.ticks(6)).join('line')
    .attr('x1', margin.left).attr('x2', width-margin.right)
    .attr('y1', d=>y(d)).attr('y2', d=>y(d)).attr('stroke', cssVar('--rule-soft'));

  const xAxis = xm.type === 'log' ? d3.axisBottom(x).ticks(5, '~s') : d3.axisBottom(x).ticks(7).tickFormat(xm.key==='year'?d3.format('d'):null);
  const yAxis = ym.type === 'log' ? d3.axisLeft(y).ticks(5, '~s') : d3.axisLeft(y).ticks(6);
  svg.append('g').attr('transform', `translate(0,${height-margin.bottom})`).call(xAxis)
    .call(g=>g.select('.domain').attr('stroke', cssVar('--rule')))
    .call(g=>g.selectAll('line').attr('stroke', cssVar('--rule')))
    .call(g=>g.selectAll('text').attr('fill', cssVar('--ink-3')).attr('font-size', 11));
  svg.append('g').attr('transform', `translate(${margin.left},0)`).call(yAxis)
    .call(g=>g.select('.domain').remove())
    .call(g=>g.selectAll('line').remove())
    .call(g=>g.selectAll('text').attr('fill', cssVar('--ink-3')).attr('font-size', 11));

  svg.append('text').attr('x', (margin.left+width-margin.right)/2).attr('y', height-6)
    .attr('text-anchor','middle').attr('fill', cssVar('--ink-2')).attr('font-size', 11.5)
    .text(xm.label);
  svg.append('text').attr('transform', `translate(14,${(margin.top+height-margin.bottom)/2}) rotate(-90)`)
    .attr('text-anchor','middle').attr('fill', cssVar('--ink-2')).attr('font-size', 11.5)
    .text(ym.label);

  svg.append('g').selectAll('circle').data(data).join('circle')
    .attr('cx', d=>x(xm.get(d))).attr('cy', d=>y(ym.get(d))).attr('r', 5)
    .attr('fill', d=>color(cm.get(d))).attr('opacity', 0.82)
    .attr('stroke', cssVar('--raised')).attr('stroke-width', 0.8)
    .style('cursor', 'pointer')
    .on('mousemove', (evt,d)=> showTip(evt,
      `<b>${esc(d.name)}</b><br>${xm.label}: ${esc(String(xm.get(d)))}`
      + `<br>${ym.label}: ${esc(String(Math.round(ym.get(d)*10)/10))}`
      + `<br>${cm.label}: ${esc(String(cm.get(d)))}`))
    .on('mouseleave', hideTip)
    .on('click', (evt,d)=>{ window.location.href = datasetHref(d.id); });

  const legend = document.getElementById('explorerLegend');
  legend.innerHTML = cats.map(c=>
    `<span class="chart-key"><i style="background:${color(c)};border-color:${color(c)}"></i>${esc(c)}</span>`).join('');
}

(function initExplorer(){
  const xSel = document.getElementById('explorerX');
  const ySel = document.getElementById('explorerY');
  const cSel = document.getElementById('explorerColor');
  METRICS.forEach(m=>{ const o=document.createElement('option'); o.value=m.key; o.textContent=m.label; xSel.appendChild(o); });
  METRICS.forEach(m=>{ const o=document.createElement('option'); o.value=m.key; o.textContent=m.label; ySel.appendChild(o.cloneNode(true)); });
  COLOR_DIMS.forEach(c=>{ const o=document.createElement('option'); o.value=c.key; o.textContent=c.label; cSel.appendChild(o); });
  xSel.value = 'year'; ySel.value = 'completeness'; cSel.value = 'availability';
  const redraw = ()=>drawExplorer(xSel.value, ySel.value, cSel.value);
  [xSel,ySel,cSel].forEach(s=>s.addEventListener('change', redraw));
  redraw();
  window.__redrawExplorer = redraw;
})();

/* ---------- keep charts crisp on resize ---------- */
let resizeT;
window.addEventListener('resize', ()=>{
  clearTimeout(resizeT);
  resizeT = setTimeout(()=>{
    drawTrend(trendField); drawLandscape(); drawTimeline();
    const hd = document.getElementById('heatmapDim'); if(hd) drawHeatmap(hd.value);
    if(window.__redrawExplorer) window.__redrawExplorer();
  }, 150);
});
})();
