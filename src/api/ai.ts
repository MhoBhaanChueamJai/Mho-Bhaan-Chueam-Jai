/**
 * AI Cloud (BMS) — ศูนย์รวมการเชื่อมต่อ
 *  - LLM      : vllm-gemma → Gemma 4 31B (OpenAI-compatible /v1/chat/completions, ดูภาพได้)
 *  - ASR      : asr2   → Qwen3-ASR (เสียง → ข้อความ ภาษาไทย/ภาษาถิ่น)
 *  - TTS      : vox-cpm → VoxCPM Thai (ข้อความ → เสียงพูด)
 *  - OCR      : pdf-ocr-mcp → Typhoon OCR (ภาพตำรา/สมุดข่อย → ข้อความ)
 */
import { File, Paths } from 'expo-file-system';
import { guarded } from './guard';

export const ENDPOINTS = {
  llm: 'https://vllm-gemma.bmscloud.in.th',
  asr: 'https://asr2.bmscloud.in.th',
  tts: 'https://vox-cpm.bmscloud.in.th',
  ocr: 'https://pdf-ocr-mcp.bmscloud.in.th/api',
};

/** โมเดลภาษาเดียวทั้งแอป (ค่า settings.model ที่บันทึกไว้จากรุ่นก่อนไม่มีผลแล้ว) */
export const LLM_MODEL = 'gemma4';
export type ModelKey = 'gemma';

export type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };
/** ข้อความที่แนบภาพได้ (content แบบ OpenAI: ข้อความ + image_url) */
type LlmMsg = ChatMsg | { role: 'user'; content: unknown[] };

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

/** ส่งข้อความไป LLM (ผ่านด่านกันเซิร์ฟเวอร์ล่ม) */
export async function llm(messages: LlmMsg[], opts: { maxTokens: number; timeoutMs: number; temperature?: number }): Promise<string> {
  return guarded('llm', () => withTimeout(async (signal) => {
    const res = await fetch(`${ENDPOINTS.llm}/v1/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature ?? 0.4,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? '';
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/\*\*/g, '').trim();
  }, opts.timeoutMs));
}

/**
 * ครูปัญญาตอบในแชท
 * - คำถามทั่วไป (deep=false): ให้เวลา 45 วินาที
 * - เรื่องยา ความปลอดภัย ผู้ป่วย (deep=true / ไม่ระบุ): ให้เวลาคิดนานขึ้น 60 วินาที
 */
export async function chat(messages: ChatMsg[], _model?: ModelKey, maxTokens = 700, opts?: { deep?: boolean }): Promise<string> {
  return llm(messages, { maxTokens, timeoutMs: opts?.deep === false ? 45_000 : 60_000 });
}

/** ตอบเร็ว (โหมดคุยด้วยเสียง): คำตอบสั้น หมดเวลาเร็ว เพื่อให้คุยโต้ตอบได้เป็นธรรมชาติ ไม่เงียบนาน */
export async function chatQuick(messages: ChatMsg[], maxTokens = 400): Promise<string> {
  return llm(messages, { maxTokens, timeoutMs: 25_000 });
}

/** ขอผลลัพธ์เป็น JSON */
/** opts.maxTokens/timeoutMs: งานที่ต้องตอบยาว (จัดหน้าตำรา ถอดความตำรา) ต้องให้งบมากกว่าค่าปกติ ไม่งั้น JSON ถูกตัดกลางทาง */
export async function chatJSON<T>(messages: ChatMsg[], _model?: ModelKey, opts?: { maxTokens?: number; timeoutMs?: number }): Promise<T> {
  const raw = await llm(messages, { maxTokens: opts?.maxTokens ?? 1200, timeoutMs: opts?.timeoutMs ?? 45_000 });
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no json');
  return JSON.parse(m[0]) as T;
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
    ping(`${ENDPOINTS.llm}/v1/models`),
    ping(`${ENDPOINTS.asr}/health`),
    ping(`${ENDPOINTS.tts}/health`),
    ping(`${ENDPOINTS.ocr}/health`),
  ]);
  return { llm, asr, tts, ocr };
}
