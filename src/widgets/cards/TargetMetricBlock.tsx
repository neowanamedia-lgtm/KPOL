/**
 * 카드 우측 메트릭 블록 — count + change(+sparkline 옵션).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FlowSparkline } from '../../components/FlowSparkline';
import { MetricChange } from '../../components/MetricChange';
import { colors, spacing, typography } from '../../constants/theme';
import type { FlowPointDTO } from '../../services/dataProvider/types';
import { formatCount } from '../../utils/format';

interface Props {
  mention_count?: number;
  mention_change?: number;
  flow_7d?: FlowPointDTO[];
  context?: string;            // "D-15", "24h"
}

export const TargetMetricBlock: React.FC<Props> = ({
  mention_count,
  mention_change,
  flow_7d,
  context,
}) => {
  return (
    <View style={styles.wrap}>
      {typeof mention_count === 'number' ? (
        <Text style={styles.count}>{formatCount(mention_count)}</Text>
      ) : null}
      {typeof mention_change === 'number' ? (
        <MetricChange value={mention_change} size="sm" />
      ) : null}
      {flow_7d && flow_7d.length > 0 ? (
        <View style={styles.sparkWrap}>
          <FlowSparkline data={flow_7d} height={20} />
        </View>
      ) : null}
      {context ? <Text style={styles.context}>{context}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-end',
    minWidth: 84,
  },
  count: {
    color: colors.textPrimary,
    fontSize: typography.size.xl,
    fontFamily: typography.mono,
    fontVariant: ['tabular-nums'],
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
  sparkWrap: {
    width: 70,
    marginTop: spacing.xs,
  },
  context: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    letterSpacing: typography.letterSpacing.wide,
    marginTop: 2,
  },
});
