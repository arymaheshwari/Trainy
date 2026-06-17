import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from '../theme';
import { TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from './constants';

/** Icon (base name) per route. Outline variant is shown when not focused. */
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Summary: 'home',
  Nutrition: 'nutrition',
  Workout: 'barbell',
  Recovery: 'battery-charging',
};

/**
 * Floating bottom tab bar with a solid elevated surface. Sits above the screen
 * content (which scrolls underneath) for a clean, modern look — no blur, no
 * extra native dependencies.
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const baseIcon = ICONS[route.name] ?? 'ellipse';
          const iconName = (focused ? baseIcon : `${baseIcon}-outline`) as keyof typeof Ionicons.glyphMap;
          const color = focused ? colors.primary : colors.textTertiary;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={route.name}
            >
              <Ionicons name={iconName} size={24} color={color} />
              <Text style={[styles.label, { color }]}>{route.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: TAB_BAR_MARGIN,
  },
  bar: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    // Subtle lift off the background.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: fontSize.caption - 1,
    fontWeight: '600',
  },
});
