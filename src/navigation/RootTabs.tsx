import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '../screens/HomeScreen';
import { NutritionScreen } from '../screens/NutritionScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { WorkoutScreen } from '../screens/WorkoutScreen';
import { colors } from '../theme';
import { FloatingTabBar } from './FloatingTabBar';

const Tab = createBottomTabNavigator();

/** Root bottom-tab navigator with the custom floating tab bar. */
export function RootTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} />
      <Tab.Screen name="Workout" component={WorkoutScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
    </Tab.Navigator>
  );
}
