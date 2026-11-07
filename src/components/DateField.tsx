import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from './theme';

/** A labeled date picker: inline compact picker on iOS, a dialog on Android. */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const text = value.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          themeVariant="dark"
          accentColor={colors.accent}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_e, d) => d && onChange(d)}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${text}`}
          style={styles.button}
          onPress={() =>
            DateTimePickerAndroid.open({
              value,
              mode: 'date',
              minimumDate,
              maximumDate,
              onChange: (e, d) => e.type === 'set' && d && onChange(d),
            })
          }
        >
          <Text style={styles.value}>{text}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: 44 },
  label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  button: { backgroundColor: colors.surfaceRaised, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  value: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
