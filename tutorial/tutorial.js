/* คู่มือการใช้งานหมอบ้านเชื่อมใจ — บทความทีละฟีเจอร์ ภาพหน้าจอจริงพร้อมนิ้วสาธิตการกด */
const INFO = {
  home: { group: "หน้าหลัก", title: "หน้าหลัก แจ้งเตือน และตั้งค่า", short: "ทางลัด · แจ้งเตือน · ตั้งค่า", color: "#14905c", icon: "house", desc: "รู้จักหน้าหลักของแอป ทางลัดที่ใช้บ่อย กระดิ่งแจ้งเตือน และทางเข้าหน้าตั้งค่า" },
  patients: { group: "ผู้ป่วย", title: "รายชื่อผู้ป่วยและการค้นหา", short: "ภาพรวม · กรอง · ค้นหา", color: "#3b82c4", icon: "users", desc: "ดูผู้ป่วยทั้งหมดตามสถานะ กรองเฉพาะคนที่ต้องติดตาม และค้นหาด้วยชื่อ อาการ หรือเบอร์โทร" },
  addpatient: { group: "ผู้ป่วย", title: "เพิ่มผู้ป่วยใหม่", short: "เพิ่มผู้ป่วย", color: "#3b82c4", icon: "user-plus", desc: "เพิ่มผู้ป่วยได้ 3 แบบ: ให้ครูปัญญาซักประวัติด้วยเสียง ถ่ายบัตรประชาชน หรือกรอกเอง พร้อมธาตุเจ้าเรือนอัตโนมัติ" },
  patient: { group: "ผู้ป่วย", title: "บัตรผู้ป่วยและประวัติการรักษา", short: "บัตร · สุขภาพ · ประวัติ", color: "#3b82c4", icon: "contact", desc: "บัตรผู้ป่วยตามธาตุเจ้าเรือน ข้อมูลสุขภาพพร้อมคำเตือนเรื่องยา และไทม์ไลน์การรักษาแบบ ม.บ.5" },
  record: { group: "ผู้ป่วย", title: "บันทึกการรักษา (ม.บ.5)", short: "บันทึกการรักษา", color: "#3b82c4", icon: "notebook-pen", desc: "บันทึกการรักษาแต่ละครั้งตามแบบ ม.บ.5 เล่าให้ครูปัญญาบันทึกด้วยเสียง หรือกรอกเองทีละช่อง" },
  herbs: { group: "สมุนไพร", title: "คลังสมุนไพร", short: "สมุนไพร 100 ชนิด · ค้นหาตามอาการ", color: "#3e8e2e", icon: "leaf", desc: "สมุนไพรไทย 100 ชนิด สรรพคุณ วิธีใช้ ข้อควรระวัง สมุนไพรแนะนำตามอากาศวันนี้ และค้นหาตามอาการ" },
  vault: { group: "คลังภูมิปัญญา", title: "คลังภูมิปัญญาและการอ่านตำรา", short: "คลังภูมิ · อ่านตำรา · เพิ่ม", color: "#8a5e30", icon: "library", desc: "เก็บตำรับยา วิธีรักษา คาถา และตำราโบราณ อ่านแบบพลิกหน้าหนังสือ และเพิ่มภูมิปัญญาใหม่" },
  share: { group: "คลังภูมิปัญญา", title: "แชร์และรับตำราจากเพื่อน", short: "แชร์ · รับตำรา", color: "#8a5e30", icon: "share-2", desc: "ส่งต่อตำราให้หมอพื้นบ้านคนอื่นด้วยคิวอาร์โค้ดหรือรหัส 8 ตัว และรับตำราที่เพื่อนส่งมา" },
  assistant: { group: "ครูปัญญา AI", title: "ถามครูปัญญา", short: "พิมพ์ถาม · คุยด้วยเสียง", color: "#7a4fd0", icon: "sparkles", desc: "ผู้ช่วย AI ที่รู้เรื่องสมุนไพร การตั้งตำรับ และความปลอดภัยของยา ถามได้ทั้งพิมพ์และพูด" },
  notifications: { group: "หน้าหลัก", title: "แจ้งเตือน", short: "กรอง · อ่าน · ล้าง", color: "#14905c", icon: "bell", desc: "ดูผู้ป่วยที่ต้องติดตามอาการ ผู้ป่วยส่งต่อ ตำรารอตรวจทาน และอัปเดตจากระบบ" },
  settings: { group: "ตั้งค่า", title: "ตั้งค่าและบัญชี", short: "ครูปัญญา · PIN · บัญชี", color: "#66756b", icon: "settings", desc: "ตั้งภาษาพูดของครูปัญญา ตั้งรหัส PIN และจัดการบัญชีผู้ใช้" },
};
const ORDER = ["home", "notifications", "patients", "addpatient", "patient", "record", "herbs", "vault", "share", "assistant", "settings"];
const GROUPS = [...new Set(ORDER.map((id) => INFO[id].group))];

const $ = (s, el = document) => el.querySelector(s);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const store = {
  get() {
    try {
      return JSON.parse(localStorage.getItem("tw.academy") || "{}");
    } catch {
      return {};
    }
  },
  done(id) {
    const s = this.get();
    s[id] = 1;
    try {
      localStorage.setItem("tw.academy", JSON.stringify(s));
    } catch {}
  },
};

let DATA = {};
let current = null;

fetch("chapters.json")
  .then((r) => r.json())
  .then((d) => {
    DATA = d;
    renderHeroCards();
    renderToc();
    renderMobileHome();
    const want = location.hash.slice(1);
    if (MOBILE.matches && !ORDER.includes(want)) showHome();
    else open(ORDER.includes(want) ? want : ORDER[0], false);
  });

function renderStats() {
  const steps = ORDER.reduce((a, id) => a + (DATA[id]?.steps.length || 0), 0);
  $("#stats").innerHTML = `
    <div><b>${GROUPS.length}</b><small>เมนู</small></div>
    <div><b>${ORDER.length}</b><small>ฟีเจอร์</small></div>
    <div><b>${steps}</b><small>ขั้นตอน</small></div>`;
}

function renderHeroCards() {
  $("#heroCards").innerHTML = ["herbs", "home", "patient"]
    .map((id, i) => `<img src="${DATA[id]?.poster}" style="--i:${i}" alt="" />`)
    .join("");
}

const GROUP_ICON = { "หน้าหลัก": "house", "ผู้ป่วย": "users", "สมุนไพร": "leaf", "คลังภูมิปัญญา": "library", "ครูปัญญา AI": "sparkles", "ตั้งค่า": "sliders-horizontal" };
function renderToc() {
  $("#toc").innerHTML =
    `<p class="nav__title">สารบัญ</p>` +
    GROUPS.map((g) => {
      const ids = ORDER.filter((id) => INFO[id].group === g);
      const col = INFO[ids[0]].color;
      return `<section class="nav__group" data-g="${g}" style="--c:${col}">
        <p class="nav__gh">${g}</p>
        <div class="nav__items">
          ${ids
            .map((id) => {
              const c = INFO[id];
              const words = [c.title, c.short, c.desc, ...(DATA[id]?.steps || []).map((s) => s.title + " " + s.detail)].join(" ").toLowerCase().replace(/"/g, "");
              return `<div class="nav__it" data-id="${id}" data-words="${words}">
                <button class="nav__link">${c.title}</button>
                <ol class="nav__sub">${(DATA[id]?.steps || []).map((s) => `<li><a href="#s-${s.n}" data-n="${s.n}">${s.title}</a></li>`).join("")}</ol>
              </div>`;
            })
            .join("")}
        </div>
      </section>`;
    }).join("");
  const T = $("#toc");
  T.querySelectorAll(".nav__link").forEach((b) => b.addEventListener("click", () => open(b.parentElement.dataset.id)));
  T.querySelectorAll(".nav__sub a").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      $("#s-" + a.dataset.n)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }),
  );
}

/* highlight the section being read in the sidebar */
let spy = null;
function scrollSpy() {
  spy?.disconnect();
  const links = [...document.querySelectorAll(`.nav__it[data-id="${current}"] .nav__sub a`)];
  spy = new IntersectionObserver(
    (es) =>
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        const n = e.target.id.slice(2);
        links.forEach((a) => a.classList.toggle("is-on", a.dataset.n === n));
      }),
    { rootMargin: "-30% 0px -60% 0px" },
  );
  document.querySelectorAll(".doc__sec").forEach((s) => spy.observe(s));
}

/* ── มือถือ: หน้ารวมการ์ด ↔ หน้าบทความ (ปุ่มกลับ/ปัดกลับของเบราว์เซอร์ใช้ได้) ── */
const MOBILE = matchMedia("(max-width: 760px)");
function renderMobileHome() {
  $("#mhome").innerHTML = GROUPS.map((g) => {
    const ids = ORDER.filter((id) => INFO[id].group === g);
    return `<section class="mgroup">
      <h2>${icon(GROUP_ICON[g] || "book-open", 16)}${g}</h2>
      <div class="mgrid">${ids
        .map((id) => {
          const c = INFO[id], d = DATA[id];
          return `<button class="mcard" data-open="${id}" style="--c:${c.color}">
            <span class="mcard__shot"><img src="${d?.poster}" alt="" loading="lazy" /></span>
            <span class="mcard__ic">${icon(c.icon, 16)}</span>
            <b>${c.title}</b>
            <small>${d?.steps.length || 0} ขั้นตอน · ${c.short}</small>
          </button>`;
        })
        .join("")}</div>
    </section>`;
  }).join("");
  $("#mhome").querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => open(b.dataset.open)));
}
function showHome() {
  current = null;
  document.body.classList.add("m-home");
  document.body.classList.remove("m-article");
  $("#mhome").hidden = false;
  $("#mbar").hidden = true;
  if (location.hash) history.replaceState(null, "", location.pathname);
  scrollTo(0, 0);
}
addEventListener("popstate", () => {
  if (!MOBILE.matches) return;
  const id = location.hash.slice(1);
  ORDER.includes(id) ? open(id, false, true) : showHome();
});

function open(id, scroll = true, fromPop = false) {
  const wasHome = document.body.classList.contains("m-home");
  current = id;
  if (MOBILE.matches) {
    // จากหน้ารวม → เพิ่มประวัติ (ปุ่มกลับของเบราว์เซอร์กลับหน้ารวมได้) · ระหว่างบท → แทนที่
    if (!fromPop) wasHome ? history.pushState({ a: 1 }, "", "#" + id) : history.replaceState({ a: 1 }, "", "#" + id);
    document.body.classList.remove("m-home");
    document.body.classList.add("m-article");
    $("#mhome").hidden = true;
    $("#mbar").hidden = false;
    $("#mtitle").textContent = INFO[id].title;
  } else history.replaceState(null, "", "#" + id);
  document.querySelectorAll(".nav__it").forEach((b) => b.classList.toggle("is-on", b.dataset.id === id));
  document.querySelector(`.nav__it[data-id="${id}"]`)?.closest(".nav__group")?.classList.remove("is-closed");
  const c = INFO[id];
  const d = DATA[id];
  const i = ORDER.indexOf(id);
  const prev = ORDER[i - 1];
  const next = ORDER[i + 1];
  const L = $("#lesson");
  L.style.setProperty("--c", c.color);
  const related = ORDER.filter((x) => x !== id && INFO[x].group === c.group).concat(ORDER.filter((x) => x !== id && INFO[x].group !== c.group)).slice(0, 3);
  L.innerHTML = `
    <article class="doc">
      <nav class="doc__crumb reveal"><span>คู่มือการใช้งาน</span> › <span>${c.group}</span></nav>
      <header class="doc__head reveal">
        <span class="doc__icon">${icon(c.icon, 26)}</span>
        <h1>${c.title}</h1>
        <p class="doc__lead">${c.desc}</p>
        <p class="doc__meta">${d.steps.length} ขั้นตอน · อ่านประมาณ ${Math.max(1, Math.round(d.steps.length * 0.5))} นาที</p>
      </header>

      <aside class="doc__toc reveal">
        <b>ในบทความนี้</b>
        <ol>${d.steps.map((x) => `<li><a href="#s-${x.n}" data-jump="${x.n}">${x.title}</a></li>`).join("")}</ol>
      </aside>

      ${d.steps
        .map(
          (x, k) => `<section class="doc__sec reveal" id="s-${x.n}">
          <h2><span>${x.n}</span>${x.title}</h2>
          <p>${x.detail || ""}</p>
          <figure class="doc__fig">
            <div class="device phone">
              <img class="phone__bezel" src="media/iphone.webp" alt="" />
              <div class="anim" data-k="${k}">
                <div class="anim__cam">
                  <img class="anim__a" src="${x.start}" alt="${x.title}" />
                  <img class="anim__b" alt="" />
                </div>
                <span class="anim__ring"></span>
                <span class="anim__trail"></span>
                <span class="anim__finger"><i></i></span>
                <span class="anim__bubble"></span>
              </div>
              <span class="device__loop"><i></i></span>
            </div>
            <figcaption>ภาพที่ ${x.n} · ${x.title}</figcaption>
          </figure>
        </section>`,
        )
        .join("")}

      <footer class="doc__foot reveal">
        <b>หัวข้อที่เกี่ยวข้อง</b>
        <div class="doc__rel">
          ${related.map((r) => `<button data-go="${r}" style="--c:${INFO[r].color}"><span>${icon(INFO[r].icon, 17)}</span><div><small>${INFO[r].group}</small><b>${INFO[r].title}</b></div></button>`).join("")}
        </div>
        <nav class="pager">
          ${prev ? `<button class="pager__btn" data-go="${prev}"><small>${icon("arrow-left", 13)} ก่อนหน้า</small><b>${INFO[prev].title}</b></button>` : "<span></span>"}
          ${next ? `<button class="pager__btn is-next" data-go="${next}"><small>ถัดไป ${icon("arrow-right", 13)}</small><b>${INFO[next].title}</b></button>` : `<button class="pager__btn is-next" data-home="1"><small>ดูครบทุกหัวข้อแล้ว</small><b>กลับหน้ารวมคู่มือ</b></button>`}
        </nav>
      </footer>
    </article>`;
  wireFlow();
  scrollSpy();
  L.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => open(b.dataset.go)));
  L.querySelectorAll("[data-home]").forEach((b) => b.addEventListener("click", () => (MOBILE.matches ? (history.state?.a ? history.back() : showHome()) : open(ORDER[0]))));
  L.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", (e) => (e.preventDefault(), $("#s-" + b.dataset.jump).scrollIntoView({ behavior: "smooth", block: "start" }))));
  reveal();
  if (MOBILE.matches) scrollTo(0, 0);
  else if (scroll) $(".layout").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ── tap-demo animation engine: still frames + animated finger, looping like a GIF ── */
const sleep = (ms, run) =>
  new Promise((res, rej) => {
    const t = setTimeout(() => (run.alive ? res() : rej(0)), ms);
    run.timers.push(t);
  });
const preload = (src) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = src; });

function makeRunner(el, step) {
  const cam = el.querySelector(".anim__cam");
  let A = el.querySelector(".anim__a");
  let B = el.querySelector(".anim__b");
  const finger = el.querySelector(".anim__finger");
  const ring = el.querySelector(".anim__ring");
  const trail = el.querySelector(".anim__trail");
  const bubble = el.querySelector(".anim__bubble");
  const bar = el.parentElement.querySelector(".device__loop i");
  let run = null;
  const pos = (n, x, y) => { n.style.left = x + "%"; n.style.top = y + "%"; };
  const show = (src, run, ms = 450) => new Promise(async (res) => {
    await preload(src);
    B.src = src;
    B.style.transition = `opacity ${ms}ms ease`;
    B.style.opacity = 1;
    await sleep(ms, run).catch(() => {});
    A.src = src;
    B.style.transition = "none";
    B.style.opacity = 0;
    res();
  });
  const zoom = (a, on) => {
    cam.style.transformOrigin = `${a.x}% ${a.y}%`;
    cam.style.transform = on ? "scale(1.08)" : "scale(1)";
  };
  const ringAt = (a, on) => {
    const w = Math.max(a.w || 6, 5), h = Math.max(a.h || 6, 6);
    ring.style.left = a.x - w / 2 - 0.8 + "%";
    ring.style.top = a.y - h / 2 - 1.2 + "%";
    ring.style.width = w + 1.6 + "%";
    ring.style.height = h + 2.4 + "%";
    ring.classList.toggle("is-on", on);
  };
  async function loop(r) {
    const acts = step.actions;
    const total = 1200 + acts.length * 2600 + 1800;
    for (;;) {
      bar.style.transition = "none"; bar.style.transform = "scaleX(0)"; void bar.offsetWidth;
      bar.style.transition = `transform ${total}ms linear`; bar.style.transform = "scaleX(1)";
      A.src = step.start; B.style.opacity = 0; zoom({ x: 50, y: 50 }, false); ringAt({ x: -50, y: -50 }, false);
      finger.className = "anim__finger"; pos(finger, 50, 112);
      await sleep(900, r);
      for (const a of acts) {
        finger.classList.add("is-on");
        pos(finger, a.x, a.y);
        await sleep(750, r);
        if (a.kind === "point") {
          ringAt(a, true); zoom(a, true);
          await sleep(1300, r);
        } else if (a.kind === "drag") {
          finger.classList.add("is-down");
          trail.style.left = a.x + "%"; trail.style.top = a.y + "%"; trail.style.width = "0%"; trail.classList.add("is-on");
          await sleep(150, r);
          finger.style.transition = "left .9s cubic-bezier(.45,0,.2,1), top .9s cubic-bezier(.45,0,.2,1)";
          trail.style.width = Math.abs(a.x2 - a.x) + "%";
          pos(finger, a.x2, a.y2);
          await sleep(950, r);
          finger.style.transition = ""; finger.classList.remove("is-down"); trail.classList.remove("is-on");
        } else if (a.kind === "scroll") {
          finger.classList.add("is-down");
          finger.style.transition = "top .8s cubic-bezier(.45,0,.2,1)";
          pos(finger, a.x, a.y - 18);
          await sleep(850, r);
          finger.style.transition = ""; finger.classList.remove("is-down");
        } else {
          ringAt(a, true); zoom(a, true);
          finger.classList.add("is-down");
          ripple(el, a);
          if (a.kind === "hold") { finger.classList.add("is-hold"); await sleep(900, r); finger.classList.remove("is-hold"); }
          else await sleep(180, r);
          finger.classList.remove("is-down");
          if (a.kind === "type") {
            bubble.style.left = a.x + "%"; bubble.style.top = a.y + "%"; bubble.textContent = ""; bubble.classList.add("is-on");
            for (const ch of a.text) { bubble.textContent += ch; await sleep(70, r); }
            await sleep(400, r);
            bubble.classList.remove("is-on");
          } else await sleep(350, r);
        }
        await show(a.frame, r);
        zoom(a, false); ringAt(a, false);
        await sleep(700, r);
      }
      finger.classList.remove("is-on");
      await sleep(1800, r);
    }
  }
  return {
    start() {
      if (run) return;
      run = { alive: true, timers: [] };
      el.closest(".doc__sec")?.classList.add("is-live");
      // warm the frames, then play
      Promise.all([step.start, ...step.actions.map((a) => a.frame)].map(preload)).then(() => run && loop(run).catch(() => {}));
    },
    stop() {
      if (!run) return;
      run.alive = false; run.timers.forEach(clearTimeout); run = null;
      el.closest(".doc__sec")?.classList.remove("is-live");
    },
  };
}
function ripple(el, a) {
  const r = document.createElement("span");
  r.className = "anim__ripple";
  r.style.left = a.x + "%"; r.style.top = a.y + "%";
  el.appendChild(r);
  setTimeout(() => r.remove(), 800);
}

const runners = new Map();
const vio = new IntersectionObserver(
  (es) => es.forEach((e) => { const r = runners.get(e.target); if (r) e.isIntersecting ? r.start() : r.stop(); }),
  { threshold: 0.35 },
);
function wireFlow() {
  runners.forEach((r, el) => (r.stop(), vio.unobserve(el)));
  runners.clear();
  const d = DATA[current];
  document.querySelectorAll(".doc .anim").forEach((el) => {
    const r = makeRunner(el, d.steps[+el.dataset.k]);
    runners.set(el, r);
    vio.observe(el);
  });

}

function lightbox(src, cap) {
  const lb = $("#lightbox");
  $("img", lb).src = src;
  $("p", lb).textContent = cap;
  lb.hidden = false;
  requestAnimationFrame(() => lb.classList.add("is-open"));
}
$("#lightbox").addEventListener("click", () => {
  const lb = $("#lightbox");
  lb.classList.remove("is-open");
  setTimeout(() => (lb.hidden = true), 250);
});
addEventListener("keydown", (e) => e.key === "Escape" && !$("#lightbox").hidden && $("#lightbox").click());


const io = new IntersectionObserver(
  (es) =>
    es.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }),
  { threshold: 0.12 },
);
function reveal() {
  document.querySelectorAll(".reveal:not(.is-in)").forEach((el, i) => {
    el.style.setProperty("--d", `${Math.min(i, 8) * 60}ms`);
    io.observe(el);
  });
}

/* ── hero search: topics + steps ── */
(function heroSearch() {
  const q = $("#hq");
  const box = $("#hres");
  const clear = $("#hqx");
  let hits = [];
  let sel = 0;
  const norm = (t) => t.toLowerCase();
  const render = () => {
    const v = norm(q.value.trim());
    clear.hidden = !v;
    if (!v) return (box.hidden = true);
    hits = [];
    for (const id of ORDER) {
      const c = INFO[id];
      if (norm(c.title + " " + c.desc + " " + c.group).includes(v)) hits.push({ id, title: c.title, sub: c.group, ic: c.icon, color: c.color });
      for (const s of DATA[id]?.steps || [])
        if (norm(s.title + " " + (s.detail || "")).includes(v)) hits.push({ id, n: s.n, title: s.title, sub: `${c.title} · ขั้นตอนที่ ${s.n}`, ic: c.icon, color: c.color });
    }
    hits = hits.slice(0, 8);
    sel = 0;
    box.hidden = false;
    box.innerHTML = hits.length
      ? hits.map((h, i) => `<button class="hres__it${i === 0 ? " is-sel" : ""}" data-i="${i}" style="--c:${h.color}"><span>${icon(h.ic, 16)}</span><div><b>${h.title}</b><small>${h.sub}</small></div>${icon("corner-down-left", 14)}</button>`).join("")
      : `<p class="hres__none">ไม่พบ “${q.value.trim()}” · ลองคำอื่น เช่น ผู้ป่วย, สมุนไพร, PIN</p>`;
    box.querySelectorAll(".hres__it").forEach((b) => b.addEventListener("click", () => go(hits[+b.dataset.i])));
  };
  const go = (h) => {
    if (!h) return;
    box.hidden = true;
    open(h.id);
    if (h.n) setTimeout(() => $("#s-" + h.n)?.scrollIntoView({ behavior: "smooth", block: "start" }), 450);
  };
  q.addEventListener("input", render);
  q.addEventListener("focus", render);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") go(hits[sel]);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % Math.max(1, hits.length);
      box.querySelectorAll(".hres__it").forEach((b, i) => b.classList.toggle("is-sel", i === sel));
    }
    if (e.key === "Escape") box.hidden = true;
  });
  clear.addEventListener("click", () => ((q.value = ""), render(), q.focus()));
  document.addEventListener("pointerdown", (e) => !e.target.closest(".hsearch") && (box.hidden = true));
  $("#hqi").innerHTML = icon("search", 20);
  clear.innerHTML = icon("x", 14);
})();
document.querySelector(".brand__mark").innerHTML = icon("book-open", 18);
$("#mbacki").innerHTML = icon("arrow-left", 18);
$("#mback").addEventListener("click", () => (history.state?.a ? history.back() : showHome()));

