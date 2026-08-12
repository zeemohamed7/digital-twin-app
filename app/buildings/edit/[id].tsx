import { View, Text, ScrollView, TouchableOpacity, TextInput, Image } from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { useColors } from "@/hooks/use-colors";
import { notify } from "@/lib/alert";

const PAGE_MARGIN = 24;

const BUILDING_TYPES: { type: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: "office", label: "Office", icon: "business" },
  { type: "residential", label: "Residential", icon: "home" },
  { type: "industrial", label: "Industrial", icon: "cog" },
  { type: "retail", label: "Retail", icon: "storefront" },
];

interface Building {
  id: string;
  name: string;
  type: string;
  size: number;
  floors: number;
  location: string;
  image?: string | number;
  createdAt: string;
  isDemo?: boolean;
  [key: string]: any;
}

function FieldLabel({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text
      className="font-mono text-[11px] uppercase tracking-widest"
      style={{ color: colors.muted, marginBottom: 8 }}
    >
      {children}
    </Text>
  );
}

export default function EditBuildingScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams();
  const [building, setBuilding] = useState<Building | null>(null);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [size, setSize] = useState("");
  const [floors, setFloors] = useState("");
  const [type, setType] = useState("");
  const [image, setImage] = useState<string | number | undefined>(undefined);

  useEffect(() => {
    loadBuilding();
  }, [id]);

  const loadBuilding = async () => {
    try {
      const data = await AsyncStorage.getItem("buildings");
      if (!data) return;
      const buildings: Building[] = JSON.parse(data);
      const found = buildings.find((b) => b.id === id);
      if (found) {
        // See buildings.tsx: older builds could persist a NaN size/floors
        // (typed non-numeric input) as null via JSON.stringify.
        const sanitizedSize = Number.isFinite(found.size) ? found.size : 0;
        const sanitizedFloors = Number.isFinite(found.floors) ? found.floors : 0;
        setBuilding({ ...found, size: sanitizedSize, floors: sanitizedFloors });
        setName(found.name);
        setLocation(found.location);
        setSize(String(sanitizedSize));
        setFloors(String(sanitizedFloors));
        setType(found.type);
        setImage(found.image);
      }
    } catch (error) {
      console.error("Failed to load building", error);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleSave = async () => {
    if (!name || !location || !size || !floors) {
      notify("Missing Information", "Please fill in all required fields");
      return;
    }

    const parsedSize = parseInt(size, 10);
    const parsedFloors = parseInt(floors, 10);

    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      notify("Invalid Size", "Please enter a valid positive number for size (sq ft)");
      return;
    }

    if (!Number.isFinite(parsedFloors) || parsedFloors <= 0) {
      notify("Invalid Floors", "Please enter a valid positive number for floors");
      return;
    }

    try {
      const data = await AsyncStorage.getItem("buildings");
      const buildings: Building[] = data ? JSON.parse(data) : [];
      const index = buildings.findIndex((b) => b.id === id);
      if (index === -1) {
        notify("Error", "Building not found");
        return;
      }

      buildings[index] = {
        ...buildings[index],
        name,
        location,
        type,
        size: parsedSize,
        floors: parsedFloors,
        image,
      };

      await AsyncStorage.setItem("buildings", JSON.stringify(buildings));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      notify("Error", "Failed to save changes");
    }
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
            <Text className="text-foreground text-xl font-bold">Edit Building</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: PAGE_MARGIN, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(300)}>
            {building.isDemo && (
              <View
                className="rounded-xl p-3 flex-row items-center gap-2"
                style={{ marginBottom: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
              >
                <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
                <Text className="text-muted text-xs" style={{ flex: 1 }}>
                  This is a sample building. Changes may be reset when demo data reloads.
                </Text>
              </View>
            )}

            {/* Image */}
            <FieldLabel>Photo</FieldLabel>
            {image ? (
              <View style={{ marginBottom: 20 }}>
                <Image
                  source={typeof image === "string" ? { uri: image } : image}
                  style={{ width: "100%", height: 180, borderRadius: 16 }}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={pickImage}
                  className="absolute items-center justify-center rounded-full"
                  style={{
                    top: 8,
                    right: 8,
                    width: 32,
                    height: 32,
                    backgroundColor: "rgba(0,0,0,0.55)",
                  }}
                >
                  <Ionicons name="camera" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={pickImage}
                className="items-center justify-center"
                style={{
                  borderRadius: 16,
                  padding: 24,
                  marginBottom: 20,
                  minHeight: 140,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderStyle: "dashed",
                }}
              >
                <Ionicons name="image-outline" size={28} color={colors.muted} />
                <Text className="text-muted text-sm" style={{ marginTop: 8 }}>
                  Add a photo
                </Text>
              </TouchableOpacity>
            )}

            {/* Type */}
            <FieldLabel>Building Type</FieldLabel>
            <View className="flex-row flex-wrap gap-2" style={{ marginBottom: 20 }}>
              {BUILDING_TYPES.map((item) => {
                const isSelected = type === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    onPress={() => {
                      setType(item.type);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    className="flex-row items-center rounded-full"
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      gap: 6,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary + "1A" : colors.surface,
                    }}
                  >
                    <Ionicons name={item.icon} size={14} color={isSelected ? colors.primary : colors.muted} />
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: isSelected ? colors.primary : colors.foreground }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Name */}
            <FieldLabel>Building Name *</FieldLabel>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Main Office Tower"
              placeholderTextColor={colors.muted}
              className="text-foreground"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
              }}
            />

            {/* Location */}
            <FieldLabel>Location *</FieldLabel>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="e.g., Manama, Bahrain"
              placeholderTextColor={colors.muted}
              className="text-foreground"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
              }}
            />

            {/* Size */}
            <FieldLabel>Total Size (sq ft) *</FieldLabel>
            <TextInput
              value={size}
              onChangeText={(text) => setSize(text.replace(/[^0-9]/g, ""))}
              placeholder="e.g., 60000"
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
              className="text-foreground"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
              }}
            />

            {/* Floors */}
            <FieldLabel>Number of Floors *</FieldLabel>
            <TextInput
              value={floors}
              onChangeText={(text) => setFloors(text.replace(/[^0-9]/g, ""))}
              placeholder="e.g., 18"
              keyboardType="numeric"
              placeholderTextColor={colors.muted}
              className="text-foreground"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 8,
              }}
            />
          </Animated.View>
        </ScrollView>

        {/* Save Button */}
        <View style={{ padding: PAGE_MARGIN, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity
            onPress={handleSave}
            className="bg-primary flex-row items-center justify-center"
            style={{ borderRadius: 16, height: 56, gap: 8 }}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#05100D" />
            <Text className="font-mono uppercase tracking-widest text-sm" style={{ color: "#05100D", fontWeight: "700" }}>
              Save Changes
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
