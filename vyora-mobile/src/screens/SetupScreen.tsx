/**
 * Development setup — where the API is and which synthetic workspace this build
 * speaks for.
 *
 * Both values are entered at runtime rather than compiled in. A string baked
 * into the bundle ships with the bundle; one typed into a device cannot appear
 * in a release binary no matter what anybody forgets to remove.
 *
 * The screen explains the emulator host alias rather than assuming a developer
 * remembers it. `127.0.0.1` inside an Android emulator is the emulator, not the
 * host machine, and the resulting timeout is indistinguishable from "the server
 * is down" — which sends people debugging the wrong thing.
 */

import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation";
import { useApp } from "../store/AppProvider";
import { ANDROID_EMULATOR_HOST, defaultBaseUrl } from "../api/config";
import { colors, spacing, type } from "../theme";
import { Button, Card, Caption, DevNotice, ErrorNotice, Field, Heading, Screen } from "../components";

type Props = NativeStackScreenProps<RootStackParamList, "Setup">;

export function SetupScreen({ navigation }: Props) {
  const { settings, saveSettings, decision } = useApp();
  const [baseUrl, setBaseUrl] = useState(settings.apiBaseUrl ?? "");
  const [identity, setIdentity] = useState(settings.identity ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBaseUrl(settings.apiBaseUrl ?? "");
    setIdentity(settings.identity ?? "");
  }, [settings.apiBaseUrl, settings.identity]);

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings({ apiBaseUrl: baseUrl.trim() || null, identity: identity.trim() || null });
    } finally {
      setSaving(false);
    }
  };

  const suggestion = defaultBaseUrl(Platform.OS);

  return (
    <Screen>
      <DevNotice>
        <Heading>This screen is not for merchants</Heading>
        <Caption>
          It points a development build at a local API using a synthetic fixture identity. A release
          build refuses the whole path regardless of what is entered here.
        </Caption>
      </DevNotice>

      <Card>
        <Field
          label="API base URL"
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder={suggestion}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          testID="setup-base-url"
        />
        <Caption>
          Leave blank to use {suggestion}.
          {Platform.OS === "android"
            ? ` On an Android emulator the host machine is ${ANDROID_EMULATOR_HOST} — 127.0.0.1 is the emulator itself, and pointing at it produces a timeout that looks exactly like a server being down.`
            : " On a physical device, use the host's address on your own network."}
        </Caption>

        <Field
          label="Development identity"
          value={identity}
          onChangeText={setIdentity}
          placeholder="A seeded synthetic workspace identity"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          testID="setup-identity"
        />
        <Caption>
          Sent as the X-Vyora-Dev-Identity header. The API refuses this scheme unless it was started
          with development auth, which it refuses in production.
        </Caption>

        <Button
          label={saving ? "Saving…" : "Save"}
          onPress={() => void save()}
          disabled={saving}
          testID="setup-save"
        />
      </Card>

      <Card>
        <Heading>Current status</Heading>
        {decision.enabled ? (
          <View style={styles.ok}>
            <Text style={styles.okText}>Configured — {decision.config.baseUrl}</Text>
          </View>
        ) : (
          <ErrorNotice message={decision.reason} />
        )}
        <Caption>
          Whatever this says, entries you record are saved on this device first and queued for
          delivery. Nothing here can cause an entry to be lost.
        </Caption>
        <Button label="Back to contacts" variant="secondary" onPress={() => navigation.navigate("Parties")} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ok: {
    backgroundColor: "#E7F5EE",
    borderRadius: 12,
    padding: spacing.md,
  },
  okText: { ...type.body, color: colors.synced },
});
