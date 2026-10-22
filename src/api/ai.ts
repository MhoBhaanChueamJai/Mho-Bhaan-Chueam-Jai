/**
 * AI Cloud (BMS) — ศูนย์รวมการเชื่อมต่อ
 *  - LLM      : vllm-qwen / vllm-gemma  (OpenAI-compatible /v1/chat/completions)
 *  - ASR      : asr2   → Qwen3-ASR (เสียง → ข้อความ ภาษาไทย/ภาษาถิ่น)
 *  - TTS      : vox-cpm → VoxCPM Thai (ข้อความ → เสียงพูด)
 *  - OCR      : pdf-ocr-mcp → Typhoon OCR (ภาพตำรา/สมุดข่อย → ข้อความ)
 */
import { File, Paths } from 'expo-file-system';
import { guarded } from './guard';

export const ENDPOINTS = {
  qwen: 'https://vllm-qwen.bmscloud.in.th',
  gemma: 'https://vllm-gemma.bmscloud.in.th',
  asr: 'https://asr2.bmscloud.in.th',
  tts: 'https://vox-cpm.bmscloud.in.th',
  ocr: 'https://pdf-ocr-mcp.bmscloud.in.th/api',
};

export type ModelKey = 'qwen' | 'gemma';
export const MODELS: Record<ModelKey, { id: string; label: string; note: string }> = {
  gemma: { id: 'gemma4', label: 'Gemma', note: 'สรุปไว ภาษาไทยลื่น' },
  qwen: { id: 'qwen3.6', label: 'Qwen', note: 'วิเคราะห์ละเอียด' },
};

export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await p(ctl.signal);
  } finally {
    clearTimeout(t);
  }
}

export const SYSTEM_PROMPT = `คุณคือ "ครูปัญญา" ผู้ช่วย AI ของแอป "หมอบ้านเชื่อมใจ" สำหรับแพทย์แผนไทย แพทย์แผนปัจจุบัน หมอพื้นบ้าน และประชาชนทั่วไป
หลักการ:
- ตอบเป็นภาษาไทยที่สุภาพ อบอุ่น ใช้ประโยคสั้น อ่านง่าย เรียกผู้ใช้ตามบทบาท (แพทย์/หมอ = "คุณหมอ" · ประชาชน = "คุณ")
- อ้างอิงองค์ความรู้การแพทย์แผนไทย: ธาตุเจ้าเรือน (ดิน น้ำ ลม ไฟ), รสยา 9 รส, บัญชียาจากสมุนไพร
- เคารพภูมิปัญญาท้องถิ่น แต่ระบุข้อควรระวังด้านความปลอดภัย ปฏิกิริยากับยาแผนปัจจุบัน และอาการที่ต้องส่งต่อโรงพยาบาลเสมอ
- ห้ามวินิจฉัยแทนแพทย์ ให้เป็นคำแนะนำเบื้องต้นเท่านั้น
- ไม่ใช้ markdown ตาราง ใช้หัวข้อสั้นและรายการด้วย "•"`;

/** เรียกโมเดลเดียว */
async function chatOne(messages: ChatMsg[], model: ModelKey, maxTokens: number, ms = 60_000): Promise<string> {
  return guarded(model, () => withTimeout(async (signal) => {
    const res = await fetch(`${ENDPOINTS[model]}/v1/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODELS[model].id,
        messages,
        max_tokens: maxTokens,
        temperature: 0.4,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? '';
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\*\*/g, '').trim();
  }, ms));
}

/** ยิงทั้ง 2 โมเดลพร้อมกัน คืนผลที่สำเร็จ (ตัวที่ล่ม/ช้าเกิน ถูกข้าม) */
async function both<T>(fn: (m: ModelKey) => Promise<T>): Promise<{ gemma?: T; qwen?: T }> {
  const [g, q] = await Promise.allSettled([fn('gemma'), fn('qwen')]);
  return { gemma: g.status === 'fulfilled' ? g.value : undefined, qwen: q.status === 'fulfilled' ? q.value : undefined };
}

/**
 * ครูปัญญาตอบในแชท
 * - คำถามทั่วไป (deep=false): โมเดลเดียว (Gemma ภาษาไทยลื่น) ล่ม/ช้า → Qwen = ส่ง 1 ครั้ง
 * - เรื่องยา ความปลอดภัย ผู้ป่วย (deep=true): Gemma + Qwen ตอบพร้อมกัน แล้วรวมเป็นคำตอบเดียวที่ถูกต้องที่สุด = ส่ง 3 ครั้ง
 * ถ้าโมเดลใดล่มหรือช้า ใช้ผลของอีกตัวทันที
 */
export async function chat(messages: ChatMsg[], _model?: ModelKey, maxTokens = 700, opts?: { deep?: boolean }): Promise<string> {
  if (opts?.deep === false) {
    try {
      return await chatOne(messages, 'gemma', maxTokens, 45_000);
    } catch {
      return chatOne(messages, 'qwen', maxTokens, 45_000);
    }
  }
  const r = await both((m) => chatOne(messages, m, maxTokens, 45_000));
  if (!r.gemma && !r.qwen) throw new Error('LLM unavailable');
  if (!r.gemma || !r.qwen) return (r.gemma ?? r.qwen)!;
  const question = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? '';
  const system = messages.find((m) => m.role === 'system')?.content;
  try {
    return await chatOne(
      [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        {
          role: 'user',
          content: `คำถาม: ${question}\n\nคำตอบจากผู้ช่วยคนที่ 1:\n${r.gemma}\n\nคำตอบจากผู้ช่วยคนที่ 2:\n${r.qwen}\n\nช่วยกันตรวจสอบ: รวมเป็นคำตอบเดียวที่ถูกต้องและครบถ้วนที่สุด ตัดส่วนที่ผิดหรือขัดแย้งออก ถ้าความเห็นต่างกันให้เลือกข้อที่ปลอดภัยต่อผู้ป่วยกว่า ใช้รูปแบบและภาษาเดียวกับคำตอบเดิม ตอบเฉพาะคำตอบสุดท้าย ห้ามพูดถึงผู้ช่วยทั้งสอง`,
        },
      ],
      'gemma',
      maxTokens,
      30_000,
    );
  } catch {
    return r.qwen.length > r.gemma.length ? r.qwen : r.gemma;
  }
}

/**
 * ตอบเร็ว (โหมดคุยด้วยเสียง): ใช้โมเดลเดียว (Gemma ภาษาไทยลื่น) — ล่ม/ช้า → สลับไป Qwen ทันที
 * ไม่รอให้ 2 โมเดลตอบแล้วรวม เพื่อให้คุยโต้ตอบได้เป็นธรรมชาติ ไม่เงียบนาน
 */
export async function chatQuick(messages: ChatMsg[], maxTokens = 400): Promise<string> {
  try {
    return await chatOne(messages, 'gemma', maxTokens, 25_000);
  } catch {
    return chatOne(messages, 'qwen', maxTokens, 30_000);
  }
}

const isEmpty = (v: unknown) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
const norm = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, '').toLowerCase() : JSON.stringify(v));

/** รวม JSON 2 ชุด: ตรงกัน/มีฝั่งเดียว → ใช้เลย · ข้อความยาว → ใช้ของ Gemma (ภาษาไทยลื่น) · ค่าสั้นที่ขัดกัน → เก็บไว้ให้ตัดสิน */
function mergeJSON(a: any, b: any, path: string, conflicts: { path: string; a: unknown; b: unknown }[]): any {
  if (isEmpty(a)) return b;
  if (isEmpty(b)) return a;
  if (Array.isArray(a) && Array.isArray(b)) {
    const seen = new Set(a.map(norm));
    return [...a, ...b.filter((x) => !seen.has(norm(x)))];
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const out: any = {};
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => (out[k] = mergeJSON(a[k], b[k], path ? `${path}.${k}` : k, conflicts)));
    return out;
  }
  if (norm(a) === norm(b)) return a;
  if (typeof a === 'string' && typeof b === 'string' && Math.max(a.length, b.length) > 40) return a;
  conflicts.push({ path, a, b });
  return a;
}

/** ขอผลลัพธ์เป็น JSON — 2 โมเดลช่วยกัน แล้วรวม/ตัดสินค่าที่ขัดกัน */
/** opts.maxTokens/timeoutMs: งานที่ต้องตอบยาว (จัดหน้าตำรา ถอดความตำรา) ต้องให้งบมากกว่าค่าปกติ ไม่งั้น JSON ถูกตัดกลางทาง */
export async function chatJSON<T>(messages: ChatMsg[], _model?: ModelKey, opts?: { maxTokens?: number; timeoutMs?: number }): Promise<T> {
  const parse = (raw: string) => {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no json');
    return JSON.parse(m[0]);
  };
  const r = await both(async (m) => parse(await chatOne(messages, m, opts?.maxTokens ?? 1200, opts?.timeoutMs ?? 45_000)));
  if (!r.gemma && !r.qwen) throw new Error('LLM unavailable');
  if (!r.gemma || !r.qwen) return (r.gemma ?? r.qwen) as T;
  const conflicts: { path: string; a: unknown; b: unknown }[] = [];
  const merged = mergeJSON(r.gemma, r.qwen, '', conflicts);
  if (!conflicts.length) return merged as T;
  // ค่าที่สองโมเดลเห็นไม่ตรงกัน → ให้ตัดสินจากบริบทเดิม
  try {
    const question = messages.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? '';
    const verdict = parse(
      await chatOne(
        [
          {
            role: 'user',
            content: `${question}\n\n---\nมีผู้ช่วย 2 คนตอบข้อมูลบางช่องไม่ตรงกัน:\n${conflicts.map((c) => `${c.path}: (1) ${JSON.stringify(c.a)} | (2) ${JSON.stringify(c.b)}`).join('\n')}\nเลือกค่าที่ถูกต้องที่สุดตามข้อมูลต้นทาง ตอบ JSON เท่านั้น เช่น {"ชื่อช่อง": ค่าที่ถูก}`,
          },
        ],
        'qwen',
        400,
        15_000,
      ),
    );
    conflicts.forEach((c) => {
      if (verdict[c.path] === undefined) return;
      const keys = c.path.split('.');
      let o = merged;
      keys.slice(0, -1).forEach((k) => (o = o[k]));
      o[keys[keys.length - 1]] = verdict[c.path];
    });
  } catch {}
  return merged as T;
}

/** เสียง (WAV 16kHz) → ข้อความ */
export async function transcribe(uri: string): Promise<string> {
  return guarded('asr', () => withTimeout(async (signal) => {
    const form = new FormData();
    form.append('file', { uri, name: 'voice.wav', type: 'audio/wav' } as any);
    form.append('model', 'Qwen/Qwen3-ASR-1.7B');
    form.append('language', 'th');
    const res = await fetch(`${ENDPOINTS.asr}/v1/audio/transcriptions`, { method: 'POST', body: form, signal });
    if (!res.ok) throw new Error(`ASR ${res.status}`);
    const json = await res.json();
    return String(json.text ?? '')
      .replace(/^.*<asr_text>/s, '')
      .trim();
  }, 60_000));
}

/**
 * เสียงของครูปัญญา — ล็อกเป็นเสียงเดียวทั้งแอป (ผู้ชายวัยกลางคน โทนทุ้มอบอุ่น)
 * male_eugene: pitch เฉลี่ย ~103 Hz (ทดสอบเทียบกับ male / boga / kostas / takis)
 */
export const KRU_VOICE = 'male_eugene';

/** เตรียมข้อความก่อนส่ง TTS: ขยาย "ๆ" (เซิร์ฟเวอร์ VoxCPM ล่มเมื่อเจอ ๆ) และตัดสัญลักษณ์ที่อ่านไม่ได้ */
export function speakable(text: string, strict = false): string {
  let t = text.replace(/[•*#_`>|~]/g, ' ').replace(/[“”"']/g, '');
  if (t.includes('ๆ')) {
    try {
      const Seg = (Intl as any).Segmenter;
      const words: string[] = Array.from(new Seg('th', { granularity: 'word' }).segment(t), (x: any) => x.segment);
      const out: string[] = [];
      words.forEach((w) => {
        if (w.trim() === 'ๆ') {
          const prev = [...out].reverse().find((x) => x.trim());
          if (prev) out.push(prev);
        } else out.push(w);
      });
      t = out.join('');
    } catch {
      t = t.replace(/ๆ/g, '');
    }
    t = t.replace(/ๆ/g, '');
  }
  if (strict) t = t.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s.,?!]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * ข้อความ → ไฟล์เสียง (คืนค่า uri ในเครื่อง) — เสียงครูปัญญาเสมอ
 * 1) ElevenLabs (ผ่าน proxy ของเซิร์ฟเวอร์ vox-cpm) — เสียงผู้ชาย เป็นธรรมชาติเหมือนคนจริง
 * 2) สำรอง: VoxCPM เสียง male_eugene
 */
export async function synthesize(text: string, voice = KRU_VOICE): Promise<string> {
  const save = (buf: Uint8Array, ext: string) => {
    const file = new File(Paths.cache, `tts-${Date.now()}.${ext}`);
    file.write(buf);
    return file.uri;
  };
  try {
    return await guarded('tts', () => withTimeout(async (signal) => {
      const res = await fetch(`${ENDPOINTS.tts}/v1/audio/elevenlabs`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.replace(/[•*#_`>|~]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600), voice: 'male' }),
      });
      if (!res.ok) throw new Error(`EL ${res.status}`);
      return save(new Uint8Array(await res.arrayBuffer()), 'mp3');
    }, 45_000));
  } catch {}
  const call = (input: string) =>
    guarded('tts', () => withTimeout(async (signal) => {
      const res = await fetch(`${ENDPOINTS.tts}/v1/audio/speech`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'voxcpm-thai', input: input.slice(0, 600), voice, response_format: 'wav', speed: 0.95 }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      return save(new Uint8Array(await res.arrayBuffer()), 'wav');
    }, 90_000));
  try {
    return await call(speakable(text));
  } catch {
    return call(speakable(text, true));
  }
}

/** ภาพตำรา/สมุดข่อย → ข้อความ */
export async function ocrImage(uri: string, mime = 'image/jpeg'): Promise<string> {
  return guarded('ocr', () => withTimeout(async (signal) => {
    const form = new FormData();
    form.append('file', { uri, name: 'page.jpg', type: mime } as any);
    const res = await fetch(`${ENDPOINTS.ocr}/ocr_image/upload`, { method: 'POST', body: form, signal });
    if (!res.ok) throw new Error(`OCR ${res.status}`);
    const json = await res.json();
    return String(json.text ?? '').trim();
  }, 120_000));
}

export type ServiceKey = 'llm' | 'asr' | 'tts' | 'ocr';
export async function health(): Promise<Record<ServiceKey, boolean>> {
  const ping = (url: string) =>
    withTimeout((signal) => fetch(url, { signal }).then((r) => r.ok), 8000).catch(() => false);
  const [llm, asr, tts, ocr] = await Promise.all([
    ping(`${ENDPOINTS.gemma}/v1/models`),
    ping(`${ENDPOINTS.asr}/health`),
    ping(`${ENDPOINTS.tts}/health`),
    ping(`${ENDPOINTS.ocr}/health`),
  ]);
  return { llm, asr, tts, ocr };
}
