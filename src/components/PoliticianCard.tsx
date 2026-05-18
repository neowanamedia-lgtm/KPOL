import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { personTypeShortLabel } from '../constants/personType';
import { colors, spacing, typography } from '../constants/theme';
import type { PoliticianCardDTO } from '../services/dataProvider/types';
import { formatCount } from '../utils/format';
import { Card } from './Card';
import { MetricChange } from './MetricChange';
import { Tag } from './Tag';

interface Props {
  politician: PoliticianCardDTO;
  onPress?: (id: string) => void;
  compact?: boolean;
}

export const PoliticianCard: React.FC<Props> = ({ politician, onPress, compact }) => {
  const metaParts = [politician.party_name ?? politician.affiliation, politician.position_label].filter(
    (s): s is string => Boolean(s),
  );
  const meta = metaParts.join(' · ');

  return (
    <Card onPress={onPress ? () => onPress(politician.id) : undefined}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.typeLabel} numberOfLines={1}>
            {personTypeShortLabel[politician.person_type]}
          </Text>
          <Text style={styles.name}>{politician.name}</Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          {politician.region ? (
            <Text style={styles.region} numberOfLines={1}>
              {politician.region}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>
          <Text style={styles.count}>{formatCount(politician.mention_count)}</Text>
          <MetricChange value={politician.mention_change} size="sm" />
        </View>
      </View>

      {!compact && politician.keywords.length > 0 ? (
        <View style={styles.tagsRow}>
          {politician.keywords.slice(0, 4).map((kw) => (
            <Tag key={kw} label={kw} variant="muted" />
          ))}
        </View>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  left: {
    flex: 1,
    paddingRight: spacing.md,
  },
  right: {
    alignItems: 'flex-end',
  },
  typeLabel: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  name: {
    color: colors.textPrimary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: 2,
  },
  region: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    marginTop: 2,
    letterSpacing: typography.letterSpacing.wide,
  },
  count: {
    color: colors.textPrimary,
    fontSize: typography.size.xl,
    fontFamily: typography.mono,
    fontVariant: ['tabular-nums'],
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
});
