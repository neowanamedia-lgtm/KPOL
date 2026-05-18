/**
 * 미니 카드 그리드 컨테이너 — 3열 고정.
 * AddInterestTargetScreen에서 카테고리별로 사용.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../constants/theme';
import { InterestTargetMiniCard } from './InterestTargetMiniCard';
import type { AvailableTarget } from '../../services/dataProvider/types';

interface Props {
  items: AvailableTarget[];
  isAdded: (type: AvailableTarget['type'], target_ref: string) => boolean;
  onItemPress: (target: AvailableTarget) => void;
}

const COLS = 3;

export const InterestTargetGrid: React.FC<Props> = ({ items, isAdded, onItemPress }) => {
  return (
    <View style={styles.grid}>
      {items.map((t) => (
        <View key={`${t.type}:${t.target_ref}`} style={styles.cell}>
          <InterestTargetMiniCard
            target={t}
            added={isAdded(t.type, t.target_ref)}
            onPress={() => onItemPress(t)}
          />
        </View>
      ))}
    </View>
  );
};

const GAP = spacing.sm;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -GAP / 2,
  },
  cell: {
    width: `${100 / COLS}%`,
    paddingHorizontal: GAP / 2,
    marginBottom: GAP,
  },
});
