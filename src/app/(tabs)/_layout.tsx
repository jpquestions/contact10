import { Tabs } from 'expo-router/js-tabs';
import { Text, type ColorValue } from 'react-native';
import { colors } from '../../components/theme';

// Plain glyphs until the icon set lands in the polish phase.
function glyph(symbol: string) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{symbol}</Text>;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: glyph('●') }} />
      <Tabs.Screen name="games" options={{ title: 'Games', tabBarIcon: glyph('◆') }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: glyph('◎') }} />
      <Tabs.Screen name="rewards" options={{ title: 'Rewards', tabBarIcon: glyph('★') }} />
      <Tabs.Screen name="rules" options={{ title: 'Rules', tabBarIcon: glyph('≡') }} />
    </Tabs>
  );
}
