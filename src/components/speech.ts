/**
 * เสียงพูดและการฟังของครูปัญญา (ใช้ร่วมทุกหน้า AI)
 *
 * พูด: แบ่งข้อความเป็นช่วงประโยค แล้วสังเคราะห์ช่วงถัดไปไว้ล่วงหน้าระหว่างที่ช่วงก่อนกำลังเล่น
 *   → เริ่มพูดเร็วขึ้น (ไม่ต้องรอสังเคราะห์ทั้งก้อน) พูดได้ยาวจนจบ (เดิมตัดที่ 600 ตัวอักษร/30 วินาที)
 *   และเว้นจังหวะหายใจสั้นๆ ระหว่างประโยคเหมือนคนพูดจริง
 * ฟัง: VAD ปรับตามเสียงห้อง — เริ่มนับเมื่อพูดดังกว่าพื้นหลังชัดเจน จบเมื่อเงียบต่อเนื่อง
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';
import { withTiming, type SharedValue } from 'react-native-reanimated';
import { synthesize, transcribe } from '../api/ai';
import { audioCtx } from './webAudio';

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
// คำท้ายวลีที่คนมักหยุดหายใจ (รวมคำลงท้ายภาษาถิ่น อีสาน/เหนือ/ใต้) — ตัดช่วงเสียงตรงนี้ จังหวะเป็นธรรมชาติ
const ENDERS = /(ครับ|ค่ะ|คะ|นะ|เลย|ด้วย|แล้ว|เด้อ|เนาะ|แหน่|เน้อ|ก่อ|เจ้า|โหล|หนิ|เหอ|แหละ|[?!.。])$/;

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

  /**
   * เว็บ: เล่นผ่าน AudioContext ที่ปลดล็อกไว้ตอนผู้ใช้แตะ (Safari บล็อก <audio> ที่เริ่มเล่นหลังรอ AI)
   * และวัดระดับเสียงจริงด้วย AnalyserNode ให้ลูกแก้วขยับ
   */
  const playWeb = (uri: string, my: number) =>
    new Promise<void>((resolve) => {
      if (my !== gen) return resolve();
      (async () => {
        const ac = audioCtx();
        // Safari: resume() ที่ไม่ได้มาจากการแตะจะค้างไม่จบ → รอแค่ครู่เดียว
        await Promise.race([ac.resume().catch(() => {}), wait(500)]);
        const buf = await ac.decodeAudioData(await (await fetch(uri)).arrayBuffer());
        if (my !== gen) return resolve();
        // ยังไม่ได้ปลดล็อกเสียง (ผู้ใช้ยังไม่เคยแตะ) → ข้ามช่วงนี้ ไม่ค้างทั้งบทสนทนา (ข้อความยังขึ้นบนจอ)
        if (ac.state !== 'running') return resolve();
        const src = ac.createBufferSource();
        src.buffer = buf;
        const an = ac.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        an.connect(ac.destination);
        const frame = new Float32Array(an.fftSize);
        let done = false;
        const end = () => {
          if (done) return;
          done = true;
          clearInterval(meter);
          clearTimeout(guard);
          try {
            src.stop();
          } catch {}
          src.disconnect();
          an.disconnect();
          finishCur = null;
          resolve();
        };
        finishCur = end;
        const meter = setInterval(() => {
          an.getFloatTimeDomainData(frame);
          let sum = 0;
          for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
          level.value = withTiming(Math.min(1, Math.sqrt(sum / frame.length) * 5.8), { duration: 80 });
        }, 80);
        src.onended = end;
        // กันค้าง: context ถูกพักกลางทาง (สลับแอป/สายเข้า) แล้ว onended ไม่มาถึง
        const guard = setTimeout(end, buf.duration * 1000 + 2000);
        src.start();
      })().catch(() => resolve());
    });

  /** เล่นไฟล์ 1 ช่วงจนจบ */
  const playOne = (uri: string, my: number) =>
    new Promise<void>((resolve) => {
      if (my !== gen) return resolve();
      if (Platform.OS === 'web') return playWeb(uri, my).then(resolve);
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

/** ประโยคที่ค้างอยู่ — ลงท้ายด้วยคำเชื่อม/คำลังเล แปลว่ายังพูดไม่จบ (เช่น "ปวดหัวมาสามวัน แล้วก็…") */
const UNFINISHED = /(และ|แล้วก็|แต่|แต่ว่า|เพราะ|เพราะว่า|คือ|คือว่า|ก็คือ|ที่|ว่า|หรือ|หรือว่า|กับ|ถ้า|ซึ่ง|โดย|ของ|ให้|จะ|ตอน|ตั้งแต่|เวลา|แบบ|เอ่อ|อ่า|อ่ะ|อืม|เออ|เอ้อ)[\s.,…]*$/;
const COMPLETE = /(ครับ|ค่ะ|คะ|ค่า|จ้ะ|จ้า|นะคะ|นะครับ|เท่านั้น|แค่นั้น|เด้อ|เนาะ|เน้อ|เจ้า|แหละ)[\s.,!?…]*$/;
export const looksUnfinished = (t: string) => !!t && !COMPLETE.test(t) && UNFINISHED.test(t.trim());

/**
 * ฟัง 1 ครั้ง (VAD ปรับตามห้อง) แล้วถอดเป็นข้อความ
 * alive() = ยังอยู่ในโหมดนี้ไหม · submit() = ผู้ใช้แตะเพื่อส่งเอง · typed() = ข้อความที่พิมพ์แทน
 * onHeard = เริ่มได้ยินเสียงพูด (ให้หน้าจอเปลี่ยนสถานะ)
 *
 * กันตอบแทรกก่อนพูดจบ:
 *  - รอเงียบ 1.6 วิ (พูดสั้นๆ แล้วหยุด = น่าจะกำลังคิด → รอ 2.4 วิ)
 *  - พอเงียบแล้ว เปิดไมค์ต่อทันทีระหว่างถอดความ — ถ้าผู้ใช้พูดต่อ จะฟังต่อแล้วรวมเป็นข้อความเดียว
 *  - ถ้าข้อความลงท้ายค้าง (แล้วก็ / เพราะว่า / เอ่อ…) รอฟังต่ออีก 4 วิก่อนส่ง
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
  // เสียงพื้นหลัง: ใช้ค่าต่ำของช่วงวัด (ถ้าผู้ใช้เริ่มพูดเร็ว ค่าเฉลี่ยจะสูงเกินจริงจนเสียงพูดเบาๆ ถูกนับเป็นความเงียบ)
  const samples: number[] = [];
  for (let i = 0; i < 6 && opts.alive(); i++) {
    await wait(TICK);
    samples.push(rec.level.value);
  }
  samples.sort((x, y) => x - y);
  const floor = samples.length ? samples[Math.floor(samples.length / 3)] : 0;
  const speakTh = Math.min(0.9, floor + 0.14);
  const quietTh = Math.min(0.85, floor + 0.07);

  type Seg = { heard: boolean; submitted: boolean; typed: string | null };
  /** ฟัง 1 ช่วงบนไมค์ที่เปิดอยู่ จนเงียบ/แตะส่ง/พิมพ์/หมดเวลา · cancel() = เลิกรอ (ไม่มีเสียงพูดในช่วงนี้) */
  const segment = async (waitMs: number, cancel: () => boolean = () => false, onLoud?: () => void): Promise<Seg> => {
    let loud = 0;
    let speech = 0;
    let heard = false;
    let quiet = 0;
    const t0 = Date.now();
    while (opts.alive() && !opts.submit?.()) {
      const t = opts.typed?.();
      if (t) return { heard, submitted: false, typed: t };
      if (!heard && cancel()) break;
      await wait(TICK);
      const lv = rec.level.value;
      if (lv > speakTh) {
        loud += TICK;
        if (heard) speech += TICK;
        if (loud >= 250 && !heard) {
          heard = true;
          speech = loud;
          onLoud?.();
        }
        quiet = 0;
      } else {
        loud = 0;
        if (heard && lv < quietTh) quiet += TICK;
        else if (heard) quiet = Math.max(0, quiet - TICK / 2);
      }
      if (heard && quiet >= (speech < 1200 ? 2400 : 1600)) break;
      if (Date.now() - t0 > (heard ? 30_000 : waitMs)) break;
    }
    return { heard, submitted: !!opts.submit?.(), typed: null };
  };
  const finish = (texts: string[], heard: boolean) => ({ text: texts.filter(Boolean).join(' ').trim(), heard });

  const texts: string[] = [];
  let seg = await segment(opts.maxSilentMs ?? 10_000, undefined, opts.onHeard);
  if (seg.typed) {
    await rec.stop().catch(() => null);
    return { text: seg.typed, heard: true };
  }
  for (let round = 0; ; round++) {
    const uri = await rec.stop().catch(() => null);
    if (!opts.alive()) return { text: '', heard: seg.heard };
    if (uri && (seg.heard || seg.submitted)) {
      const job = transcribe(uri)
        .then((t) => {
          const text = t.trim();
          // เสียงรบกวนมักถอดออกมาเป็นอักษรอื่น/เครื่องหมาย (เช่น "嗯。") → ถือว่าไม่ได้ยิน ให้ขอพูดใหม่ ไม่ส่งไปถามครูปัญญา
          return text.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]/g, '').length >= 2 ? text : '';
        })
        .catch(() => '');
      // แตะส่ง / ฟังต่อมาหลายรอบแล้ว → ส่งเลย
      if (seg.submitted || round >= 3) {
        texts.push(await job);
        return finish(texts, true);
      }
      // เปิดไมค์ต่อระหว่างถอดความ เผื่อผู้ใช้แค่หยุดหายใจ/คิด
      let next: Promise<Seg> | null = null;
      let resumed = false;
      let decided = false; // เลิกรอช่วงสั้น เพื่อเริ่มช่วงรอยาว 4 วิแทน
      try {
        await rec.start();
        next = segment(1000, () => decided, () => (resumed = true));
      } catch {}
      const text = await job;
      texts.push(text);
      if (!next) return finish(texts, true);
      // ข้อความดูค้าง → ให้เวลาพูดต่ออีก 4 วิ · ดูครบแล้ว → รอเฉพาะช่วงสั้นๆ ที่เปิดไว้ (1 วิ นับซ้อนกับเวลาถอดความ)
      if (looksUnfinished(finish(texts, true).text) && !resumed) {
        decided = true;
        const r = await next;
        next = r.heard || r.submitted || r.typed ? Promise.resolve(r) : segment(4000);
      }
      seg = await next;
      if (seg.typed) {
        await rec.stop().catch(() => null);
        return { text: [...texts, seg.typed].join(' '), heard: true };
      }
      if (!seg.heard && !seg.submitted) {
        await rec.stop().catch(() => null);
        return finish(texts, true);
      }
      continue;
    }
    return { text: '', heard: seg.heard };
  }
}
