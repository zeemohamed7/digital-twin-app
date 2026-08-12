import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, Alert } from "react-native";
import { Fragment, useState } from "react";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";

// Colors from .claude/stitch_ecotwin_buildings_dashboard_redesign/ecotwin_sovereign/DESIGN.md.
// Scoped locally to this flow only (not the shared app theme, which still
// uses #2dd4bf elsewhere) per the explicit "only touch the Add Building
// flow" instruction -- adopting this newer palette app-wide would mean
// editing the shared theme.config.js, which is out of scope here.
const THEME = {
  background: "#131314",
  surface: "#201f20",
  onSurface: "#e5e2e3",
  onSurfaceVariant: "#bacac5",
  outline: "#859490",
  outlineVariant: "#3c4a46",
  primary: "#57f1db",
  onPrimary: "#003731",
  error: "#ffb4ab",
  onError: "#690005",
};

type BuildingType = "office" | "residential" | "industrial" | "retail";

// Renamed from the Stitch reference's INFO/SPECS/IOT/REVIEW to match what's
// actually on each real step -- the reference's "IoT Configuration" step
// (gateway/protocol/device scan) has no backing state or logic anywhere in
// this app, so it isn't represented here.
const STEPS: { number: number; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { number: 1, label: "TYPE", icon: "business-outline" },
  { number: 2, label: "DETAILS", icon: "create-outline" },
  { number: 3, label: "PHOTO", icon: "camera-outline" },
  { number: 4, label: "REVIEW", icon: "checkmark-done-outline" },
];

function StepRail({ currentStep }: { currentStep: number }) {
  return (
    <View className="flex-row items-start">
      {STEPS.map((s, index) => {
        const isComplete = s.number < currentStep;
        const isActive = s.number === currentStep;
        const nodeColor = isComplete || isActive ? THEME.primary : THEME.outline;
        return (
          <Fragment key={s.number}>
            {/* Connecting line rendered as its own row item -- keeping it
                out of the node's column is what lets the label below
                center on the circle instead of drifting toward the line. */}
            {index > 0 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  marginTop: 17,
                  marginHorizontal: 4,
                  backgroundColor:
                    STEPS[index - 1].number < currentStep ? THEME.primary : THEME.outlineVariant,
                }}
              />
            )}
            <View style={{ width: 60, alignItems: "center" }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: isActive ? 2 : 1,
                  borderColor: nodeColor,
                  backgroundColor: isComplete ? THEME.primary : "transparent",
                }}
              >
                <Ionicons
                  name={isComplete ? "checkmark" : s.icon}
                  size={16}
                  color={isComplete ? THEME.onPrimary : nodeColor}
                />
              </View>
              <Text
                className="font-mono"
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  letterSpacing: 1,
                  color: isActive ? THEME.primary : THEME.outline,
                }}
              >
                {s.label}
              </Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-row items-center justify-between"
      style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: THEME.outlineVariant }}
    >
      <Text className="font-mono" style={{ color: THEME.onSurfaceVariant, fontSize: 11, letterSpacing: 1 }}>
        {label}
      </Text>
      <Text className="font-sans" style={{ color: THEME.onSurface, fontSize: 14, fontWeight: "600" }}>
        {value}
      </Text>
    </View>
  );
}

function ReviewSection({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 16,
        backgroundColor: THEME.surface,
        borderWidth: 1,
        borderColor: THEME.outlineVariant,
        marginBottom: 16,
      }}
    >
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Ionicons name={icon} size={14} color={THEME.primary} />
        <Text className="font-mono" style={{ color: THEME.primary, fontSize: 11, letterSpacing: 1 }}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

export default function AddBuildingScreen() {
  const [step, setStep] = useState(1);
  const [buildingType, setBuildingType] = useState<BuildingType | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [size, setSize] = useState("");
  const [floors, setFloors] = useState("");
  const [image, setImage] = useState<string | null>(null);

  const buildingTypes: { type: BuildingType; label: string; icon: keyof typeof Ionicons.glyphMap; imagePath: any }[] = [
    { type: "office", label: "Office Building", icon: "business", imagePath: require("@/assets/images/building-types-office.png") },
    { type: "residential", label: "Residential", icon: "home", imagePath: require("@/assets/images/building-types-residential.png") },
    { type: "industrial", label: "Industrial", icon: "cog", imagePath: require("@/assets/images/building-types-industrial.png") },
    { type: "retail", label: "Retail/Commercial", icon: "storefront", imagePath: null },
  ];

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

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera permission is required to take photos");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!buildingType || !name || !location || !size || !floors) {
      Alert.alert("Missing Information", "Please fill in all required fields");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const newBuilding = {
      id: Date.now().toString(),
      type: buildingType,
      name,
      location,
      size: parseInt(size),
      floors: parseInt(floors),
      image,
      createdAt: new Date().toISOString(),
    };

    try {
      const existing = await AsyncStorage.getItem("buildings");
      const buildings = existing ? JSON.parse(existing) : [];
      buildings.push(newBuilding);
      await AsyncStorage.setItem("buildings", JSON.stringify(buildings));

      Alert.alert("Success", "Building added successfully!", [
        { text: "OK", onPress: () => router.replace("/(tabs)/buildings") }
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to save building");
    }
  };

  return (
    <ScreenContainer containerClassName="" className="">
      <View className="flex-1" style={{ backgroundColor: THEME.background }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 }}>
          <View className="flex-row items-center justify-between" style={{ marginBottom: 24 }}>
            <TouchableOpacity
              onPress={handleBack}
              className="rounded-full items-center justify-center"
              style={{ width: 36, height: 36, borderWidth: 1, borderColor: THEME.outline }}
            >
              <Ionicons name="arrow-back" size={18} color={THEME.onSurface} />
            </TouchableOpacity>
            <Text style={{ color: THEME.onSurface, fontSize: 18, fontWeight: "700" }}>
              Add Building
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <StepRail currentStep={step} />
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Step 1: Building Type */}
          {step === 1 && (
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 24 }}>
              <Text
                className="font-mono"
                style={{ color: THEME.primary, fontSize: 12, letterSpacing: 2, marginBottom: 8 }}
              >
                {"// STEP 01"}
              </Text>
              <Text
                className="font-sans"
                style={{ color: THEME.onSurface, fontSize: 32, fontWeight: "600", marginBottom: 8 }}
              >
                Select Building Type
              </Text>
              <Text
                className="font-sans"
                style={{ color: THEME.onSurfaceVariant, fontSize: 16, marginBottom: 24 }}
              >
                Choose the type of building you want to add
              </Text>

              <View style={{ gap: 12 }}>
                {buildingTypes.map((item) => {
                  const isSelected = buildingType === item.type;
                  return (
                    <TouchableOpacity
                      key={item.type}
                      onPress={() => {
                        setBuildingType(item.type);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      className="flex-row items-center"
                      style={{
                        borderRadius: 16,
                        padding: 16,
                        backgroundColor: isSelected ? THEME.primary + "1A" : THEME.surface,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? THEME.primary : THEME.outlineVariant,
                      }}
                    >
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 12,
                          marginRight: 16,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: THEME.background,
                        }}
                      >
                        {item.imagePath ? (
                          <Image source={item.imagePath} style={{ width: 40, height: 40 }} resizeMode="contain" />
                        ) : (
                          <Ionicons name={item.icon} size={28} color={isSelected ? THEME.primary : THEME.onSurfaceVariant} />
                        )}
                      </View>
                      <Text
                        className="font-sans"
                        style={{ color: THEME.onSurface, fontSize: 17, fontWeight: "600" }}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Step 2: Basic Information */}
          {step === 2 && (
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 24 }}>
              <Text
                className="font-mono"
                style={{ color: THEME.primary, fontSize: 12, letterSpacing: 2, marginBottom: 8 }}
              >
                {"// STEP 02"}
              </Text>
              <Text
                className="font-sans"
                style={{ color: THEME.onSurface, fontSize: 32, fontWeight: "600", marginBottom: 8 }}
              >
                Basic Information
              </Text>
              <Text
                className="font-sans"
                style={{ color: THEME.onSurfaceVariant, fontSize: 16, marginBottom: 24 }}
              >
                Enter building details to initialize the digital twin.
              </Text>

              <View style={{ gap: 20 }}>
                <View>
                  <Text
                    className="font-mono"
                    style={{ color: THEME.onSurfaceVariant, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    BUILDING NAME <Text style={{ color: THEME.primary }}>*</Text>
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., Main Office Tower"
                    placeholderTextColor={THEME.outline}
                    style={{
                      backgroundColor: THEME.background,
                      borderRadius: 12,
                      padding: 16,
                      color: THEME.onSurface,
                      borderWidth: 1,
                      borderColor: THEME.outlineVariant,
                    }}
                  />
                </View>

                <View>
                  <Text
                    className="font-mono"
                    style={{ color: THEME.onSurfaceVariant, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    LOCATION <Text style={{ color: THEME.primary }}>*</Text>
                  </Text>
                  <TextInput
                    value={location}
                    onChangeText={setLocation}
                    placeholder="e.g., Manama, Bahrain"
                    placeholderTextColor={THEME.outline}
                    style={{
                      backgroundColor: THEME.background,
                      borderRadius: 12,
                      padding: 16,
                      color: THEME.onSurface,
                      borderWidth: 1,
                      borderColor: THEME.outlineVariant,
                    }}
                  />
                </View>

                <View>
                  <Text
                    className="font-mono"
                    style={{ color: THEME.onSurfaceVariant, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    TOTAL SIZE (SQ FT) <Text style={{ color: THEME.primary }}>*</Text>
                  </Text>
                  <View
                    className="flex-row items-center"
                    style={{
                      backgroundColor: THEME.background,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: THEME.outlineVariant,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Ionicons name="resize-outline" size={16} color={THEME.outline} />
                    <TextInput
                      value={size}
                      onChangeText={setSize}
                      placeholder="e.g., 60000"
                      keyboardType="numeric"
                      placeholderTextColor={THEME.outline}
                      style={{ flex: 1, padding: 16, color: THEME.onSurface }}
                    />
                    <Text className="font-mono" style={{ color: THEME.outline, fontSize: 11, letterSpacing: 1 }}>
                      SQ FT
                    </Text>
                  </View>
                </View>

                <View>
                  <Text
                    className="font-mono"
                    style={{ color: THEME.onSurfaceVariant, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}
                  >
                    NUMBER OF FLOORS <Text style={{ color: THEME.primary }}>*</Text>
                  </Text>
                  <View
                    className="flex-row items-center"
                    style={{
                      backgroundColor: THEME.background,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: THEME.outlineVariant,
                      paddingHorizontal: 16,
                    }}
                  >
                    <Ionicons name="layers-outline" size={16} color={THEME.outline} />
                    <TextInput
                      value={floors}
                      onChangeText={setFloors}
                      placeholder="e.g., 18"
                      keyboardType="numeric"
                      placeholderTextColor={THEME.outline}
                      style={{ flex: 1, padding: 16, color: THEME.onSurface }}
                    />
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Step 3: Upload Image */}
          {step === 3 && (
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 24 }}>
              <Text
                className="font-mono"
                style={{ color: THEME.primary, fontSize: 12, letterSpacing: 2, marginBottom: 8 }}
              >
                {"// STEP 03"}
              </Text>
              <Text
                className="font-sans"
                style={{ color: THEME.onSurface, fontSize: 32, fontWeight: "600", marginBottom: 8 }}
              >
                Building Image
              </Text>
              <Text
                className="font-sans"
                style={{ color: THEME.onSurfaceVariant, fontSize: 16, marginBottom: 24 }}
              >
                Upload a photo or sketch of your building
              </Text>

              {image ? (
                <View style={{ marginBottom: 20 }}>
                  <Image source={{ uri: image }} style={{ width: "100%", height: 200, borderRadius: 16 }} resizeMode="cover" />
                  <TouchableOpacity
                    onPress={() => setImage(null)}
                    className="absolute items-center justify-center"
                    style={{
                      top: 8,
                      right: 8,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: THEME.error,
                    }}
                  >
                    <Ionicons name="close" size={18} color={THEME.onError} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View
                  className="items-center justify-center"
                  style={{
                    borderRadius: 16,
                    padding: 32,
                    marginBottom: 20,
                    minHeight: 200,
                    backgroundColor: THEME.surface,
                    borderWidth: 2,
                    borderColor: THEME.outlineVariant,
                    borderStyle: "dashed",
                  }}
                >
                  <Ionicons name="image-outline" size={32} color={THEME.outline} />
                  <Text
                    className="font-sans"
                    style={{ color: THEME.onSurfaceVariant, textAlign: "center", marginTop: 12 }}
                  >
                    No image selected
                  </Text>
                </View>
              )}

              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={pickImage}
                  className="flex-row items-center justify-center"
                  style={{ borderRadius: 12, padding: 16, gap: 8, backgroundColor: THEME.primary }}
                >
                  <Ionicons name="image-outline" size={18} color={THEME.onPrimary} />
                  <Text className="font-sans" style={{ color: THEME.onPrimary, fontWeight: "600" }}>
                    Choose from Gallery
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={takePhoto}
                  className="flex-row items-center justify-center"
                  style={{
                    borderRadius: 12,
                    padding: 16,
                    gap: 8,
                    backgroundColor: THEME.surface,
                    borderWidth: 1,
                    borderColor: THEME.outlineVariant,
                  }}
                >
                  <Ionicons name="camera-outline" size={18} color={THEME.onSurface} />
                  <Text className="font-sans" style={{ color: THEME.onSurface, fontWeight: "600" }}>
                    Take Photo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNext}
                  className="items-center"
                  style={{ borderRadius: 12, padding: 16 }}
                >
                  <Text className="font-sans" style={{ color: THEME.outline, fontWeight: "600" }}>
                    Skip for Now
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 24 }}>
              <Text
                className="font-mono"
                style={{ color: THEME.primary, fontSize: 12, letterSpacing: 2, marginBottom: 8 }}
              >
                {"// STEP 04"}
              </Text>
              <Text
                className="font-sans"
                style={{ color: THEME.onSurface, fontSize: 32, fontWeight: "600", marginBottom: 8 }}
              >
                Review & Confirm
              </Text>
              <Text
                className="font-sans"
                style={{ color: THEME.onSurfaceVariant, fontSize: 16, marginBottom: 24 }}
              >
                Verify the details below before adding your building.
              </Text>

              <ReviewSection icon="business-outline" title="// BUILDING_IDENTITY">
                <ReviewRow label="NAME" value={name || "-"} />
                <ReviewRow label="LOCATION" value={location || "-"} />
                <ReviewRow
                  label="TYPE"
                  value={buildingType ? buildingType.charAt(0).toUpperCase() + buildingType.slice(1) : "-"}
                />
              </ReviewSection>

              <ReviewSection icon="resize-outline" title="// PHYSICAL_METRICS">
                <ReviewRow label="SIZE" value={size ? `${size} sq ft` : "-"} />
                <ReviewRow label="FLOORS" value={floors || "-"} />
              </ReviewSection>

              {image && (
                <ReviewSection icon="image-outline" title="// BUILDING_IMAGE">
                  <View style={{ marginTop: 12 }}>
                    <Image source={{ uri: image }} style={{ width: "100%", height: 150, borderRadius: 12 }} resizeMode="cover" />
                  </View>
                </ReviewSection>
              )}

              <TouchableOpacity
                onPress={handleSave}
                className="flex-row items-center justify-center"
                style={{
                  borderRadius: 16,
                  height: 56,
                  backgroundColor: THEME.primary,
                  marginTop: 8,
                  marginBottom: 24,
                  gap: 8,
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color={THEME.onPrimary} />
                <Text
                  className="font-mono"
                  style={{ color: THEME.onPrimary, fontSize: 14, fontWeight: "700", letterSpacing: 1 }}
                >
                  ADD BUILDING
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>

        {/* Navigation Buttons */}
        {step < 4 && (
          <View style={{ padding: 24, borderTopWidth: 1, borderTopColor: THEME.outlineVariant }}>
            <TouchableOpacity
              onPress={handleNext}
              disabled={step === 1 && !buildingType}
              className="flex-row items-center justify-center"
              style={{
                borderRadius: 16,
                height: 56,
                backgroundColor: THEME.primary,
                opacity: step === 1 && !buildingType ? 0.5 : 1,
              }}
            >
              <Text
                className="font-mono"
                style={{ color: THEME.onPrimary, fontSize: 14, fontWeight: "700", letterSpacing: 1, marginRight: 8 }}
              >
                CONTINUE
              </Text>
              <Ionicons name="arrow-forward" size={16} color={THEME.onPrimary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
