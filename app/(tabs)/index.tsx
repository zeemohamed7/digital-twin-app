import { ScrollView, Text, View, TouchableOpacity, Image } from 'react-native'
import { Link, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import Animated, {
  FadeInDown,
  FadeInUp,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'

import { ScreenContainer } from '@/components/screen-container'
import { MetricCard } from '@/components/ui/card'
import { HudGrid } from '@/components/ui/hud-grid'
import { SectionHeader } from '@/components/ui/typography'
import { useColors } from '@/hooks/use-colors'
import { loadDemoBuildings } from '@/lib/demoBuildings'
import { loadAllSimulations, type FormattedSimulation } from '@/lib/simulations'

// Spacing system for this screen -- one 8px grid, applied once at the page
// level via PAGE_MARGIN. Buckets: 8 (micro/inline pairs), 16 (card-to-card,
// heading-to-content, icon-to-text), 32 (section-to-section).
const PAGE_MARGIN = 24

interface BuildingSummary {
  id: string
  isDemo?: boolean
}

interface Feature {
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
  code: string
  toneKey: 'primary' | 'secondary' | 'success'
}

const features: Feature[] = [
  {
    title: 'Digital Twin Visualization',
    description:
      'Convert building sketches into interactive 3D models with IoT sensor integration',
    icon: 'business',
    code: 'DTV',
    toneKey: 'primary'
  },
  {
    title: 'AI-Powered Analysis',
    description:
      'Intelligent carbon forecasting and cost-benefit analysis for sustainability interventions',
    icon: 'hardware-chip',
    code: 'AI',
    toneKey: 'secondary'
  },
  {
    title: 'Blockchain Carbon Accounting',
    description:
      'Immutable supply chain carbon tracking with verified Scope 3 emissions data',
    icon: 'link',
    code: 'BCA',
    toneKey: 'success'
  }
]

/** Slow-breathing status dot for the HUD header's "System online" readout. */
function StatusPulse() {
  const colors = useColors()
  const pulse = useSharedValue(0)

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    )
  }, [pulse])

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.5
  }))

  return (
    <Animated.View
      style={[
        {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.primary
        },
        pulseStyle
      ]}
    />
  )
}

/**
 * Bracket-framed image card used for hero imagery, matching the HUD
 * instrument aesthetic. Inset and rounded like every other card on the
 * page; the corner brackets sit on the whole card frame (photo + caption
 * bar together), and the caption -- when given -- is a separate label row
 * below the photo, not text overlaid on top of it.
 */
function FramedImage({
  source,
  height,
  caption
}: {
  source: number
  height: number
  caption?: string
}) {
  const colors = useColors()
  return (
    <View
      className="relative rounded-2xl overflow-hidden"
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface
      }}
    >
      <Image
        source={source}
        style={{ width: '100%', height }}
        resizeMode="cover"
      />
      {caption && (
        <View className="px-4 py-4">
          <Text className="font-mono text-xs uppercase tracking-[0.25em] text-muted">
            {caption}
          </Text>
        </View>
      )}
      <View
        style={{
          position: 'absolute',
          left: 8,
          top: 8,
          width: 12,
          height: 12,
          borderLeftWidth: 2,
          borderTopWidth: 2,
          borderColor: colors.primary
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 8,
          top: 8,
          width: 12,
          height: 12,
          borderRightWidth: 2,
          borderTopWidth: 2,
          borderColor: colors.primary
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 8,
          bottom: 8,
          width: 12,
          height: 12,
          borderLeftWidth: 2,
          borderBottomWidth: 2,
          borderColor: colors.primary
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
          width: 12,
          height: 12,
          borderRightWidth: 2,
          borderBottomWidth: 2,
          borderColor: colors.primary
        }}
      />
    </View>
  )
}

export default function HomeScreen() {
  const colors = useColors()
  const [buildings, setBuildings] = useState<BuildingSummary[]>([])
  const [simulations, setSimulations] = useState<FormattedSimulation[]>([])

  useFocusEffect(
    useCallback(() => {
      loadPortfolio()
    }, [])
  )

  const loadPortfolio = async () => {
    await loadDemoBuildings()
    const buildingsData = await AsyncStorage.getItem('buildings')
    setBuildings(buildingsData ? JSON.parse(buildingsData) : [])
    setSimulations(await loadAllSimulations())
  }

  // Real portfolio statistics -- these reflect whatever is actually stored
  // on this device, not a fixed demo-data count.
  const buildingsCount = buildings.length
  const simulationsCount = simulations.length
  const totalCO2Saved = simulations.reduce(
    (sum, sim) => sum + sim.results.projected.annualReduction,
    0
  )
  const totalSavings = simulations.reduce(
    (sum, sim) => sum + sim.results.financial.annualSavings,
    0
  )

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: PAGE_MARGIN,
          paddingBottom: 32
        }}
      >
        {/* HUD Header */}
        <Animated.View
          entering={FadeInUp.duration(800)}
          className="relative overflow-hidden pt-4"
        >
          <HudGrid />
          <View className="flex-row items-center gap-2 pt-2">
            <StatusPulse />
            <Text
              className="font-mono text-[10px] uppercase tracking-[0.25em]"
              style={{ color: colors.primary }}
            >
              System online
            </Text>
          </View>

          <Text
            className="mt-4 text-4xl font-bold tracking-tight"
            style={{
              color: colors.primary,
              textShadowColor: 'rgba(45, 212, 191, 0.4)',
              textShadowRadius: 8,
              textShadowOffset: { width: 0, height: 0 }
            }}
          >
            EcoTwin
          </Text>
          <Text
            className="mt-2 font-mono text-xs uppercase tracking-[0.2em]"
            style={{ color: colors.primary }}
          >
            Digital Twin Sustainability Platform
          </Text>
          <Text
            className="font-sans text-muted text-sm mt-2"
            style={{ maxWidth: '85%' }}
          >
            Proactive carbon reduction through AI-powered optimization
          </Text>
        </Animated.View>

        {/* Telemetry Stats */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={{ marginTop: 32 }}
        >
          <View className="gap-4 mb-4">
            <View className="flex-row gap-4">
              <MetricCard
                className="flex-1"
                label="Buildings"
                value={String(buildingsCount)}
                tone="primary"
              />
              <MetricCard
                className="flex-1"
                label="Simulations"
                value={String(simulationsCount)}
                tone="primary"
              />
            </View>
            <View className="flex-row gap-4">
              <MetricCard
                className="flex-1"
                label="CO2 Saved"
                value={`${Math.round(totalCO2Saved)}t`}
                tone="secondary"
              />
              <MetricCard
                className="flex-1"
                label="Cost Savings"
                value={`$${(totalSavings / 1000000).toFixed(1)}M`}
                tone="success"
              />
            </View>
          </View>
        </Animated.View>

        {/* Hero Image */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(600)}
          style={{ marginTop: 32 }}
        >
          <FramedImage
            source={require('@/assets/images/hero-sustainability.png')}
            height={220}
            caption="Smart Building · Eco-System"
          />
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View
          entering={FadeInDown.delay(600).duration(600)}
          style={{ marginTop: 32 }}
        >
          <SectionHeader className="font-mono text-xs uppercase tracking-[0.25em] text-muted mt-4 mb-4">
            {'Quick Actions'}
          </SectionHeader>
          <View className="flex-row gap-4">
            <Link href="/buildings/add" asChild onPress={handlePress}>
              <TouchableOpacity
                className="flex-1 rounded-2xl p-4"
                style={{
                  borderWidth: 1,
                  borderColor: colors.primary + '55',
                  backgroundColor: colors.primary + '1A'
                }}
              >
                <View
                  className="w-9 h-9 rounded-md items-center justify-center mb-4"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                </View>
                <Text className="font-sans text-foreground font-semibold text-sm">
                  Add Building
                </Text>
                <Text className="font-sans text-muted text-xs mt-2">
                  Upload or design new building
                </Text>
              </TouchableOpacity>
            </Link>

            <Link href="/simulations/new" asChild onPress={handlePress}>
              <TouchableOpacity
                className="flex-1 rounded-2xl p-4"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface
                }}
              >
                <View
                  className="w-9 h-9 rounded-md items-center justify-center mb-4"
                  style={{ backgroundColor: colors.secondary + '22' }}
                >
                  <Ionicons name="flash" size={18} color={colors.secondary} />
                </View>
                <Text className="font-sans text-foreground font-semibold text-sm">
                  New Simulation
                </Text>
                <Text className="font-sans text-muted text-xs mt-2">
                  Run carbon reduction scenario
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </Animated.View>

        {/* Platform Features */}
        <Animated.View
          entering={FadeInDown.delay(800).duration(600)}
          style={{ marginTop: 32 }}
        >
          <SectionHeader className="font-mono text-xs uppercase tracking-[0.25em] text-muted mt-2 mb-2">
            {'Platform Features'}
          </SectionHeader>
          <View className="gap-4">
            {features.map((f) => {
              const accent = colors[f.toneKey]
              return (
                <View
                  key={f.title}
                  className="flex-row items-start gap-4 rounded-xl p-4"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface
                  }}
                >
                  <View
                    className="w-9 h-9 rounded-md items-center justify-center"
                    style={{
                      borderWidth: 1,
                      borderColor: accent + '66',
                      backgroundColor: accent + '1A'
                    }}
                  >
                    <Ionicons name={f.icon} size={16} color={accent} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="font-sans text-foreground font-semibold text-sm">
                        {f.title}
                      </Text>
                      <Text
                        className="font-mono text-[9px] uppercase tracking-wider"
                        style={{ color: accent }}
                      >
                        {f.code}
                      </Text>
                    </View>
                    <Text className="font-sans text-muted text-xs mt-2">
                      {f.description}
                    </Text>
                  </View>
                </View>
              )
            })}
          </View>
        </Animated.View>

        {/* Digital Twin Concept Image */}
        <Animated.View
          entering={FadeInDown.delay(1000).duration(600)}
          style={{ marginTop: 32 }}
        >
          <SectionHeader className="font-mono text-xs uppercase tracking-[0.25em] text-muted mt-2 mb-2">
            {'Digital Twin Visualization'}
          </SectionHeader>
          <FramedImage
            source={require('@/assets/images/hero-digital-twin.png')}
            height={200}
          />
        </Animated.View>

        {/* AI Insights */}
        <Animated.View
          entering={FadeInDown.delay(1200).duration(600)}
          style={{ marginTop: 32 }}
        >
          <SectionHeader className="font-mono text-xs uppercase tracking-[0.25em] text-muted mb-2">
            {'AI Insights'}
          </SectionHeader>

          <View
            className="rounded-xl p-4 flex-row items-start gap-4"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface
            }}
          >
            <View
              className="w-8 h-8 rounded-full items-center justify-center mt-0.5"
              style={{ backgroundColor: colors.primary + '33' }}
            >
              <Ionicons name="bulb" size={16} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="font-sans text-foreground font-semibold mb-2">
                Get Started
              </Text>
              <Text className="font-sans text-muted text-sm">
                Add your first building to unlock AI-powered carbon reduction
                recommendations and simulation capabilities
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  )
}
