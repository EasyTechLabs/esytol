/**
 * One party's statement — the screen that settles an argument at a counter.
 *
 * Every row carries the running balance after it, oldest first, because that is
 * how the paper book it replaces is read: you find the disputed entry and look
 * across.
 *
 * Unsent entries are shown *in the ledger*, not held back until the server has
 * seen them. Hiding an entry until it syncs would mean a merchant who took ₹500
 * with no signal cannot see the ₹500 they just took — which is exactly when
 * they most need to.
 */

import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { useApp } from "../store/AppProvider";
import { readStatement, readSummary, type LedgerSummary, type StatementRow } from "../database/repository";
import { balanceColor, balanceLabel, colors, formatMoney, radius, spacing, type } from "../theme";
import { Button, Card, Caption, Empty, Loading, Money, Screen } from "../components";

type Props = NativeStackScreenProps<RootStackParamList, "PartyDetail">;

export function PartyDetailScreen({ route, navigation }: Props) {
  const { partyId, partyName } = route.params;
  const { db, revision } = useApp();
  const [rows, setRows] = useState<StatementRow[] | null>(null);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    Promise.all([readStatement(db, partyId), readSummary(db, partyId)]).then(([r, s]) => {
      if (cancelled) return;
      setRows(r);
      setSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, [db, partyId, revision]);

  if (rows === null || summary === null) return <Loading />;

  return (
    <Screen>
      <Card>
        <Text style={styles.label}>{balanceLabel(summary.net)}</Text>
        <Money value={summary.net} />
        <Caption>
          {summary.entryCount} entr{summary.entryCount === 1 ? "y" : "ies"} ·{" "}
          {summary.counts.credits} credit{summary.counts.credits === 1 ? "" : "s"} ·{" "}
          {summary.counts.payments} payment{summary.counts.payments === 1 ? "" : "s"}
          {summary.pending > 0 ? ` · ${summary.pending} not sent yet` : ""}
        </Caption>

        {/* Gross totals beside the net: "given ₹40,000, paid back ₹38,500" is a
            different fact from "₹1,500 outstanding", and chasing a debt needs both. */}
        <View style={styles.totals}>
          <Total label="Given" value={summary.totals.creditGiven} />
          <Total label="Taken" value={summary.totals.creditTaken} />
          <Total label="Received" value={summary.totals.paymentReceived} />
          <Total label="Paid" value={summary.totals.paymentPaid} />
        </View>
      </Card>

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label="Record credit"
            testID="go-record-credit"
            onPress={() => navigation.navigate("RecordCredit", { partyId, partyName })}
          />
        </View>
        <View style={styles.action}>
          <Button
            label="Record payment"
            variant="secondary"
            testID="go-record-payment"
            onPress={() => navigation.navigate("RecordPayment", { partyId, partyName })}
          />
        </View>
      </View>

      {rows.length === 0 ? (
        <Empty title="No entries for this party yet" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.id}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`entry-${item.id}`}>
              <View style={styles.rowMain}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowMeta}>
                  {item.date}
                  {item.note ? ` · ${item.note}` : ""}
                  {item.synced ? "" : " · not sent"}
                </Text>
              </View>
              <View style={styles.rowAmounts}>
                <Text style={[type.amountSmall, { color: balanceColor(item.signedAmount) }]}>
                  {item.signedAmount > 0 ? "+" : "−"}
                  {formatMoney(item.amount)}
                </Text>
                <Text style={[styles.running, { color: balanceColor(item.runningNet) }]}>
                  {formatMoney(item.runningNet)}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{formatMoney(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...type.label, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  totals: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xs },
  total: { minWidth: 84, gap: 2 },
  totalLabel: { ...type.caption, color: colors.textFaint },
  totalValue: { ...type.label, color: colors.text, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowMain: { flex: 1, gap: 2 },
  rowLabel: { ...type.body, fontWeight: "600", color: colors.text },
  rowMeta: { ...type.caption, color: colors.textMuted },
  rowAmounts: { alignItems: "flex-end", gap: 2 },
  running: { ...type.caption, fontVariant: ["tabular-nums"] },
});
