import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from '../theme';

type Method = 'ai' | 'photo' | 'label' | 'barcode' | 'search';

const OPTIONS: { key: Method; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: 'ai', label: 'AI', icon: 'sparkles', color: colors.primary },
  { key: 'photo', label: 'Photo', icon: 'camera', color: colors.orange },
  { key: 'label', label: 'Label', icon: 'document-text-outline', color: colors.amber },
  { key: 'barcode', label: 'Barcode', icon: 'barcode-outline', color: colors.teal },
  { key: 'search', label: 'Search', icon: 'search', color: colors.blue },
];

/**
 * Bottom-sheet menu for starting food tracking. Presents circular method
 * buttons — AI, Photo, Label, Barcode, Search. `onSelect` fires with the method.
 */
export function AddFoodMenu({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect?: (method: Method) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop propagation so taps inside the sheet don't close it. */}
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add food</Text>

          <View style={styles.options}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={styles.option}
                onPress={() => {
                  onSelect?.(opt.key);
                  onClose();
                }}
              >
                <View style={[styles.circle, { backgroundColor: opt.color + '26' }]}>
                  <Ionicons name={opt.icon} size={28} color={opt.color} />
                </View>
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: spacing.xl,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xl,
  },
  option: {
    width: '33.33%',
    alignItems: 'center',
    gap: spacing.sm,
  },
  circle: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});
