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

// iOS Safari ปลดล็อกเสียงเฉพาะตอนปล่อยนิ้ว (touchend/click) ไม่ใช่ตอนเริ่มแตะ — และ context กลับไป
// suspended/interrupted ได้เมื่อสลับแอป/ล็อกจอ → ลองใหม่ทุกครั้งที่ผู้ใช้แตะจนกว่าจะทำงาน
if (typeof document !== 'undefined') {
  const unlock = () => {
    const ac = audioCtx();
    if (ac.state === 'running') return;
    ac.resume().catch(() => {});
    // เล่นบัฟเฟอร์เงียบ 1 ครั้งระหว่างแตะ เพื่อเปิดเส้นทางเสียง
    const b = ac.createBufferSource();
    b.buffer = ac.createBuffer(1, 1, 22050);
    b.connect(ac.destination);
    b.start();
  };
  for (const ev of ['touchend', 'click', 'pointerup', 'keydown']) document.addEventListener(ev, unlock, true);
}
