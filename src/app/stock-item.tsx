/** เพิ่ม/แก้ไขยาในคลัง — ชื่อยา รูปแบบ จำนวน วันที่ปรุง และอายุยา (คำนวณวันหมดอายุให้) */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { TextInput } from '../components/AppText';
import { DateField } from '../components/FormPickers';
import { Sym, ios } from '../components/ios';
import { Button, GlassDock, PressableScale, T, useHaptic } from '../components/ui';
import { Alert } from '../lib/alert';
import { cancelReminder, thShort } from '../lib/reminders';
import { FORMS, UNITS, remindExpiry, useStock, type StockItem } from '../lib/stock';
import { elevation, palette } from '../theme';

const LIFE = [
  { m: 1, label: '1 เดือน' },
  { m: 3, label: '3 เดือน' },
  { m: 6, label: '6 เดือน' },
  { m: 12, label: '1 ปี' },
  { m: 0, label: 'ไม่ระบุ' },
];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addMonths = (d: Date, m: number) => new Date(d.getFullYear(), d.getMonth() + m, d.getDate());

export default function StockItemPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [items, setItems] = useStock();
  const h = useHaptic();
  const cur = items.find((x) => x.id === id);
  const [name, setName] = useState(cur?.name ?? '');
  const [form, setForm] = useState(cur?.form ?? FORMS[0]);
  const [qty, setQty] = useState(String(cur?.qty ?? 1));
  const [unit, setUnit] = useState(cur?.unit ?? UNITS[0]);
  const [lowAt, setLowAt] = useState(cur?.lowAt != null ? String(cur.lowAt) : '');
  const [made, setMade] = useState<Date>(cur ? fromIso(cur.madeOn) : new Date());
  // อายุยา: แก้ไขยาเดิม → คงวันหมดอายุเดิมไว้จนกว่าจะเลือกใหม่
  const [life, setLife] = useState<number | null>(cur ? null : 6);
  const [note, setNote] = useState(cur?.note ?? '');
  const expiresOn = life === null ? cur?.expiresOn : life ? iso(addMonths(made, life)) : undefined;
  const can = !!name.trim() && Number(qty) >= 0;

  const save = () => {
    if (!can) return;
    const item: StockItem = {
      id: cur?.id ?? `s${Date.now()}`,
      name: name.trim(),
      form,
      qty: Math.max(0, Math.round(Number(qty) || 0)),
      unit,
      lowAt: lowAt.trim() ? Math.max(0, Number(lowAt) || 0) : undefined,
      madeOn: iso(made),
      expiresOn,
      note: note.trim() || undefined,
    };
    setItems(cur ? items.map((x) => (x.id === cur.id ? item : x)) : [item, ...items]);
    remindExpiry(item).catch(() => {});
    h.success();
    router.back();
  };
  const remove = () =>
    Alert.alert(`ลบ ${cur?.name}?`, 'ลบออกจากคลังยา', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: () => {
          setItems(items.filter((x) => x.id !== cur?.id));
          cancelReminder(`exp-${cur?.id}`).catch(() => {});
          router.back();
        },
      },
    ]);

  const Chips = ({ list, value, onPick }: { list: { k: string | number; label: string }[]; value: string | number | null; onPick: (k: any) => void }) => (
    <View style={styles.chips}>
      {list.map((x) => {
        const on = value === x.k;
        return (
          <PressableScale key={String(x.k)} haptic="select" scaleTo={0.95} onPress={() => onPick(x.k)} style={[styles.chip, on && styles.chipOn]} accessibilityState={{ selected: on }}>
            <T v="subhead" color={on ? '#FFFFFF' : palette.ink} style={{ fontWeight: '600' }}>{x.label}</T>
          </PressableScale>
        );
      })}
    </View>
  );
  const Label = ({ t }: { t: string }) => <T v="subhead" color={ios.secondary} style={styles.label}>{t}</T>;

  return (
    <>
      <Stack.Screen options={{ title: cur ? 'แก้ไขยา' : 'เพิ่มยาในคลัง' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
          <View style={[styles.card, elevation.e1]}>
            <View>
              <Label t="ชื่อยา" />
              <TextInput value={name} onChangeText={setName} placeholder="เช่น ยาประสะไพล ยาเถาวัลย์เปรียง" placeholderTextColor={ios.tertiary} style={styles.input} accessibilityLabel="ชื่อยา" />
            </View>
            <View>
              <Label t="รูปแบบยา" />
              <Chips list={FORMS.map((k) => ({ k, label: k }))} value={form} onPick={setForm} />
            </View>
          </View>
          <View style={[styles.card, elevation.e1]}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Label t="จำนวนคงเหลือ" />
                <TextInput value={qty} onChangeText={(v) => setQty(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={styles.input} accessibilityLabel="จำนวนคงเหลือ" />
              </View>
              <View style={{ flex: 1 }}>
                <Label t="เตือนเมื่อเหลือ" />
                <TextInput value={lowAt} onChangeText={(v) => setLowAt(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="ไม่เตือน" placeholderTextColor={ios.tertiary} style={styles.input} accessibilityLabel="เตือนเมื่อเหลือ" />
              </View>
            </View>
            <View>
              <Label t="หน่วย" />
              <Chips list={UNITS.map((k) => ({ k, label: k }))} value={unit} onPick={setUnit} />
            </View>
          </View>
          <View style={[styles.card, elevation.e1]}>
            <DateField label="วันที่ปรุงยา" value={made} onChange={setMade} />
            <View>
              <Label t="ยาเก็บได้นาน" />
              <Chips list={LIFE.map((x) => ({ k: x.m, label: x.label }))} value={life} onPick={setLife} />
              <T v="caption" color={ios.tertiary} style={{ marginTop: 6, marginLeft: 4 }}>
                {expiresOn ? `หมดอายุ ${thShort(expiresOn)} · แอปเตือนก่อน 7 วัน` : 'ไม่ระบุวันหมดอายุ'}
              </T>
            </View>
            <View>
              <Label t="หมายเหตุ (ถ้ามี)" />
              <TextInput value={note} onChangeText={setNote} placeholder="เช่น ใช้แก้ปวดเมื่อย ครั้งละ 3 ลูก" placeholderTextColor={ios.tertiary} style={[styles.input, { height: 76, borderRadius: 22, paddingTop: 14, textAlignVertical: 'top' }]} multiline accessibilityLabel="หมายเหตุ" />
            </View>
          </View>
          {cur ? (
            <PressableScale haptic="select" onPress={remove} style={{ alignSelf: 'center', padding: 10 }} accessibilityLabel="ลบยานี้">
              <T v="body" color={palette.coral} style={{ fontWeight: '600' }}>ลบยานี้</T>
            </PressableScale>
          ) : null}
        </ScrollView>
        <GlassDock>
          <Button label="บันทึก" icon={<Sym name="checkmark" size={17} color="#FFFFFF" weight="bold" />} disabled={!can} onPress={save} style={{ flex: 1, height: 52 }} />
        </GlassDock>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 140, gap: 14 },
  card: { padding: 16, borderRadius: 22, backgroundColor: palette.surface, gap: 14 },
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  input: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: palette.primary },
});
