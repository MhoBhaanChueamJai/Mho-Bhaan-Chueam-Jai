/**
 * AI Cloud (BMS) — ศูนย์รวมการเชื่อมต่อ
 *  - LLM      : vllm-qwen / vllm-gemma  (OpenAI-compatible /v1/chat/completions)
 *  - ASR      : asr2   → Qwen3-ASR (เสียง → ข้อความ ภาษาไทย/ภาษาถิ่น)
 *  - TTS      : vox-cpm → VoxCPM Thai (ข้อความ → เสียงพูด)
 *  - OCR      : pdf-ocr-mcp → Typhoon OCR (ภาพตำรา/สมุดข่อย → ข้อความ)
 */
import { File, Paths } from 'expo-file-system';

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

export const SYSTEM_PROMPT = `คุณคือ "ครูปัญญา" ผู้ช่วย AI ของแอป "หมอบ้านเชื่อมใจ" สำหรับหมอพื้นบ้านไทยอายุ 40–80 ปี
หลักการ:
- ตอบเป็นภาษาไทยที่สุภาพ อบอุ่น ใช้ประโยคสั้น อ่านง่าย เรียกผู้ใช้ว่า "คุณหมอ"
- อ้างอิงองค์ความรู้การแพทย์แผนไทย: ธาตุเจ้าเรือน (ดิน น้ำ ลม ไฟ), รสยา 9 รส, บัญชียาจากสมุนไพร
- เคารพภูมิปัญญาท้องถิ่น แต่ระบุข้อควรระวังด้านความปลอดภัย ปฏิกิริยากับยาแผนปัจจุบัน และอาการที่ต้องส่งต่อโรงพยาบาลเสมอ
- ห้ามวินิจฉัยแทนแพทย์ ให้เป็นคำแนะนำเบื้องต้นเท่านั้น
- ไม่ใช้ markdown ตาราง ใช้หัวข้อสั้นและรายการด้วย "•"`;

export async function chat(messages: ChatMsg[], model: ModelKey = 'gemma', maxTokens = 700): Promise<string> {
  return withTimeout(async (signal) => {
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
  }, 90_000);
}

/** ขอผลลัพธ์เป็น JSON จาก LLM (ตัด code fence ออกให้) */
export async function chatJSON<T>(messages: ChatMsg[], model: ModelKey = 'gemma'): Promise<T> {
  const raw = await chat(messages, model, 1200);
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no json');
  return JSON.parse(m[0]) as T;
}

/** เสียง (WAV 16kHz) → ข้อความ */
export async function transcribe(uri: string): Promise<string> {
  return withTimeout(async (signal) => {
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
  }, 60_000);
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

/** ข้อความ → ไฟล์เสียง (คืนค่า uri ในเครื่อง) — ใช้เสียงครูปัญญาเสมอ */
export async function synthesize(text: string, voice = KRU_VOICE): Promise<string> {
  const call = (input: string) =>
    withTimeout(async (signal) => {
      const res = await fetch(`${ENDPOINTS.tts}/v1/audio/speech`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'voxcpm-thai', input: input.slice(0, 600), voice, response_format: 'wav', speed: 0.95 }),
      });
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      const file = new File(Paths.cache, `tts-${Date.now()}.wav`);
      file.write(buf);
      return file.uri;
    }, 90_000);
  try {
    return await call(speakable(text));
  } catch {
    // ลองใหม่ด้วยข้อความที่ตัดสัญลักษณ์ทั้งหมดออก
    return call(speakable(text, true));
  }
}

/** ภาพตำรา/สมุดข่อย → ข้อความ */
export async function ocrImage(uri: string, mime = 'image/jpeg'): Promise<string> {
  return withTimeout(async (signal) => {
    const form = new FormData();
    form.append('file', { uri, name: 'page.jpg', type: mime } as any);
    const res = await fetch(`${ENDPOINTS.ocr}/ocr_image/upload`, { method: 'POST', body: form, signal });
    if (!res.ok) throw new Error(`OCR ${res.status}`);
    const json = await res.json();
    return String(json.text ?? '').trim();
  }, 120_000);
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
