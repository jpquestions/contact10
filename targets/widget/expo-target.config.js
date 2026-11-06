/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'Contact10Widget',
  displayName: 'Contact 10',
  icon: '../../assets/icon.png',
  // Buttons inside widgets (App Intents) need iOS 17.
  deploymentTarget: '17.0',
  colors: {
    $accent: '#FF5A36',
    $widgetBackground: '#0E0F13',
    surface: '#22252E',
    muted: '#9AA0AC',
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
