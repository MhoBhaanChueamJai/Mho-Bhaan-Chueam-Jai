// node rec.cjs [chapterId ...]  → frames/<id>-fN.png + out.json (ตำแหน่งที่กดเป็น % ของจอ 402×874)
// อัดจากแอปเวอร์ชันเว็บจริง (Metro :8081) จอจำลอง iPhone 17 Pro (ขอบจอ 62/34) · เริ่มทุกขั้นจากสถานะทดลองใช้ชุดเดิม
const { chromium } = require('/Users/oommie/Projects/folk-promo/node_modules/playwright-core');
const fs = require('fs');
const D = __dirname;
const W = 402, H = 874;
const CH = require('./chapters.cjs');
const want = process.argv.slice(2);
fs.mkdirSync(D + '/frames', { recursive: true });
const out = fs.existsSync(D + '/out.json') ? JSON.parse(fs.readFileSync(D + '/out.json', 'utf8')) : {};
const pct = (v, t) => Math.round((v / t) * 10000) / 100;

async function find(p, t) {
  if (t.point) return { x: t.point[0], y: t.point[1], w: 44, h: 44, el: null };
  let loc;
  if (t.label) loc = p.getByLabel(t.label, { exact: !!t.exact });
  else if (t.text) loc = p.getByText(t.text, { exact: !!t.exact });
  else if (t.css) loc = p.locator(t.css);
  loc = loc.nth(t.nth ?? 0);
  if (t.last) loc = (t.label ? p.getByLabel(t.label, { exact: !!t.exact }) : p.getByText(t.text, { exact: !!t.exact })).last();
  await loc.waitFor({ state: 'visible', timeout: 15000 });
  if (t.reveal) await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, el: loc };
}

(async () => {
  const b = await chromium.launch({ channel: 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  for (const ch of CH) {
    if (want.length && !want.includes(ch.id)) continue;
    const steps = [];
    let fi = 0;
    for (const [si, st] of ch.steps.entries()) {
      const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: process.env.STATE || D + '/../web/state.json', permissions: ['microphone', 'camera'] });
      // บัญชีทดลองใช้ร่วมกัน: ห้ามเขียนข้อมูลขึ้นคลาวด์ระหว่างอัดคู่มือ (อ่านได้อย่างเดียว)
      await ctx.route(/supabase\.co/, (r) => (['GET', 'HEAD', 'OPTIONS'].includes(r.request().method()) ? r.continue() : r.abort('blockedbyclient')));
      const p = await ctx.newPage();
      p.on('pageerror', (e) => console.log('  pageerror', e.message.slice(0, 120)));
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 62, bottom: 34, left: 0, right: 0 } });
      await p.goto('http://localhost:8081/' + st.path, { waitUntil: 'load', timeout: 120000 });
      await p.waitForTimeout(st.settle ?? 4500);
      // ขั้นเตรียม (ไม่อัด)
      for (const a of st.pre || []) await act(p, a, null);
      await p.waitForTimeout(600);
      const shot = async () => {
        fi++;
        const f = `frames/${ch.id}-f${fi}.png`;
        await p.screenshot({ path: D + '/' + f });
        return f;
      };
      const start = await shot();
      const actions = [];
      for (const a of st.actions) {
        const r = await act(p, a, shot).catch((e) => (console.log('  FAIL', ch.id, si + 1, JSON.stringify(a).slice(0, 80), e.message.slice(0, 80)), null));
        if (r) actions.push(r);
      }
      steps.push({ n: si + 1, title: st.title, detail: st.detail, start, actions });
      console.log(ch.id, 'step', si + 1, 'actions', actions.length + '/' + st.actions.length);
      await ctx.close();
    }
    out[ch.id] = { id: ch.id, poster: steps[0]?.start, steps };
    fs.writeFileSync(D + '/out.json', JSON.stringify(out, null, 1));
  }
  await b.close();
})();

async function act(p, a, shot) {
  const wait = a.wait ?? 1400;
  if (a.kind === 'wait') return void (await p.waitForTimeout(a.ms));
  if (a.kind === 'scroll') {
    await p.mouse.move(W / 2, H * 0.6);
    await p.mouse.wheel(0, a.dy);
    await p.waitForTimeout(wait);
    if (!shot) return;
    return { kind: 'scroll', x: 50, y: 70, frame: await shot() };
  }
  const t = await find(p, a);
  const base = { x: pct(t.x, W), y: pct(t.y, H), w: pct(Math.min(t.w, 380), W), h: pct(Math.min(t.h, 300), H) };
  if (a.kind === 'point') {
    if (!shot) return;
    await p.waitForTimeout(300);
    return { kind: 'point', ...base, frame: await shot() };
  }
  if (a.kind === 'type') {
    await (t.el ? t.el.click() : p.mouse.click(t.x, t.y));
    await p.keyboard.type(a.type, { delay: 30 });
    if (a.enter) await p.keyboard.press('Enter');
    await p.waitForTimeout(wait);
    if (!shot) return;
    return { kind: 'type', ...base, text: a.type, frame: await shot() };
  }
  if (a.kind === 'drag') {
    await p.mouse.move(t.x, t.y);
    await p.mouse.down();
    for (let i = 1; i <= 12; i++) await p.mouse.move(t.x + (a.dx * i) / 12, t.y + ((a.dy || 0) * i) / 12), await p.waitForTimeout(25);
    await p.mouse.up();
    await p.waitForTimeout(wait);
    if (!shot) return;
    return { kind: 'drag', ...base, x2: pct(t.x + a.dx, W), y2: pct(t.y + (a.dy || 0), H), frame: await shot() };
  }
  // tap
  if (a.hold) {
    await p.mouse.move(t.x, t.y);
    await p.mouse.down();
    await p.waitForTimeout(700);
    await p.mouse.up();
  } else await p.mouse.click(t.x, t.y);
  await p.waitForTimeout(wait);
  if (!shot) return;
  return { kind: a.hold ? 'hold' : 'tap', ...base, frame: await shot() };
}
