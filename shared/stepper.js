// Step player shared by every figure. A figure hands over its steps and a pure pose(i, p):
// i is the step on screen (-1 before the first), p its progress from 0 to 1.
function mountStepper(cfg) {
  const FIRST = cfg.firstAt ?? 0.9;
  const GAP = cfg.gap ?? 0.7;
  const HOLD = cfg.hold ?? 1.6;
  const steps = cfg.steps;
  const n = steps.length;
  const body = document.body;
  const params = new URLSearchParams(location.search);
  const rendering = params.has("render");
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  const list = document.querySelector(".bk-steps");
  const hintEl = document.querySelector(".bk-hint");
  const badgeEl = document.querySelector(".bk-badge");
  const chipsEl = document.querySelector(".bk-chips");
  const statusEl = document.querySelector("[data-status]");
  const modeButtons = [...document.querySelectorAll(".bk-mode [data-mode]")];
  const resetEl = document.querySelector(".bk-reset");
  const cursorEl = document.querySelector(".bk-cursor");
  const stage = document.querySelector(".bk-card");

  const starts = [];
  let t0 = FIRST;
  for (const step of steps) { starts.push(t0); t0 += step.dur + GAP; }
  const total = starts[n - 1] + steps[n - 1].dur;
  const loop = total + HOLD;

  const buttons = steps.map((step, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<button class="bk-step" type="button" data-i="${i}"><span class="bk-num">${i + 1}</span><span>${step.label}</span></button>`;
    list.appendChild(li);
    return li.firstChild;
  });

  const svg = cfg.svg;
  const NS = "http://www.w3.org/2000/svg";
  const soundLayer = document.createElementNS(NS, "g");
  soundLayer.setAttribute("aria-hidden", "true");
  svg.appendChild(soundLayer);
  const sounds = [];
  steps.forEach((step, i) => {
    for (const s of [].concat(step.sound || [])) {
      const el = document.createElementNS(NS, "text");
      el.setAttribute("class", "bk-sound");
      el.setAttribute("x", s.at[0]);
      el.setAttribute("y", s.at[1]);
      el.setAttribute("font-size", s.size || 17);
      el.setAttribute("text-anchor", "middle");
      el.setAttribute("transform", `rotate(${s.tilt ?? -7} ${s.at[0]} ${s.at[1]})`);
      el.textContent = s.word;
      el.style.opacity = "0";
      soundLayer.appendChild(el);
      sounds.push({ el, i, from: s.from ?? 0.05, to: s.to ?? 0.6 });
    }
  });

  const load = () => { try { return localStorage.getItem(cfg.key + ":mode"); } catch { return null; } };
  const save = (value) => { try { localStorage.setItem(cfg.key + ":mode", value); } catch { /* storage blocked: the mode just isn't remembered */ } };

  let mode = rendering ? "auto" : load() === "auto" && !still.matches ? "auto" : "manual";
  let cur = -1, prog = 1, playing = false, clock = 0;
  let frame = 0, last = 0, visible = true;

  function at(t) {
    if (t < FIRST) return [-1, 1];
    for (let k = n - 1; k >= 0; k--) {
      if (t >= starts[k]) return t < starts[k] + steps[k].dur ? [k, (t - starts[k]) / steps[k].dur] : [k, 1];
    }
    return [-1, 1];
  }
  const timeOf = (i, p) => (i < 0 ? 0 : starts[i] + steps[i].dur * p);

  function speedOf(step) {
    if (!step.real) return "";
    const ratio = step.dur / step.real;
    const nice = (v) => (v >= 10 ? Math.round(v / 5) * 5 : Math.round(v));
    if (ratio > 1.3) return "×1/" + nice(ratio);
    if (ratio < 0.77) return "×" + nice(1 / ratio);
    return "";
  }

  function nextIndex() {
    if (mode !== "manual" || playing) return -1;
    return cur + 1 < n ? cur + 1 : -1;
  }

  let lastChips = "";
  function render() {
    const i = cur, p = prog;
    cfg.pose(i, p);
    const next = nextIndex();
    buttons.forEach((b, k) => {
      const state = k < i || (k === i && p >= 1) ? "done" : k === i ? "running" : k === next ? "next" : "idle";
      if (b.dataset.state !== state) b.dataset.state = state;
      const enabled = mode === "manual" && k === next;
      if (b.disabled === enabled) b.disabled = !enabled;
    });
    const hint = i < 0 ? cfg.intro : i === n - 1 && p >= 1 && cfg.outro ? cfg.outro : steps[i].hint;
    if (hintEl.textContent !== hint) {
      hintEl.textContent = hint;
      if (statusEl) statusEl.textContent = hint;
    }
    const badge = i >= 0 ? speedOf(steps[i]) : "";
    if (badge) badgeEl.textContent = badge;
    badgeEl.toggleAttribute("data-on", !!badge);
    for (const s of sounds) {
      let a = 0;
      if (s.i === i && p > s.from && p < s.to) a = Math.min(1, (p - s.from) / 0.06, (s.to - p) / 0.08);
      const text = a.toFixed(2);
      if (s.el.style.opacity !== text) s.el.style.opacity = text;
    }
    const chips = cfg.chips ? cfg.chips(i, p) : [];
    const html = chips.map((c) => `<span class="bk-chip"${c.hot ? " data-hot" : ""}><span>${c.k}</span><b>${c.v}</b></span>`).join("");
    if (html !== lastChips) { chipsEl.innerHTML = html; lastChips = html; }
  }

  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    if (mode === "auto") {
      clock += dt;
      if (clock >= loop) clock = 0;
      [cur, prog] = at(clock);
    } else if (playing) {
      prog = Math.min(1, prog + dt / (still.matches ? 0.001 : steps[cur].dur));
      if (prog >= 1) playing = false;
    }
    render();
    const busy = mode === "auto" || playing;
    frame = busy && visible && !document.hidden ? requestAnimationFrame(tick) : 0;
  }
  function run() {
    if (rendering || frame || !visible) return;
    last = 0;
    frame = requestAnimationFrame(tick);
  }

  function play(k) {
    if (k !== nextIndex()) return;
    cur = k; prog = 0; playing = true;
    run();
  }
  function setMode(next) {
    if (next === mode) return;
    if (next === "auto") { clock = timeOf(cur, prog); playing = false; }
    else if (cur >= 0 && prog < 1) playing = true;
    mode = next;
    save(mode);
    modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    render();
    run();
  }
  function reset() {
    cur = -1; prog = 1; playing = false; clock = 0;
    render();
    run();
  }

  buttons.forEach((b, k) => b.addEventListener("click", () => play(k)));
  modeButtons.forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    b.addEventListener("click", () => setMode(b.dataset.mode));
  });
  resetEl.addEventListener("click", (event) => { event.preventDefault(); reset(); });
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("input, textarea, select, button, a")) return;
    if (event.key === " " || event.key === "Enter") {
      const k = nextIndex();
      if (k >= 0) { event.preventDefault(); play(k); }
    }
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) run();
    }, { rootMargin: "80px 0px" }).observe(stage);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) run(); });

  function centreOf(el) {
    const r = el.getBoundingClientRect();
    return [r.left + Math.min(r.width * 0.32, 70), r.top + r.height / 2];
  }
  function cursorAt(t) {
    const rest = [window.innerWidth * 0.62, window.innerHeight * 0.92];
    let from = rest, to = rest, u = 1, press = -1;
    for (let k = 0; k < n; k++) {
      const leave = starts[k] - (k === 0 ? FIRST * 0.9 : GAP);
      const arrive = starts[k] - 0.16;
      if (t < leave) break;
      from = k === 0 ? rest : centreOf(buttons[k - 1]);
      to = centreOf(buttons[k]);
      u = Math.min(1, Math.max(0, (t - leave) / (arrive - leave)));
      if (t > arrive - 0.02 && t < starts[k] + 0.12) press = k;
    }
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const x = from[0] + (to[0] - from[0]) * e;
    const y = from[1] + (to[1] - from[1]) * e;
    cursorEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${press >= 0 ? 0.84 : 1})`;
    buttons.forEach((b, k) => b.toggleAttribute("data-pressed", k === press));
  }

  window.tourLength = loop;
  window.seek = (t) => {
    mode = "auto";
    [cur, prog] = at(Math.min(t, total));
    playing = false;
    render();
    if (rendering) cursorAt(t);
  };

  if (rendering) {
    body.setAttribute("data-render", "");
    window.seek(0);
  } else {
    render();
    run();
  }
  return { reset, setMode, render };
}
