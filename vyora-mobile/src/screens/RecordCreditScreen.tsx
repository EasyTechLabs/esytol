/**
 * Record a credit.
 *
 * The form commits to SQLite and returns immediately. It does **not** wait for
 * the network, show a spinner while a request is in flight, or report a failure
 * to send — because none of that changes whether the entry happened. The
 * merchant handed over goods; the entry is true the moment they say so.
 *
 * Delivery is the outbox's problem, and its state is visible on the sync screen
 * and as a per-row marker on the statement. Conflating "recorded" with "sent"
 * is what makes offline apps feel unreliable when they are merely offline.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { useApp } from "../store/AppProvider";
import { recordCredit } from "../features/ledger";
import { colors, radius, spacing, type } from "../theme";
import { Button, Card, Caption, ErrorNotice, Field, Screen } from "../components";

type Props = NativeStackScreenProps<RootStackParamList, "RecordCredit">;
type Kind = "given" | "taken";

export function RecordCreditScreen({ route, navigation }: Props) {
  const { partyId, partyName } = route.params;
  const { db, refresh } = useApp();

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<Kind>("given");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const value = Number.parseInt(amount, 10);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!db) return;

    setSaving(true);
    setError(null);
    try {
      await recordCredit(db, {
        partyId,
        amount: value,
        kind,
        description: note.trim() || null,
      });
      refresh();
      navigation.goBack();
    } catch (cause) {
      // A failure here means SQLite refused — the entry is genuinely not
      // recorded, which is a different and much rarer thing than "not sent".
      setError(`Could not save on this device. ${(cause as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Caption>Recording against {partyName}</Caption>

        <View style={styles.choices}>
          <Choice
            label="I gave credit"
            hint="They owe you more"
            active={kind === "given"}
            onPress={() => setKind("given")}
            testID="kind-given"
          />
          <Choice
            label="I took credit"
            hint="You owe them more"
            active={kind === "taken"}
            onPress={() => setKind("taken")}
            testID="kind-taken"
          />
        </View>

        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="number-pad"
          testID="credit-amount"
        />
        <Field
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="What was it for?"
          testID="credit-note"
        />

        {error ? <ErrorNotice message={error} /> : null}

        <Button
          label={saving ? "Saving…" : "Record credit"}
          onPress={() => void submit()}
          disabled={saving || !amount.trim()}
          testID="submit-credit"
        />
        <Caption>
          Saved on this device straight away. It will be sent when the API is reachable.
        </Caption>
      </Card>
    </Screen>
  );
}

export function Choice({
  label,
  hint,
  active,
  onPress,
  testID,
}: {
  label: string;
  hint: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
    >
      <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{label}</Text>
      <Text style={styles.choiceHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: "row", gap: spacing.sm },
  choice: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  choiceActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  choiceLabel: { ...type.label, color: colors.text },
  choiceLabelActive: { color: colors.accent, fontWeight: "700" },
  choiceHint: { ...type.caption, color: colors.textMuted },
});
