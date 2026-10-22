/**
 * ตัวอัดเสียงฝั่งเว็บ — อัด PCM ตรงจากไมค์ผ่าน Web Audio แล้วแปลงเป็น WAV 16kHz mono เอง
 * (MediaRecorder ของเบราว์เซอร์ให้ได้แค่ webm/mp4 ซึ่ง ASR ไม่รับ และ expo-audio บนเว็บไม่มีค่า metering
 *  → VAD ไม่รู้ว่าผู้ใช้เริ่มพูด) — API เหมือน recorder.ts ทุกอย่าง
 */
import { useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { audioCtx } from './webAudio';

const RATE = 16000;

/** Float32 หลายก้อน (อัตรา from) → WAV 16-bit mono อัตรา RATE */
function encodeWav(chunks: Float32Array[], from: number): Blob {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  const ratio = from / RATE;
  const n = Math.floor(total / ratio);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    // linear interpolation ระหว่างตัวอย่างต้นทาง
    const p = i * ratio;
    const k = Math.floor(p);
    const a = all[k] ?? 0;
    const b = all[k + 1] ?? a;
    const s = Math.max(-1, Math.min(1, a + (b - a) * (p - k)));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

type Session = { stream: MediaStream; nodes: AudioNode[]; chunks: Float32Array[]; rate: number; t0: number };

export function useVoiceRecorder() {
  const level = useSharedValue(0);
  const [isRecording, setRecording] = useState(false);
  const [durationMs, setDuration] = useState(0);
  const cur = useRef<Session | null>(null);

  const teardown = (s: Session) => {
    s.nodes.forEach((n) => n.disconnect());
    s.stream.getTracks().forEach((t) => t.stop());
  };

  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => cur.current && setDuration(Date.now() - cur.current.t0), 80);
    return () => clearInterval(id);
  }, [isRecording]);

  useEffect(
    () => () => {
      if (cur.current) teardown(cur.current);
      cur.current = null;
    },
    [],
  );

  const start = async () => {
    if (cur.current) {
      teardown(cur.current);
      cur.current = null;
    }
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('mic-unavailable');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      throw new Error('mic-denied');
    }
    const ac = audioCtx();
    await ac.resume().catch(() => {});
    const src = ac.createMediaStreamSource(stream);
    const proc = ac.createScriptProcessor(2048, 1, 1);
    const mute = ac.createGain();
    mute.gain.value = 0;
    const s: Session = { stream, nodes: [src, proc, mute], chunks: [], rate: ac.sampleRate, t0: Date.now() };
    proc.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      s.chunks.push(new Float32Array(input));
      let sum = 0;
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
      // RMS → dBFS → 0..1 สเกลเดียวกับ metering ฝั่ง native
      const db = 20 * Math.log10(Math.sqrt(sum / input.length) || 1e-8);
      level.value = Math.max(0, Math.min(1, (db + 55) / 50));
    };
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ac.destination);
    cur.current = s;
    setDuration(0);
    setRecording(true);
  };

  const stop = async (): Promise<string | null> => {
    const s = cur.current;
    cur.current = null;
    level.value = 0;
    setRecording(false);
    if (!s) return null;
    teardown(s);
    if (!s.chunks.length) return null;
    return URL.createObjectURL(encodeWav(s.chunks, s.rate));
  };

  return { start, stop, level, isRecording, durationMs };
}
