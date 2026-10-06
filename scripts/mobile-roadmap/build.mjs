// Builds the CEO-facing roadmap page from docs/MOBILE_ROADMAP.md, so the two never diverge.
//   node scripts/mobile-roadmap/build.mjs [--date=YYYY-MM-DD]
// Recounts progress from the task statuses, rewrites the "Обновлено … · Готово …" line of the
// Markdown, and writes docs/mobile-roadmap.html. The HTML has no <html>/<head>/<body> of its own:
// it is published as an Artifact, which adds that skeleton; browsers open it as is.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MD = path.join(ROOT, "docs/MOBILE_ROADMAP.md");
const OUT = path.join(ROOT, "docs/mobile-roadmap.html");

const arg = process.argv.find((a) => a.startsWith("--date="));
const date = arg ? arg.slice(7) : new Date().toISOString().slice(0, 10);

const STATUS = {
  Planned: { label: "В плане", cls: "planned" },
  "In Progress": { label: "В работе", cls: "progress" },
  Testing: { label: "Проверяется", cls: "testing" },
  Done: { label: "Готово", cls: "done" },
  Blocked: { label: "Ждёт ответа", cls: "blocked" },
};

// ── Parse ────────────────────────────────────────────────────────────────────
const lines = fs.readFileSync(MD, "utf8").split("\n");
const waiting = [];
const stages = [];
let section = null;
let task = null;
let key = null;

for (const line of lines.slice(1)) {
  let m;
  if ((m = line.match(/^## Этап ([A-ZА-Я])\. (.+?)(?: — (.+))?$/))) {
    section = "stage";
    stages.push({ letter: m[1], name: m[2], promise: m[3] || "", see: "", tasks: [] });
    task = null;
  } else if (line.startsWith("## ")) {
    section = /Ждёт решения/.test(line) ? "waiting" : "other";
    task = null;
  } else if (section === "waiting" && (m = line.match(/^- (.+)/))) {
    waiting.push(m[1]);
  } else if (section === "stage" && (m = line.match(/^Что увидите: (.+)/))) {
    stages.at(-1).see = m[1];
  } else if (section === "stage" && (m = line.match(/^### (R-\d+) · (.+)/))) {
    task = { id: m[1], title: m[2], fields: {} };
    stages.at(-1).tasks.push(task);
    key = null;
  } else if (task && (m = line.match(/^- ([^:]+): ?(.*)$/))) {
    key = m[1];
    task.fields[key] = m[2];
  } else if (task && key && /^\s+- /.test(line)) {
    task.fields[key] += (task.fields[key] ? "\n" : "") + line.trim().replace(/^- /, "");
  }
}

const tasks = stages.flatMap((s) => s.tasks);
for (const t of tasks) {
  t.status = (t.fields["Статус"] || "Planned").trim();
  if (!STATUS[t.status]) throw new Error(`${t.id}: unknown status "${t.status}"`);
}
const done = tasks.filter((t) => t.status === "Done").length;
const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

// ── Keep the Markdown header in step ─────────────────────────────────────────
const header = `Обновлено: ${date} · Готово: ${done} из ${tasks.length} (${pct} %)`;
const mdText = fs.readFileSync(MD, "utf8");
const nextMd = mdText.replace(/^Обновлено: .*$/m, header);
if (nextMd !== mdText) fs.writeFileSync(MD, nextMd);

// ── Render ───────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
// Markdown values follow a colon ("Зачем: снимать…"); on the page they stand alone as sentences.
const sentence = (s) => inline(s.charAt(0).toUpperCase() + s.slice(1));
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const [y, mo, d] = date.split("-").map(Number);
const humanDate = `${d} ${MONTHS[mo - 1]} ${y}`;

const stageState = (s) => {
  const n = s.tasks.length;
  const k = s.tasks.filter((t) => t.status === "Done").length;
  if (k === n && n > 0) return "done";
  if (s.tasks.some((t) => t.status !== "Planned")) return "active";
  return "next";
};

const segs = stages
  .map((s) => {
    const n = s.tasks.length;
    const k = s.tasks.filter((t) => t.status === "Done").length;
    return `<span class="seg" style="flex:${n}" title="Этап ${esc(s.letter)}: ${k} из ${n}"><span class="seg-fill" style="width:${n ? (k / n) * 100 : 0}%"></span></span>`;
  })
  .join("");

const stageHtml = stages
  .map((s) => {
    const n = s.tasks.length;
    const k = s.tasks.filter((t) => t.status === "Done").length;
    const rows = s.tasks
      .map((t) => {
        const st = STATUS[t.status];
        const why = t.fields["Зачем"] ? `<p class="why">${sentence(t.fields["Зачем"])}</p>` : "";
        return `<li class="task"><div class="task-head"><span class="tid">${esc(t.id)}</span><span class="tname">${inline(t.title)}</span><span class="chip ${st.cls}">${st.label}</span></div>${why}</li>`;
      })
      .join("");
    return `<section class="stage ${stageState(s)}" id="stage-${esc(s.letter.toLowerCase())}">
  <div class="stage-head"><span class="letter">${esc(s.letter)}</span><div class="stage-title"><h2>${inline(s.name)}</h2>${s.promise ? `<p class="promise">${sentence(s.promise)}</p>` : ""}</div><span class="count">${k}/${n}</span></div>
  ${s.see ? `<p class="see"><span>Что увидите</span>${sentence(s.see)}</p>` : ""}
  <ol class="tasks">${rows}</ol>
</section>`;
  })
  .join("\n");

const waitingHtml = waiting.length
  ? `<section class="waiting" aria-labelledby="waiting-h"><h2 id="waiting-h">Ждёт вашего решения</h2><ul>${waiting.map((w) => `<li>${inline(w)}</li>`).join("")}</ul></section>`
  : `<section class="waiting quiet"><h2>Ждёт вашего решения</h2><p>Сейчас ничего — работа идёт по плану.</p></section>`;

const current = tasks.find((t) => t.status === "In Progress") || tasks.find((t) => t.status === "Planned");

const html = `<meta charset="utf-8">
<title>Роадмап мобильного GOO</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Poppins:wght@800&display=swap">
<style>
/* Layout: one reading column; progress first, then what waits for the CEO, then stages as a sequence. Dark-first, like the site. */
:root {
  --bg: #0A0A0A; --surface: #141414; --fg: #F0EEE8; --muted: #8E8E89; --line: #232321; --soft: rgba(240,238,232,.07);
  --ok: #5DB585; --warn: #D9A441; --test: #7FA7D9; --stop: #E07A62;
  --sans: "Inter Tight", system-ui, -apple-system, "Segoe UI", sans-serif; --mark: Poppins, "Inter Tight", sans-serif;
  color-scheme: dark;
}
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) {
  --bg: #F4F2EE; --surface: #FFFFFF; --fg: #0A0A0A; --muted: #6B6B6B; --line: #E4E1DA; --soft: rgba(10,10,10,.05);
  --ok: #2F7D50; --warn: #9A6A12; --test: #2F5E99; --stop: #B5462F; color-scheme: light } }
:root[data-theme="light"] {
  --bg: #F4F2EE; --surface: #FFFFFF; --fg: #0A0A0A; --muted: #6B6B6B; --line: #E4E1DA; --soft: rgba(10,10,10,.05);
  --ok: #2F7D50; --warn: #9A6A12; --test: #2F5E99; --stop: #B5462F; color-scheme: light }
* { box-sizing: border-box }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.55 var(--sans); -webkit-font-smoothing: antialiased }
.page { max-width: 760px; margin: 0 auto; padding-inline: 20px; padding-block: 28px 64px; display: flex; flex-direction: column; gap: 28px }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px }
.mark { font: 800 17px/1 var(--mark); letter-spacing: .16em }
.updated { font-size: 13px; color: var(--muted) }
h1 { margin: 0; font-size: clamp(28px, 6vw, 40px); line-height: 1.1; font-weight: 600; letter-spacing: -.02em; text-wrap: balance }
.lede { margin: 8px 0 0; color: var(--muted); max-width: 60ch }
.progress { background: var(--surface); border-radius: 20px; padding: 20px; display: grid; gap: 14px }
.progress-row { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap }
.pct { font-size: 48px; line-height: 1; font-weight: 700; letter-spacing: -.03em; font-variant-numeric: tabular-nums }
.of { color: var(--muted) }
.bar { display: flex; gap: 4px; height: 10px }
.seg { background: var(--soft); border-radius: 5px; overflow: hidden }
.seg-fill { display: block; height: 100%; background: var(--fg); border-radius: 5px }
.next { font-size: 14px; color: var(--muted) }
.next strong { color: var(--fg); font-weight: 500 }
.waiting { border-radius: 20px; padding: 18px 20px; box-shadow: inset 0 0 0 1.5px var(--fg) }
.waiting.quiet { box-shadow: inset 0 0 0 1px var(--line) }
.waiting h2 { margin: 0 0 8px; font-size: 16px; font-weight: 600 }
.waiting ul { margin: 0; padding-left: 18px; display: grid; gap: 6px }
.waiting p { margin: 0; color: var(--muted) }
.stages { display: grid; gap: 14px }
.stage { background: var(--surface); border-radius: 20px; padding: 18px 20px }
.stage-head { display: flex; align-items: flex-start; gap: 12px }
.letter { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-weight: 600; font-size: 14px; background: var(--soft) }
.stage.done .letter { background: var(--ok); color: var(--bg) }
.stage.active .letter { background: var(--fg); color: var(--bg) }
.stage-title { flex: 1; min-width: 0 }
.stage h2 { margin: 4px 0 0; font-size: 17px; line-height: 1.3; font-weight: 600; text-wrap: balance }
.promise { margin: 2px 0 0; color: var(--muted); font-size: 14px }
.count { flex: none; margin-top: 6px; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums }
.see { margin: 14px 0 0; padding: 12px 14px; border-radius: 14px; background: var(--soft); font-size: 14px }
.see span { display: block; font-size: 12px; color: var(--muted); margin-bottom: 2px }
.tasks { list-style: none; margin: 10px 0 0; padding: 0 }
.task { padding: 12px 0; border-top: 1px solid var(--line) }
.task:first-child { border-top: 0 }
.task-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap }
.tid { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; min-width: 34px }
.tname { flex: 1 1 220px; min-width: 0; font-weight: 500 }
.chip { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 12px; background: var(--soft); font-size: 12px; color: var(--muted) }
.chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor }
.chip.progress { color: var(--warn) } .chip.testing { color: var(--test) } .chip.done { color: var(--ok) } .chip.blocked { color: var(--stop) }
.why { margin: 4px 0 0 44px; color: var(--muted); font-size: 14px; max-width: 62ch }
code { font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--soft); padding: 1px 5px; border-radius: 5px }
footer { color: var(--muted); font-size: 13px; display: grid; gap: 4px }
footer a { color: var(--fg) }
a:focus-visible, button:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px }
@media (max-width: 480px) { .why { margin-left: 0 } .pct { font-size: 40px } }
</style>
<main class="page">
  <div class="top"><span class="mark">GOO</span><span class="updated">Обновлено ${esc(humanDate)}</span></div>
  <header>
    <h1>Мобильная версия GOO</h1>
    <p class="lede">Сайт на телефоне «причёсываем» по выбранному варианту Б: те же экраны и функции, меньше кнопок, рамок и капса, больше воздуха. Десктоп не меняется.</p>
  </header>
  <section class="progress" aria-label="Прогресс">
    <div class="progress-row"><span class="pct">${pct}%</span><span class="of">${done} из ${tasks.length} задач готово · ${stages.length} этапов</span></div>
    <div class="bar" role="img" aria-label="Прогресс по этапам">${segs}</div>
    ${current ? `<p class="next">Следующая задача: <strong>${esc(current.id)} · ${inline(current.title)}</strong></p>` : ""}
  </section>
  ${waitingHtml}
  <div class="stages">
${stageHtml}
  </div>
  <footer>
    <span>Макеты: <a href="https://claude.ai/artifact/TJiTGG5bV46G8R3CNeyTR8">холст с вариантом Б</a></span>
    <span>Страница собирается из рабочего роадмапа <code>docs/MOBILE_ROADMAP.md</code>.</span>
  </footer>
</main>
`;

fs.writeFileSync(OUT, html);
console.log(`${path.relative(ROOT, OUT)}: ${done}/${tasks.length} done (${pct}%), ${stages.length} stages, ${waiting.length} waiting`);
