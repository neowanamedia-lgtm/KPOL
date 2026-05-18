import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BasisFooter } from '../components/system/BasisFooter';
import { LastUpdatedLabel } from '../components/system/LastUpdatedLabel';
import { Card } from '../components/Card';
import { SectionHeader } from '../components/SectionHeader';
import { strings } from '../constants/strings';
import { colors, layout, spacing, typography } from '../constants/theme';
import type { MainTabScreenProps } from '../navigation/types';

interface Row {
  label: string;
  value?: string;
}

const aboutRows: Row[] = [
  { label: '버전', value: '0.1.0 · MVP' },
  { label: '데이터 단계', value: 'Demo Data (UI 구조 검증)' },
  { label: '업데이트 주기', value: '일 1회 / 6시간 1회 (예정)' },
];

const stageRows: Row[] = [
  { label: '현재 단계', value: '실제 뉴스 데이터 엔진 연결 전' },
  { label: '데이터 흐름', value: '서버 배치 → DB → 앱 (예정)' },
  { label: '키 발급', value: '선관위·국회·빅카인즈·Supabase (진행 예정)' },
];

const policyRows: Row[] = [
  { label: '의견', value: '제공하지 않음' },
  { label: '댓글·토론·좋아요', value: '제공하지 않음' },
  { label: '선거 예측·승패 표현', value: '제공하지 않음' },
  { label: '뉴스·공개 데이터', value: '사실 기반 흐름만 표시' },
];

export const SettingsScreen: React.FC<MainTabScreenProps<'Settings'>> = () => {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{strings.settings}</Text>
          <LastUpdatedLabel />
        </View>

        <View style={styles.section}>
          <SectionHeader title={strings.about} />
          <Card variant="flat">
            {aboutRows.map((row, idx) => (
              <RowItem key={row.label} row={row} isLast={idx === aboutRows.length - 1} />
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="현재 단계" />
          <Card variant="flat">
            {stageRows.map((row, idx) => (
              <RowItem key={row.label} row={row} isLast={idx === stageRows.length - 1} />
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title={strings.dataPolicy} />
          <Card variant="flat">
            {policyRows.map((row, idx) => (
              <RowItem key={row.label} row={row} isLast={idx === policyRows.length - 1} />
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title={strings.disclaimer} />
          <Card variant="flat">
            <Text style={styles.body}>{strings.disclaimerBody}</Text>
          </Card>
        </View>

        <BasisFooter />
      </ScrollView>
    </SafeAreaView>
  );
};

const RowItem: React.FC<{ row: Row; isLast: boolean }> = ({ row, isLast }) => (
  <View style={[styles.row, !isLast && styles.rowDivider]}>
    <Text style={styles.rowLabel}>{row.label}</Text>
    {row.value ? <Text style={styles.rowValue}>{row.value}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: 48,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.xxl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  section: { marginBottom: layout.sectionGap },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
  },
  rowValue: {
    color: colors.textPrimary,
    fontSize: typography.size.sm,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
});
