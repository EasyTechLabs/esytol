/**
 * Record a payment.
 *
 * Same commit-locally-first behaviour as recording a credit, and the same
 * refusal to conflate "recorded" with "sent".
 *
 * There is deliberately no "settle this entry" picker and no "pay off the
 * balance" shortcut. A payment moves the running position; it does not
 * discharge a nominated credit. Offering a picker would record a link the
 * merchant never asserted, and that link would then be wrong the moment an
 * older entry arrived late from another device.
 *
 * Over-payment is allowed and simply flips the position. Blocking it would make
 * the ledger disagree with what happened at the counter.
 */

import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { useApp } from "../store/AppProvider";
import { recordPayment } from "../features/ledger";
import { spacing } from "../theme";
import { Button, Card, Caption, ErrorNotice, Field, Screen } from "../components";
import { Choice } from "./RecordCreditScreen";

type Props = NativeStackScreenProps<RootStackParamList, "RecordPayment">;
type Kind = "received" | "paid";

export function RecordPaymentScreen({ route, navigation }: Props) {
  const { partyId, partyName } = route.params;
  const { db, refresh } = useApp();

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<Kind>("received");
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
      await recordPayment(db, { partyId, amount: value, kind, note: note.trim() || null });
      refresh();
      navigation.goBack();
    } catch (cause) {
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
            label="They paid me"
            hint="They owe you less"
            active={kind === "received"}
            onPress={() => setKind("received")}
            testID="kind-received"
          />
          <Choice
            label="I paid them"
            hint="You owe them less"
            active={kind === "paid"}
            onPress={() => setKind("paid")}
            testID="kind-paid"
          />
        </View>

        <Field
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="number-pad"
          testID="payment-amount"
        />
        <Field
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Cash at shop, part payment…"
          testID="payment-note"
        />

        {error ? <ErrorNotice message={error} /> : null}

        <Button
          label={saving ? "Saving…" : "Record payment"}
          onPress={() => void submit()}
          disabled={saving || !amount.trim()}
          testID="submit-payment"
        />
        <Caption>
          Moves the running balance. It does not settle any one entry, because that is not what a
          payment against a running tab means.
        </Caption>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: "row", gap: spacing.sm },
});
