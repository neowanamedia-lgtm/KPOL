/**
 * HomeScreen "추천 관심 대상" 영역의 단일 카드.
 * 작고 가벼움. generated_reason을 작은 회색 라벨로 표시. 우측에 [+] 추가 버튼.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatChange, formatCount } from '../../utils/format';
import { reasonLabel, type RecommendedTarget } from '../../types/widget';

interface Props {
  target: RecommendedTarget;
  added: boolean;
  onAdd: () => void;
  onOpen?: () => void;
}

export const RecommendedCard: React.FC<Props> = ({ target, added, onAdd, onOpen }) => {
  const p = target.preview;
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.left}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{target.title}</Text>
          <Text style={styles.reason} numberOfLines={1}>
            {reasonLabel[target.generated_reason]}
          </Text>
        </View>
        {target.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{target.subtitle}</Text>
        ) : null}
        {p && typeof p.mention_count === 'number' ? (
          <Text style={styles.metric}>
            {formatCount(p.mention_count)}
            {typeof p.mention_change === 'number' ? `  ${formatChange(p.mention_change)}` : ''}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onAdd}
        disabled={added}
        style={({ pressed }) => [
          styles.addBtn,
          added && styles.addBtnAdded,
          pressed && styles.addBtnPressed,
        ]}
      >
        <Text style={[styles.addText, added && styles.addTextAdded]}>
          {added ? '추가됨' : '+ 추가'}
        </Text>
      </Pressable>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  pressed: { opacity: 0.85 },
  left: {
    flex: 1,
    paddingRight: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  reason: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    letterSpacing: typography.letterSpacing.wide,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    marginTop: 2,
  },
  metric: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  addBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  addBtnPressed: { opacity: 0.7 },
  addBtnAdded: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
  },
  addText: {
    color: colors.accent,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.wide,
  },
  addTextAdded: {
    color: colors.textTertiary,
  },
});
