/**
 * ถาม-ตอบโต้ตอบในแชทครูปัญญา (เรียกหลังได้คำตอบแล้ว ไม่ทำให้คำตอบช้า)
 *  - ask: ถ้าข้อมูลยังไม่พอและคำตอบของผู้ใช้จะเปลี่ยนคำแนะนำ → คำถามกลับ 1 ข้อ + ตัวเลือกให้แตะ
 *  - follow: คำถามต่อที่ผู้ใช้น่าจะอยากถาม 2-3 ข้อ (แตะถามได้ทันที)
 */
import { chatJSON } from '../api/ai';

export type ChatQA = { ask?: { q: string; options: string[] }; follow: string[] };

const short = (x: unknown, n: number) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** ตัวเลือกจาก 2 โมเดลรวมกันมักซ้ำความ ("ไม่มี" กับ "ไม่มีโรคประจำตัว") → เก็บข้อแรก ตัดข้อที่ซ้อนกัน */
export function uniqOptions(list: string[], max = 5) {
  const key = (x: string) => x.replace(/[\s/()（）.,]|ครับ|ค่ะ|คะ/g, '');
  const out: string[] = [];
  for (const o of list) {
    const k = key(o);
    // ซ้อนกันแบบขึ้นต้นเหมือนกันเท่านั้น (ไม่มี ⊂ ไม่มีโรคประจำตัว) — ไม่ตัด "มีไข้" กับ "ไม่มีไข้" ที่ความหมายตรงข้าม
    if (k && !out.some((x) => key(x).startsWith(k) || k.startsWith(key(x)))) out.push(o);
  }
  return out.slice(0, max);
}

export async function chatQA(question: string, reply: string): Promise<ChatQA> {
  const r = await chatJSON<{ ask?: { q?: string; options?: string[] } | null; follow?: string[] }>(
    [
      {
        role: 'user',
        content: `ผู้ใช้ถามครูปัญญา (ผู้ช่วยสุขภาพแผนไทย): ${question}
ครูปัญญาตอบว่า:
${reply.slice(0, 1800)}

1) ask: ถ้าคำแนะนำจะเปลี่ยนไปตามข้อมูลที่ผู้ใช้ยังไม่ได้บอก (เช่น อายุ เด็ก/ผู้สูงอายุ ตั้งครรภ์ โรคประจำตัว ยาที่กินอยู่ เป็นมานานแค่ไหน ใช้ส่วนไหนของพืช) ให้ตั้งคำถามกลับ 1 ข้อ สั้น สุภาพ ลงท้าย "ครับ" พร้อม options 2-5 ข้อที่แตะตอบได้ (สั้นไม่เกิน 30 ตัวอักษร) · ถ้าคำตอบท้ายข้อความของครูปัญญามีคำถามอยู่แล้ว ให้ใช้คำถามนั้นแล้วคิดตัวเลือกให้ · ถ้าไม่จำเป็นให้เป็น null
2) follow: คำถามต่อที่ผู้ใช้น่าจะอยากถาม 2-3 ข้อ เขียนแบบผู้ใช้ถาม สั้นไม่เกิน 40 ตัวอักษร ต่อยอดจากเรื่องนี้ (เช่น วิธีใช้ ข้อห้าม ใช้กับเด็กได้ไหม กินกี่วัน) ห้ามซ้ำกับที่ถามไปแล้ว
ตอบ JSON เท่านั้น: {"ask":{"q":"","options":[""]},"follow":[""]}`,
      },
    ],
    undefined,
    { maxTokens: 350, timeoutMs: 20_000 },
  );
  const q = short(r?.ask?.q, 140);
  const options = uniqOptions((Array.isArray(r?.ask?.options) ? r.ask!.options : []).map((x) => short(x, 34)).filter(Boolean));
  const follow = [...new Set((Array.isArray(r?.follow) ? r.follow : []).map((x) => short(x, 48)).filter((x) => x && x !== question.trim()))].slice(0, 3);
  return { ask: q && options.length >= 2 ? { q, options } : undefined, follow };
}
