import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Routine } from '../api/workouts/routines';
import { colors, fontSize, radius, spacing } from '../theme';

/**
 * Bottom-sheet menu shown from a routine's three-dot button. Offers editing or
 * deleting the routine. `routine` is null when closed.
 */
export function RoutineActionsMenu({
  routine,
  onEdit,
  onDelete,
  onClose,
}: {
  routine: Routine | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={routine != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop propagation so taps inside the sheet don't close it. */}
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.handle} />
          <Text style={styles.title} numberOfLines={1}>
            {routine?.name}
          </Text>

          <Pressable style={styles.option} onPress={onEdit}>
            <Ionicons name="create-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.optionLabel}>Edit routine</Text>
          </Pressable>

          <Pressable style={styles.option} onPress={onDelete}>
            <Ionicons name="trash-outline" size={22} color={colors.red} />
            <Text style={[styles.optionLabel, styles.deleteLabel]}>Delete routine</Text>
          </Pressable>
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
    color: colors.textSecondary,
    fontSize: fontSize.body,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  optionLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '700',
  },
  deleteLabel: {
    color: colors.red,
  },
});
