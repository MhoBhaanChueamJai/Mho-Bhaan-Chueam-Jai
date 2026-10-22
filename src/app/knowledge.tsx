/**
 * คลังความรู้อ้างอิงของครูปัญญา — ตำราทางการที่ AI ใช้ตอบและอ้างอิง
 * ไม่มีพารามิเตอร์: รายการเล่ม · ?book=<key>: หัวข้อในเล่ม · ดาวน์โหลดเป็น PDF ได้ทั้งคลัง / ทั้งเล่ม
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CircleIcon, ListRow, ListSection, PAGE_PAD } from '../components/ListRow';
import { Sym, ios } from '../components/ios';
import { column } from '../components/layout';
import { Button, HeaderButton, T } from '../components/ui';
import { Alert } from '../lib/alert';
import { allBooksPdf, bookPdf } from '../lib/knowledgePdf';
import { BOOKS, bookOf, citeLabel, docsOf, type BookKey } from '../lib/sources';
import { palette } from '../theme';

function useDownload() {
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await f();
    } catch {
      Alert.alert('ดาวน์โหลดไม่สำเร็จ', 'ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export default function Knowledge() {
  const { book } = useLocalSearchParams<{ book?: BookKey }>();
  const dl = useDownload();
  const b = book && BOOKS.some((x) => x.k === book) ? bookOf(book) : null;

  if (b) {
    const docs = docsOf(b.k);
    return (
      <>
        <Stack.Screen
          options={{
            title: b.short,
            headerRight: () => (
              <HeaderButton label="ดาวน์โหลดเล่มนี้" onPress={() => dl.run(() => bookPdf(b.k))}>
                <Sym name="arrow.down.doc" size={19} color={palette.ink} weight="semibold" />
              </HeaderButton>
            ),
          }}
        />
        <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[{ paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 64 }, column.read]}>
          <View style={styles.hero}>
            <CircleIcon name={b.icon} color={b.color} size={52} />
            <T v="h3" center style={{ marginTop: 10 }}>{b.title}</T>
            <T v="subhead" color={ios.secondary} center>{b.desc}</T>
          </View>
          <ListSection i={1} title={`${docs.length} หัวข้อ`}>
            {docs.map((d, i) => (
              <ListRow key={d.id} title={d.title} titleLines={2} subtitle={d.sub ?? citeLabel(d)} onPress={() => router.push({ pathname: '/source', params: { id: d.id } })} chevron last={i === docs.length - 1} />
            ))}
          </ListSection>
          <ListSection i={2} title="แหล่งอ้างอิง">
            {b.refs.map((r, i) => (
              <ListRow key={i} title={r.title} titleLines={4} subtitle={r.url} last={i === b.refs.length - 1} />
            ))}
          </ListSection>
          <Button label={dl.busy ? 'กำลังสร้างเอกสาร…' : 'ดาวน์โหลดเล่มนี้'} icon={<Sym name="arrow.down.doc.fill" size={16} color="#FFFFFF" />} disabled={dl.busy} onPress={() => dl.run(() => bookPdf(b.k))} style={{ marginTop: 20, height: 50 }} />
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'คลังความรู้อ้างอิง' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: palette.bg }} contentContainerStyle={[{ paddingHorizontal: PAGE_PAD, paddingTop: 8, paddingBottom: 64 }, column.read]}>
        <T v="callout" color={ios.secondary} style={{ marginHorizontal: 4, marginBottom: 4 }}>
          ตำราทางการที่ครูปัญญาใช้ค้นและอ้างอิงทุกคำแนะนำ แตะเพื่ออ่าน หรือดาวน์โหลดเป็นเอกสาร
        </T>
        <ListSection i={1} title="ตำราในคลัง">
          {BOOKS.map((x, i) => (
            <ListRow key={x.k} icon={<CircleIcon name={x.icon} color={x.color} />} title={x.short} titleLines={2} subtitle={`${docsOf(x.k).length} หัวข้อ · ${x.desc}`} onPress={() => router.push({ pathname: '/knowledge', params: { book: x.k } })} chevron last={i === BOOKS.length - 1} />
          ))}
        </ListSection>
        <Button label={dl.busy ? 'กำลังสร้างเอกสาร…' : 'ดาวน์โหลดทั้งคลัง'} icon={<Sym name="arrow.down.doc.fill" size={16} color="#FFFFFF" />} disabled={dl.busy} onPress={() => dl.run(allBooksPdf)} style={{ marginTop: 20, height: 50 }} />
        <T v="caption" color={ios.tertiary} center style={{ marginTop: 8 }}>ใช้เพื่อการศึกษาและประกอบการดูแลสุขภาพ ไม่แทนการตรวจวินิจฉัยของแพทย์</T>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 4, paddingHorizontal: 12, marginTop: 8 },
});
