/**
 * HomeScreen — 관심 대상 터미널.
 *
 * 구조:
 *  - 헤더: KPOL 브랜드 + 6·3 D-카운트 + LastUpdatedLabel
 *  - "내 관심" 영역: InterestStore의 myInterests를 InterestTargetCard 리스트로
 *  - "추천 관심 대상" 영역: 자동 생성된 추천을 RecommendedCard로
 *  - 우측 하단 FAB [+] → AddInterestTargetScreen
 *
 * 기능 섹션 / 고정 카드 모음 톤을 제거하고
 * "관심 대상이 살아 움직이는 정치 흐름 터미널" 톤 유지.
 */

import React from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BasisFooter } from '../components/system/BasisFooter';
import { LastUpdatedLabel } from '../components/system/LastUpdatedLabel';
import { colors, layout, radius, spacing, typography } from '../constants/theme';
import { useInterestStore } from '../services/interestStore/InterestStore';
import { InterestTargetCard } from '../widgets/cards/InterestTargetCard';
import { RecommendedCard } from '../widgets/cards/RecommendedCard';
import type { MainTabScreenProps } from '../navigation/types';
import type { InterestTarget } from '../types/widget';

// 6·3 선거 D-카운트 (FAKE_TODAY 2026-05-19 기준)
const ELECTION_DATE = new Date('2026-06-03T00:00:00+09:00');
const FAKE_TODAY = new Date('2026-05-19T00:00:00+09:00');
const daysToElection = Math.max(
  0,
  Math.ceil((+ELECTION_DATE - +FAKE_TODAY) / (1000 * 60 * 60 * 24)),
);

export const HomeScreen: React.FC<MainTabScreenProps<'Home'>> = ({ navigation }) => {
  const { myInterests, recommended, loading, addTarget, removeTarget, togglePin, isAdded } =
    useInterestStore();

  const openTarget = (target: InterestTarget) => {
    // C6에서 InterestDetailScreen 신설 전까지 politician만 기존 라우트 사용
    if (target.type === 'politician') {
      navigation.navigate('PoliticianDetail', { politicianId: target.target_ref });
    } else {
      // 다른 타입은 임시 알림 — C6에서 통합 라우트
      Alert.alert(target.title, '상세 화면은 다음 단계(C6)에서 구현됩니다.');
    }
  };

  const showCardActions = (target: InterestTarget) => {
    const pinAction = target.pinned ? '핀 해제' : '핀 고정';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: target.title,
          options: [pinAction, '홈에서 제거', '취소'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (idx) => {
          if (idx === 0) togglePin(target.id);
          else if (idx === 1) removeTarget(target.id);
        },
      );
    } else {
      Alert.alert(target.title, undefined, [
        { text: pinAction, onPress: () => togglePin(target.id) },
        { text: '홈에서 제거', style: 'destructive', onPress: () => removeTarget(target.id) },
        { text: '취소', style: 'cancel' },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>KPOL</Text>
            <Text style={styles.tagline}>6·3 선거 흐름 터미널 · D-{daysToElection}</Text>
          </View>
          <LastUpdatedLabel />
        </View>

        {/* 내 관심 */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>내 관심</Text>
            <Text style={styles.sectionMeta}>{myInterests.length}</Text>
          </View>
          {loading ? (
            <Text style={styles.emptyHint}>관심 대상 불러오는 중…</Text>
          ) : myInterests.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>홈에 설치된 관심 대상이 없습니다</Text>
              <Text style={styles.emptyBody}>
                우측 하단 [+] 버튼으로 인물·선거구·지방선거·정책·이슈를 추가하세요.
              </Text>
            </View>
          ) : (
            <View style={styles.stack}>
              {myInterests.map((t) => (
                <InterestTargetCard
                  key={t.id}
                  target={t}
                  onOpen={openTarget}
                  onLongPress={showCardActions}
                />
              ))}
            </View>
          )}
        </View>

        {/* 추천 관심 대상 */}
        {recommended.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>추천 관심 대상</Text>
              <Text style={styles.sectionMeta}>뉴스 흐름 기반</Text>
            </View>
            <View style={styles.stack}>
              {recommended.map((rec) => (
                <RecommendedCard
                  key={rec.id}
                  target={rec}
                  added={isAdded(rec.type, rec.target_ref)}
                  onAdd={() => addTarget(rec)}
                  onOpen={() => Alert.alert(rec.title, '상세 화면은 다음 단계(C6)에서 구현됩니다.')}
                />
              ))}
            </View>
          </View>
        ) : null}

        <BasisFooter />
      </ScrollView>

      {/* FAB — 관심 대상 추가 */}
      <Pressable
        onPress={() => navigation.navigate('AddInterest')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.fabPlus}>＋</Text>
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 96,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  brand: {
    color: colors.textPrimary,
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.wider,
  },
  tagline: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    letterSpacing: typography.letterSpacing.wide,
    marginTop: 4,
  },
  section: { marginBottom: layout.sectionGap },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  sectionMeta: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    letterSpacing: typography.letterSpacing.wide,
  },
  stack: { gap: spacing.sm },
  emptyHint: {
    color: colors.textTertiary,
    fontSize: typography.size.sm,
    paddingVertical: spacing.lg,
  },
  emptyBox: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bgSurface,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    lineHeight: 19,
  },
  fab: {
    position: 'absolute',
    right: layout.screenPadding,
    bottom: spacing.xl,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: { opacity: 0.85 },
  fabPlus: {
    color: colors.accent,
    fontSize: 28,
    fontWeight: typography.weight.semibold,
    marginTop: -2,
  },
});
