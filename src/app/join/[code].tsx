import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ErrorText, Field } from '../../components/controls';
import { Body, Button } from '../../components/ui';
import { colors, space } from '../../components/theme';
import { api, errorMessage } from '../../lib/api';

/** contact10://join/CODE opens here; /join/enter shows a code field. */
export default function Join() {
  const params = useLocalSearchParams<{ code: string }>();
  const fromLink = params.code && params.code !== 'enter' ? params.code : null;
  const [code, setCode] = useState(fromLink ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(value: string) {
    setBusy(true);
    setError(null);
    try {
      const { gameId } = await api.joinGameByCode({ code: value });
      router.replace(`/game/${gameId}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  useEffect(() => {
    if (fromLink) join(fromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLink]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg }}>
      <Body muted>Enter the 8 character code a friend shared with you.</Body>
      <Field
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder="ABCD2345"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={8}
        style={{ fontSize: 26, letterSpacing: 6, textAlign: 'center' }}
      />
      {busy && fromLink ? <ActivityIndicator color={colors.accent} /> : null}
      <Button label="Join game" onPress={() => join(code)} loading={busy} disabled={code.length !== 8} />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}
