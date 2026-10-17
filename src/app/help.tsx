/**
 * ช่วยเหลือ · วิธีใช้งานแอป — หัวข้อตามเมนูของแอป แตะเพื่อกางดูขั้นตอน
 * ยังสงสัย → ถามครูปัญญา (เปิดแชทพร้อมคำถาม)
 */
import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { CircleIcon, PAGE_PAD } from '../components/ListRow';
import { Sym, ios } from '../components/ios';
import { PressableScale, T } from '../components/ui';
import { elevation, palette } from '../theme';

type Topic = { id: string; title: string; icon: string; color: string; steps: string[] };

const TOPICS: Topic[] = [
  {
    id: 'start',
    title: 'เริ่มต้นใช้งาน',
    icon: 'sparkles',
    color: palette.primary,
    steps: [
      'สมัครบัญชีด้วยอีเมล หรือกด "ทดลองใช้" เพื่อลองใช้แอปก่อน (ข้อมูลในโหมดทดลองเก็บในเครื่องเท่านั้น)',
      'ตั้งรหัส PIN หรือ Face ID ไว้ปลดล็อกแอป เพื่อป้องกันข้อมูลผู้ป่วย (ตั้งค่า → ความปลอดภัย)',
      'ยืนยันตัวตนหมอพื้นบ้านด้วยเลขที่หนังสือรับรอง เพื่อใช้งานการรักษาผู้ป่วย (ตั้งค่า → ยืนยันตัวตนหมอพื้นบ้าน)',
    ],
  },
  {
    id: 'patient',
    title: 'ผู้ป่วยและการรักษา',
    icon: 'person.2.fill',
    color: '#3B7DD8',
    steps: [
      'เพิ่มผู้ป่วย: แท็บผู้ป่วย → ปุ่ม + กรอกเอง หรือให้ครูปัญญาซักประวัติด้วยเสียง หรือสแกนบัตรประชาชน',
      'บันทึกการรักษา: เปิดผู้ป่วย → ปุ่ม + มุมขวาบน → เลือก "ให้ครูปัญญาบันทึก" (เล่าด้วยเสียง) หรือ "กรอกเอง"',
      'หน้าแรก → เล่าอาการ: เลือกผู้ป่วยแล้วเล่าอาการให้ครูปัญญาฟังได้ทันที',
      'บัตรผู้ป่วย: แตะบัตรเพื่อพลิกดูธาตุเจ้าเรือน รสยาที่เหมาะ และข้อควรระวัง · ปุ่มโทรอยู่บนบัตร',
      'ส่งออกทะเบียนการรักษา หรือลบผู้ป่วย: ปุ่ม ••• มุมขวาบนของหน้าผู้ป่วย',
    ],
  },
  {
    id: 'ai',
    title: 'ครูปัญญา (ผู้ช่วย AI)',
    icon: 'bubble.left.and.text.bubble.right.fill',
    color: '#7A5CC8',
    steps: [
      'ถามได้ทั้งพิมพ์และพูด เรื่องสมุนไพร การตั้งตำรับ-ผสมยา ธาตุเจ้าเรือน และความปลอดภัยของยา',
      'คุยด้วยเสียง: กดปุ่มคลื่นเสียง แล้วพูดต่อเนื่องได้เลย · แตะลูกแก้วเพื่อส่ง หรือขัดจังหวะตอนครูปัญญาพูด',
      'ประวัติแชท / เริ่มแชทใหม่: ปุ่มบนแถบด้านบนของหน้าครูปัญญา · กดค้างที่แชทเพื่อลบ',
      'ใต้คำตอบมีตำราหรือสมุนไพรที่ใช้อ้างอิง แตะเพื่อเปิดดูได้',
      'เปลี่ยนภาษาถิ่น (อีสาน เหนือ ใต้) และเปิด/ปิดการพูดคำตอบ: ตั้งค่า → ตั้งค่า AI',
    ],
  },
  {
    id: 'vault',
    title: 'คลังภูมิปัญญา',
    icon: 'books.vertical.fill',
    color: '#C2564B',
    steps: [
      'เพิ่มภูมิปัญญา: แท็บคลังภูมิ → ปุ่ม + → เล่าให้ครูปัญญาฟัง / เขียนเอง / สแกนตำราโบราณ',
      'เล่าให้ครูปัญญาฟัง: เล่าต่อเนื่องเหมือนเล่าให้ลูกหลานฟัง ครูปัญญาเก็บเสียงไว้และเรียบเรียงเป็นหนังสือให้',
      'เขียนเอง: เขียนเสร็จกด "ให้ครูปัญญาจัดหน้า" แล้วตรวจทานก่อนบันทึก',
      'อ่านแบบหนังสือ: เปิดตำรา → ไอคอนหนังสือมุมขวาบน · ปัดเพื่อพลิกหน้า',
      'แชร์ตำราให้เพื่อน: เมนู ••• → แชร์ให้เพื่อน (คิวอาร์โค้ด/รหัส) · รับตำรา: ไอคอนสแกนในแท็บคลังภูมิ',
    ],
  },
  {
    id: 'herb',
    title: 'สมุนไพร',
    icon: 'leaf.fill',
    color: '#4E9A3E',
    steps: [
      'ค้นหาหรือกรองตามรสยา ดูสรรพคุณ วิธีใช้ และข้อควรระวังของสมุนไพร 100 ชนิด',
      'สแกนหาสมุนไพร: ส่องกล้องที่ใบหรือเหง้า ครูปัญญาบอกชื่อและสรรพคุณ',
      'ส่วนประกอบของต้น: แตะป้ายบนภาพเพื่อดูแต่ละส่วนและส่วนที่ใช้เป็นยา',
      'แนะนำวันนี้: สมุนไพรตามสภาพอากาศในพื้นที่ ปัดการ์ดเพื่อดูตัวถัดไป',
    ],
  },
  {
    id: 'data',
    title: 'ข้อมูลและบัญชี',
    icon: 'icloud.fill',
    color: '#2A8C7A',
    steps: [
      'ข้อมูลซิงก์ขึ้นคลาวด์อัตโนมัติ ดูสถานะหรือซิงก์ทันทีได้ที่ ตั้งค่า → ซิงก์ข้อมูล',
      'ออกจากระบบแล้วข้อมูลยังอยู่บนคลาวด์ เข้าสู่ระบบใหม่ก็ใช้งานต่อได้',
      'แก้ไขชื่อ เปลี่ยนรหัสผ่าน หรือลบบัญชี: ตั้งค่า → บัญชี',
      'ลบบัญชีแล้ว ข้อมูลผู้ป่วย ตำรา และเสียงเล่าทั้งหมดถูกลบถาวร กู้คืนไม่ได้',
    ],
  },
];

export default function Help() {
  const [open, setOpen] = useState<string | null>('start');
  return (
    <>
      <Stack.Screen options={{ title: 'ช่วยเหลือ' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <T v="callout" color={ios.secondary} style={{ marginHorizontal: 4, marginBottom: 4 }}>แตะหัวข้อเพื่อดูวิธีใช้งาน</T>
        {TOPICS.map((t) => {
          const on = open === t.id;
          return (
            <Animated.View key={t.id} layout={LinearTransition.duration(240)} style={[styles.card, elevation.e1]}>
              <PressableScale haptic="select" scaleTo={0.99} onPress={() => setOpen(on ? null : t.id)} style={styles.head} accessibilityLabel={t.title} accessibilityState={{ expanded: on }}>
                <CircleIcon name={t.icon} color={t.color} />
                <T v="title" style={{ flex: 1 }}>{t.title}</T>
                <Sym name={on ? 'chevron.up' : 'chevron.down'} size={13} color={ios.tertiary} weight="semibold" />
              </PressableScale>
              {on ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.steps}>
                  {t.steps.map((s, i) => (
                    <View key={i} style={styles.step}>
                      <View style={[styles.num, { backgroundColor: `${t.color}1F` }]}>
                        <T v="caption" color={t.color} style={{ fontWeight: '700' }}>{i + 1}</T>
                      </View>
                      <T v="subhead" style={{ flex: 1, lineHeight: 22 }}>{s}</T>
                    </View>
                  ))}
                </Animated.View>
              ) : null}
            </Animated.View>
          );
        })}

        {/* ยังสงสัย → ถามครูปัญญา */}
        <PressableScale haptic="press" scaleTo={0.98} onPress={() => router.push({ pathname: '/assistant', params: { q: 'ช่วยสอนวิธีใช้แอปหมอบ้านเชื่อมใจหน่อย' } })} style={[styles.ask, elevation.e1]} accessibilityLabel="ถามครูปัญญาเรื่องการใช้งาน">
          <CircleIcon name="sparkles" color={palette.primary} />
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">ยังสงสัยอยู่ใช่ไหม</T>
            <T v="subhead" color={ios.secondary}>ถามครูปัญญาเรื่องการใช้งานได้เลย</T>
          </View>
          <Sym name="chevron.right" size={13} color={ios.tertiary} weight="semibold" />
        </PressableScale>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 64, gap: 12 },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  steps: { gap: 12, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 2 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  ask: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginTop: 8, borderRadius: 22, borderCurve: 'continuous', backgroundColor: palette.surface },
});
