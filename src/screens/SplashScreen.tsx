import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../constants/theme';
import { strings } from '../constants/strings';
import type { RootStackScreenProps } from '../navigation/types';

export const SplashScreen: React.FC<RootStackScreenProps<'Splash'>> = ({ navigation }) => {
  useEffect(() => {
    const t = setTimeout(() => {
      navigation.replace('Main');
    }, 900);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.brand}>{strings.appName}</Text>
        <View style={styles.line} />
        <Text style={styles.tagline}>{strings.appTagline}</Text>
      </View>
      <Text style={styles.footer}>KPOL v0.1 — Demo Data</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 48,
  },
  center: {
    alignItems: 'flex-start',
  },
  brand: {
    color: colors.textPrimary,
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.wider,
  },
  line: {
    height: 1,
    backgroundColor: colors.accent,
    width: 32,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    letterSpacing: typography.letterSpacing.wide,
  },
  footer: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
  },
});
