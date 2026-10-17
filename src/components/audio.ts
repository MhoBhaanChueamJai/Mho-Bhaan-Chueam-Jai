import {
  AudioModule,
  AudioQuality,
  IOSOutputFormat,
  createAudioPlayer,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
  type RecordingOptions,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { synthesize } from '../api/ai';

/** WAV 16kHz mono — รูปแบบที่ ASR (Qwen3-ASR) รองรับ */
const ASR_PRESET: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  isMeteringEnabled: true,
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  web: { mimeType: 'audio/webm' },
};

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(ASR_PRESET);
  const state = useAudioRecorderState(recorder, 80);
  const level = useSharedValue(0);

  useEffect(() => {
    // metering dBFS (-160..0) → 0..1
    const db = state.metering ?? -160;
    const v = state.isRecording ? Math.max(0, Math.min(1, (db + 55) / 50)) : 0;
    level.value = v;
  }, [state.metering, state.isRecording]);

  const start = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) throw new Error('mic-denied');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stop = async (): Promise<string | null> => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    return recorder.uri;
  };

  return { start, stop, level, isRecording: state.isRecording, durationMs: state.durationMillis };
}

/** PCM frames → ระดับเสียง 0..1 (RMS ปรับให้เห็นการขยับชัด) */
export function rmsLevel(frames?: number[]): number {
  if (!frames?.length) return 0;
  let sum = 0;
  for (let i = 0; i < frames.length; i += 2) sum += frames[i] * frames[i];
  const rms = Math.sqrt(sum / Math.ceil(frames.length / 2));
  return Math.min(1, rms * 4.5);
}

/** พูดข้อความด้วย VoxCPM (ภาษาไทย) — เสียงครูปัญญาเดียวทั้งแอป */
export function useSpeaker() {
  const player = useRef<AudioPlayer | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const level = useSharedValue(0);

  // รุ่นของคำสั่งพูด: กดหยุด/ออกจากหน้า/สั่งพูดใหม่ระหว่างรอสังเคราะห์เสียง → ผลเก่าที่มาทีหลังต้องไม่เล่น
  const gen = useRef(0);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
      gen.current++;
      player.current?.remove();
    },
    [],
  );

  const stop = () => {
    gen.current++;
    player.current?.pause();
    player.current?.remove();
    player.current = null;
    setSpeaking(false);
    level.value = 0;
  };

  const speak = async (text: string) => {
    stop();
    const my = gen.current;
    setSpeaking(true);
    try {
      const uri = await synthesize(text);
      if (my !== gen.current || !alive.current) return; // ถูกยกเลิกระหว่างรอ
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (my !== gen.current || !alive.current) return;
      const p = createAudioPlayer({ uri });
      player.current = p;
      // ระดับเสียงจริงจากคลื่นเสียง (RMS) → ดอกไม้ AI ขยับตามจังหวะพูด
      try {
        p.setAudioSamplingEnabled(true);
        p.addListener('audioSampleUpdate', (sm) => {
          level.value = withTiming(rmsLevel(sm.channels[0]?.frames), { duration: 90 });
        });
      } catch {}
      p.addListener('playbackStatusUpdate', (s) => {
        if (s.didJustFinish) {
          setSpeaking(false);
          level.value = 0;
        }
      });
      p.play();
    } catch {
      if (my === gen.current && alive.current) setSpeaking(false);
    }
  };

  return { speak, stop, speaking, level };
}
