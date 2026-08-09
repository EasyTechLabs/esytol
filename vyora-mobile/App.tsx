/**
 * Vyora mobile.
 *
 * The provider opens and migrates the device database before anything renders,
 * so no screen ever has to cope with a half-initialised ledger.
 */

import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "./src/store/AppProvider";
import { RootNavigator } from "./src/navigation";

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
