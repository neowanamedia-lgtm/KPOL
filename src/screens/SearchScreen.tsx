import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BasisFooter } from '../components/system/BasisFooter';
import { FilterChip } from '../components/FilterChip';
import { PoliticianCard } from '../components/PoliticianCard';
import { SectionHeader } from '../components/SectionHeader';
import {
  SEARCH_FILTER_TYPES,
  personTypeShortLabel,
} from '../constants/personType';
import { strings } from '../constants/strings';
import { colors, layout, radius, spacing, typography } from '../constants/theme';
import { useSearchResults } from '../hooks';
import type { MainTabScreenProps } from '../navigation/types';
import type { SearchFilter } from '../services/dataProvider/types';

export const SearchScreen: React.FC<MainTabScreenProps<'Search'>> = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const { data, loading } = useSearchResults(query, filter);

  const results = data?.results ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>검색</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={strings.searchPlaceholder}
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip
            label="전체"
            selected={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          {SEARCH_FILTER_TYPES.map((type) => (
            <FilterChip
              key={type}
              label={personTypeShortLabel[type]}
              selected={filter === type}
              onPress={() => setFilter(type)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <SectionHeader
            title={
              filter === 'all'
                ? query
                  ? '검색 결과'
                  : '전체'
                : personTypeShortLabel[filter]
            }
            subtitle={`${results.length}건`}
          />
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.textSecondary} />
            </View>
          ) : results.length === 0 ? (
            <Text style={styles.empty}>{strings.noResults}</Text>
          ) : (
            <View style={styles.stack}>
              {results.map((p) => (
                <PoliticianCard
                  key={p.id}
                  politician={p}
                  compact
                  onPress={(id) =>
                    navigation.navigate('PoliticianDetail', { politicianId: id })
                  }
                />
              ))}
            </View>
          )}
        </View>

        <BasisFooter />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  headerWrap: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: spacing.md,
  },
  inputWrap: {
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    height: 44,
    color: colors.textPrimary,
    fontSize: typography.size.base,
    letterSpacing: typography.letterSpacing.normal,
  },
  filterRow: {
    paddingRight: spacing.lg,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: 48,
  },
  section: { marginBottom: layout.sectionGap },
  stack: { gap: spacing.sm },
  empty: {
    color: colors.textTertiary,
    fontSize: typography.size.sm,
    paddingVertical: spacing.lg,
  },
  loadingWrap: { paddingVertical: spacing.xl, alignItems: 'center' },
});
