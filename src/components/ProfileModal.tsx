import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  cmToFtIn,
  ensureProfileLoaded,
  ftInToCm,
  getProfileSync,
  HeightUnit,
  kgToLb,
  lbToKg,
  saveProfile,
  WeightUnit,
} from '../api/profile';
import { colors, fontSize, radius, spacing } from '../theme';

const ACCENT = colors.primary;

/** Format a number for display: one decimal, no trailing ".0". */
function fmt(n: number): string {
  return String(Math.round(n * 10) / 10);
}

interface Marker {
  key: string;
  label: string;
  unit: string;
}

interface MarkerGroup {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  markers: Marker[];
}

/**
 * Common, core health markers people track from a blood panel. Grouped the way
 * a lab report is, with the most-tracked panels first. Values are entered by
 * the user (optionally from an uploaded report).
 */
const MARKER_GROUPS: MarkerGroup[] = [
  {
    id: 'lipids',
    title: 'Lipid Panel',
    icon: 'water',
    markers: [
      { key: 'totalCholesterol', label: 'Total Cholesterol', unit: 'mg/dL' },
      { key: 'ldl', label: 'LDL', unit: 'mg/dL' },
      { key: 'hdl', label: 'HDL', unit: 'mg/dL' },
      { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL' },
    ],
  },
  {
    id: 'glucose',
    title: 'Blood Sugar',
    icon: 'pulse',
    markers: [
      { key: 'fastingGlucose', label: 'Fasting Glucose', unit: 'mg/dL' },
      { key: 'hba1c', label: 'HbA1c', unit: '%' },
      { key: 'fastingInsulin', label: 'Fasting Insulin', unit: 'µIU/mL' },
    ],
  },
  {
    id: 'vitamins',
    title: 'Vitamins',
    icon: 'sunny',
    markers: [
      { key: 'vitaminD', label: 'Vitamin D (25-OH)', unit: 'ng/mL' },
      { key: 'vitaminB12', label: 'Vitamin B12', unit: 'pg/mL' },
      { key: 'folate', label: 'Folate', unit: 'ng/mL' },
    ],
  },
  {
    id: 'minerals',
    title: 'Minerals & Electrolytes',
    icon: 'flash',
    markers: [
      { key: 'iron', label: 'Iron', unit: 'µg/dL' },
      { key: 'ferritin', label: 'Ferritin', unit: 'ng/mL' },
      { key: 'magnesium', label: 'Magnesium', unit: 'mg/dL' },
      { key: 'calcium', label: 'Calcium', unit: 'mg/dL' },
      { key: 'sodium', label: 'Sodium', unit: 'mmol/L' },
      { key: 'potassium', label: 'Potassium', unit: 'mmol/L' },
    ],
  },
  {
    id: 'thyroid',
    title: 'Thyroid',
    icon: 'body',
    markers: [
      { key: 'tsh', label: 'TSH', unit: 'mIU/L' },
      { key: 'freeT4', label: 'Free T4', unit: 'ng/dL' },
      { key: 'freeT3', label: 'Free T3', unit: 'pg/mL' },
    ],
  },
  {
    id: 'cbc',
    title: 'Complete Blood Count',
    icon: 'fitness',
    markers: [
      { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL' },
      { key: 'hematocrit', label: 'Hematocrit', unit: '%' },
      { key: 'wbc', label: 'White Blood Cells', unit: '10³/µL' },
      { key: 'rbc', label: 'Red Blood Cells', unit: '10⁶/µL' },
      { key: 'platelets', label: 'Platelets', unit: '10³/µL' },
    ],
  },
  {
    id: 'kidney',
    title: 'Kidney Function',
    icon: 'funnel',
    markers: [
      { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL' },
      { key: 'bun', label: 'BUN', unit: 'mg/dL' },
      { key: 'egfr', label: 'eGFR', unit: 'mL/min' },
    ],
  },
  {
    id: 'liver',
    title: 'Liver Function',
    icon: 'medkit',
    markers: [
      { key: 'alt', label: 'ALT', unit: 'U/L' },
      { key: 'ast', label: 'AST', unit: 'U/L' },
      { key: 'bilirubin', label: 'Bilirubin', unit: 'mg/dL' },
    ],
  },
  {
    id: 'vitals',
    title: 'Vitals & Inflammation',
    icon: 'heart',
    markers: [
      { key: 'restingHr', label: 'Resting Heart Rate', unit: 'bpm' },
      { key: 'systolic', label: 'Blood Pressure (Systolic)', unit: 'mmHg' },
      { key: 'diastolic', label: 'Blood Pressure (Diastolic)', unit: 'mmHg' },
      { key: 'crp', label: 'CRP', unit: 'mg/L' },
    ],
  },
];

interface UploadedReport {
  uri: string;
  name: string;
}

/** Full-screen profile page: body metrics, optional report upload, and the
 * collapsible blood-marker lists. */
export function ProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('ftin');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');

  const [reports, setReports] = useState<UploadedReport[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');

  // Load saved profile into the form each time the page opens.
  useEffect(() => {
    if (!visible) return;
    ensureProfileLoaded().then(() => {
      const p = getProfileSync();
      setWeightUnit(p.weightUnit);
      setWeight(p.weightKg != null ? fmt(p.weightUnit === 'lb' ? kgToLb(p.weightKg) : p.weightKg) : '');
      setHeightUnit(p.heightUnit);
      if (p.heightCm == null) {
        setHeightCm('');
        setHeightFt('');
        setHeightIn('');
      } else if (p.heightUnit === 'cm') {
        setHeightCm(fmt(p.heightCm));
      } else {
        const { ft, in: inch } = cmToFtIn(p.heightCm);
        setHeightFt(String(ft));
        setHeightIn(String(inch));
      }
      setValues(p.markers);
      setNotes(p.notes);
    });
  }, [visible]);

  const onChangeWeight = (text: string) => {
    setWeight(text);
    const n = parseFloat(text);
    const kg = Number.isFinite(n) ? (weightUnit === 'lb' ? lbToKg(n) : n) : null;
    saveProfile({ weightKg: kg != null ? Math.round(kg * 10) / 10 : null, weightUnit });
  };

  const onToggleWeightUnit = (u: string) => {
    const unit = u as WeightUnit;
    setWeightUnit(unit);
    const { weightKg } = getProfileSync();
    setWeight(weightKg != null ? fmt(unit === 'lb' ? kgToLb(weightKg) : weightKg) : '');
    saveProfile({ weightUnit: unit });
  };

  const saveHeightFromFtIn = (ftStr: string, inStr: string) => {
    const ft = parseFloat(ftStr) || 0;
    const inch = parseFloat(inStr) || 0;
    const cm = ft || inch ? Math.round(ftInToCm(ft, inch) * 10) / 10 : null;
    saveProfile({ heightCm: cm, heightUnit: 'ftin' });
  };

  const onChangeHeightCm = (text: string) => {
    setHeightCm(text);
    const n = parseFloat(text);
    saveProfile({ heightCm: Number.isFinite(n) ? Math.round(n * 10) / 10 : null, heightUnit: 'cm' });
  };

  const onChangeHeightFt = (text: string) => {
    setHeightFt(text);
    saveHeightFromFtIn(text, heightIn);
  };

  const onChangeHeightIn = (text: string) => {
    setHeightIn(text);
    saveHeightFromFtIn(heightFt, text);
  };

  const onToggleHeightUnit = (u: string) => {
    const unit = u as HeightUnit;
    setHeightUnit(unit);
    const { heightCm: cm } = getProfileSync();
    if (cm == null) {
      setHeightCm('');
      setHeightFt('');
      setHeightIn('');
    } else if (unit === 'cm') {
      setHeightCm(fmt(cm));
    } else {
      const { ft, in: inch } = cmToFtIn(cm);
      setHeightFt(String(ft));
      setHeightIn(String(inch));
    }
    saveProfile({ heightUnit: unit });
  };

  const setValue = (key: string, v: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: v };
      saveProfile({ markers: next });
      return next;
    });
  };

  const onChangeNotes = (text: string) => {
    setNotes(text);
    saveProfile({ notes: text });
  };

  const toggleGroup = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const pickReport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      setReports((prev) => [
        ...prev,
        ...result.assets.map((a, i) => ({ uri: a.uri, name: a.name ?? `Report ${prev.length + i + 1}` })),
      ]);
    } catch {
      Alert.alert("Couldn't upload", 'Please try again.');
    }
  };

  const removeReport = (uri: string) => setReports((prev) => prev.filter((r) => r.uri !== uri));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top + 56}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl * 3 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {/* Body metrics */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Body Metrics</Text>

              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Weight</Text>
                <SegmentedToggle
                  options={[
                    { label: 'kg', value: 'kg' },
                    { label: 'lb', value: 'lb' },
                  ]}
                  value={weightUnit}
                  onChange={onToggleWeightUnit}
                />
              </View>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={weight}
                  onChangeText={onChangeWeight}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.inputUnit}>{weightUnit}</Text>
              </View>

              <View style={[styles.metricRow, { marginTop: spacing.lg }]}>
                <Text style={styles.metricLabel}>Height</Text>
                <SegmentedToggle
                  options={[
                    { label: 'ft / in', value: 'ftin' },
                    { label: 'cm', value: 'cm' },
                  ]}
                  value={heightUnit}
                  onChange={onToggleHeightUnit}
                />
              </View>
              {heightUnit === 'cm' ? (
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    value={heightCm}
                    onChangeText={onChangeHeightCm}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Text style={styles.inputUnit}>cm</Text>
                </View>
              ) : (
                <View style={styles.heightRow}>
                  <View style={[styles.inputWrap, styles.flex]}>
                    <TextInput
                      style={styles.input}
                      value={heightFt}
                      onChangeText={onChangeHeightFt}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={styles.inputUnit}>ft</Text>
                  </View>
                  <View style={[styles.inputWrap, styles.flex]}>
                    <TextInput
                      style={styles.input}
                      value={heightIn}
                      onChangeText={onChangeHeightIn}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={styles.inputUnit}>in</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Blood reports (optional) */}
            <View style={styles.card}>
              <View style={styles.reportHeader}>
                <Text style={styles.cardTitle}>Blood Reports</Text>
                <Text style={styles.optional}>Optional</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Upload a PDF, photo, or scan of a report to keep it handy.
              </Text>

              {reports.map((r) => (
                <View key={r.uri} style={styles.reportChip}>
                  <Ionicons name="document-text-outline" size={18} color={ACCENT} />
                  <Text style={styles.reportName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Pressable onPress={() => removeReport(r.uri)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </Pressable>
                </View>
              ))}

              <Pressable
                style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed]}
                onPress={pickReport}
              >
                <Ionicons name="cloud-upload-outline" size={20} color={ACCENT} />
                <Text style={styles.uploadText}>Upload report</Text>
              </Pressable>
            </View>

            {/* Blood markers */}
            <Text style={styles.sectionHeading}>Blood Markers</Text>
            {MARKER_GROUPS.map((group) => {
              const filled = group.markers.filter((m) => values[m.key]?.trim()).length;
              const isOpen = !!expanded[group.id];
              return (
                <View key={group.id} style={styles.card}>
                  <Pressable
                    style={styles.groupHeader}
                    onPress={() => toggleGroup(group.id)}
                    accessibilityRole="button"
                  >
                    <View style={styles.groupIcon}>
                      <Ionicons name={group.icon} size={18} color={ACCENT} />
                    </View>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    {filled > 0 && (
                      <View style={styles.filledBadge}>
                        <Text style={styles.filledBadgeText}>{filled}</Text>
                      </View>
                    )}
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textTertiary}
                    />
                  </Pressable>

                  {isOpen && (
                    <View style={styles.markerList}>
                      {group.markers.map((m) => (
                        <View key={m.key} style={styles.markerRow}>
                          <Text style={styles.markerLabel} numberOfLines={1}>
                            {m.label}
                          </Text>
                          <View style={styles.markerInputWrap}>
                            <TextInput
                              style={styles.markerInput}
                              value={values[m.key] ?? ''}
                              onChangeText={(v) => setValue(m.key, v)}
                              keyboardType="decimal-pad"
                              placeholder="—"
                              placeholderTextColor={colors.textTertiary}
                            />
                            <Text style={styles.markerUnit}>{m.unit}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Notes */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notes</Text>
              <Text style={styles.cardSubtitle}>
                Anything else worth tracking — a deficiency or marker without a section above.
              </Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={onChangeNotes}
                multiline
                textAlignVertical="top"
                placeholder="e.g. Low magnesium flagged by doctor, supplementing 400mg daily…"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function SegmentedToggle({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.heading,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '700',
    paddingVertical: spacing.md,
  },
  inputUnit: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  heightRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    padding: 3,
  },
  segmentItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  segmentItemActive: {
    backgroundColor: ACCENT,
  },
  segmentText: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: colors.textPrimary,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optional: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
  reportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  reportName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  uploadText: {
    color: ACCENT,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
  sectionHeading: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: -spacing.xs,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  groupTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  filledBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  filledBadgeText: {
    color: ACCENT,
    fontSize: fontSize.caption,
    fontWeight: '800',
  },
  markerList: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  markerLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  markerInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minWidth: 120,
  },
  markerInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '700',
    paddingVertical: spacing.sm,
    textAlign: 'right',
  },
  markerUnit: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  notesInput: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 110,
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '600',
    lineHeight: 20,
  },
});
