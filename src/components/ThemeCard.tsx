import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../constants/theme';
import type { ThemeFlowDTO } from '../services/dataProvider/types';
import { formatCount } from '../utils/format';
import { Card } from './Card';
import { MetricChange } from './MetricChange';

interface Props {
  theme: ThemeFlowDTO;
  onPress?: (id: string) => void;
}

export const ThemeCard: React.FC<Props> = ({ theme, onPress }) => {
  return (
    <Card
      style={styles.card}
      onPress={onPress ? () => onPress(theme.id) : undefined}
      variant="flat"
    >
      <Text style={styles.name} numberOfLines={1}>{theme.name}</Text>
      <Text style={styles.count}>{formatCount(theme.mention_count)}</Text>
      <MetricChange value={theme.mention_change} size="sm" />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 132,
    marginRight: spacing.sm,
  },
  name: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.sm,
  },
  count: {
    color: colors.textPrimary,
    fontSize: typography.size.xl,
    fontFamily: typography.mono,
    fontVariant: ['tabular-nums'],
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
});
