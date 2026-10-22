import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { createSpeech, type SpeechCtl } from './speech';

export { useVoiceRecorder } from './recorder';
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
