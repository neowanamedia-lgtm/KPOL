import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../constants/theme';
import { changeDirection, formatChange } from '../utils/format';

interface Props {
  /** 변화율 (%) */
  value: number;
  size?: 'sm' | 'md' | 'lg';
}

export const MetricChange: React.FC<Props> = ({ value, size = 'md' }) => {
  const direction = changeDirection(value);
  const color =
    direction === 'up' ? colors.up : direction === 'down' ? colors.down : colors.neutral;

  const fontSize =
    size === 'lg'
      ? typography.size.lg
      : size === 'sm'
      ? typography.size.sm
      : typography.size.base;

  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '•';

  return (
    <View style={styles.row}>
      <Text style={[styles.arrow, { color, fontSize: fontSize - 2 }]}>{arrow}</Text>
      <Text style={[styles.text, { color, fontSize }]}>{formatChange(value)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrow: {
    marginRight: spacing.xs,
  },
  text: {
    fontFamily: typography.mono,
    fontVariant: ['tabular-nums'],
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
});
