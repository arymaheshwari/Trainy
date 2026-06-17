import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
  addPantryItem,
  ensurePantryLoaded,
  getPantrySync,
  PantryItem,
  removePantryItem,
} from '../api/nutrition/pantry';
import { colors, fontSize, radius, spacing } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * The user's pantry. Add items with the + at the top; swipe a row left to
 * remove it. Backed by the local pantry store.
 */
export function PantryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!visible) return;
    ensurePantryLoaded().then(() => setItems(getPantrySync()));
    setText('');
  }, [visible]);

  const add = async () => {
    const created = await addPantryItem(text);
    if (created) {
      setItems(getPantrySync());
      setText('');
    }
  };

  const remove = async (id: string) => {
    await removePantryItem(id);
    setItems(getPantrySync());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View pointerEvents="none" style={styles.keyboardFiller} />
          <View style={styles.handle} />

          <Text style={styles.title}>My Pantry</Text>

          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Add an item…"
              placeholderTextColor={colors.textTertiary}
              returnKeyType="done"
              onSubmitEditing={add}
              autoCapitalize="none"
            />
            <Pressable style={styles.addButton} onPress={add} hitSlop={6}>
              <Ionicons name="add" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {items.length === 0 ? (
              <Text style={styles.empty}>Your pantry is empty. Add items above.</Text>
            ) : (
              items.map((item) => (
                <SwipeableRow key={item.id} onRemove={() => remove(item.id)}>
                  <Text style={styles.itemName}>{item.name}</Text>
                </SwipeableRow>
              ))
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A row that swipes left to reveal/trigger delete. */
function SwipeableRow({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;

  const pan = useRef(
    PanResponder.create({
      // Only claim horizontal drags so vertical scrolling still works.
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -80) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onRemoveRef.current());
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={styles.rowWrap}>
      <View style={styles.rowDelete}>
        <Ionicons name="trash-outline" size={20} color={colors.textPrimary} />
      </View>
      <Animated.View style={[styles.row, { transform: [{ translateX }] }]} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
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
    maxHeight: '80%',
  },
  keyboardFiller: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '100%',
    height: 1000,
    backgroundColor: colors.surface,
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
    marginBottom: spacing.lg,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexGrow: 0,
  },
  empty: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '600',
    paddingVertical: spacing.lg,
  },
  rowWrap: {
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  rowDelete: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.red,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: spacing.xl,
  },
  row: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  itemName: {
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
  },
});
