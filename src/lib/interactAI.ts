/**
 * ครูปัญญาวิเคราะห์ยาตีกัน (หน้า "ตรวจยาตีกัน")
 * ข้อมูลที่ตรวจในเครื่องแล้ว (ข้อห้ามตามกลุ่มเสี่ยง แพ้ยา อันตรกิริยาตามบัญชียาหลักฯ 2566) ส่งให้ AI เป็นข้อเท็จจริงที่ห้ามขัด
 * AI ช่วยสรุปความเสี่ยงรวม แนะนำวิธีใช้ให้ปลอดภัย และเสนอสมุนไพรทางเลือก — อ้างได้เฉพาะหัวข้อในคลังที่ส่งให้ (ข้อที่อ้างไม่ได้ถูกตัด)
 */
import { chatJSON } from '../api/ai';
import type { Herb } from '../data/herbs';
import { herbsFor, pharmacyFor } from './brain';
import { clip, dedupe, dedupeText, herbBrief, strip, type PlanItem } from './plan';
import { roleBrief, userNoun } from './roles';
import type { DrugHit } from './safety';
import { citeLabel, docById, herbDocId, ixDocId, type KDoc } from './sources';
import { sexAgeLabel } from './birth';

export type RiskLevel = 'avoid' | 'caution' | 'ok';
export type HerbAdvice = { herb: string; level: RiskLevel; text: string; refs: PlanItem['refs'] };
export type InteractionAdvice = {
  level: RiskLevel;
  summary: string;
  herbs: HerbAdvice[];
  alternatives: PlanItem[];
  ask: string[];
  seeDoctor: string;
};

export type InteractionCase = {
  herbs: Herb[];
  patient?: { name: string; age?: number; sex?: string; chronic?: string; allergies?: string; meds?: string[] } | null;
  conditions: string[];
  medsText: string;
  /** ผลตรวจในเครื่อง */
  conflicts: { herb: Herb; group: string; caution: string }[];
  allergic: Herb[];
  drugHits: Map<string, DrugHit[]>;
};

const LEVEL: Record<string, RiskLevel> = { avoid: 'avoid', caution: 'caution', ok: 'ok' };
const order = (l: RiskLevel) => (l === 'avoid' ? 2 : l === 'caution' ? 1 : 0);

export async function interactionAdvice(c: InteractionCase): Promise<InteractionAdvice> {
  const names = c.herbs.map((h) => h.name).join(' ');
  const cond = [...c.conditions, c.patient?.chronic ?? ''].filter(Boolean).join(' ');
  // คลัง: สมุนไพรที่เลือก + อันตรกิริยาของแต่ละตัว + ความรู้ความปลอดภัย + สมุนไพรทางเลือกที่สรรพคุณใกล้กัน
  const S: { key: string; doc: KDoc; body: string }[] = [];
  const add = (doc: KDoc | undefined, body: string) => doc && !S.some((x) => x.doc.id === doc.id) && S.push({ key: `S${S.length + 1}`, doc, body });
  c.herbs.forEach((h) => add(docById(herbDocId(h)), herbBrief(h)));
  c.herbs.forEach((h) => (c.drugHits.get(h.id) ?? []).forEach(({ it }) => add(docById(ixDocId(it)), `อันตรกิริยา ${h.name} กับ${it.label}: ${it.statement}`)));
  pharmacyFor(`${names} ${cond} ยาตีกัน ข้อควรระวัง ยาแผนปัจจุบัน`, 3).forEach((d) => add(docById(d.id), `${d.title}\n${clip(d.text, 700)}`));
  const alts = herbsFor(c.herbs.flatMap((h) => h.uses.slice(0, 2)).join(' '), 6).filter((h) => !c.herbs.includes(h)).slice(0, 4);
  alts.forEach((h) => add(docById(herbDocId(h)), `(ทางเลือก) ${herbBrief(h)}`));

  const facts = [
    ...c.allergic.map((h) => `ผู้ป่วยแพ้ ${h.name} → ห้ามใช้`),
    ...c.conflicts.map((x) => `${x.herb.name} ขัดกับ${x.group}: ${x.caution}`),
    ...c.herbs.flatMap((h) => (c.drugHits.get(h.id) ?? []).filter((x) => x.hit).map((x) => `${h.name} ตรงกับยาที่ใช้อยู่ (${x.it.label}): ${x.it.statement}`)),
  ];
  const p = c.patient;
  const r = await chatJSON<{
    level?: string;
    summary?: string;
    herbs?: { herb?: string; level?: string; text?: string; src?: string[] }[];
    alternatives?: { text?: string; src?: string[] }[];
    ask?: string[];
    seeDoctor?: string;
  }>(
    [
      {
        role: 'user',
        content: `${roleBrief()}
สมุนไพรที่จะใช้: ${names}
${p ? `ผู้ป่วย: ${p.name} ${sexAgeLabel(p)} · โรคประจำตัว ${p.chronic || '-'} · แพ้ ${p.allergies || '-'} · ยาที่ใช้อยู่ ${p.meds?.join(', ') || '-'}` : 'ไม่ได้เลือกผู้ป่วย'}
ภาวะที่เลือก: ${c.conditions.join(', ') || '-'}
ยาที่กินอยู่ (พิมพ์เพิ่ม): ${c.medsText.trim() || '-'}

ผลตรวจในเครื่อง (ข้อเท็จจริงจากคลังที่ตรวจแล้ว ห้ามขัดหรือลดความรุนแรง):
${facts.length ? facts.map((f) => `• ${f}`).join('\n') : '• ไม่พบข้อห้ามที่ตรงกับผู้ป่วย'}

คลังความรู้ (อ้างด้วยรหัสในวงเล็บเหลี่ยม ใช้ได้เฉพาะข้อมูลในนี้):
${S.map((x) => `[${x.key}] ${x.body}`).join('\n\n')}

ช่วย${userNoun()}ประเมินว่าใช้สมุนไพรเหล่านี้ร่วมกับยา/ภาวะของผู้ป่วยได้ไหม ตอบภาษาไทย กระชับ:
- level รวม: "avoid" ไม่ควรใช้ / "caution" ใช้ได้แต่ต้องระวัง / "ok" ไม่พบปัญหาจากข้อมูลที่มี
- summary: สรุป 1-2 ประโยค
- herbs: ทีละสมุนไพร {herb, level, text: คำแนะนำที่ทำได้จริง เช่น เว้นระยะห่างจากยา เฝ้าระวังอาการอะไร ควรปรึกษาแพทย์/เภสัชกรเรื่องอะไร, src: รหัส S}
- alternatives: สมุนไพรทางเลือกที่ปลอดภัยกว่าสำหรับผู้ป่วยรายนี้ 0-3 ข้อ (เฉพาะที่มีในคลัง ต้องมี src)
- ask: คำถามที่ควรถามผู้ป่วยเพิ่ม 0-3 ข้อ (เช่น ชื่อยาที่กินจริง ขนาดยา)
- seeDoctor: เมื่อไรต้องปรึกษาแพทย์หรือเภสัชกร
ห้ามแต่งข้อมูลยาตีกันที่ไม่มีในคลัง ถ้าไม่มีข้อมูลให้บอกว่า "ไม่พบข้อมูลในคลัง" ห้ามบอกว่าปลอดภัยแน่นอน
ตอบ JSON เท่านั้น:
{"level":"caution","summary":"","herbs":[{"herb":"","level":"caution","text":"","src":["S1"]}],"alternatives":[{"text":"","src":["S2"]}],"ask":[""],"seeDoctor":""}`,
      },
    ],
    undefined,
    { maxTokens: 1400, timeoutMs: 60_000 },
  );

  const byKey = new Map(S.map((x) => [x.key, x.doc] as const));
  const refsOf = (src: unknown) =>
    [...new Set((Array.isArray(src) ? src : []).map((k) => String(k).replace(/[[\]\s]/g, '').toUpperCase()).filter((k) => byKey.has(k)))].map((k) => {
      const d = byKey.get(k)!;
      return { id: d.id, label: citeLabel(d) };
    });

  // ระดับความเสี่ยงต่อสมุนไพร: ไม่ต่ำกว่าผลตรวจในเครื่อง
  const floor = (h: Herb): RiskLevel => (c.allergic.includes(h) ? 'avoid' : c.conflicts.some((x) => x.herb === h) || (c.drugHits.get(h.id) ?? []).some((x) => x.hit) ? 'caution' : 'ok');
  const raw = Array.isArray(r.herbs) ? r.herbs : [];
  const herbs: HerbAdvice[] = c.herbs.map((h) => {
    const m = raw.filter((x) => String(x?.herb ?? '').includes(h.name) || h.name.includes(String(x?.herb ?? '___')));
    const ai = m.map((x) => LEVEL[String(x?.level)] ?? 'caution').reduce<RiskLevel>((a, b) => (order(b) > order(a) ? b : a), 'ok');
    const lv = order(floor(h)) > order(ai) ? floor(h) : ai;
    // สองโมเดลตอบซ้ำความกัน → ใช้ข้อความที่ละเอียดที่สุดข้อเดียว
    const text = dedupeText(m.map((x) => strip(x?.text)).filter(Boolean)).sort((a, b) => b.length - a.length)[0] ?? '';
    const refs = [...new Map(m.flatMap((x) => refsOf(x?.src)).map((x) => [x.id, x])).values()];
    return { herb: h.name, level: lv, text: text || (lv === 'ok' ? 'ไม่พบข้อห้ามจากข้อมูลในคลัง' : ''), refs: refs.length ? refs : [{ id: herbDocId(h), label: citeLabel(docById(herbDocId(h))!) }] };
  });
  const top = herbs.reduce<RiskLevel>((a, b) => (order(b.level) > order(a) ? b.level : a), 'ok');
  const aiLevel = LEVEL[String(r.level)] ?? top;
  return {
    level: order(top) > order(aiLevel) ? top : aiLevel,
    summary: strip(r.summary),
    herbs,
    alternatives: dedupe((Array.isArray(r.alternatives) ? r.alternatives : []).map((x) => ({ text: strip(x?.text), refs: refsOf(x?.src) })).filter((x) => x.text && x.refs.length)).slice(0, 3),
    ask: dedupeText((Array.isArray(r.ask) ? r.ask : []).map(strip).filter(Boolean)).slice(0, 3),
    seeDoctor: strip(r.seeDoctor),
  };
}
