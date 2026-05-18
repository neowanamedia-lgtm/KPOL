import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';

interface Props {
  label: string;
  variant?: 'default' | 'muted';
}

export const Tag: React.FC<Props> = ({ label, variant = 'default' }) => {
  return (
    <View style={[styles.base, variant === 'muted' && styles.muted]}>
      <Text style={[styles.text, variant === 'muted' && styles.textMuted]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  muted: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  text: {
    color: colors.textPrimary,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  textMuted: {
    color: colors.textSecondary,
  },
});
