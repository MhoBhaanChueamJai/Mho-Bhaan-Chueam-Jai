/**
 * เสียงพูดและการฟังของครูปัญญา (ใช้ร่วมทุกหน้า AI)
 *
 * พูด: แบ่งข้อความเป็นช่วงประโยค แล้วสังเคราะห์ช่วงถัดไปไว้ล่วงหน้าระหว่างที่ช่วงก่อนกำลังเล่น
 *   → เริ่มพูดเร็วขึ้น (ไม่ต้องรอสังเคราะห์ทั้งก้อน) พูดได้ยาวจนจบ (เดิมตัดที่ 600 ตัวอักษร/30 วินาที)
 *   และเว้นจังหวะหายใจสั้นๆ ระหว่างประโยคเหมือนคนพูดจริง
 * ฟัง: VAD ปรับตามเสียงห้อง — เริ่มนับเมื่อพูดดังกว่าพื้นหลังชัดเจน จบเมื่อเงียบต่อเนื่อง
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { withTiming, type SharedValue } from 'react-native-reanimated';
import { synthesize, transcribe } from '../api/ai';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** PCM frames → ระดับเสียง 0..1 (RMS ปรับให้เห็นการขยับชัด) */
export function rmsLevel(frames?: number[]): number {
  if (!frames?.length) return 0;
  let sum = 0;
  for (let i = 0; i < frames.length; i += 2) sum += frames[i] * frames[i];
  const rms = Math.sqrt(sum / Math.ceil(frames.length / 2));
  return Math.min(1, rms * 4.5);
}

/** คำที่มักขึ้นต้นประโยค/วลีใหม่ (ตัดก่อนคำนี้ = หายใจตรงจังหวะธรรมชาติ) */
const OPENERS = /^(แต่|เพราะ|และ|คือ|ถ้า|หาก|ส่วน|หรือ|ซึ่ง|จึง|ดังนั้น|นอกจากนี้|วิธี|ควร|ห้าม|อย่า|ทั้งนี้|โดย|เช่น|สำหรับ|ตอนนี้|ลอง|ถ้าอย่างนั้น)/;
/** คำท้ายประโยค */
const ENDERS = /(ครับ|ค่ะ|คะ|นะ|เลย|ด้วย|แล้ว|[?!.。])$/;

/**
 * แบ่งข้อความเป็นช่วงพูด: ช่วงแรกสั้น (~80 ตัวอักษร เริ่มพูดได้ไว) ช่วงถัดไป ~150
 * ตัดที่ท้ายประโยค หรือก่อนคำขึ้นต้นวลีใหม่ — ไม่ตัดกลางวลี เช่น "วันละ | 2 ครั้ง"
 */
export function splitSpeech(text: string): string[] {
  const words = text
    .replace(/[•*#_`>|~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const out: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    cur.push(w);
    len += w.length + 1;
    const target = out.length ? 150 : 80;
    const next = words[i + 1];
    if (!next) break;
    const natural = ENDERS.test(w) || OPENERS.test(next);
    // ตัวเลขตามด้วยหน่วย/คำถัดไป ห้ามแยก (5 | กรัม)
    const glued = /\d$/.test(w) || /^\d/.test(next);
    if ((len >= target * 0.6 && natural && !glued) || (len >= target * 1.35 && !glued)) {
      out.push(cur.join(' '));
      cur = [];
      len = 0;
    }
  }
  if (cur.length) {
    // ช่วงสุดท้ายสั้นมาก → รวมกับช่วงก่อนหน้า
    if (out.length && len < 25) out[out.length - 1] += ` ${cur.join(' ')}`;
    else out.push(cur.join(' '));
  }
  return out.filter((x) => x.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]/g, '').length > 0);
}

export type SpeechCtl = {
  /** พูดแล้วรอจนจบ (ถูกหยุดกลางทาง = resolve ทันที) */
  speak: (text: string) => Promise<void>;
  stop: () => void;
};

/**
 * ตัวพูดแบบต่อเนื่อง: level = ระดับเสียง 0..1 (ให้ลูกแก้วขยับตาม) · onState = กำลังพูด/หยุด
 */
export function createSpeech(level: SharedValue<number>, onState?: (speaking: boolean) => void): SpeechCtl {
  let gen = 0;
  let player: AudioPlayer | null = null;
  let finishCur: (() => void) | null = null;

  const stop = () => {
    gen++;
    try {
      player?.pause();
      player?.remove();
    } catch {}
    player = null;
    finishCur?.();
    finishCur = null;
    level.value = withTiming(0, { duration: 200 });
    onState?.(false);
  };

  /** เล่นไฟล์ 1 ช่วงจนจบ */
  const playOne = (uri: string, my: number) =>
    new Promise<void>((resolve) => {
      if (my !== gen) return resolve();
      let done = false;
      const end = () => {
        if (done) return;
        done = true;
        clearInterval(sim);
        clearTimeout(guard);
        try {
          p.remove();
        } catch {}
        if (player === p) player = null;
        finishCur = null;
        resolve();
      };
      const p = createAudioPlayer({ uri });
      player = p;
      finishCur = end;
      let lastSample = 0;
      try {
        p.setAudioSamplingEnabled(true);
        p.addListener('audioSampleUpdate', (sm) => {
          lastSample = Date.now();
          level.value = withTiming(Math.min(1, rmsLevel(sm.channels[0]?.frames) * 1.3), { duration: 80 });
        });
      } catch {}
      // ไฟล์ที่ไม่มีค่าคลื่นเสียง (MP3) → จำลองจังหวะพยางค์ให้ลูกแก้วขยับ
      const t0 = Date.now();
      const sim = setInterval(() => {
        if (Date.now() - lastSample < 300) return;
        const tt = (Date.now() - t0) / 1000;
        const syl = Math.abs(Math.sin(tt * 7.3)) * (0.55 + 0.45 * Math.sin(tt * 1.9 + 1));
        level.value = withTiming(0.25 + syl * 0.6, { duration: 90 });
      }, 90);
      p.addListener('playbackStatusUpdate', (s) => {
        if (s.didJustFinish) end();
      });
      // กันค้าง: ช่วงละไม่เกิน ~45 วินาที
      const guard = setTimeout(end, 45_000);
      p.play();
    });

  const speak = async (text: string) => {
    stop();
    const my = gen;
    const parts = splitSpeech(text);
    if (!parts.length) return;
    onState?.(true);
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      // สังเคราะห์ล่วงหน้า 1 ช่วง: ระหว่างเล่นช่วง i เตรียมช่วง i+1 ไว้แล้ว
      const jobs: (Promise<string | null> | undefined)[] = [];
      const job = (i: number) => (jobs[i] ??= synthesize(parts[i]).catch(() => null));
      job(0);
      for (let i = 0; i < parts.length; i++) {
        if (my !== gen) return;
        if (i + 1 < parts.length) job(i + 1);
        const uri = await job(i);
        if (my !== gen) return;
        if (!uri) continue; // ช่วงนี้สังเคราะห์ไม่สำเร็จ → ข้ามไปช่วงถัดไป ไม่หยุดทั้งคำตอบ
        await playOne(uri, my);
        if (my !== gen) return;
        // เว้นจังหวะหายใจระหว่างประโยค
        if (i + 1 < parts.length) {
          level.value = withTiming(0.05, { duration: 150 });
          await wait(120);
        }
      }
    } finally {
      if (my === gen) {
        level.value = withTiming(0, { duration: 250 });
        onState?.(false);
      }
    }
  };

  return { speak, stop };
}

type Rec = { start: () => Promise<void>; stop: () => Promise<string | null>; level: SharedValue<number> };

/**
 * ฟัง 1 ครั้ง (VAD ปรับตามห้อง) แล้วถอดเป็นข้อความ
 * alive() = ยังอยู่ในโหมดนี้ไหม · submit() = ผู้ใช้แตะเพื่อส่งเอง · typed() = ข้อความที่พิมพ์แทน
 * onHeard = เริ่มได้ยินเสียงพูด (ให้หน้าจอเปลี่ยนสถานะ)
 */
export async function listenOnce(
  rec: Rec,
  opts: { alive: () => boolean; submit?: () => boolean; typed?: () => string | null; onHeard?: () => void; maxSilentMs?: number },
): Promise<{ text: string; heard: boolean }> {
  const pre = opts.typed?.();
  if (pre) return { text: pre, heard: true };
  await wait(250);
  try {
    await rec.start();
  } catch {
    return { text: '', heard: false };
  }
  const TICK = 80;
  let floor = 0;
  let n = 0;
  for (let i = 0; i < 6 && opts.alive(); i++) {
    await wait(TICK);
    floor += rec.level.value;
    n++;
  }
  floor = n ? floor / n : 0;
  const speakTh = Math.min(0.9, floor + 0.14);
  const quietTh = Math.min(0.85, floor + 0.07);
  let loud = 0;
  let heard = false;
  let quiet = 0;
  const t0 = Date.now();
  while (opts.alive() && !opts.submit?.()) {
    const t = opts.typed?.();
    if (t) {
      await rec.stop().catch(() => null);
      return { text: t, heard: true };
    }
    await wait(TICK);
    const lv = rec.level.value;
    if (lv > speakTh) {
      loud += TICK;
      if (loud >= 250 && !heard) {
        heard = true;
        opts.onHeard?.();
      }
      quiet = 0;
    } else {
      loud = 0;
      if (heard && lv < quietTh) quiet += TICK;
      else if (heard) quiet = Math.max(0, quiet - TICK / 2);
    }
    // หยุดพูดเกิน 1.3 วินาที = จบประโยค (คนสูงอายุพูดช้า เว้นช่วงได้)
    if (heard && quiet >= 1300) break;
    if (Date.now() - t0 > (heard ? 30_000 : opts.maxSilentMs ?? 10_000)) break;
  }
  const submitted = !!opts.submit?.();
  const uri = await rec.stop().catch(() => null);
  if (!opts.alive() || !uri || (!heard && !submitted)) return { text: '', heard };
  try {
    return { text: (await transcribe(uri)).trim(), heard: true };
  } catch {
    return { text: '', heard: true };
  }
}
