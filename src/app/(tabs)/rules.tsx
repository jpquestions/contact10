import { StyleSheet, Text } from 'react-native';
import { RuleLadder } from '../../components/RuleLadder';
import { Body, Card, Screen, Title } from '../../components/ui';
import { colors } from '../../components/theme';
import { MAX_ENTRY, MIN_ENTRY, QUICK_ADD } from '../../lib/rules';

export default function Rules() {
  return (
    <Screen>
      <Title>Rules</Title>
      <Card>
        <RuleLadder />
      </Card>

      <Card>
        <Text style={styles.heading}>Quick add</Text>
        <Body muted>
          The {QUICK_ADD.join(', ')} buttons match the ladder: 1 for the bubble, 2 or 3 for a single step, 6 for bubble
          through laugh, and 10 for a full contact. You can also enter any amount from {MIN_ENTRY} to {MAX_ENTRY}.
        </Body>
      </Card>

      <Card>
        <Text style={styles.heading}>Games</Text>
        <Body muted>
          Points scored in a game count toward that game and your lifetime total. A game can add its own house rules,
          shown on the game page.
        </Body>
      </Card>

      <Card>
        <Text style={styles.heading}>Fair play</Text>
        <Body muted>
          Anyone in a game can flag an entry they think is false. The game creator has the final say. If the flag is
          upheld, those points come off your game and lifetime totals.
        </Body>
      </Card>

      <Card>
        <Text style={styles.heading}>Respect</Text>
        <Body muted>
          Contact 10 is about confident, respectful conversation. The app only tracks your points and never stores
          anything about the people you meet.
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
