/**
 * Navigation.
 *
 * A single stack. Vyora's job on a phone is: see who owes what, open one of
 * them, record a credit or a payment. Tabs would give that shape a horizontal
 * axis it does not have.
 *
 * Setup is a screen rather than a modal because on a fresh install it is the
 * first thing that must happen, and a modal that cannot be dismissed is just a
 * screen that lies about being optional.
 */

import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../theme";
import { SetupScreen } from "../screens/SetupScreen";
import { PartyListScreen } from "../screens/PartyListScreen";
import { PartyDetailScreen } from "../screens/PartyDetailScreen";
import { RecordCreditScreen } from "../screens/RecordCreditScreen";
import { RecordPaymentScreen } from "../screens/RecordPaymentScreen";
import { SyncStatusScreen } from "../screens/SyncStatusScreen";

export type RootStackParamList = {
  Setup: undefined;
  Parties: undefined;
  PartyDetail: { partyId: string; partyName: string };
  RecordCredit: { partyId: string; partyName: string };
  RecordPayment: { partyId: string; partyName: string };
  SyncStatus: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Parties"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="Parties" component={PartyListScreen} options={{ title: "Vyora" }} />
        <Stack.Screen
          name="PartyDetail"
          component={PartyDetailScreen}
          options={({ route }) => ({ title: route.params.partyName })}
        />
        <Stack.Screen
          name="RecordCredit"
          component={RecordCreditScreen}
          options={{ title: "Record credit" }}
        />
        <Stack.Screen
          name="RecordPayment"
          component={RecordPaymentScreen}
          options={{ title: "Record payment" }}
        />
        <Stack.Screen name="SyncStatus" component={SyncStatusScreen} options={{ title: "Sync" }} />
        <Stack.Screen name="Setup" component={SetupScreen} options={{ title: "Development setup" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
