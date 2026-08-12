import { ScrollView, Text, View, TouchableOpacity } from 'react-native'
import { useEffect, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'

import { ScreenContainer } from '@/components/screen-container'
import { Badge } from '@/components/ui/badge'
import { MetricCard } from '@/components/ui/card'
import { LoadingIndicator } from '@/components/ui/loading-indicator'
import { useColors } from '@/hooks/use-colors'
import { getSimulationById, type FormattedSimulation } from '@/lib/simulations'

// Same spacing system as the rest of the app: one 8px grid, page margin
// applied once at the top level. See app/(tabs)/index.tsx for the rationale.
const PAGE_MARGIN = 24

// Financial values (e.g. implementationCost derived as costSavings / (roi/100))
// aren't always whole numbers. Plain .toLocaleString() defaults to showing up
// to 3 decimal places, producing artifacts like "$2,064,516.129" -- rounding
// to the nearest dollar first keeps every currency figure on this page a
// clean whole number with comma separators.
const formatCurrency = (value: number) =>
  `$${Math.round(value).toLocaleString()}`

export default function SimulationResultsScreen() {
  const colors = useColors()
  const { simulationId } = useLocalSearchParams()
  const [simulation, setSimulation] = useState<FormattedSimulation | null>(null)

  useEffect(() => {
    loadSimulation()
  }, [simulationId])

  const loadSimulation = async () => {
    try {
      const found = await getSimulationById(simulationId as string)
      setSimulation(found ?? null)
    } catch (error) {
      console.error('Failed to load simulation', error)
    }
  }

  if (!simulation) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <LoadingIndicator label="Loading Results" />
        </View>
      </ScreenContainer>
    )
  }

  const { results, buildingName, interventionType } = simulation
  const { baseline, projected, financial, confidence } = results
  const reductionPercentage =
    projected.reductionPercentage ||
    (projected.annualReduction / baseline.annualEmissions) * 100 ||
    0

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View
          style={{
            paddingHorizontal: PAGE_MARGIN,
            paddingTop: 16,
            paddingBottom: 16
          }}
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => {
                handlePress()
                router.back()
              }}
              className="rounded-full items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderWidth: 1,
                borderColor: colors.border
              }}
            >
              <Ionicons name="arrow-back" size={18} color={colors.foreground} />
            </TouchableOpacity>
            <View className="flex-row items-center gap-1.5">
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.primary
                }}
              />
              <Text
                className="font-mono text-[10px] font-bold uppercase tracking-widest"
                style={{ color: colors.primary }}
              >
                Simulation Complete
              </Text>
            </View>
          </View>

          <View
            className="flex-row items-center gap-2"
            style={{ marginTop: 16 }}
          >
            <Text className="text-foreground text-2xl font-bold capitalize">
              {interventionType.replace('-', ' ')} Strategy
            </Text>
            {simulation.isDemo && <Badge label="Sample" tone="sample" />}
          </View>
          <Text className="text-muted text-sm" style={{ marginTop: 4 }}>
            {buildingName}
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: PAGE_MARGIN,
            paddingBottom: 24
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero: reduction achieved + before/after */}
          <Animated.View
            entering={FadeInUp.duration(600)}
            style={{
              borderRadius: 24,
              padding: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface
            }}
          >
            <Text
              className="font-bold"
              style={{
                fontSize: 36,
                color: colors.primary,
                textShadowColor: colors.primary,
                textShadowRadius: 18,
                textShadowOffset: { width: 0, height: 0 }
              }}
            >
              {projected.annualReduction.toFixed(1)}t CO
              <Text style={{ fontSize: 16 }}>2</Text>
            </Text>
            <Text
              className="text-sm"
              style={{ color: colors.primary, marginTop: 4 }}
            >
              {projected.annualReduction.toFixed(1)} tons CO₂/year saved
            </Text>

            <View
              className="flex-row items-center justify-between"
              style={{ marginTop: 20 }}
            >
              <View
                className="rounded-2xl px-3 py-2"
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border
                }}
              >
                <Text className="font-mono text-[9px] uppercase tracking-widest text-muted">
                  Baseline
                </Text>
                <Text
                  className="text-foreground font-semibold"
                  style={{ marginTop: 2 }}
                >
                  {baseline.annualEmissions.toFixed(0)}t CO₂/yr
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.muted} />
              <View
                className="rounded-2xl px-3 py-2"
                style={{
                  backgroundColor: colors.primary + '1A',
                  borderWidth: 1,
                  borderColor: colors.primary
                }}
              >
                <Text
                  className="font-mono text-[9px] uppercase tracking-widest"
                  style={{ color: colors.primary }}
                >
                  Projected
                </Text>
                <Text
                  className="font-semibold"
                  style={{ color: colors.primary, marginTop: 2 }}
                >
                  {projected.annualEmissions.toFixed(0)}t CO₂/yr
                </Text>
              </View>
            </View>

            <View
              className="h-2 rounded-full overflow-hidden flex-row"
              style={{ marginTop: 16, backgroundColor: colors.background }}
            >
              <View
                style={{
                  width: `${100 - reductionPercentage}%`,
                  backgroundColor: colors.border
                }}
              />
              <View
                style={{
                  width: `${reductionPercentage}%`,
                  backgroundColor: colors.primary
                }}
              />
            </View>
            <Text
              className="text-xs text-center"
              style={{ marginTop: 8, color: colors.primary }}
            >
              ↓ {reductionPercentage.toFixed(1)}% reduction achieved
            </Text>
          </Animated.View>

          {/* Key results */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(600)}
            className="gap-4"
            style={{ marginTop: 24 }}
          >
            <View className="flex-row gap-4">
              <MetricCard
                className="flex-1 rounded-3xl"
                label="Carbon Reduction"
                value={`${reductionPercentage.toFixed(1)}%`}
                caption={`${projected.annualReduction.toFixed(1)} tons CO₂/year saved`}
                tone="success"
              />
              <MetricCard
                className="flex-1 rounded-3xl"
                label="Implementation Cost"
                value={formatCurrency(financial.implementationCost)}
                caption="One-time investment"
                tone="primary"
              />
            </View>
            <View className="flex-row gap-4 py-4">
              <MetricCard
                className="flex-1 rounded-3xl"
                label="Payback Period"
                value={`${financial.paybackPeriod.toFixed(1)} yrs`}
                caption={`ROI: ${financial.roi.toFixed(1)}%`}
                tone="secondary"
              />
              <MetricCard
                className="flex-1 rounded-3xl"
                label="Annual Savings"
                value={formatCurrency(financial.annualSavings)}
                caption="Energy cost reduction"
                tone="success"
              />
            </View>
            <MetricCard
              label="20-Year NPV"
              value={formatCurrency(financial.npv)}
              caption="Net present value"
              tone="primary"
            />
          </Animated.View>

          {/* Confidence */}
          <Animated.View
            entering={FadeInDown.delay(400).duration(600)}
            style={{
              marginTop: 24,
              borderRadius: 24,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface
            }}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-mono text-xs uppercase tracking-widest text-muted">
                {confidence.level} Confidence
              </Text>
              <Text className="font-bold" style={{ color: colors.primary }}>
                {confidence.percentage}%
              </Text>
            </View>
            <View
              className="h-2 rounded-full overflow-hidden"
              style={{ marginTop: 12, backgroundColor: colors.background }}
            >
              <View
                style={{
                  width: `${confidence.percentage}%`,
                  backgroundColor: colors.primary
                }}
              />
            </View>
            <View style={{ marginTop: 16, gap: 8 }}>
              {confidence.factors.map((factor, index) => (
                <View key={index} className="flex-row items-center gap-2">
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={colors.primary}
                  />
                  <Text className="text-foreground text-sm">{factor}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>

        {/* Actions */}
        <View
          style={{
            paddingHorizontal: PAGE_MARGIN,
            paddingVertical: 16,
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border
          }}
        >
          <TouchableOpacity
            onPress={() => {
              handlePress()
              router.push('/simulations/new')
            }}
            className="bg-primary rounded-2xl flex-row items-center justify-center gap-2"
            style={{ height: 52 }}
          >
            <Ionicons name="play" size={15} color="#05100D" />
            <Text
              className="font-mono uppercase tracking-widest font-bold text-sm"
              style={{ color: '#05100D' }}
            >
              Re-Run Simulation
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              handlePress()
              router.push('/(tabs)/simulations')
            }}
            className="rounded-2xl items-center"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingVertical: 14
            }}
          >
            <Text className="text-foreground font-semibold">
              View All Simulations
            </Text>
          </TouchableOpacity>

          <View
            className="rounded-2xl flex-row items-center justify-center gap-2"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              opacity: 0.6,
              paddingVertical: 14
            }}
          >
            <Ionicons
              name="document-text-outline"
              size={18}
              color={colors.muted}
            />
            <Text className="text-muted font-semibold">Export PDF Report</Text>
            <Badge label="Coming soon" tone="neutral" />
          </View>
        </View>
      </View>
    </ScreenContainer>
  )
}
