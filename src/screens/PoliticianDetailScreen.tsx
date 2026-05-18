import React from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BasisFooter } from '../components/system/BasisFooter';
import { Card } from '../components/Card';
import { FlowSparkline } from '../components/FlowSparkline';
import { MetricChange } from '../components/MetricChange';
import { SectionHeader } from '../components/SectionHeader';
import { Tag } from '../components/Tag';
import { personTypeLabel } from '../constants/personType';
import { strings } from '../constants/strings';
import { colors, layout, spacing, typography } from '../constants/theme';
import { usePoliticianDetail } from '../hooks';
import type { RootStackScreenProps } from '../navigation/types';
import { formatCount, formatDateTime } from '../utils/format';

export const PoliticianDetailScreen: React.FC<
  RootStackScreenProps<'PoliticianDetail'>
> = ({ route }) => {
  const { politicianId } = route.params;
  const { data, loading } = usePoliticianDetail(politicianId);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>해당 인물을 찾을 수 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { profile, metrics, keywords, themes, related_articles } = data;
  const metaLine = [profile.party_name ?? profile.affiliation, profile.position_label]
    .filter((s): s is string => Boolean(s))
    .join(' · ');

  const openArticle = (url: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      /* no-op — 외부 브라우저 실패는 조용히 무시 */
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 기본 정보 */}
        <View style={styles.header}>
          <Text style={styles.typeLabel}>{personTypeLabel[profile.person_type]}</Text>
          <Text style={styles.name}>{profile.name}</Text>
          {metaLine ? <Text style={styles.meta}>{metaLine}</Text> : null}
          {profile.region ? <Text style={styles.region}>{profile.region}</Text> : null}
        </View>

        {/* 흐름 지표 */}
        <View style={styles.section}>
          <SectionHeader title={strings.recentFlow} subtitle="14d · 뉴스 언급량 기준" />
          <Card>
            <View style={styles.metricRow}>
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>오늘 언급</Text>
                <Text style={styles.metricValue}>{formatCount(metrics.today_mention_count)}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricCell}>
                <Text style={styles.metricLabel}>변화</Text>
                <View style={styles.changeWrap}>
                  <MetricChange value={metrics.mention_change} size="lg" />
                </View>
              </View>
            </View>
            <View style={styles.sparklineWrap}>
              <FlowSparkline data={metrics.flow_14d.map((p) => ({ date: p.date, value: p.value }))} height={64} />
            </View>
            <View style={styles.sparkAxis}>
              <Text style={styles.axisLabel}>14d</Text>
              <Text style={styles.axisLabel}>today</Text>
            </View>
          </Card>
        </View>

        {/* 연결 키워드 */}
        <View style={styles.section}>
          <SectionHeader title={strings.keywords} />
          <Card variant="flat">
            <View style={styles.tagsRow}>
              {keywords.map((kw) => (
                <Tag key={kw} label={kw} />
              ))}
            </View>
          </Card>
        </View>

        {/* 관련 테마 */}
        <View style={styles.section}>
          <SectionHeader title={strings.themes} />
          <Card variant="flat">
            <View style={styles.tagsRow}>
              {themes.map((t) => (
                <Tag key={t} label={t} variant="muted" />
              ))}
            </View>
          </Card>
        </View>

        {/* 근거 기사 */}
        <View style={styles.section}>
          <SectionHeader title={strings.recentNews} subtitle={`${related_articles.length}건 · 자동 집계`} />
          <View style={styles.newsList}>
            {related_articles.length === 0 ? (
              <Text style={styles.emptyText}>관련 기사가 없습니다.</Text>
            ) : (
              related_articles.map((n) => (
                <Pressable key={n.id} onPress={() => openArticle(n.url)}>
                  <Card variant="flat" style={styles.newsCard}>
                    <View style={styles.newsTopRow}>
                      <Text style={styles.newsTitle} numberOfLines={2}>{n.title}</Text>
                      {n.ai_summary_flag ? <Text style={styles.aiBadge}>AI 요약</Text> : null}
                    </View>
                    <View style={styles.newsMetaRow}>
                      <Text style={styles.newsSource}>{n.source}</Text>
                      <Text style={styles.newsDate}>{formatDateTime(n.published_at)}</Text>
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
          </View>
        </View>

        <BasisFooter />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 48,
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
  typeLabel: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  name: {
    color: colors.textPrimary,
    fontSize: typography.size.xxxl,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: typography.size.md,
    marginTop: spacing.xs,
  },
  region: {
    color: colors.textTertiary,
    fontSize: typography.size.sm,
    marginTop: 2,
    letterSpacing: typography.letterSpacing.wide,
  },
  section: { marginBottom: layout.sectionGap },
  metricRow: { flexDirection: 'row', alignItems: 'flex-start' },
  metricCell: { flex: 1 },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    alignSelf: 'stretch',
  },
  metricLabel: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wider,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: typography.size.xxl,
    fontFamily: typography.mono,
    fontVariant: ['tabular-nums'],
    fontWeight: typography.weight.semibold,
  },
  changeWrap: { marginTop: spacing.xs },
  sparklineWrap: { marginTop: spacing.lg },
  sparkAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  axisLabel: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    letterSpacing: typography.letterSpacing.wide,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  newsList: { gap: spacing.sm },
  newsCard: { paddingVertical: spacing.md },
  newsTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  newsTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.base,
    lineHeight: 20,
    flex: 1,
    paddingRight: spacing.sm,
  },
  aiBadge: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  newsMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  newsSource: {
    color: colors.textSecondary,
    fontSize: typography.size.xs,
  },
  newsDate: {
    color: colors.textTertiary,
    fontSize: typography.size.xs,
    fontFamily: typography.mono,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: typography.size.sm,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.screenPadding,
  },
  notFoundText: {
    color: colors.textSecondary,
    fontSize: typography.size.base,
  },
});
