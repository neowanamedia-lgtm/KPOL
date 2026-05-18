import React from 'react';

import type { TargetCardProps } from '../../types/widget';
import { TargetCardShell } from './TargetCardShell';
import { TargetMetricBlock } from './TargetMetricBlock';

export const PoliticianTargetCard: React.FC<TargetCardProps & { onLongPress?: () => void }> = ({
  target,
  onOpen,
  onLongPress,
}) => {
  const p = target.preview;
  return (
    <TargetCardShell
      typeLabel="POLITICIAN"
      title={target.title}
      subtitle={target.subtitle}
      pinned={target.pinned}
      onPress={onOpen ? () => onOpen(target) : undefined}
      onLongPress={onLongPress}
      rightSlot={
        p ? (
          <TargetMetricBlock
            mention_count={p.mention_count}
            mention_change={p.mention_change}
            flow_7d={p.flow_7d}
          />
        ) : null
      }
    />
  );
};
