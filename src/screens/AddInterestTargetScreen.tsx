/**
 * AddInterestTargetScreen — 관심 대상 "설치" 화면.
 *
 * UX 목표:
 *   - 카테고리별 미니 카드 그리드 (앱 아이콘 톤)
 *   - 상단 검색으로 즉시 필터
 *   - 추가/추가됨 상태가 카드에 시각적으로 표시
 *
 * 데이터:
 *   - useAvailableTargets() — 전체 카탈로그
 *   - useInterestStore() — 추가/제거 액션 + 추가됨 여부
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BasisFooter } from '../components/system/BasisFooter';
import { colors, layout, radius, spacing, typography } from '../constants/theme';
import { useAvailableTargets } from '../hooks';
import { useInterestStore } from '../services/interestStore/InterestStore';
import { InterestTargetGrid } from '../widgets/grid/InterestTargetGrid';
import { normalizeNameQuery } from '../utils/format';
import type { RootStackScreenProps } from '../navigation/types';
import type {
  AvailableTarget,
  InterestCategory,
} from '../services/dataProvider/types';

const CATEGORY_ORDER: InterestCategory[] = [
  '인물',
  '선거구',
  '지방선거',
  '정책/주제',
  '지역',
  '선거',
  '이슈',
];

export const AddInterestTargetScreen: React.FC<RootStackScreenProps<'AddInterest'>> = ({
  navigation,
}) => {
  const { data, loading } = useAvailableTargets();
  const { addTarget, isAdded } = useInterestStore();
  const [query, setQuery] = useState('');

  const targets: AvailableTarget[] = data?.targets ?? [];

  const filtered = useMemo(() => {
    const q = normalizeNameQuery(query);
    if (!q) return targets;
    return targets.filter((t) => {
      const haystack = [
        t.title,
        t.subtitle ?? '',
        t.category,
        t.target_ref,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [targets, query]);

  const grouped = useMemo(() => {
    const map = new Map<InterestCategory, AvailableTarget[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return map;
  }, [filtered]);

  const handlePick = (t: AvailableTarget) => {
    if (isAdded(t.type, t.target_ref)) return;
    addTarget(t);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
            <Text style={styles.backText}>← 홈</Text>
          </Pressable>
          <Text style={styles.title}>관심 대상 설치</Text>
          <View style={{ width: 50 }} />
        </View>
        <Text style={styles.tagline}>인물 · 선거구 · 지방선거 · 정책 · 지역 · 선거 · 이슈</Text>

        <View style={styles.inputWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="이재명 · 종로 · 서울시장 · AI"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : (
          CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <View key={cat} style={styles.category}>
                <View style={styles.catHead}>
                  <Text style={styles.catTitle}>{cat}</Text>
                  <Text style={styles.catCount}>{items.length}</Text>
                </View>
                <InterestTargetGrid
                  items={items}
                  isAdded={isAdded}
                  onItemPress={handlePick}
                />
              </View>
            );
          })
        )}

        {!loading && filtered.length === 0 ? (
          <Text style={styles.noResult}>일치하는 관심 대상이 없습니다.</Text>
        ) : null}

        <BasisFooter />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  back: {
    paddingVertical: spacing.xs,
    width: 60,
  },
  backPressed: { opacity: 0.6 },
  backText: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.tight,
  },
  tagline: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    letterSpacing: typography.letterSpacing.wide,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  inputWrap: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  input: {
    height: 44,
    color: colors.textPrimary,
    fontSize: typography.size.base,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: 48,
  },
  category: { marginBottom: spacing.xxl },
  catHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  catTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  catCount: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
  },
  loadingWrap: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  noResult: {
    color: colors.textTertiary,
    fontSize: typography.size.sm,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
});
