import { AudioModule, AudioQuality, IOSOutputFormat, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, type RecordingOptions } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { createSpeech, type SpeechCtl } from './speech';

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

export { rmsLevel } from './speech';

/** พูดข้อความด้วยเสียงครูปัญญา — แบ่งเป็นช่วงประโยค เตรียมช่วงถัดไปล่วงหน้า พูดได้ยาวจนจบ */
export function useSpeaker() {
  const level = useSharedValue(0);
  const [speaking, setSpeaking] = useState(false);
  const alive = useRef(true);
  const ctl = useRef<SpeechCtl | null>(null);
  if (!ctl.current) ctl.current = createSpeech(level, (on) => alive.current && setSpeaking(on));
  useEffect(
    () => () => {
      alive.current = false;
      ctl.current?.stop();
    },
    [],
  );
  const speak = useCallback((text: string) => ctl.current!.speak(text), []);
  const stop = useCallback(() => ctl.current!.stop(), []);
  return { speak, stop, speaking, level };
}
