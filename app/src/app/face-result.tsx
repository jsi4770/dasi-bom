import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { FaceAnalysisResult } from '@/lib/api';

const SEVERITY_LABEL: Record<FaceAnalysisResult['severity'], string> = {
  normal: '정상',
  mild: '경미',
  moderate: '중등도',
  severe: '심함',
};

const SEVERITY_COLOR: Record<FaceAnalysisResult['severity'], string> = {
  normal: '#4CAF50',
  mild: '#F0B429',
  moderate: '#F08C3C',
  severe: '#D64545',
};

const REGION_LABEL: Record<string, string> = {
  forehead: '이마',
  nose: '코',
  left_cheek: '왼쪽 볼',
  right_cheek: '오른쪽 볼',
};

export default function FaceResultScreen() {
  const { photoUri, result: resultParam } = useLocalSearchParams<{
    photoUri: string;
    result: string;
  }>();
  const result: FaceAnalysisResult = JSON.parse(resultParam);
  const severityColor = SEVERITY_COLOR[result.severity];

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/')} hitSlop={12}>
            <ThemedText type="default">닫기</ThemedText>
          </TouchableOpacity>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            분석 결과
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {photoUri && (
            <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />
          )}

          <ThemedView type="backgroundElement" style={styles.summaryCard}>
            <ThemedText type="default" themeColor="textSecondary">
              종합 홍조 점수
            </ThemedText>
            <ThemedText type="title" style={styles.scoreText}>
              {result.redness_score}
              <ThemedText type="default" themeColor="textSecondary">
                {' '}
                / 100
              </ThemedText>
            </ThemedText>
            <View style={[styles.severityBadge, { backgroundColor: severityColor }]}>
              <ThemedText type="default" style={styles.severityBadgeText}>
                {SEVERITY_LABEL[result.severity]}
              </ThemedText>
            </View>
          </ThemedView>

          <ThemedText type="default" style={styles.sectionTitle}>
            부위별 점수
          </ThemedText>
          <View style={styles.regionList}>
            {Object.entries(result.region_scores).map(([region, score]) => (
              <View key={region} style={styles.regionRow}>
                <ThemedText type="default" style={styles.regionLabel}>
                  {REGION_LABEL[region] ?? region}
                </ThemedText>
                <ThemedView type="backgroundElement" style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${score}%`, backgroundColor: severityColor },
                    ]}
                  />
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary" style={styles.regionScore}>
                  {score}
                </ThemedText>
              </View>
            ))}
          </View>

          {result.excluded_regions.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              {result.excluded_regions.map((r) => REGION_LABEL[r] ?? r).join(', ')} 부위는 사진에서
              잘 안 보여서 점수에서 제외했어요.
            </ThemedText>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace('/face-capture')}>
            <ThemedText type="default" style={styles.secondaryButtonText}>
              다시 촬영하기
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/')}>
            <ThemedText type="default" style={styles.primaryButtonText}>
              홈으로
            </ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.three,
  },
  summaryCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  scoreText: {
    fontSize: 36,
  },
  severityBadge: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  severityBadgeText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontWeight: '600',
  },
  regionList: {
    gap: Spacing.two,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  regionLabel: {
    width: 72,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Spacing.two,
  },
  regionScore: {
    width: 32,
    textAlign: 'right',
  },
  note: {
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F0F0F3',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontWeight: '600',
  },
});
