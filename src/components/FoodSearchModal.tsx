import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ensureCustomFoodsLoaded, searchCustomFoodsSync } from '../api/nutrition/customFoods';
import { FoodSearchResult, FoodTarget, searchFoods } from '../api/usda';
import { colors, fontSize, radius, spacing } from '../theme';
import { CreateFoodModal } from './CreateFoodModal';
import { FoodDetailSheet } from './FoodDetailSheet';

const DEBOUNCE_MS = 300;
const MIN_QUERY = 2;

type Status = 'idle' | 'loading' | 'done' | 'error';

/**
 * Full-screen food search backed by USDA, plus the user's own custom foods.
 * Results show in two sections — "Your foods" (only when the query matches one)
 * and "USDA". Typing is debounced and stale USDA requests are aborted so only
 * the latest query's results render. If nothing fits, "Add a food" creates a
 * custom entry.
 */
export function FoodSearchModal({
  visible,
  day,
  onClose,
  onLogged,
}: {
  visible: boolean;
  /** Day key foods are logged against. */
  day: string;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [usdaResults, setUsdaResults] = useState<FoodSearchResult[]>([]);
  const [customResults, setCustomResults] = useState<FoodSearchResult[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [selected, setSelected] = useState<FoodTarget | null>(null);
  const [creating, setCreating] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    let active = true;

    // Custom foods are local — filter them instantly (no debounce, no network).
    ensureCustomFoodsLoaded().then(() => {
      if (active) setCustomResults(searchCustomFoodsSync(q));
    });

    if (q.length < MIN_QUERY) {
      controllerRef.current?.abort();
      setUsdaResults([]);
      setStatus('idle');
      return () => {
        active = false;
      };
    }

    const handle = setTimeout(() => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      setStatus('loading');
      searchFoods(q, controller.signal)
        .then((res) => {
          if (controller.signal.aborted) return;
          setUsdaResults(res);
          setStatus('done');
        })
        .catch((e) => {
          if (e.name === 'AbortError') return;
          setStatus('error');
        });
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query, visible]);

  const close = () => {
    controllerRef.current?.abort();
    setQuery('');
    setUsdaResults([]);
    setCustomResults([]);
    setStatus('idle');
    setSelected(null);
    setCreating(false);
    onClose();
  };

  const sections = [
    ...(customResults.length > 0 ? [{ title: 'Your foods', data: customResults }] : []),
    ...(usdaResults.length > 0 ? [{ title: 'USDA', data: usdaResults }] : []),
  ];

  const showSpinner = status === 'loading' && sections.length === 0;
  const showEmpty = status === 'done' && sections.length === 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Search foods"
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
          <Pressable onPress={close} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.addRow}
          onPress={() => {
            Keyboard.dismiss();
            setCreating(true);
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.addRowText}>Add a food</Text>
        </Pressable>

        {status === 'idle' && sections.length === 0 ? (
          <Hint icon="restaurant-outline" text="Search USDA or your own foods" />
        ) : status === 'error' ? (
          <Hint icon="cloud-offline-outline" text="Something went wrong. Try again." />
        ) : showSpinner ? (
          <ActivityIndicator color={colors.orange} style={styles.loader} />
        ) : showEmpty ? (
          <Hint icon="search-outline" text={`No results for "${query.trim()}"`} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => {
                  Keyboard.dismiss();
                  setSelected(
                    item.source === 'custom'
                      ? { source: 'custom', customId: item.customId! }
                      : { source: 'usda', fdcId: item.fdcId! },
                  );
                }}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {[item.brand, item.dataType].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {item.calories != null && (
                  <Text style={styles.rowCalories}>{Math.round(item.calories)} kcal</Text>
                )}
              </Pressable>
            )}
          />
        )}
      </View>

      {selected != null && (
        <FoodDetailSheet
          detail={
            selected.source === 'usda'
              ? { kind: 'usda', fdcId: selected.fdcId }
              : { kind: 'custom', customId: selected.customId }
          }
          day={day}
          onClose={() => setSelected(null)}
          onLogged={onLogged}
        />
      )}

      <CreateFoodModal
        visible={creating}
        initialName={query}
        onClose={() => setCreating(false)}
        onCreated={(customId) => {
          setCustomResults(searchCustomFoodsSync(query));
          setSelected({ source: 'custom', customId });
        }}
      />
    </Modal>
  );
}

function Hint({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.hint}>
      <Ionicons name={icon} size={40} color={colors.textTertiary} />
      <Text style={styles.hintText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.subtitle,
    padding: 0,
  },
  cancel: {
    color: colors.primary,
    fontSize: fontSize.subtitle,
    fontWeight: '600',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  addRowText: {
    color: colors.primary,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  list: {
    paddingBottom: spacing.xxxl,
  },
  sectionHeader: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  rowSub: {
    color: colors.textTertiary,
    fontSize: fontSize.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  rowCalories: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    fontWeight: '700',
  },
  hint: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xxxl * 2,
  },
  hintText: {
    color: colors.textTertiary,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});
