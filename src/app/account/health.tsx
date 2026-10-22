/**
 * ข้อมูลสุขภาพของฉัน — วันเกิด อายุ เพศ น้ำหนัก ส่วนสูง → ธาตุเจ้าเรือน และ BMI
 * เก็บในเครื่องนี้ · ครูปัญญาใช้ประกอบคำแนะนำเมื่อถามเรื่องตัวเอง
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput } from '../../components/AppText';
import { ElementInsight, ElementPicker } from '../../components/ElementPicker';
import { DateField } from '../../components/FormPickers';
import { FormSheet } from '../../components/FormSheet';
import { Sym, ios } from '../../components/ios';
import { PressableScale, T, useHaptic } from '../../components/ui';
import type { Patient } from '../../data/mock';
import { ageFrom, elementFromMonth } from '../../lib/birth';
import { bmiLabel, myBmi, type MyHealth } from '../../lib/me';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

const num = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function Field({ label, value, onChange, placeholder, flex }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; flex?: number }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ flex }}>
      <T v="subhead" color={ios.secondary} style={styles.label}>{label}</T>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={ios.tertiary}
        keyboardType="decimal-pad"
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[styles.input, focus && styles.inputFocus]}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function MyHealthSheet() {
  const { settings, update } = useApp();
  const h = useHaptic();
  const me = settings.me ?? {};
  const [birth, setBirth] = useState(me.birth);
  const [age, setAge] = useState(me.age ? String(me.age) : '');
  const [sex, setSex] = useState(me.sex);
  const [weight, setWeight] = useState(me.weight ? String(me.weight) : '');
  const [height, setHeight] = useState(me.height ? String(me.height) : '');
  // ธาตุ: มีวันเกิด → คำนวณให้ (เลือกเองทับได้) · ไม่มี → เลือกเอง
  const [picked, setPicked] = useState<Patient['element'] | undefined>(me.element);
  const element = picked ?? (birth ? elementFromMonth(Number(birth.slice(5, 7))) : undefined);
  const ageNow = birth ? ageFrom(birth) : num(age);

  const next: MyHealth = { birth, age: birth ? undefined : num(age), sex, weight: num(weight), height: num(height), element: picked };
  const changed = JSON.stringify(next) !== JSON.stringify({ birth: me.birth, age: me.birth ? undefined : me.age, sex: me.sex, weight: me.weight, height: me.height, element: me.element });
  const bmi = myBmi(next);

  const save = () => {
    update({ me: next });
    h.success();
    router.back();
  };

  return (
    <FormSheet title="ข้อมูลสุขภาพของฉัน" canSave={changed} onSave={save}>
      <View style={styles.note}>
        <Sym name="sparkles" size={14} color={palette.primary} />
        <T v="subhead" color={palette.primaryDeep} style={{ flex: 1 }}>ครูปัญญาใช้ข้อมูลนี้เวลาคุณถามเรื่องตัวเอง เช่น ธาตุเจ้าเรือนกับรสยาที่เหมาะ · เก็บไว้ในเครื่องนี้เท่านั้น</T>
      </View>

      <View style={[styles.card, elevation.e1]}>
        <View style={styles.row}>
          <DateField
            label="วันเดือนปีเกิด"
            value={birth ? new Date(birth + 'T00:00:00') : null}
            onChange={(d) => setBirth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)}
            fallback={new Date(1990, 0, 1)}
            flex={2.2}
          />
          {birth ? (
            <View style={{ flex: 1.1 }}>
              <T v="subhead" color={ios.secondary} style={styles.label}>อายุ</T>
              <View style={[styles.input, { justifyContent: 'center' }]}>
                <T v="body">{ageNow} ปี</T>
              </View>
            </View>
          ) : (
            <Field label="อายุ (ปี)" value={age} onChange={setAge} placeholder="เช่น 45" flex={1.1} />
          )}
        </View>

        <View>
          <T v="subhead" color={ios.secondary} style={styles.label}>เพศ</T>
          <View style={styles.row}>
            {(['หญิง', 'ชาย'] as const).map((s) => (
              <PressableScale key={s} haptic="select" scaleTo={0.96} onPress={() => setSex(sex === s ? undefined : s)} accessibilityState={{ selected: sex === s }} accessibilityLabel={`เพศ${s}`} style={[styles.seg, sex === s && styles.segOn]}>
                <T v="bodyStrong" color={sex === s ? '#FFFFFF' : palette.ink}>{s}</T>
              </PressableScale>
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <Field label="น้ำหนัก (กก.)" value={weight} onChange={setWeight} placeholder="เช่น 60" flex={1} />
          <Field label="ส่วนสูง (ซม.)" value={height} onChange={setHeight} placeholder="เช่น 160" flex={1} />
        </View>
        {bmi ? (
          <T v="subhead" color={ios.secondary} style={{ marginLeft: 4 }}>
            BMI {bmi.toFixed(1)} · {bmiLabel(bmi)}
          </T>
        ) : null}
      </View>

      <View style={[styles.card, elevation.e1]}>
        <T v="h3">ธาตุเจ้าเรือน</T>
        <T v="subhead" color={birth && !picked ? palette.primaryDeep : ios.secondary}>
          {birth ? (picked ? `เลือกเอง: ธาตุ${picked}` : `ครูปัญญาวิเคราะห์จากเดือนเกิด: ธาตุ${element}`) : 'ใส่วันเกิดให้ครูปัญญาวิเคราะห์ หรือเลือกเอง'}
        </T>
        <ElementPicker value={element ?? null} onChange={setPicked} />
        {element ? <ElementInsight el={element} age={ageNow} /> : null}
      </View>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16, gap: 14 },
  row: { flexDirection: 'row', gap: 10 },
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  input: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink, borderWidth: 1.5, borderColor: 'transparent' },
  inputFocus: { backgroundColor: palette.surface, borderColor: palette.primary },
  seg: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.mint },
  segOn: { backgroundColor: palette.primary },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: palette.primarySoft },
});
