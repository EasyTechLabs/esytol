/**
 * Shared pieces. Small on purpose — a component library invented ahead of the
 * screens that need it is a set of guesses.
 */

import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { balanceColor, colors, formatMoney, radius, spacing, type } from "../theme";

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Caption({ children }: { children: ReactNode }) {
  return <Text style={styles.caption}>{children}</Text>;
}

/** A balance. Never rendered without its label — a bare number invites the wrong reading. */
export function Money({ value, small }: { value: number; small?: boolean }) {
  return (
    <Text style={[small ? type.amountSmall : type.amount, { color: balanceColor(value) }]}>
      {formatMoney(value)}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  variant = "primary",
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  testID?: string;
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
        (disabled || pressed) && styles.buttonDim,
      ]}
    >
      <Text style={isPrimary ? styles.buttonPrimaryText : styles.buttonSecondaryText}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textFaint}
        accessibilityLabel={label}
        {...props}
      />
    </View>
  );
}

/** Pending / synced / blocked, in the merchant's terms rather than the queue's. */
export function SyncBadge({ pending, blocked }: { pending: number; blocked: number }) {
  if (blocked > 0) {
    return (
      <View style={[styles.badge, { backgroundColor: "#FDECEA" }]}>
        <Text style={[styles.badgeText, { color: colors.failed }]}>
          {blocked} need{blocked === 1 ? "s" : ""} attention
        </Text>
      </View>
    );
  }
  if (pending > 0) {
    return (
      <View style={[styles.badge, { backgroundColor: colors.warnSoft }]}>
        <Text style={[styles.badgeText, { color: colors.pending }]}>
          {pending} waiting to send
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: "#E7F5EE" }]}>
      <Text style={[styles.badgeText, { color: colors.synced }]}>All sent</Text>
    </View>
  );
}

export function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.caption}>{subtitle}</Text> : null}
    </View>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

/**
 * A development-only surface.
 *
 * Visually distinct on purpose: anything inside this is not merchant-facing,
 * and a screenshot should make that obvious without reading the words.
 */
export function DevNotice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.dev}>
      <Text style={styles.devLabel}>DEVELOPMENT</Text>
      {children}
    </View>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heading: { ...type.heading, color: colors.text },
  caption: { ...type.caption, color: colors.textMuted },
  field: { gap: spacing.xs },
  fieldLabel: { ...type.label, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  buttonDim: { opacity: 0.55 },
  buttonPrimaryText: { color: "#FFFFFF", ...type.heading },
  buttonSecondaryText: { color: colors.text, ...type.heading },
  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  badgeText: { ...type.caption, fontWeight: "600" },
  empty: { alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyTitle: { ...type.heading, color: colors.textMuted },
  dev: {
    backgroundColor: colors.devSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dev,
    padding: spacing.md,
    gap: spacing.sm,
  },
  devLabel: { ...type.caption, fontWeight: "700", color: colors.dev, letterSpacing: 1 },
  error: {
    backgroundColor: "#FDECEA",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.failed,
    padding: spacing.md,
  },
  errorText: { ...type.body, color: colors.failed },
});

export { styles as componentStyles };
