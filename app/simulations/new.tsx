import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert
} from 'react-native'
import { useState, useEffect, Fragment } from 'react'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Circle } from 'react-native-svg'

import { ScreenContainer } from '@/components/screen-container'
import { Badge } from '@/components/ui/badge'
import {
  analyzeCarbonImpact,
  type BuildingData,
  type SimulationScenario
} from '@/lib/carbonAnalysis'

type InterventionType = 'solar' | 'hvac' | 'wind' | 'envelope' | 'combined'

interface Building {
  id: string
  name: string
  type: string
  size: number
  floors: number
  location: string
  isDemo?: boolean
}

// Colors from .claude/stitch_ecotwin_buildings_dashboard_redesign/ecotwin_sovereign/DESIGN.md.
// Same values as app/buildings/add.tsx so the two multi-step flows read as
// one consistent system, not just individually DESIGN.md-compliant. Scoped
// locally here (not the shared theme.config.js) per "only touch this flow".
const THEME = {
  background: '#131314',
  surface: '#201f20',
  onSurface: '#e5e2e3',
  onSurfaceVariant: '#bacac5',
  outline: '#859490',
  outlineVariant: '#3c4a46',
  primary: '#57f1db',
  onPrimary: '#003731',
  error: '#ffb4ab',
  onError: '#690005'
}

const STEPS: {
  number: number
  label: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { number: 1, label: 'BUILDING', icon: 'business-outline' },
  { number: 2, label: 'STRATEGY', icon: 'flash-outline' },
  { number: 3, label: 'PARAMS', icon: 'options-outline' },
  { number: 4, label: 'REVIEW', icon: 'checkmark-done-outline' },
  { number: 5, label: 'RUN', icon: 'play-outline' }
]

function StepRail({ currentStep }: { currentStep: number }) {
  return (
    <View className="flex-row items-start">
      {STEPS.map((s, index) => {
        const isComplete = s.number < currentStep
        const isActive = s.number === currentStep
        const nodeColor = isComplete || isActive ? THEME.primary : THEME.outline
        return (
          <Fragment key={s.number}>
            {index > 0 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 17,
                  marginHorizontal: 4,
                  backgroundColor:
                    STEPS[index - 1].number < currentStep
                      ? THEME.primary
                      : THEME.outlineVariant
                }}
              />
            )}
            <View style={{ width: 52, alignItems: 'center' }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isActive ? 2 : 1,
                  borderColor: nodeColor,
                  backgroundColor: isComplete ? THEME.primary : 'transparent'
                }}
              >
                <Ionicons
                  name={isComplete ? 'checkmark' : s.icon}
                  size={16}
                  color={isComplete ? THEME.onPrimary : nodeColor}
                />
              </View>
              <Text
                className="font-mono"
                style={{
                  marginTop: 8,
                  fontSize: 9,
                  letterSpacing: 0.5,
                  color: isActive ? THEME.primary : THEME.outline
                }}
              >
                {s.label}
              </Text>
            </View>
          </Fragment>
        )
      })}
    </View>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-row items-center justify-between"
      style={{
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: THEME.outlineVariant
      }}
    >
      <Text
        className="font-mono"
        style={{
          color: THEME.onSurfaceVariant,
          fontSize: 11,
          letterSpacing: 1
        }}
      >
        {label}
      </Text>
      <Text
        className="font-sans"
        style={{ color: THEME.onSurface, fontSize: 14, fontWeight: '600' }}
      >
        {value}
      </Text>
    </View>
  )
}

function ReviewSection({
  icon,
  title,
  children
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  children: React.ReactNode
}) {
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 16,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.outlineVariant,
        marginBottom: 16
      }}
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Ionicons name={icon} size={14} color={THEME.primary} />
        <Text
          className="font-mono"
          style={{ color: THEME.primary, fontSize: 11, letterSpacing: 1 }}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  )
}

// Decorative only -- runSimulation() executes synchronously (no real
// multi-stage async job), so this ring/percentage doesn't track actual
// progress. It counts up once on mount purely for visual flavor, the same
// way HudGrid/glow are decorative elsewhere; the button below is tappable
// immediately regardless of where the count is, so no behavior changes.
function ComputeRing({ subtitle }: { subtitle: string }) {
  const size = 220
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const target = 100

  const [percent, setPercent] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const duration = 1800
    const id = setInterval(() => {
      const t = Math.min((Date.now() - start) / duration, 1)
      setPercent(target * t)
      if (t >= 1) clearInterval(id)
    }, 50)
    return () => clearInterval(id)
  }, [])

  const dashOffset = circumference * (1 - percent / 100)

  return (
    <View
      style={{
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: THEME.background,
        borderWidth: 1,
        borderColor: THEME.outlineVariant,
        marginBottom: 32
      }}
    >
      <View
        className="flex-row items-center justify-between"
        style={{
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: THEME.outlineVariant
        }}
      >
        <View className="flex-row" style={{ gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#ff5f57'
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#febc2e'
            }}
          />
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#28c840'
            }}
          />
        </View>
        <Text
          className="font-mono"
          style={{ color: THEME.outline, fontSize: 10, letterSpacing: 1 }}
        >
          NODE_SIM_001
        </Text>
      </View>

      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text
          className="font-mono"
          style={{
            color: THEME.onSurfaceVariant,
            fontSize: 11,
            letterSpacing: 1,
            marginBottom: 20
          }}
        >
          {subtitle}
        </Text>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={THEME.outlineVariant}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={THEME.primary}
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              fill="transparent"
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Text
              className="font-mono"
              style={{
                color: THEME.primary,
                fontSize: 11,
                letterSpacing: 2,
                marginBottom: 6
              }}
            >
              COMPUTING
            </Text>
            <Text
              className="font-sans"
              style={{
                color: THEME.onSurface,
                fontSize: 34,
                fontWeight: '700'
              }}
            >
              {percent.toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default function NewSimulationScreen() {
  const [step, setStep] = useState(1)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null
  )
  const [interventionType, setInterventionType] =
    useState<InterventionType | null>(null)

  // Configuration parameters
  const [solarCapacity, setSolarCapacity] = useState('300')
  const [hvacEfficiency, setHvacEfficiency] = useState('20')
  const [windTurbines, setWindTurbines] = useState('2')
  const [insulationUpgrade, setInsulationUpgrade] = useState('30')

  useEffect(() => {
    loadBuildings()
  }, [])

  const loadBuildings = async () => {
    try {
      const data = await AsyncStorage.getItem('buildings')
      if (data) {
        setBuildings(JSON.parse(data))
      }
    } catch (error) {
      console.error('Failed to load buildings', error)
    }
  }

  const interventionTypes: {
    type: InterventionType
    label: string
    description: string
    icon: keyof typeof Ionicons.glyphMap
  }[] = [
    {
      type: 'solar',
      label: 'Solar Panels',
      description: 'Rooftop photovoltaic installation',
      icon: 'sunny-outline'
    },
    {
      type: 'hvac',
      label: 'HVAC Optimization',
      description: 'High-efficiency climate control',
      icon: 'thermometer-outline'
    },
    {
      type: 'wind',
      label: 'Wind Turbines',
      description: 'On-site wind energy generation',
      icon: 'cloudy-outline'
    },
    {
      type: 'envelope',
      label: 'Building Envelope',
      description: 'Insulation and window upgrades',
      icon: 'construct-outline'
    },
    {
      type: 'combined',
      label: 'Combined Strategy',
      description: 'Multiple interventions together',
      icon: 'flash-outline'
    }
  ]

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (step < 5) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (step > 1) {
      setStep(step - 1)
    } else {
      router.back()
    }
  }

  const runSimulation = async () => {
    if (!selectedBuilding || !interventionType) {
      Alert.alert('Error', 'Please complete all steps')
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const buildingData: BuildingData = {
      size: selectedBuilding.size,
      floors: selectedBuilding.floors,
      location: selectedBuilding.location,
      buildingType: selectedBuilding.type as any
    }

    const scenario: SimulationScenario = {
      type: interventionType,
      parameters: {
        solarCapacity:
          interventionType === 'solar' || interventionType === 'combined'
            ? parseInt(solarCapacity)
            : undefined,
        hvacEfficiencyGain:
          interventionType === 'hvac' || interventionType === 'combined'
            ? parseInt(hvacEfficiency)
            : undefined,
        windTurbines:
          interventionType === 'wind' || interventionType === 'combined'
            ? parseInt(windTurbines)
            : undefined,
        envelopeUpgrade:
          interventionType === 'envelope' || interventionType === 'combined'
            ? true
            : undefined
      }
    }

    const results = analyzeCarbonImpact(buildingData, scenario)

    const simulation = {
      id: Date.now().toString(),
      buildingId: selectedBuilding.id,
      buildingName: selectedBuilding.name,
      interventionType,
      parameters: scenario.parameters,
      results,
      createdAt: new Date().toISOString()
    }

    try {
      const existing = await AsyncStorage.getItem('simulations')
      const simulations = existing ? JSON.parse(existing) : []
      simulations.push(simulation)
      await AsyncStorage.setItem('simulations', JSON.stringify(simulations))

      // Go straight to this simulation's own results, not the list
      router.replace({
        pathname: '/simulations/results',
        params: { simulationId: simulation.id }
      } as any)
    } catch (error) {
      Alert.alert('Error', 'Failed to save simulation')
    }
  }

  return (
    <ScreenContainer containerClassName="" className="">
      <View className="flex-1" style={{ backgroundColor: THEME.background }}>
        {/* Header */}
        <View
          style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 }}
        >
          <View
            className="flex-row items-center justify-between"
            style={{ marginBottom: 24 }}
          >
            <TouchableOpacity
              onPress={handleBack}
              className="rounded-full items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderWidth: 1,
                borderColor: THEME.outline
              }}
            >
              <Ionicons name="arrow-back" size={18} color={THEME.onSurface} />
            </TouchableOpacity>
            <Text
              style={{
                color: THEME.onSurface,
                fontSize: 18,
                fontWeight: '700'
              }}
            >
              New Simulation
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <StepRail currentStep={step} />
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Step 1: Select Building */}
          {step === 1 && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={{ paddingHorizontal: 24 }}
            >
              <Text
                className="font-mono"
                style={{
                  color: THEME.primary,
                  fontSize: 12,
                  letterSpacing: 2,
                  marginBottom: 8
                }}
              >
                {'// STEP 01'}
              </Text>
              <Text
                className="font-sans"
                style={{
                  color: THEME.onSurface,
                  fontSize: 32,
                  fontWeight: '600',
                  marginBottom: 8
                }}
              >
                Select Building
              </Text>
              <Text
                className="font-sans"
                style={{
                  color: THEME.onSurfaceVariant,
                  fontSize: 16,
                  marginBottom: 24
                }}
              >
                Choose a building to simulate
              </Text>

              {buildings.length === 0 ? (
                <View
                  className="items-center"
                  style={{
                    borderRadius: 16,
                    padding: 32,
                    backgroundColor: THEME.surface,
                    borderWidth: 1,
                    borderColor: THEME.outlineVariant
                  }}
                >
                  <Image
                    source={require('@/assets/images/empty-buildings.png')}
                    style={{ width: 120, height: 120, marginBottom: 16 }}
                    resizeMode="contain"
                  />
                  <Text
                    className="font-sans"
                    style={{
                      color: THEME.onSurfaceVariant,
                      textAlign: 'center',
                      marginBottom: 16
                    }}
                  >
                    No buildings added yet
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/buildings/add')}
                    style={{
                      borderRadius: 12,
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      backgroundColor: THEME.primary
                    }}
                  >
                    <Text
                      className="font-sans"
                      style={{ color: THEME.onPrimary, fontWeight: '600' }}
                    >
                      Add Your First Building
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {buildings.map((building) => {
                    const isSelected = selectedBuilding?.id === building.id
                    return (
                      <TouchableOpacity
                        key={building.id}
                        onPress={() => {
                          setSelectedBuilding(building)
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                        }}
                        className="flex-row items-start"
                        style={{
                          borderRadius: 16,
                          padding: 16,
                          backgroundColor: isSelected
                            ? THEME.primary + '1A'
                            : THEME.surface,
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected
                            ? THEME.primary
                            : THEME.outlineVariant
                        }}
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            marginRight: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: THEME.background
                          }}
                        >
                          <Ionicons
                            name="business-outline"
                            size={24}
                            color={
                              isSelected
                                ? THEME.primary
                                : THEME.onSurfaceVariant
                            }
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View
                            className="flex-row items-center gap-2"
                            style={{ marginBottom: 4 }}
                          >
                            <Text
                              className="font-sans"
                              style={{
                                color: THEME.onSurface,
                                fontSize: 17,
                                fontWeight: '600'
                              }}
                            >
                              {building.name}
                            </Text>
                            {building.isDemo && (
                              <Badge label="Sample" tone="sample" />
                            )}
                          </View>
                          <Text
                            className="font-sans capitalize"
                            style={{
                              color: THEME.onSurfaceVariant,
                              fontSize: 13
                            }}
                          >
                            {building.type} • {building.size.toLocaleString()}{' '}
                            sq ft • {building.floors} floors
                          </Text>
                          <Text
                            className="font-sans"
                            style={{
                              color: THEME.onSurfaceVariant,
                              fontSize: 13
                            }}
                          >
                            {building.location}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )}
            </Animated.View>
          )}

          {/* Step 2: Choose Intervention Type */}
          {step === 2 && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={{ paddingHorizontal: 24 }}
            >
              <Text
                className="font-mono"
                style={{
                  color: THEME.primary,
                  fontSize: 12,
                  letterSpacing: 2,
                  marginBottom: 8
                }}
              >
                {'// STEP 02'}
              </Text>
              <Text
                className="font-sans"
                style={{
                  color: THEME.onSurface,
                  fontSize: 32,
                  fontWeight: '600',
                  marginBottom: 8
                }}
              >
                Choose Intervention
              </Text>
              <Text
                className="font-sans"
                style={{
                  color: THEME.onSurfaceVariant,
                  fontSize: 16,
                  marginBottom: 24
                }}
              >
                Select sustainability strategy
              </Text>

              <View style={{ gap: 12 }}>
                {interventionTypes.map((item) => {
                  const isSelected = interventionType === item.type
                  return (
                    <TouchableOpacity
                      key={item.type}
                      onPress={() => {
                        setInterventionType(item.type)
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      }}
                      className="flex-row items-center"
                      style={{
                        borderRadius: 16,
                        padding: 16,
                        backgroundColor: isSelected
                          ? THEME.primary + '1A'
                          : THEME.surface,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected
                          ? THEME.primary
                          : THEME.outlineVariant
                      }}
                    >
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 12,
                          marginRight: 16,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: THEME.background,
                          borderWidth: 1,
                          borderColor: isSelected ? THEME.primary : THEME.outlineVariant
                        }}
                      >
                        <Ionicons
                          name={item.icon}
                          size={26}
                          color={isSelected ? THEME.primary : THEME.onSurfaceVariant}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          className="font-sans"
                          style={{
                            color: THEME.onSurface,
                            fontSize: 17,
                            fontWeight: '600'
                          }}
                        >
                          {item.label}
                        </Text>
                        <Text
                          className="font-sans"
                          style={{
                            color: THEME.onSurfaceVariant,
                            fontSize: 13,
                            marginTop: 2
                          }}
                        >
                          {item.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </Animated.View>
          )}

          {/* Step 3: Configure Parameters */}
          {step === 3 && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={{ paddingHorizontal: 24 }}
            >
              <Text
                className="font-mono"
                style={{
                  color: THEME.primary,
                  fontSize: 12,
                  letterSpacing: 2,
                  marginBottom: 8
                }}
              >
                {'// STEP 03'}
              </Text>
              <Text
                className="font-sans"
                style={{
                  color: THEME.onSurface,
                  fontSize: 32,
                  fontWeight: '600',
                  marginBottom: 8
                }}
              >
                Configure Parameters
              </Text>
              <Text
                className="font-sans"
                style={{
                  color: THEME.onSurfaceVariant,
                  fontSize: 16,
                  marginBottom: 24
                }}
              >
                Set intervention specifications
              </Text>

              <View style={{ gap: 20 }}>
                {(interventionType === 'solar' ||
                  interventionType === 'combined') && (
                  <View>
                    <Text
                      className="font-mono"
                      style={{
                        color: THEME.onSurfaceVariant,
                        fontSize: 11,
                        letterSpacing: 1,
                        marginBottom: 8
                      }}
                    >
                      SOLAR CAPACITY (KW)
                    </Text>
                    <TextInput
                      value={solarCapacity}
                      onChangeText={setSolarCapacity}
                      placeholder="300"
                      keyboardType="numeric"
                      placeholderTextColor={THEME.outline}
                      style={{
                        backgroundColor: THEME.background,
                        borderRadius: 12,
                        padding: 16,
                        color: THEME.onSurface,
                        borderWidth: 1,
                        borderColor: THEME.outlineVariant
                      }}
                    />
                    <Text
                      className="font-sans"
                      style={{
                        color: THEME.outline,
                        fontSize: 12,
                        marginTop: 6
                      }}
                    >
                      Typical: 200-500 kW for commercial buildings
                    </Text>
                  </View>
                )}

                {(interventionType === 'hvac' ||
                  interventionType === 'combined') && (
                  <View>
                    <Text
                      className="font-mono"
                      style={{
                        color: THEME.onSurfaceVariant,
                        fontSize: 11,
                        letterSpacing: 1,
                        marginBottom: 8
                      }}
                    >
                      HVAC EFFICIENCY GAIN (%)
                    </Text>
                    <TextInput
                      value={hvacEfficiency}
                      onChangeText={setHvacEfficiency}
                      placeholder="20"
                      keyboardType="numeric"
                      placeholderTextColor={THEME.outline}
                      style={{
                        backgroundColor: THEME.background,
                        borderRadius: 12,
                        padding: 16,
                        color: THEME.onSurface,
                        borderWidth: 1,
                        borderColor: THEME.outlineVariant
                      }}
                    />
                    <Text
                      className="font-sans"
                      style={{
                        color: THEME.outline,
                        fontSize: 12,
                        marginTop: 6
                      }}
                    >
                      Typical: 15-30% improvement
                    </Text>
                  </View>
                )}

                {(interventionType === 'wind' ||
                  interventionType === 'combined') && (
                  <View>
                    <Text
                      className="font-mono"
                      style={{
                        color: THEME.onSurfaceVariant,
                        fontSize: 11,
                        letterSpacing: 1,
                        marginBottom: 8
                      }}
                    >
                      NUMBER OF TURBINES
                    </Text>
                    <TextInput
                      value={windTurbines}
                      onChangeText={setWindTurbines}
                      placeholder="2"
                      keyboardType="numeric"
                      placeholderTextColor={THEME.outline}
                      style={{
                        backgroundColor: THEME.background,
                        borderRadius: 12,
                        padding: 16,
                        color: THEME.onSurface,
                        borderWidth: 1,
                        borderColor: THEME.outlineVariant
                      }}
                    />
                    <Text
                      className="font-sans"
                      style={{
                        color: THEME.outline,
                        fontSize: 12,
                        marginTop: 6
                      }}
                    >
                      Each turbine: ~50 kW capacity
                    </Text>
                  </View>
                )}

                {interventionType === 'envelope' && (
                  <View>
                    <Text
                      className="font-mono"
                      style={{
                        color: THEME.onSurfaceVariant,
                        fontSize: 11,
                        letterSpacing: 1,
                        marginBottom: 8
                      }}
                    >
                      INSULATION UPGRADE (%)
                    </Text>
                    <TextInput
                      value={insulationUpgrade}
                      onChangeText={setInsulationUpgrade}
                      placeholder="30"
                      keyboardType="numeric"
                      placeholderTextColor={THEME.outline}
                      style={{
                        backgroundColor: THEME.background,
                        borderRadius: 12,
                        padding: 16,
                        color: THEME.onSurface,
                        borderWidth: 1,
                        borderColor: THEME.outlineVariant
                      }}
                    />
                    <Text
                      className="font-sans"
                      style={{
                        color: THEME.outline,
                        fontSize: 12,
                        marginTop: 6
                      }}
                    >
                      Typical: 20-40% thermal improvement
                    </Text>
                  </View>
                )}

                {interventionType === 'combined' && (
                  <View
                    style={{
                      borderRadius: 12,
                      padding: 16,
                      backgroundColor: THEME.surface,
                      borderWidth: 1,
                      borderColor: THEME.outlineVariant
                    }}
                  >
                    <Text
                      className="font-sans"
                      style={{ color: THEME.onSurfaceVariant, fontSize: 13 }}
                    >
                      A building envelope upgrade (insulation + windows) is
                      included automatically as part of the combined strategy.
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={{ paddingHorizontal: 24 }}
            >
              <Text
                className="font-mono"
                style={{
                  color: THEME.primary,
                  fontSize: 12,
                  letterSpacing: 2,
                  marginBottom: 8
                }}
              >
                {'// STEP 04'}
              </Text>
              <Text
                className="font-sans"
                style={{
                  color: THEME.onSurface,
                  fontSize: 32,
                  fontWeight: '600',
                  marginBottom: 8
                }}
              >
                Review Configuration
              </Text>
              <Text
                className="font-sans"
                style={{
                  color: THEME.onSurfaceVariant,
                  fontSize: 16,
                  marginBottom: 24
                }}
              >
                Verify simulation parameters
              </Text>

              <ReviewSection icon="business-outline" title="// BUILDING">
                <ReviewRow label="NAME" value={selectedBuilding?.name || '-'} />
                <ReviewRow
                  label="SIZE"
                  value={
                    selectedBuilding
                      ? `${selectedBuilding.size.toLocaleString()} sq ft`
                      : '-'
                  }
                />
                <ReviewRow
                  label="FLOORS"
                  value={String(selectedBuilding?.floors ?? '-')}
                />
              </ReviewSection>

              <ReviewSection icon="flash-outline" title="// STRATEGY">
                <ReviewRow
                  label="TYPE"
                  value={
                    interventionType
                      ? interventionType.charAt(0).toUpperCase() +
                        interventionType.slice(1).replace('-', ' ')
                      : '-'
                  }
                />
              </ReviewSection>

              <ReviewSection icon="options-outline" title="// PARAMETERS">
                {(interventionType === 'solar' ||
                  interventionType === 'combined') && (
                  <ReviewRow label="SOLAR" value={`${solarCapacity} kW`} />
                )}
                {(interventionType === 'hvac' ||
                  interventionType === 'combined') && (
                  <ReviewRow
                    label="HVAC"
                    value={`${hvacEfficiency}% efficiency gain`}
                  />
                )}
                {(interventionType === 'wind' ||
                  interventionType === 'combined') && (
                  <ReviewRow
                    label="WIND"
                    value={`${windTurbines} turbines (${parseInt(windTurbines || '0') * 50} kW)`}
                  />
                )}
                {interventionType === 'envelope' && (
                  <ReviewRow
                    label="INSULATION"
                    value={`${insulationUpgrade}% upgrade`}
                  />
                )}
                {interventionType === 'combined' && (
                  <ReviewRow
                    label="ENVELOPE"
                    value="Insulation + windows included"
                  />
                )}
              </ReviewSection>
            </Animated.View>
          )}

          {/* Step 5: Running Simulation */}
          {step === 5 && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={{ paddingHorizontal: 24, alignItems: 'center' }}
            >
              <Text
                className="font-mono"
                style={{
                  color: THEME.primary,
                  fontSize: 12,
                  letterSpacing: 2,
                  marginBottom: 16,
                  alignSelf: 'flex-start'
                }}
              >
                {'// STEP 05'}
              </Text>

              <ComputeRing
                subtitle={`// ${(interventionType ?? 'SIMULATION').toUpperCase()} · ${selectedBuilding?.name ?? ''}`}
              />

              <Text
                className="font-sans"
                style={{
                  color: THEME.onSurface,
                  fontSize: 28,
                  fontWeight: '600',
                  marginBottom: 8,
                  textAlign: 'center'
                }}
              >
                Running Simulation
              </Text>
              <Text
                className="font-sans"
                style={{
                  color: THEME.onSurfaceVariant,
                  fontSize: 16,
                  marginBottom: 32,
                  textAlign: 'center'
                }}
              >
                Analyzing carbon impact and cost-benefit...
              </Text>

              <TouchableOpacity
                onPress={runSimulation}
                className="flex-row items-center justify-center"
                style={{
                  borderRadius: 16,
                  height: 56,
                  paddingHorizontal: 32,
                  backgroundColor: THEME.primary,
                  gap: 8,
                  shadowColor: THEME.primary,
                  shadowOpacity: 0.5,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 8
                }}
              >
                <Ionicons name="play" size={16} color={THEME.onPrimary} />
                <Text
                  className="font-mono"
                  style={{
                    color: THEME.onPrimary,
                    fontSize: 14,
                    fontWeight: '700',
                    letterSpacing: 1
                  }}
                >
                  VIEW RESULTS
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>

        {/* Navigation Buttons */}
        {step < 5 && (
          <View
            style={{
              padding: 24,
              borderTopWidth: 1,
              borderTopColor: THEME.outlineVariant
            }}
          >
            <TouchableOpacity
              onPress={handleNext}
              disabled={
                (step === 1 && !selectedBuilding) ||
                (step === 2 && !interventionType)
              }
              className="flex-row items-center justify-center"
              style={{
                borderRadius: 16,
                height: 56,
                backgroundColor: THEME.primary,
                opacity:
                  (step === 1 && !selectedBuilding) ||
                  (step === 2 && !interventionType)
                    ? 0.5
                    : 1
              }}
            >
              <Text
                className="font-mono"
                style={{
                  color: THEME.onPrimary,
                  fontSize: 14,
                  fontWeight: '700',
                  letterSpacing: 1,
                  marginRight: 8
                }}
              >
                CONTINUE
              </Text>
              <Ionicons
                name="arrow-forward"
                size={16}
                color={THEME.onPrimary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenContainer>
  )
}
