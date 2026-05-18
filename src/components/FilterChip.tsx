import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../constants/theme';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export const FilterChip: React.FC<Props> = ({ label, selected, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
    marginRight: spacing.xs,
  },
  selected: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: typography.weight.medium,
  },
  labelSelected: {
    color: colors.textPrimary,
    fontWeight: typography.weight.semibold,
  },
});
