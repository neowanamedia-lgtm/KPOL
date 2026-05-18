/**
 * InterestTargetCard — InterestTarget.type에 따라 적절한 5개 카드 중 하나를 렌더.
 * HomeScreen "내 관심" 영역의 진입점.
 */

import React from 'react';

import type { InterestTarget } from '../../types/widget';
import { ClusterTargetCard } from './ClusterTargetCard';
import { DistrictTargetCard } from './DistrictTargetCard';
import { ElectionTargetCard } from './ElectionTargetCard';
import { PoliticianTargetCard } from './PoliticianTargetCard';
import { RegionalOfficeTargetCard } from './RegionalOfficeTargetCard';

interface Props {
  target: InterestTarget;
  onOpen?: (target: InterestTarget) => void;
  onLongPress?: (target: InterestTarget) => void;
}

export const InterestTargetCard: React.FC<Props> = ({ target, onOpen, onLongPress }) => {
  const longPress = onLongPress ? () => onLongPress(target) : undefined;
  const cardProps = { target, onOpen, onLongPress: longPress };

  switch (target.type) {
    case 'politician':
      return <PoliticianTargetCard {...cardProps} />;
    case 'district':
      return <DistrictTargetCard {...cardProps} />;
    case 'regional_office':
      return <RegionalOfficeTargetCard {...cardProps} />;
    case 'election':
      return <ElectionTargetCard {...cardProps} />;
    case 'issue_cluster':
      return <ClusterTargetCard {...cardProps} />;
    default:
      return null;
  }
};
