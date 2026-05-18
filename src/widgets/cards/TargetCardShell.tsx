/**
 * 홈에 표시되는 InterestTarget 카드의 공통 셸.
 * Bloomberg ticker 톤 — 작은 uppercase 타입 라벨, 큰 제목, 부제, 우측 메트릭.
 *
 * 액션:
 *   - tap → onPress (대상 상세로 이동)
 *   - long press → onLongPress (제거/고정 메뉴 — 호출자가 처리)
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';

import { colors, radius, spacing, typography } from '../../constants/theme';

interface Props {
  typeLabel: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  pinned?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export const TargetCardShell: React.FC<Props> = ({
  typeLabel,
  title,
  subtitle,
  rightSlot,
  pinned,
  onPress,
  onLongPress,
  style,
  children,
}) => {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      <View style={styles.topRow}>
        <Text style={styles.typeLabel} numberOfLines={1}>
          {typeLabel}
        </Text>
        {pinned ? <Text style={styles.pinDot}>● PINNED</Text> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.left}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {children}
        </View>
        {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeLabel: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  pinDot: {
    color: colors.accent,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    fontFamily: typography.mono,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    paddingRight: spacing.md,
  },
  right: {
    alignItems: 'flex-end',
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    marginTop: 2,
  },
});
