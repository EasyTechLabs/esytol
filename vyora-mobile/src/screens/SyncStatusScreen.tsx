/**
 * What has been sent, and what has not.
 *
 * The one screen that tells the truth about delivery. Two numbers matter and
 * they mean different things:
 *
 *   **waiting** — recorded here, not yet acknowledged. Normal. Nothing is
 *   wrong and nothing is lost; the queue will keep trying.
 *
 *   **needs attention** — the server refused and will refuse again. The entry
 *   is still on the device and still in the merchant's ledger; what stopped is
 *   the retrying. These have to be visible, or a permanently refused entry
 *   would sit in a queue forever with nothing ever saying so.
 *
 * "Try again" reuses the original idempotency key. If the first attempt did in
 * fact reach the server before whatever went wrong, the retry replays it rather
 * than recording the merchant's action a second time.
 */

import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { useApp } from "../store/AppProvider";
import { blocked as readBlocked, retryBlocked, type OutboxRow } from "../sync/outbox";
import { colors, radius, spacing, type } from "../theme";
import { Button, Card, Caption, DevNotice, ErrorNotice, Heading, Screen, SyncBadge } from "../components";

type Props = NativeStackScreenProps<RootStackParamList, "SyncStatus">;

export function SyncStatusScreen({ navigation }: Props) {
  const { db, status, syncNow, syncing, decision, revision, refresh } = useApp();
  const [stuck, setStuck] = useState<OutboxRow[]>([]);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    readBlocked(db).then((rows) => {
      if (!cancelled) setStuck(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [db, revision]);

  const retry = useCallback(
    async (id: number) => {
      if (!db) return;
      await retryBlocked(db, id);
      refresh();
      await syncNow();
    },
    [db, refresh, syncNow]
  );

  return (
    <Screen>
      <Card>
        <SyncBadge pending={status.pending} blocked={status.blocked} />
        <View style={styles.counts}>
          <Count label="Waiting" value={status.pending} />
          <Count label="Sent" value={status.sent} />
          <Count label="Needs attention" value={status.blocked} />
        </View>

        {status.lastResult?.stoppedBecause ? (
          <Caption>
            Last attempt stopped: {status.lastResult.stoppedBecause} Nothing was lost — every entry
            is still on this device.
          </Caption>
        ) : null}
        {status.lastRunAt ? <Caption>Last attempt {status.lastRunAt}</Caption> : null}

        <Button
          label={syncing ? "Sending…" : "Send now"}
          onPress={() => void syncNow()}
          disabled={!decision.enabled || syncing}
          testID="sync-now"
        />
      </Card>

      {!decision.enabled ? (
        <DevNotice>
          <Heading>The API is not configured</Heading>
          <Caption>{decision.reason}</Caption>
          <Button
            label="Open development setup"
            variant="secondary"
            onPress={() => navigation.navigate("Setup")}
          />
          <Caption>
            Entries you record are still saved on this device. They will queue until an API is
            reachable.
          </Caption>
        </DevNotice>
      ) : null}

      {stuck.length > 0 ? (
        <>
          <Heading>Refused by the server</Heading>
          <Caption>
            These will not be retried automatically. The entries remain in your ledger.
          </Caption>
          <FlatList
            data={stuck}
            keyExtractor={(row) => String(row.id)}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item }) => (
              <View style={styles.row} testID={`blocked-${item.id}`}>
                <Text style={styles.rowTitle}>
                  {item.kind} · {item.subjectId}
                </Text>
                <ErrorNotice message={item.lastError ?? "Refused, with no reason given."} />
                <Caption>{item.attempts} attempt{item.attempts === 1 ? "" : "s"}</Caption>
                <Button label="Try again" variant="secondary" onPress={() => void retry(item.id)} />
              </View>
            )}
          />
        </>
      ) : null}
    </Screen>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  counts: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.xs },
  count: { gap: 2 },
  countValue: { ...type.title, color: colors.text, fontVariant: ["tabular-nums"] },
  countLabel: { ...type.caption, color: colors.textMuted },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  rowTitle: { ...type.label, color: colors.text },
});
