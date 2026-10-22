/**
 * เกี่ยวกับแอป — ชื่อ เวอร์ชัน แหล่งข้อมูลอ้างอิง และข้อควรทราบ
 */
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Stack, router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CircleIcon, ListRow, ListSection, PAGE_PAD } from '../components/ListRow';
import { ios } from '../components/ios';
import { T } from '../components/ui';
import { palette } from '../theme';
import { openManual } from '../lib/manual';
import { column } from '../components/layout';

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const APP_BUILD = Constants.expoConfig?.ios?.buildNumber ?? '1';

export default function About() {
  return (
    <>
      <Stack.Screen options={{ title: 'เกี่ยวกับแอป' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[{ paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 64 }, column.read]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={require('../../assets/icon.png')} style={styles.icon} contentFit="cover" />
          <T v="h2" center style={{ marginTop: 12 }}>หมอบ้านเชื่อมใจ</T>
          <T v="subhead" color={ios.secondary} center>เวอร์ชัน {APP_VERSION} ({APP_BUILD})</T>
          <T v="callout" color={ios.secondary} center style={{ marginTop: 10, maxWidth: 320 }}>
            ผู้ช่วยสุขภาพแผนไทยสำหรับแพทย์และประชาชน บันทึกการรักษา เก็บภูมิปัญญาไว้ให้ลูกหลาน และมีครูปัญญาช่วยคิด
          </T>
        </View>

        <ListSection i={1} title="ข้อมูลแอป">
          <ListRow icon={<CircleIcon name="info.circle.fill" color="#3B7DD8" />} title="เวอร์ชัน" value={`${APP_VERSION} (${APP_BUILD})`} />
          <ListRow icon={<CircleIcon name="questionmark.circle.fill" color={palette.primary} />} title="ช่วยเหลือ · วิธีใช้งาน" onPress={openManual} chevron />
          <ListRow icon={<CircleIcon name="hand.raised.fill" color="#7A5CC8" />} title="นโยบายความเป็นส่วนตัว" onPress={() => router.push('/privacy')} chevron last />
        </ListSection>

        <ListSection i={2} title="แหล่งข้อมูลอ้างอิง" footer="ข้อมูลสมุนไพรและตำรับยาเรียบเรียงจากแหล่งทางการ ใช้ประกอบการตัดสินใจของหมอเท่านั้น">
          <ListRow icon={<CircleIcon name="building.columns.fill" color="#8A6A44" />} title="บัญชียาหลักแห่งชาติด้านสมุนไพร พ.ศ. 2566" titleLines={2} />
          <ListRow icon={<CircleIcon name="cross.case.fill" color="#C2564B" />} title="กรมการแพทย์แผนไทยและการแพทย์ทางเลือก" titleLines={2} />
          <ListRow icon={<CircleIcon name="checkmark.seal.fill" color="#0E7C86" />} title="ตำรามาตรฐานยาสมุนไพรไทย (THP) กรมวิทยาศาสตร์การแพทย์" titleLines={2} />
          <ListRow icon={<CircleIcon name="pills.fill" color="#D9534A" />} title="ประกาศกระทรวงสาธารณสุข เรื่อง ยาสามัญประจำบ้าน (แผนปัจจุบัน พ.ศ. 2568 · แผนโบราณ)" titleLines={3} />
          <ListRow icon={<CircleIcon name="leaf.fill" color="#4E9A3E" />} title="ศูนย์ข้อมูลสมุนไพร คณะเภสัชศาสตร์ มหาวิทยาลัยมหิดล" titleLines={2} />
          <ListRow icon={<CircleIcon name="books.vertical.fill" color={palette.primary} />} title="ดูและดาวน์โหลดคลังความรู้อ้างอิงทั้งหมด" titleLines={2} onPress={() => router.push('/knowledge')} chevron last />
        </ListSection>

        <T v="caption" color={ios.secondary} center style={{ marginTop: 28, lineHeight: 18 }}>
          คำแนะนำจากครูปัญญาเป็นข้อมูลเบื้องต้น ไม่ใช่การวินิจฉัยแทนแพทย์{'\n'}อาการรุนแรงหรือฉุกเฉิน ส่งต่อโรงพยาบาลทันที
        </T>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 16 },
  icon: { width: 96, height: 96, borderRadius: 22, borderCurve: 'continuous' },
});
