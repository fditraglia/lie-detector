'use strict';

const IMAGES = { thief: 'img/ninja.png', innocent: 'img/angel.png' };

const $ = id => document.getElementById(id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const wait = ms => new Promise(resolve => setTimeout(resolve, reduceMotion.matches ? 0 : ms));
const fmt = new Intl.NumberFormat('en-US');

function randomInt(n) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

// Two rolls of a ten-sided die, as in class: the first decides whether the
// employee is a thief (0 = thief), the second whether the test is right (2-9).
function testEmployee() {
  const thief = randomInt(10) === 0;
  const correct = randomInt(10) >= 2;
  return { thief, fail: thief === correct };
}

// ---------------------------------------------------------------- Modes

const tabs = { one: $('tab-one'), many: $('tab-many') };
const panels = { one: $('one'), many: $('many') };

function showMode() {
  const mode = location.hash === '#many' ? 'many' : 'one';
  for (const key of Object.keys(panels)) {
    const active = key === mode;
    panels[key].hidden = !active;
    tabs[key].setAttribute('aria-selected', String(active));
  }
  if (mode === 'many') renderSim();
}

for (const key of Object.keys(tabs)) {
  tabs[key].addEventListener('click', () => {
    history.replaceState(null, '', `#${key}`);
    showMode();
  });
}
window.addEventListener('hashchange', showMode);

// ---------------------------------------------------------------- One at a time

const deck = $('deck');
const drawn = $('drawn');
const flipper = $('flipper');
const frontFace = $('front-face');
const backFace = $('back-face');
const drawBtn = $('draw-btn');
const drawStatus = $('draw-status');

let drawState = 'ready'; // 'ready', then 'drawn' (failed, can flip), 'flipped' or 'skipped' (passed)
let current = null;

function restart(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function stampHTML(fail) {
  return `<span class="stamp ${fail ? 'fail' : 'pass'}">${fail ? 'FAIL' : 'PASS'}</span>`;
}

async function pickEmployee() {
  drawBtn.disabled = true;
  // On a phone the setup can leave the card or button partly off screen; bring both into view.
  const stageTop = panels.one.getBoundingClientRect().top;
  if (stageTop < 0 || drawBtn.getBoundingClientRect().bottom > window.innerHeight) {
    panels.one.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }
  drawn.hidden = true;
  deck.hidden = false;
  drawStatus.textContent = 'Picking…';
  restart(deck, 'shuffling');
  await wait(950);
  deck.classList.remove('shuffling');

  current = testEmployee();
  flipper.classList.add('no-transition');
  flipper.classList.remove('flipped');
  void flipper.offsetWidth;
  flipper.classList.remove('no-transition');

  const stamp = $('stamp');
  stamp.className = `stamp ${current.fail ? 'fail' : 'pass'}`;
  stamp.textContent = current.fail ? 'FAIL' : 'PASS';
  $('employee-no').textContent = `Employee no. ${1000 + randomInt(9000)}`;
  const who = current.thief ? 'thief' : 'innocent';
  $('truth-img').src = IMAGES[who];
  $('truth-name').textContent = current.thief ? 'Thief' : 'Innocent';
  frontFace.removeAttribute('aria-hidden');
  backFace.setAttribute('aria-hidden', 'true');

  deck.hidden = true;
  drawn.hidden = false;
  restart(drawn, 'dealt');
  // Only an employee who fails the test goes on to have the truth revealed.
  if (current.fail) {
    drawStatus.textContent = 'This employee failed the test.';
    drawBtn.textContent = 'Reveal the truth';
    drawState = 'drawn';
  } else {
    drawStatus.textContent = 'This employee passed the test. This round doesn’t count for you.';
    drawBtn.textContent = 'Pick another employee';
    drawState = 'skipped';
    recordRound(current);
  }
  drawBtn.disabled = false;
}

function revealTruth() {
  flipper.classList.add('flipped');
  frontFace.setAttribute('aria-hidden', 'true');
  backFace.removeAttribute('aria-hidden');
  drawStatus.textContent = current.thief ? 'This employee is a thief.' : 'This employee is innocent.';
  drawBtn.textContent = 'Pick another employee';
  drawState = 'flipped';
  recordRound(current);
}

drawBtn.addEventListener('click', () => {
  if (drawState === 'drawn') revealTruth();
  else pickEmployee();
});

// The tally survives a reload, so an accidental refresh mid-class loses nothing.
const TALLY_KEY = 'lie-detector-tally';
const emptyTally = () => ({ rounds: 0, fail: 0, failThief: 0 });

function loadTally() {
  try {
    const t = JSON.parse(localStorage.getItem(TALLY_KEY));
    if (t && Number.isInteger(t.rounds)) return t;
  } catch {}
  return emptyTally();
}

let tally = loadTally();

function saveTally() {
  try {
    localStorage.setItem(TALLY_KEY, JSON.stringify(tally));
  } catch {}
}

function renderTally() {
  $('t-rounds').textContent = fmt.format(tally.rounds);
  $('t-fail').textContent = fmt.format(tally.fail);
  $('t-thief').textContent = fmt.format(tally.failThief);
}

function recordRound(e) {
  tally.rounds++;
  if (e.fail) {
    tally.fail++;
    if (e.thief) tally.failThief++;
  }
  saveTally();
  renderTally();
}

// Resetting takes two taps, so a stray tap cannot wipe the tally.
const resetBtn = $('tally-reset');
let resetTimer = null;

resetBtn.addEventListener('click', () => {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
    tally = emptyTally();
    saveTally();
    renderTally();
    resetBtn.textContent = 'Reset tally';
    return;
  }
  resetBtn.textContent = 'Tap again to reset';
  resetTimer = setTimeout(() => {
    resetTimer = null;
    resetBtn.textContent = 'Reset tally';
  }, 3000);
});

renderTally();

// ---------------------------------------------------------------- Many at once

// Outcome codes: 0 = passed the test, 1 = failed and innocent, 2 = failed and a thief.
const WAFFLE_MAX = 2500;
const DURATION = { 1: 0, 10: 1200, 100: 1600, 1000: 2000 };

const sim = { n: 0, fail: 0, failThief: 0, codes: [], path: [], last: null };
let running = false;
let grouped = false;

function simulateOne() {
  const e = testEmployee();
  const code = !e.fail ? 0 : e.thief ? 2 : 1;
  sim.n++;
  if (code > 0) {
    sim.fail++;
    if (code === 2) sim.failThief++;
    sim.path.push(sim.failThief / sim.fail);
  }
  if (sim.codes.length < WAFFLE_MAX) sim.codes.push(code);
  sim.last = e;
}

const chips = document.querySelectorAll('.chip');

function setBusy(busy) {
  running = busy;
  for (const chip of chips) chip.disabled = busy;
}

function run(k) {
  if (running) return;
  setBusy(true);
  const duration = reduceMotion.matches ? 0 : DURATION[k];
  const start = performance.now();
  let done = 0;
  const step = now => {
    const target = duration
      ? Math.min(k, Math.max(1, Math.floor((k * (now - start)) / duration)))
      : k;
    while (done < target) {
      simulateOne();
      done++;
    }
    renderSim();
    if (done < k) requestAnimationFrame(step);
    else setBusy(false);
  };
  requestAnimationFrame(step);
}

for (const chip of chips) {
  chip.addEventListener('click', () => run(Number(chip.dataset.k)));
}

$('sim-reset').addEventListener('click', () => {
  if (running) return;
  Object.assign(sim, { n: 0, fail: 0, failThief: 0, codes: [], path: [], last: null });
  renderSim();
});

$('group').addEventListener('change', e => {
  grouped = e.target.checked;
  renderWaffle();
});

$('answer').addEventListener('toggle', renderChart);

function plural(n, word) {
  return `${fmt.format(n)} ${word}${n === 1 ? '' : 's'}`;
}

function renderLatest() {
  const result = $('latest-result');
  const truth = $('latest-truth');
  if (!sim.last) {
    for (const el of [result, truth]) {
      el.classList.remove('filled');
      el.innerHTML = '<span>?</span>';
    }
    return;
  }
  result.classList.add('filled');
  truth.classList.add('filled');
  result.innerHTML = stampHTML(sim.last.fail);
  truth.innerHTML = `<img src="${IMAGES[sim.last.thief ? 'thief' : 'innocent']}" alt="">`;
}

function renderEstimate() {
  const { n, fail: N, failThief: m } = sim;
  $('f-num').textContent = fmt.format(m);
  $('f-den').textContent = fmt.format(N);
  $('f-dec').textContent = N ? `= ${(m / N).toFixed(3)}` : '';
  $('fraction').style.visibility = N ? 'visible' : 'hidden';
  let text;
  if (n === 0) {
    text = 'No employees tested yet. Choose how many to test.';
  } else if (N === 0) {
    text = `None of the ${plural(n, 'employee')} tested so far failed the test.`;
  } else {
    text = `${fmt.format(N)} of ${plural(n, 'employee')} failed the test. ` +
      `Of those ${fmt.format(N)}, ${fmt.format(m)} ${m === 1 ? 'was a thief' : 'were thieves'}.`;
  }
  $('summary').textContent = text;
  $('l-thief').textContent = fmt.format(m);
  $('l-innocent').textContent = fmt.format(N - m);
  $('l-void').textContent = fmt.format(n - N);
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderWaffle() {
  const canvas = $('waffle');
  const size = canvas.clientWidth;
  if (!size) return;
  const dpr = window.devicePixelRatio || 1;
  const px = Math.round(size * dpr);
  if (canvas.width !== px) canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const colors = [cssVar('--void'), cssVar('--innocent'), cssVar('--thief')];
  const empty = cssVar('--empty');
  const codes = grouped ? [...sim.codes].sort((a, b) => b - a) : sim.codes;
  const count = codes.length;
  const cols = count <= 100 ? 10 : count <= 400 ? 20 : 50;
  const cell = size / cols;
  const gap = cols === 50 ? 1 : cell * 0.14;
  const radius = cols === 50 ? 0 : cell * 0.12;

  for (let i = 0; i < cols * cols; i++) {
    const x = (i % cols) * cell + gap / 2;
    const y = Math.floor(i / cols) * cell + gap / 2;
    ctx.fillStyle = i < count ? colors[codes[i]] : empty;
    ctx.beginPath();
    if (radius && ctx.roundRect) ctx.roundRect(x, y, cell - gap, cell - gap, radius);
    else ctx.rect(x, y, cell - gap, cell - gap);
    ctx.fill();
  }

  $('waffle-note').textContent = sim.n > WAFFLE_MAX
    ? `Showing the first ${fmt.format(WAFFLE_MAX)} of ${plural(sim.n, 'employee')}; the counts include them all.`
    : '';
}

function niceStep(max, count) {
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function renderChart() {
  const svg = $('chart');
  const W = svg.clientWidth;
  if (!W) return;
  const H = Math.round(Math.max(200, Math.min(320, W * 0.6)));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('height', H);

  const m = { l: 34, r: 44, t: 12, b: 34 };
  const N = sim.path.length;
  const xmax = Math.max(10, N);
  const x = i => m.l + (i / xmax) * (W - m.l - m.r);
  const y = v => m.t + (1 - v) * (H - m.t - m.b);
  const ink = cssVar('--ink');
  const soft = cssVar('--ink-soft');
  const rule = cssVar('--stock-edge');
  const revealed = $('answer').open;

  let out = '';
  for (const [v, label] of [[0, '0'], [0.8, '0.8'], [1, '1']]) {
    const dash = v === 0.8 ? ' stroke-dasharray="4 4"' : '';
    out += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0.8 ? soft : rule}"${dash}/>`;
    out += `<text x="${m.l - 6}" y="${y(v)}" text-anchor="end" dominant-baseline="middle" font-size="12" fill="${soft}">${label}</text>`;
  }
  if (revealed) {
    const brass = cssVar('--brass-dark');
    out += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(4 / 13)}" y2="${y(4 / 13)}" stroke="${brass}" stroke-width="2"/>`;
    out += `<text x="${W - m.r + 6}" y="${y(4 / 13)}" dominant-baseline="middle" font-size="12" font-weight="600" fill="${brass}">4/13</text>`;
  }

  const step = niceStep(xmax, 4);
  for (let t = 0; t <= xmax; t += step) {
    out += `<text x="${x(t)}" y="${H - m.b + 18}" text-anchor="middle" font-size="12" fill="${soft}">${fmt.format(t)}</text>`;
  }
  out += `<text x="${(m.l + W - m.r) / 2}" y="${H - 2}" text-anchor="middle" font-size="12" fill="${soft}">Employees who failed the test</text>`;

  if (N) {
    // Thin the path to at most ~800 vertices; always keep the latest point.
    const stride = Math.max(1, Math.ceil(N / 800));
    let d = '';
    for (let i = 1; i <= N; i += stride) d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(sim.path[i - 1]).toFixed(1)}`;
    d += `L${x(N).toFixed(1)},${y(sim.path[N - 1]).toFixed(1)}`;
    out += `<path d="${d}" fill="none" stroke="${ink}" stroke-width="1.75" stroke-linejoin="round"/>`;
    out += `<circle cx="${x(N)}" cy="${y(sim.path[N - 1])}" r="3.5" fill="${ink}"/>`;
  }
  svg.innerHTML = out;
}

function renderSim() {
  if (panels.many.hidden) return;
  renderLatest();
  renderEstimate();
  renderWaffle();
  renderChart();
}

new ResizeObserver(() => renderSim()).observe(panels.many);

// The answer's grid of 100 employees: the top row are the thieves, and the
// highlighted cells are those who fail the test (8 thieves, 18 innocent).
(function buildGrid() {
  let html = '';
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const thief = row === 0;
      const fail = thief ? col >= 2 : col < 2;
      html += `<span class="${fail ? 'fail' : 'pass'}"><img src="${IMAGES[thief ? 'thief' : 'innocent']}" alt=""></span>`;
    }
  }
  $('grid100').innerHTML = html;
})();

showMode();

// Offline support once deployed; skipped locally so edits show up on reload.
if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js');
}
