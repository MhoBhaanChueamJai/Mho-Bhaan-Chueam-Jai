/**
 * AudioContext ตัวเดียวทั้งแอป (ใช้เฉพาะบนเว็บ: อัดเสียง + เล่นเสียงครูปัญญา)
 * Safari/Chrome ยอมให้เล่นเสียงเมื่อ context ถูก resume ระหว่างผู้ใช้แตะ → ปลดล็อกตั้งแต่แตะครั้งแรก
 * แล้วเสียงที่เล่นภายหลัง (หลัง AI คิดเสร็จ) จะไม่ถูกบล็อกแบบ <audio> ที่สร้างใหม่
 */
let ctx: AudioContext | null = null;

export function audioCtx(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    ctx = new AC() as AudioContext;
  }
  return ctx;
}

if (typeof document !== 'undefined') {
  const unlock = () => {
    const ac = audioCtx();
    ac.resume().catch(() => {});
    // iOS: เล่นบัฟเฟอร์เงียบ 1 ครั้งระหว่างแตะ เพื่อเปิดเส้นทางเสียง
    const b = ac.createBufferSource();
    b.buffer = ac.createBuffer(1, 1, 22050);
    b.connect(ac.destination);
    b.start();
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('touchend', unlock, true);
  };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('touchend', unlock, true);
}
