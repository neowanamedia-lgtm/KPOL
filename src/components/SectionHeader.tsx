import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../constants/theme';

interface Props {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}

export const SectionHeader: React.FC<Props> = ({ title, subtitle, rightSlot }) => {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {rightSlot ? <View>{rightSlot}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  left: {
    flexShrink: 1,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    marginTop: 2,
    letterSpacing: typography.letterSpacing.wide,
  },
});
