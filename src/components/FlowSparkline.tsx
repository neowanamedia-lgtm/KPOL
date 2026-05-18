import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../constants/theme';
import type { FlowPoint } from '../types';

interface Props {
  data: FlowPoint[];
  height?: number;
}

/**
 * 외부 차트 라이브러리 의존 없이 막대 스파크라인으로 흐름을 표현.
 * 의도적으로 정적이고 차분한 시각화 — 애니메이션 없음.
 */
export const FlowSparkline: React.FC<Props> = ({ data, height = 56 }) => {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={[styles.row, { height }]}>
      {data.map((point, idx) => {
        const ratio = point.value / max;
        const barHeight = Math.max(2, ratio * height);
        const isLast = idx === data.length - 1;
        return (
          <View
            key={point.date}
            style={[
              styles.bar,
              {
                height: barHeight,
                backgroundColor: isLast ? colors.accent : colors.borderStrong,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
  },
  bar: {
    flex: 1,
    marginHorizontal: 1,
    borderRadius: 1,
  },
});
