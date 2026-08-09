/**
 * Who owes what.
 *
 * The first screen, and the one a merchant opens twenty times a day. It reads
 * straight from SQLite, so it renders with real numbers on the first frame
 * whether or not there is a connection — there is no loading state on the
 * happy path because there is nothing to wait for.
 *
 * Pending entries are marked per row rather than only in a global badge. "Two
 * things haven't sent" is much less useful than knowing *which* party's balance
 * the server has not seen yet.
 */

import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { useApp } from "../store/AppProvider";
import { listParties, type PartyListItem } from "../database/repository";
import { createParty } from "../features/ledger";
import { balanceColor, balanceLabel, colors, formatMoney, radius, spacing, type } from "../theme";
import { Button, Card, Empty, ErrorNotice, Field, Loading, Screen, SyncBadge } from "../components";

type Props = NativeStackScreenProps<RootStackParamList, "Parties">;

export function PartyListScreen({ navigation }: Props) {
  const { db, ready, error, revision, refresh, status, syncNow, syncing, decision } = useApp();
  const [parties, setParties] = useState<PartyListItem[] | null>(null);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!db) return;
    let cancelled = false;
    listParties(db).then((rows) => {
      if (!cancelled) setParties(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [db, revision]);

  const add = useCallback(async () => {
    if (!db || !name.trim()) return;
    setAdding(true);
    try {
      await createParty(db, { name: name.trim() });
      setName("");
      refresh();
    } finally {
      setAdding(false);
    }
  }, [db, name, refresh]);

  if (!ready) return <Loading label="Opening your ledger…" />;
  if (error) {
    return (
      <Screen>
        <ErrorNotice message={error} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.statusRow}>
        <SyncBadge pending={status.pending} blocked={status.blocked} />
        <View style={styles.statusActions}>
          <Pressable onPress={() => navigation.navigate("SyncStatus")} accessibilityRole="button">
            <Text style={styles.link}>Sync details</Text>
          </Pressable>
          <Pressable
            onPress={() => void syncNow()}
            disabled={!decision.enabled || syncing}
            accessibilityRole="button"
          >
            <Text style={[styles.link, (!decision.enabled || syncing) && styles.linkDim]}>
              {syncing ? "Sending…" : "Send now"}
            </Text>
          </Pressable>
        </View>
      </View>

      <Card>
        <Field
          label="Add a contact"
          value={name}
          onChangeText={setName}
          placeholder="Name"
          autoCapitalize="words"
          testID="new-party-name"
        />
        <Button
          label={adding ? "Adding…" : "Add contact"}
          onPress={() => void add()}
          disabled={adding || !name.trim()}
          testID="add-party"
        />
      </Card>

      {parties === null ? (
        <Loading />
      ) : parties.length === 0 ? (
        <Empty
          title="No contacts yet"
          subtitle="Add the first one above. It is saved on this device immediately."
        />
      ) : (
        <FlatList
          data={parties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              testID={`party-${item.id}`}
              onPress={() =>
                navigation.navigate("PartyDetail", { partyId: item.id, partyName: item.name })
              }
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.entryCount === 0
                    ? "No entries yet"
                    : `${balanceLabel(item.net)} · ${item.entryCount} entr${item.entryCount === 1 ? "y" : "ies"}`}
                  {item.pending > 0 ? ` · ${item.pending} not sent` : ""}
                </Text>
              </View>
              <Text style={[type.amountSmall, { color: balanceColor(item.net) }]}>
                {item.entryCount === 0 ? "—" : formatMoney(item.net)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusActions: { flexDirection: "row", gap: spacing.lg },
  link: { ...type.label, color: colors.accent },
  linkDim: { color: colors.textFaint },
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
  rowName: { ...type.body, fontWeight: "600", color: colors.text },
  rowMeta: { ...type.caption, color: colors.textMuted },
});
