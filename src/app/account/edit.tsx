/**
 * แก้ไขข้อมูลส่วนตัว — ชื่อ นามสกุล (อีเมลแสดงอย่างเดียว · ข้อมูลการรับรองหมอพื้นบ้านแก้ไม่ได้)
 */
import { Stack, router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Sym, ios } from '../../components/ios';
import { Button, GlassDock, T, useHaptic } from '../../components/ui';
import { updateName } from '../../lib/account';
import { useApp } from '../../store/app';
import { elevation, palette } from '../../theme';

function Field({ label, value, onChange, editable = true }: { label: string; value: string; onChange?: (v: string) => void; editable?: boolean }) {
  const [focus, setFocus] = useState(false);
  return (
    <View>
      <T v="subhead" color={ios.secondary} style={styles.label}>{label}</T>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        placeholder={label}
        placeholderTextColor={ios.tertiary}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[styles.input, focus && styles.inputFocus, !editable && { color: ios.secondary }]}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function EditAccount() {
  const { profile, demo, reloadCloud } = useApp();
  const h = useHaptic();
  const [first, setFirst] = useState(profile?.first_name ?? profile?.display_name?.split(' ')[0] ?? '');
  const [last, setLast] = useState(profile?.last_name ?? profile?.display_name?.split(' ').slice(1).join(' ') ?? '');
  const [busy, setBusy] = useState(false);
  const changed = first.trim() !== (profile?.first_name ?? '') || last.trim() !== (profile?.last_name ?? '');
  const can = !!first.trim() && !!last.trim() && changed && !busy && !demo;

  const save = async () => {
    if (!can) return;
    setBusy(true);
    try {
      await updateName(first.trim(), last.trim());
      await reloadCloud();
      h.success();
      router.back();
    } catch (e: any) {
      h.warn();
      Alert.alert('บันทึกไม่สำเร็จ', e?.message ? String(e.message) : 'ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ title: 'แก้ไขข้อมูลส่วนตัว' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {demo ? (
          <View style={styles.note}>
            <Sym name="info.circle.fill" size={15} color="#B26A12" />
            <T v="subhead" color="#8A5A26" style={{ flex: 1 }}>บัญชีทดลองใช้แก้ไขข้อมูลไม่ได้ สมัครบัญชีของคุณเองเพื่อใช้งานเต็มรูปแบบ</T>
          </View>
        ) : null}
        <View style={[styles.card, elevation.e1]}>
          <Field label="ชื่อ" value={first} onChange={setFirst} editable={!demo} />
          <Field label="นามสกุล" value={last} onChange={setLast} editable={!demo} />
          <Field label="อีเมล" value={profile?.email ?? '-'} editable={false} />
        </View>
        <T v="caption" color={ios.secondary} style={{ marginHorizontal: 6 }}>
          ข้อมูลการรับรองหมอพื้นบ้าน (ประเภท เลขที่หนังสือรับรอง) มาจากทะเบียนของกรมการแพทย์แผนไทยฯ แก้ไขในแอปไม่ได้
        </T>
      </ScrollView>
      <GlassDock>
        <Button label={busy ? 'กำลังบันทึก…' : 'บันทึก'} disabled={!can} onPress={save} style={{ flex: 1, height: 52 }} />
      </GlassDock>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 130, gap: 14 },
  card: { backgroundColor: palette.surface, borderRadius: 22, borderCurve: 'continuous', padding: 16, gap: 14 },
  label: { marginBottom: 6, marginLeft: 4, fontWeight: '600' },
  input: { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: palette.mint, fontSize: 17, color: palette.ink, borderWidth: 1.5, borderColor: 'transparent' },
  inputFocus: { backgroundColor: palette.surface, borderColor: palette.primary },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: '#FBF1E2' },
});
