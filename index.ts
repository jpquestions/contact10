// App entry. Expo Router renders the app; on Android this also registers the
// background task that draws the home screen widgets and handles their taps.
import { Platform } from 'react-native';
import 'expo-router/entry';

if (Platform.OS === 'android') {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widget/android/task-handler');
  /* eslint-enable @typescript-eslint/no-require-imports */
  registerWidgetTaskHandler(widgetTaskHandler);
}
