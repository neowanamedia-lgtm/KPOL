/**
 * 화면 푸터에 들어가는 시스템 라벨.
 * "Sample data for interface validation" 같은 단일 줄 표기.
 *
 * 경고/주의문 톤이 아닌 KPOL 터미널의 시스템 메타데이터.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../constants/theme';
import { useLastUpdate } from '../../hooks';

export const BasisFooter: React.FC = () => {
  const { data } = useLastUpdate();
  if (!data) return null;

  const line =
    data.data_mode === 'demo'
      ? 'Sample data for interface validation · News metrics are currently demo values'
      : data.basis_label;

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{line}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  text: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    letterSpacing: typography.letterSpacing.wide,
    opacity: 0.7,
  },
});
