/**
 * "마지막 업데이트: 2026.05.19 03:20  ·  DEMO" 같은 시스템 라벨.
 *
 * Bloomberg 톤 — low-emphasis, mono-ish, 작은 글자.
 * data_mode === 'demo'일 때만 DEMO 꼬리 라벨을 노출한다.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../constants/theme';
import { useLastUpdate } from '../../hooks';

interface Props {
  align?: 'left' | 'right';
  prefix?: string;
}

export const LastUpdatedLabel: React.FC<Props> = ({ align = 'right', prefix = '마지막 업데이트' }) => {
  const { data } = useLastUpdate();
  if (!data) return null;

  return (
    <View style={[styles.row, align === 'left' ? styles.left : styles.right]}>
      <Text style={styles.text}>
        {prefix} · {data.age_label}
      </Text>
      {data.data_mode === 'demo' ? (
        <Text style={styles.badge}>DEMO</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    justifyContent: 'flex-start',
  },
  right: {
    justifyContent: 'flex-end',
  },
  text: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    letterSpacing: typography.letterSpacing.wide,
  },
  badge: {
    marginLeft: spacing.sm,
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    letterSpacing: typography.letterSpacing.wider,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
});
