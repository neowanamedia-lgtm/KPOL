import React from 'react';

import type { TargetCardProps } from '../../types/widget';
import { TargetCardShell } from './TargetCardShell';
import { TargetMetricBlock } from './TargetMetricBlock';

export const RegionalOfficeTargetCard: React.FC<TargetCardProps & { onLongPress?: () => void }> = ({
  target,
  onOpen,
  onLongPress,
}) => {
  const p = target.preview;
  return (
    <TargetCardShell
      typeLabel="REGIONAL OFFICE"
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
            context={typeof p.member_count === 'number' ? `${p.member_count}인` : undefined}
          />
        ) : null
      }
    />
  );
};
