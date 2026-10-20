/** ค่าสุขภาพของผู้ป่วยตามครั้งที่รักษา — ค่าล่าสุด + การประเมินตามแนวทางเวชปฏิบัติ + กราฟเส้นย้อนหลัง */
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import type { Patient } from "../data/mock";
import { LEVEL, SRC, assess, vitalsOf, type Vitals } from "../lib/vitals";
import { elevation, palette } from "../theme";
import { Sym, ios } from "./ios";
import { T } from "./ui";

type Pt = { no: number; date: string; v: Vitals };

/** กราฟเส้นเล็ก (หลายเส้นได้) + เส้นเกณฑ์ */
function Spark({
  pts,
  keys,
  colors,
  limit,
  h = 72,
}: {
  pts: Pt[];
  keys: (keyof Vitals)[];
  colors: string[];
  limit?: number;
  h?: number;
}) {
  const vals = pts.flatMap((p) =>
    keys.map((k) => p.v[k]).filter((x): x is number => x != null),
  );
  const lo = Math.min(...vals, limit ?? Infinity) - 5;
  const hi = Math.max(...vals, limit ?? -Infinity) + 5;
  const W = 300;
  const x = (i: number) =>
    pts.length === 1 ? W / 2 : 8 + (i * (W - 16)) / (pts.length - 1);
  const y = (v: number) => h - 6 - ((v - lo) / (hi - lo || 1)) * (h - 12);
  return (
    <Svg
      width="100%"
      height={h}
      viewBox={`0 0 ${W} ${h}`}
      preserveAspectRatio="none"
    >
      {limit != null ? (
        <Line
          x1={0}
          x2={W}
          y1={y(limit)}
          y2={y(limit)}
          stroke="#D2453A"
          strokeOpacity={0.45}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      ) : null}
      {keys.map((k, ki) => {
        const ps = pts
          .map((p, i) => (p.v[k] != null ? `${x(i)},${y(p.v[k]!)}` : ""))
          .filter(Boolean);
        return (
          <React.Fragment key={k}>
            {ps.length > 1 ? (
              <Polyline
                points={ps.join(" ")}
                stroke={colors[ki]}
                strokeWidth={2.5}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {pts.map((p, i) =>
              p.v[k] != null ? (
                <Circle
                  key={i}
                  cx={x(i)}
                  cy={y(p.v[k]!)}
                  r={3.5}
                  fill={colors[ki]}
                />
              ) : null,
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export function VitalsTrend({ p }: { p: Patient }) {
  const pts: Pt[] = [...p.visits]
    .sort((a, b) => a.no - b.no)
    .map((v) => ({ no: v.no, date: v.date, v: vitalsOf(v) }));
  const bp = pts.filter((x) => x.v.sys && x.v.dia);
  const sugar = pts.filter((x) => x.v.sugar);
  const weight = pts.filter((x) => x.v.weight);
  if (!bp.length && !sugar.length && !weight.length) return null;
  const last = (arr: Pt[]) => arr[arr.length - 1];
  const checks = assess({
    ...(bp.length ? { sys: last(bp).v.sys, dia: last(bp).v.dia } : {}),
    ...(sugar.length ? { sugar: last(sugar).v.sugar } : {}),
  }).filter((c) => c.level !== "ok");

  const Metric = ({
    title,
    value,
    unit,
    when,
    children,
  }: {
    title: string;
    value: string;
    unit: string;
    when: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.metric}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <T
          v="subhead"
          color={ios.secondary}
          style={{ flex: 1, fontWeight: "600" }}
        >
          {title}
        </T>
        <T v="caption" color={ios.tertiary}>
          {when}
        </T>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
        <T v="h2">{value}</T>
        <T v="caption" color={ios.secondary}>
          {unit}
        </T>
      </View>
      {children}
    </View>
  );

  return (
    <View style={{ marginTop: 32 }}>
      <T v="h3" style={{ marginBottom: 10, marginLeft: 4 }}>
        ค่าสุขภาพ
      </T>
      <View style={[styles.card, elevation.e1]}>
        {checks.map((c) => (
          <View
            key={c.k}
            style={[styles.check, { backgroundColor: LEVEL[c.level].bg }]}
          >
            <Sym
              name={LEVEL[c.level].icon}
              size={15}
              color={LEVEL[c.level].color}
            />
            <View style={{ flex: 1 }}>
              <T
                v="subhead"
                color={LEVEL[c.level].color}
                style={{ fontWeight: "700" }}
              >
                {c.title}
              </T>
              <T v="caption" color={palette.inkSoft}>
                {c.text}
              </T>
            </View>
          </View>
        ))}
        {bp.length ? (
          <Metric
            title="ความดัน"
            value={`${last(bp).v.sys}/${last(bp).v.dia}`}
            unit="มม.ปรอท"
            when={`ครั้งที่ ${last(bp).no} · ${last(bp).date}`}
          >
            {bp.length > 1 ? (
              <Spark
                pts={bp}
                keys={["sys", "dia"]}
                colors={["#D2453A", "#2F7BE0"]}
                limit={160}
              />
            ) : null}
          </Metric>
        ) : null}
        {sugar.length ? (
          <Metric
            title="น้ำตาลในเลือด"
            value={String(last(sugar).v.sugar)}
            unit="มก./ดล."
            when={`ครั้งที่ ${last(sugar).no} · ${last(sugar).date}`}
          >
            {sugar.length > 1 ? (
              <Spark
                pts={sugar}
                keys={["sugar"]}
                colors={["#E0861A"]}
                limit={180}
              />
            ) : null}
          </Metric>
        ) : null}
        {weight.length ? (
          <Metric
            title="น้ำหนัก"
            value={String(last(weight).v.weight)}
            unit="กก."
            when={`ครั้งที่ ${last(weight).no} · ${last(weight).date}`}
          >
            {weight.length > 1 ? (
              <Spark pts={weight} keys={["weight"]} colors={["#7A5CC8"]} />
            ) : null}
          </Metric>
        ) : null}
        <T v="micro" color={ios.tertiary}>
          เส้นประสีแดง = เกณฑ์ส่งต่อ · เกณฑ์จาก{SRC}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: palette.surface,
    gap: 12,
  },
  check: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 14,
  },
  metric: { gap: 4 },
});
