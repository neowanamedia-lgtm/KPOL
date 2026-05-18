/**
 * AddInterestTargetScreen 그리드의 미니 카드.
 *
 * UX 목표: "정치 관심 대상을 홈에 설치" — 앱 아이콘 톤.
 * 정사각형 비율, 짧은 라벨, 작은 메트릭 한 줄, 추가 상태 표시.
 *
 * 단:
 *   - 색은 KPOL 톤 (블랙 + 미세 amber). 화려한 아이콘 금지.
 *   - 정당 색 / 사진 / 이모지 없음.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../constants/theme';
import { formatChange, formatCount } from '../../utils/format';
import type { AvailableTarget } from '../../services/dataProvider/types';

interface Props {
  target: AvailableTarget;
  added: boolean;
  onPress: () => void;
}

const TYPE_TAG: Record<AvailableTarget['type'], string> = {
  politician: 'PERSON',
  district: 'DIST',
  regional_office: 'REGN',
  election: 'ELEC',
  issue_cluster: 'ISSUE',
};

export const InterestTargetMiniCard: React.FC<Props> = ({ target, added, onPress }) => {
  const p = target.preview;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        added && styles.cardAdded,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.typeTag}>{TYPE_TAG[target.type]}</Text>
        {added ? <Text style={styles.addedDot}>●</Text> : null}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {target.title}
      </Text>

      {p && typeof p.mention_count === 'number' ? (
        <View style={styles.metricRow}>
          <Text style={styles.metric}>{formatCount(p.mention_count)}</Text>
          {typeof p.mention_change === 'number' ? (
            <Text style={[styles.change, p.mention_change >= 0 ? styles.changeUp : styles.changeDown]}>
              {formatChange(p.mention_change)}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.action}>{added ? '추가됨' : '+ 추가'}</Text>
    </Pressable>
  );
};

const CARD_PAD = 10;

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: CARD_PAD,
    justifyContent: 'space-between',
  },
  cardAdded: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgElevated,
  },
  pressed: { opacity: 0.8 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeTag: {
    color: colors.textTertiary,
    fontSize: 9,
    fontFamily: typography.mono,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.wider,
  },
  addedDot: {
    color: colors.accent,
    fontSize: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: 17,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metric: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    fontVariant: ['tabular-nums'],
  },
  change: {
    fontSize: 9,
    fontFamily: typography.mono,
    fontVariant: ['tabular-nums'],
  },
  changeUp: { color: colors.up },
  changeDown: { color: colors.down },
  action: {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: typography.mono,
    letterSpacing: typography.letterSpacing.wider,
  },
});
