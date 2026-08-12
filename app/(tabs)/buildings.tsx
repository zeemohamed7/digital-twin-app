import { ScrollView, Text, View, TouchableOpacity, Image, TextInput } from "react-native";
import { useState } from "react";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { loadDemoBuildings } from "@/lib/demoBuildings";

import { ScreenContainer } from "@/components/screen-container";
import { Badge } from "@/components/ui/badge";
import { useColors } from "@/hooks/use-colors";
import { confirmDestructive, notify } from "@/lib/alert";

// Same spacing system as the homepage: one 8px grid, page margin applied
// once at the top level. See app/(tabs)/index.tsx for the full rationale.
const PAGE_MARGIN = 24;

const buildingTypeIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  office: "business",
  residential: "home",
  industrial: "cog",
  retail: "storefront",
};

interface Building {
  id: string;
  name: string;
  type: string;
  size: number;
  floors: number;
  location: string;
  image?: string;
  createdAt: string;
  isDemo?: boolean;
}

export default function BuildingsScreen() {
  const colors = useColors();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      // Load demo buildings first, then load all buildings
      loadDemoBuildings().then(() => {
        loadBuildings();
      });
    }, [])
  );

  const loadBuildings = async () => {
    try {
      const data = await AsyncStorage.getItem("buildings");
      if (data) {
        const parsed: Building[] = JSON.parse(data);
        // Older builds could persist NaN size/floors (typed non-numeric input),
        // which JSON.stringify silently turns into null -- coerce those back
        // to 0 so a previously-corrupted record doesn't crash this screen.
        const sanitized = parsed.map((b) => ({
          ...b,
          size: Number.isFinite(b.size) ? b.size : 0,
          floors: Number.isFinite(b.floors) ? b.floors : 0,
        }));
        setBuildings(sanitized);
      }
    } catch (error) {
      console.error("Failed to load buildings", error);
    }
  };

  const deleteBuilding = async (id: string) => {
    confirmDestructive(
      "Delete Building",
      "Are you sure you want to delete this building?",
      "Delete",
      async () => {
        try {
          const filtered = buildings.filter((b) => b.id !== id);
          await AsyncStorage.setItem("buildings", JSON.stringify(filtered));
          setBuildings(filtered);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          notify("Error", "Failed to delete building");
        }
      }
    );
  };

  const filteredBuildings = buildings.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScreenContainer>
      <View className="flex-1">
        {/* Header */}
        <View style={{ paddingHorizontal: PAGE_MARGIN, paddingTop: 16, paddingBottom: 16 }}>
          <View
            className="flex-row items-center gap-2 rounded-xl px-4"
            style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
          >
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search buildings..."
              placeholderTextColor={colors.muted}
              className="flex-1 text-foreground"
              style={{ paddingVertical: 12 }}
            />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: PAGE_MARGIN, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {buildings.length === 0 ? (
            <Animated.View
              entering={FadeInDown.duration(400)}
              style={{ alignItems: "center", justifyContent: "center", paddingVertical: 64 }}
            >
              <Image
                source={require("@/assets/images/empty-buildings.png")}
                style={{ width: 200, height: 200, marginBottom: 16 }}
                resizeMode="contain"
              />
              <Text className="text-foreground text-xl font-bold mb-2">No Buildings Yet</Text>
              <Text className="text-muted text-center mb-6 px-8">
                Add your first building to start analyzing carbon reduction opportunities
              </Text>
              <Link href="/buildings/add" asChild>
                <TouchableOpacity
                  onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                  className="bg-primary rounded-xl px-6 py-3 flex-row items-center gap-2"
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text className="text-white font-semibold">Add Building</Text>
                </TouchableOpacity>
              </Link>
            </Animated.View>
          ) : (
            <>
              {/* Add Building */}
              <Link href="/buildings/add" asChild>
                <TouchableOpacity
                  onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                  className="rounded-2xl p-4 flex-row items-center justify-between"
                  style={{
                    marginBottom: 24,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <View>
                    <Text className="text-foreground text-lg font-bold">Add New Building</Text>
                    <Text className="text-muted text-sm mt-1">Upload or design from scratch</Text>
                  </View>
                  <View
                    className="w-14 h-14 rounded-full items-center justify-center"
                    style={{ borderWidth: 1, borderColor: colors.primary }}
                  >
                    <Ionicons name="add" size={22} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              </Link>

              {/* Section label */}
              <Text
                className="font-mono text-sm font-bold uppercase tracking-[0.25em]"
                style={{ color: colors.primary, marginBottom: 16 }}
              >
                Buildings ({filteredBuildings.length})
              </Text>

              {/* Buildings List */}
              <View className="gap-4" style={{ paddingBottom: 8 }}>
                {filteredBuildings.map((building, index) => (
                  <Animated.View
                    key={building.id}
                    entering={FadeInDown.delay(index * 100).duration(400)}
                  >
                    <View
                      className="rounded-2xl overflow-hidden"
                      style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
                    >
                      <View style={{ position: "relative" }}>
                        {building.image ? (
                          <Image
                            source={typeof building.image === "string" ? { uri: building.image } : building.image}
                            style={{ width: "100%", height: 220 }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            className="w-full items-center justify-center"
                            style={{ height: 220, backgroundColor: colors.primary + "20" }}
                          >
                            <Ionicons
                              name={buildingTypeIcon[building.type] ?? "business"}
                              size={56}
                              color={colors.primary}
                            />
                          </View>
                        )}
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.85)"]}
                          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "65%" }}
                        />
                        <View style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
                          <Text className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/80">
                            {building.type}
                          </Text>
                          <Text className="text-white text-xl font-bold" style={{ marginTop: 4 }}>
                            {building.name}
                          </Text>
                        </View>
                        {building.isDemo && (
                          <View style={{ position: "absolute", top: 8, right: 8 }}>
                            <Badge label="Sample" tone="sample" />
                          </View>
                        )}
                      </View>

                      <View className="p-4">
                        <View className="flex-row gap-4">
                          <View className="flex-1">
                            <Text className="font-mono text-[10px] uppercase tracking-widest text-muted">
                              Size
                            </Text>
                            <Text className="text-foreground font-semibold text-sm" style={{ marginTop: 4 }}>
                              {building.size.toLocaleString()} sq ft
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="font-mono text-[10px] uppercase tracking-widest text-muted">
                              Floors
                            </Text>
                            <Text className="text-foreground font-semibold text-sm" style={{ marginTop: 4 }}>
                              {building.floors}
                            </Text>
                          </View>
                        </View>

                        <View className="flex-row items-center gap-1" style={{ marginTop: 16 }}>
                          <Ionicons name="location" size={14} color={colors.muted} />
                          <Text className="text-muted text-sm">{building.location}</Text>
                        </View>

                        {/* Actions */}
                        <View className="flex-row gap-2" style={{ marginTop: 16 }}>
                          <TouchableOpacity
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              router.push(`/buildings/${building.id}`);
                            }}
                            className="flex-1 bg-primary rounded-xl flex-row items-center justify-center gap-2"
                            style={{ height: 48 }}
                          >
                            <View
                              style={{
                                position: "absolute",
                                left: 8,
                                top: 8,
                                width: 10,
                                height: 10,
                                borderLeftWidth: 2,
                                borderTopWidth: 2,
                                borderColor: "#05100D",
                              }}
                            />
                            <View
                              style={{
                                position: "absolute",
                                right: 8,
                                bottom: 8,
                                width: 10,
                                height: 10,
                                borderRightWidth: 2,
                                borderBottomWidth: 2,
                                borderColor: "#05100D",
                              }}
                            />
                            <Ionicons name="eye" size={15} color="#05100D" />
                            <Text
                              className="font-mono uppercase tracking-widest text-sm"
                              style={{ color: "#05100D", fontWeight: "700" }}
                            >
                              View Details
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              router.push("/simulations/new");
                            }}
                            className="rounded-xl items-center justify-center"
                            style={{
                              width: 48,
                              height: 48,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.secondary + "1A",
                            }}
                          >
                            <Ionicons name="play" size={16} color={colors.secondary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                              deleteBuilding(building.id);
                            }}
                            className="rounded-xl items-center justify-center"
                            style={{
                              width: 48,
                              height: 48,
                              borderWidth: 1,
                              borderColor: colors.error,
                              backgroundColor: colors.error + "1A",
                            }}
                          >
                            <Ionicons name="trash" size={16} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
