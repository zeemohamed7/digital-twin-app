import { ScrollView, Text, View, TouchableOpacity, Image } from "react-native";
import { useState, useCallback, useEffect } from "react";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/card";
import { CardTitle } from "@/components/ui/typography";
import { useColors } from "@/hooks/use-colors";
import { Building3DView } from "@/components/Building3DView";
import { HudGrid } from "@/components/ui/hud-grid";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { loadDemoBuildings } from "@/lib/demoBuildings";
import { confirmDestructive, notify } from "@/lib/alert";
import { LineChart, BarChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

// Same spacing system as the rest of the app: one 8px grid, page margin
// applied once at the top level. See app/(tabs)/index.tsx for the rationale.
const PAGE_MARGIN = 24;

// react-native-chart-kit wants an rgba() string with variable opacity for
// `chartConfig.color`, so palette hex tokens need converting at the edge.
const hexToRgba = (hex: string, opacity: number) => {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Same placeholder dataset the Analytics tab already used before this pass --
// not tied to a real field, so kept as a plain module-level constant rather
// than re-deriving it inside the component.
const monthlyEnergyCost = [8500, 9200, 8800, 9500, 10500, 11500];
const maxMonthlyCost = Math.max(...monthlyEnergyCost);

// Standard slippy-map tile formula, used to fetch a single static OSM tile
// centered on a building's real coordinates -- no map SDK/API key needed.
const latLonToTile = (lat: number, lon: number, zoom: number) => {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x, y };
};

interface Building {
  id: string;
  name: string;
  type: string;
  size: number;
  floors: number;
  location: string;
  lat?: number;
  lng?: number;
  image?: string;
  model3D?: any;
  solarModel?: any;
  createdAt: string;
  description?: string;
  currentEmissions?: number;
  energyConsumption?: number;
  isDemo?: boolean;
}

/** Compact number formatting matching the homepage's stat tiles (e.g. 9800 -> "9.8k"). */
function formatCompact(value?: number) {
  if (value === undefined) return "N/A";
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function LocationCard({ location, lat, lng }: { location: string; lat?: number; lng?: number }) {
  const colors = useColors();
  const zoom = 13;
  const tile = lat !== undefined && lng !== undefined ? latLonToTile(lat, lng, zoom) : null;

  return (
    <View
      className="rounded-2xl overflow-hidden"
      style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
    >
      <View style={{ position: "relative", height: tile ? 140 : undefined }}>
        {tile && (
          <>
            <Image
              source={{ uri: `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png` }}
              style={{ width: "100%", height: 140 }}
              resizeMode="cover"
            />
            <View
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(10,16,13,0.35)",
              }}
            />
            <View style={{ position: "absolute", top: "50%", left: "50%", marginLeft: -12, marginTop: -24 }}>
              <Ionicons name="location" size={24} color={colors.primary} />
            </View>
            <Text
              className="text-[9px]"
              style={{ position: "absolute", bottom: 6, right: 8, color: "rgba(255,255,255,0.6)" }}
            >
              © OpenStreetMap contributors
            </Text>
          </>
        )}
      </View>
      <View className="p-4">
        <Text
          className="font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: colors.primary }}
        >
          {"// Location"}
        </Text>
        <Text className="text-foreground text-lg font-bold" style={{ marginTop: 4 }}>
          {location}
        </Text>
      </View>
    </View>
  );
}

/** Small stat tile with an icon, matching the Analytics tab's plainer look (no glow/accent bar). */
function AnalyticsStat({
  icon,
  label,
  value,
  caption,
  captionColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  caption: string;
  captionColor: string;
}) {
  const colors = useColors();
  return (
    <View
      className="flex-1 rounded-xl p-4"
      style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
    >
      <Ionicons name={icon} size={16} color={colors.muted} />
      <Text className="text-muted text-xs" style={{ marginTop: 8 }}>
        {label}
      </Text>
      <Text className="text-foreground text-2xl font-bold" style={{ marginTop: 4 }}>
        {value}
      </Text>
      <Text className="text-xs" style={{ marginTop: 2, color: captionColor }}>
        {caption}
      </Text>
    </View>
  );
}

/**
 * A live-looking system reading. Same honest-simulation approach as
 * IoTDashboard (small random walk on an interval, clearly not real sensor
 * data) -- built locally rather than reusing IoTDashboard because that
 * component is shared with the SCE demo page and its own card styling
 * doesn't support this layout.
 */
function SystemMetric({
  icon,
  statusLabel,
  statusColor,
  initialValue,
  unit,
  label,
  min,
  max,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  statusLabel: string;
  statusColor: string;
  initialValue: number;
  unit: string;
  label: string;
  min: number;
  max: number;
}) {
  const colors = useColors();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const interval = setInterval(() => {
      setValue((prev) => {
        const next = prev + (Math.random() - 0.5) * (max - min) * 0.05;
        return Math.round(Math.max(min, Math.min(max, next)) * 10) / 10;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [min, max]);

  return (
    <View
      className="flex-1 rounded-xl p-4"
      style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
    >
      <View className="flex-row items-center justify-between">
        <Ionicons name={icon} size={16} color={colors.muted} />
        <View className="flex-row items-center gap-1.5">
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
          <Text
            className="font-mono text-[10px] font-bold uppercase tracking-widest"
            style={{ color: statusColor }}
          >
            {statusLabel}
          </Text>
        </View>
      </View>
      <Text className="text-foreground text-2xl font-bold" style={{ marginTop: 12 }}>
        {value}
      </Text>
      <Text className="text-muted text-xs" style={{ marginTop: 2 }}>
        {unit}
      </Text>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 12, paddingTop: 12 }}>
        <Text className="text-foreground text-sm">{label}</Text>
      </View>
    </View>
  );
}

/** Ring chart react-native-chart-kit's PieChart can't produce (its inner radius is hardcoded to 0) -- hand-built from the same data with react-native-svg. */
function Donut({ data }: { data: { name: string; value: number; color: string }[] }) {
  const colors = useColors();
  const size = 132;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulative = 0;

  return (
    <View className="flex-row items-center" style={{ gap: 24 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G transform={`rotate(-90, ${size / 2}, ${size / 2})`}>
            {data.map((d) => {
              const fraction = total > 0 ? d.value / total : 0;
              const dash = fraction * circumference;
              const strokeDashoffset = -cumulative * circumference;
              cumulative += fraction;
              return (
                <Circle
                  key={d.name}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={d.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={strokeDashoffset}
                  fill="transparent"
                />
              );
            })}
          </G>
        </Svg>
        <View
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="font-mono text-xs font-bold" style={{ color: colors.primary }}>
            CO<Text style={{ fontSize: 9 }}>2</Text>
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: 12 }}>
        {data.map((d) => (
          <View key={d.name} className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }} />
              <Text className="font-mono text-foreground text-sm font-bold">{d.name}</Text>
            </View>
            <Text className="font-mono text-foreground text-base font-bold">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function BuildingDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams();
  const [building, setBuilding] = useState<Building | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "systems" | "analytics">("overview");

  useFocusEffect(
    useCallback(() => {
      loadBuilding();
    }, [id])
  );

  const loadBuilding = async () => {
    try {
      // Ensure demo buildings (and any data added to them since, like
      // lat/lng) are freshly seeded before reading, same as the buildings
      // list screen -- otherwise a stale AsyncStorage entry from before a
      // field was added would silently miss it.
      await loadDemoBuildings();
      const data = await AsyncStorage.getItem("buildings");
      if (data) {
        const buildings = JSON.parse(data);
        const found = buildings.find((b: Building) => b.id === id);
        if (found) {
          // See buildings.tsx: older builds could persist a NaN size/floors
          // (typed non-numeric input) as null via JSON.stringify.
          setBuilding({
            ...found,
            size: Number.isFinite(found.size) ? found.size : 0,
            floors: Number.isFinite(found.floors) ? found.floors : 0,
          });
        }
      }
    } catch (error) {
      console.error("Failed to load building", error);
    }
  };

  const deleteBuilding = async () => {
    confirmDestructive(
      "Delete Building",
      "Are you sure you want to delete this building?",
      "Delete",
      async () => {
        try {
          const data = await AsyncStorage.getItem("buildings");
          if (data) {
            const buildings = JSON.parse(data);
            const filtered = buildings.filter((b: Building) => b.id !== id);
            await AsyncStorage.setItem("buildings", JSON.stringify(filtered));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          }
        } catch (error) {
          notify("Error", "Failed to delete building");
        }
      }
    );
  };

  if (!building) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <LoadingIndicator label="Loading Building" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View
          className="flex-row items-center justify-between"
          style={{ paddingHorizontal: PAGE_MARGIN, paddingTop: 16, paddingBottom: 16 }}
        >
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              style={{ marginRight: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-foreground text-xl font-bold" numberOfLines={1}>
                  {building.name}
                </Text>
                {building.isDemo && <Badge label="Sample" tone="sample" />}
              </View>
              <Text className="text-muted text-sm capitalize">{building.type}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/buildings/edit/${id}`);
              }}
              className="rounded-full items-center justify-center"
              style={{ width: 36, height: 36, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                deleteBuilding();
              }}
              className="rounded-full items-center justify-center"
              style={{ width: 36, height: 36, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row gap-2" style={{ paddingHorizontal: PAGE_MARGIN, paddingBottom: 16 }}>
          {(["overview", "systems", "analytics"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }}
              className="rounded-full px-4 py-2"
              style={{
                backgroundColor: activeTab === tab ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: activeTab === tab ? colors.primary : colors.border,
              }}
            >
              <Text
                className="font-mono text-xs font-bold uppercase tracking-widest"
                style={{ color: activeTab === tab ? "#05100D" : colors.muted }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: PAGE_MARGIN, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "overview" && (
            <Animated.View entering={FadeInDown.duration(400)}>
              {/* Location */}
              <LocationCard location={building.location} lat={building.lat} lng={building.lng} />

              {/* Stats */}
              <View className="gap-4" style={{ marginTop: 16 }}>
                <View className="flex-row gap-4">
                  <MetricCard
                    className="flex-1"
                    label="// Size"
                    value={building.size.toLocaleString()}
                    caption="sq ft"
                    tone="default"
                  />
                  <MetricCard
                    className="flex-1"
                    label="// Floors"
                    value={String(building.floors)}
                    caption="active levels"
                    tone="default"
                  />
                </View>
                <View className="flex-row gap-4">
                  <MetricCard
                    className="flex-1"
                    label="// Emissions"
                    value={formatCompact(building.currentEmissions)}
                    caption="tCO2e / yr"
                    tone="default"
                  />
                  <MetricCard
                    className="flex-1"
                    label="// Power"
                    value={
                      building.energyConsumption
                        ? (building.energyConsumption / 1000 / 365).toFixed(1)
                        : "N/A"
                    }
                    caption="MWh / day"
                    tone="default"
                  />
                </View>
              </View>

              {building.description && (
                <Text className="text-muted text-sm" style={{ marginTop: 16, lineHeight: 20 }}>
                  {building.description}
                </Text>
              )}

              {/* Visual Archive */}
              <View style={{ marginTop: 24 }}>
                <Text
                  className="font-mono text-xs uppercase tracking-[0.25em] text-muted"
                  style={{ marginBottom: 4 }}
                >
                  Visual Archive
                </Text>
                {building.model3D ? (
                  <>
                    <Text className="text-muted text-xs" style={{ marginBottom: 12 }}>
                      Static illustration, not a live 3D model
                    </Text>
                    <Building3DView buildingId={building.id} model3D={building.model3D} solarModel={building.solarModel} />
                  </>
                ) : (
                  <View
                    className="rounded-xl p-4"
                    style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
                  >
                    <Text className="text-muted text-sm">
                      No visual archive available for this building yet.
                    </Text>
                  </View>
                )}
              </View>

              {/* Quick Actions */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/simulations/new");
                }}
                className="bg-primary rounded-2xl p-4 flex-row items-center justify-between"
                style={{ marginTop: 24 }}
              >
                <View>
                  <Text className="text-lg font-bold" style={{ color: "#05100D" }}>
                    Run Simulation
                  </Text>
                  <Text className="text-sm" style={{ color: "#05100D", opacity: 0.75 }}>
                    Analyze carbon reduction scenarios
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={22} color="#05100D" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {activeTab === "systems" && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground text-3xl font-bold">Systems</Text>
                <Text
                  className="font-mono text-xs font-bold uppercase tracking-widest"
                  style={{ color: colors.primary }}
                >
                  {"// Active"}
                </Text>
              </View>
              <Text className="text-muted text-xs" style={{ marginTop: 4, marginBottom: 24 }}>
                Simulated, not connected to sensors
              </Text>

              <View className="gap-4">
                <View className="flex-row gap-4">
                  <SystemMetric
                    icon="flash"
                    statusLabel="Nominal"
                    statusColor={colors.primary}
                    initialValue={851.4}
                    unit="kW/h"
                    label="Energy Draw"
                    min={700}
                    max={1000}
                  />
                  <SystemMetric
                    icon="thermometer-outline"
                    statusLabel="Stable"
                    statusColor={colors.foreground}
                    initialValue={24.1}
                    unit="°C Avg"
                    label="Internal Core"
                    min={22}
                    max={26}
                  />
                </View>
                <View className="flex-row gap-4">
                  <SystemMetric
                    icon="cloud-outline"
                    statusLabel="Tracking"
                    statusColor={colors.muted}
                    initialValue={1250}
                    unit="kg/day"
                    label="CO2 Output"
                    min={1000}
                    max={1500}
                  />
                  <SystemMetric
                    icon="people-outline"
                    statusLabel="Steady"
                    statusColor={colors.foreground}
                    initialValue={78}
                    unit="%"
                    label="Occupancy"
                    min={50}
                    max={100}
                  />
                </View>
                <View className="flex-row gap-4">
                  <SystemMetric
                    icon="snow-outline"
                    statusLabel="Optimal"
                    statusColor={colors.primary}
                    initialValue={92}
                    unit="%"
                    label="HVAC Efficiency"
                    min={85}
                    max={98}
                  />
                  <SystemMetric
                    icon="sunny-outline"
                    statusLabel="Active"
                    statusColor={colors.primary}
                    initialValue={120}
                    unit="kW"
                    label="Solar Generation"
                    min={80}
                    max={150}
                  />
                </View>
              </View>

              {/* Carbon Delta -- real annual emissions figure, no fake trend/delta */}
              <View
                className="rounded-xl p-4"
                style={{ marginTop: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <View className="flex-row items-center gap-2">
                  <Text className="font-mono text-xs" style={{ color: colors.muted }}>
                    CO<Text style={{ fontSize: 8 }}>2</Text>
                  </Text>
                  <Text className="font-mono text-xs font-bold uppercase tracking-widest text-muted">
                    Carbon Delta
                  </Text>
                </View>
                <Text className="text-foreground text-3xl font-bold" style={{ marginTop: 8 }}>
                  {building.currentEmissions ? building.currentEmissions.toLocaleString() : "N/A"}
                </Text>
                <Text className="text-muted text-xs" style={{ marginTop: 2 }}>
                  Tons / YTD
                </Text>
              </View>

              {/* Subsystem Matrix */}
              <Text
                className="font-mono text-xs uppercase tracking-[0.25em] text-muted"
                style={{ marginBottom: 16 }}
              >
                Subsystem Matrix
              </Text>
              <View className="gap-3">
                {(
                  [
                    { icon: "flash", label: "Electrical System", status: "Active" },
                    { icon: "thermometer", label: "HVAC System", status: "Active" },
                    { icon: "water", label: "Water System", status: "Active" },
                    { icon: "cloudy", label: "Ventilation", status: "Active" },
                  ] as { icon: keyof typeof Ionicons.glyphMap; label: string; status: string }[]
                ).map((system, index) => (
                  <View
                    key={index}
                    className="rounded-xl p-4 flex-row items-center justify-between"
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      borderLeftWidth: 3,
                      borderLeftColor: colors.success,
                    }}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className="w-10 h-10 rounded-lg items-center justify-center"
                        style={{ backgroundColor: colors.success + "20" }}
                      >
                        <Ionicons name={system.icon} size={20} color={colors.success} />
                      </View>
                      <Text className="text-foreground font-semibold">{system.label}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.success }} />
                      <Text
                        className="font-mono text-[10px] uppercase tracking-widest"
                        style={{ color: colors.success }}
                      >
                        {system.status}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {activeTab === "analytics" && (
            <Animated.View entering={FadeInDown.duration(400)}>
              {/* Key Metrics */}
              <View className="flex-row gap-4">
                <AnalyticsStat
                  icon="cloud-outline"
                  label="Carbon Intensity"
                  value={
                    building.currentEmissions && building.size
                      ? ((building.currentEmissions / building.size) * 1000).toFixed(2)
                      : "N/A"
                  }
                  caption="kg CO2/sq ft"
                  captionColor={colors.secondary}
                />
                <AnalyticsStat
                  icon="flash"
                  label="Energy Intensity"
                  value={
                    building.energyConsumption && building.size
                      ? (building.energyConsumption / building.size).toFixed(1)
                      : "N/A"
                  }
                  caption="kWh/sq ft"
                  captionColor={colors.primary}
                />
              </View>

              <View
                className="rounded-xl p-4 flex-row items-center justify-between"
                style={{ marginTop: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <View>
                  <Text className="text-muted text-xs">Identified Savings</Text>
                  <Text className="text-foreground font-bold" style={{ marginTop: 2 }}>
                    Reduction Potential
                  </Text>
                </View>
                <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
                  32-45%
                </Text>
              </View>

              {/* Energy Consumption Trend */}
              <View
                className="rounded-xl p-4"
                style={{ marginBottom: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <View className="flex-row items-center justify-between" style={{ marginBottom: 12 }}>
                  <CardTitle>Energy Consumption</CardTitle>
                  <Text className="text-muted text-xs">12 MO</Text>
                </View>
                <View>
                  <LineChart
                    data={{
                      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                      datasets: [{
                        data: [
                          building.energyConsumption ? building.energyConsumption * 0.85 : 100,
                          building.energyConsumption ? building.energyConsumption * 0.92 : 110,
                          building.energyConsumption ? building.energyConsumption * 0.88 : 105,
                          building.energyConsumption ? building.energyConsumption * 0.95 : 115,
                          building.energyConsumption ? building.energyConsumption * 1.05 : 125,
                          building.energyConsumption ? building.energyConsumption * 1.15 : 135,
                          building.energyConsumption ? building.energyConsumption * 1.20 : 140,
                          building.energyConsumption ? building.energyConsumption * 1.18 : 138,
                          building.energyConsumption ? building.energyConsumption * 1.08 : 128,
                          building.energyConsumption ? building.energyConsumption * 0.98 : 118,
                          building.energyConsumption ? building.energyConsumption * 0.90 : 108,
                          building.energyConsumption ? building.energyConsumption * 0.87 : 103,
                        ]
                      }]
                    }}
                    width={Dimensions.get("window").width - 80}
                    height={220}
                    chartConfig={{
                      backgroundColor: colors.surface,
                      backgroundGradientFrom: colors.surface,
                      backgroundGradientTo: colors.surface,
                      decimalPlaces: 0,
                      color: (opacity = 1) => hexToRgba(colors.primary, opacity),
                      labelColor: (opacity = 1) => colors.muted,
                      style: { borderRadius: 16 },
                      propsForDots: {
                        r: "4",
                        strokeWidth: "2",
                        stroke: colors.primary
                      },
                      propsForBackgroundLines: { stroke: "transparent" }
                    }}
                    withVerticalLabels={false}
                    withHorizontalLabels={false}
                    withInnerLines={false}
                    withOuterLines={false}
                    bezier
                    style={{ marginVertical: 8, borderRadius: 16, marginLeft: -16 }}
                  />
                </View>
              </View>

              {/* Carbon Emissions Breakdown */}
              <View
                className="rounded-xl p-4"
                style={{ marginBottom: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <CardTitle style={{ marginBottom: 12 }}>Emissions by System</CardTitle>
                <Donut
                  data={[
                    { name: "HVAC", value: 45, color: colors.primary },
                    { name: "Lighting", value: 25, color: colors.muted },
                    { name: "Equipment", value: 20, color: colors.primary + "55" },
                    { name: "Other", value: 10, color: colors.border },
                  ]}
                />
              </View>

              {/* Monthly Cost Analysis */}
              <View
                className="rounded-xl overflow-hidden"
                style={{ position: "relative", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <HudGrid />
                <View style={{ padding: 16 }}>
                  <CardTitle style={{ marginBottom: 12 }}>Monthly Energy Cost</CardTitle>
                  <BarChart
                    data={{
                      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
                      datasets: [
                        {
                          data: monthlyEnergyCost,
                          colors: monthlyEnergyCost.map(
                            (value) => (opacity = 1) =>
                              value === maxMonthlyCost
                                ? hexToRgba(colors.success, opacity)
                                : hexToRgba(colors.success, opacity * 0.45)
                          )
                        }
                      ]
                    }}
                    width={Dimensions.get("window").width - 80}
                    height={220}
                    yAxisLabel="$"
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundColor: "transparent",
                      backgroundGradientFrom: "transparent",
                      backgroundGradientFromOpacity: 0,
                      backgroundGradientTo: "transparent",
                      backgroundGradientToOpacity: 0,
                      decimalPlaces: 0,
                      color: (opacity = 1) => hexToRgba(colors.primary, opacity),
                      labelColor: (opacity = 1) => colors.muted,
                      style: { borderRadius: 16 },
                      barRadius: 6,
                      formatTopBarValue: (value) =>
                        value === maxMonthlyCost ? `${(value / 1000).toFixed(0)}k` : ""
                    }}
                    withCustomBarColorFromData
                    flatColor
                    withHorizontalLabels={false}
                    withVerticalLabels={false}
                    style={{ marginVertical: 8, borderRadius: 16 }}
                    showValuesOnTopOfBars
                  />
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
