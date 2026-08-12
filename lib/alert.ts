import { Alert, Platform } from "react-native";

type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

/**
 * react-native-web's Alert.alert is a no-op stub (`static alert() {}`) --
 * on web it neither shows a dialog nor ever calls a button's onPress, which
 * silently breaks any flow that puts real logic (redirects, deletes) inside
 * an Alert callback. This wraps native Alert.alert on native platforms and
 * falls back to window.confirm/alert on web so the same call site works on
 * both.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }

  const list = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
  const cancelButton = list.find((b) => b.style === "cancel");
  const confirmButton = list.find((b) => b.style !== "cancel") ?? list[0];
  const text = [title, message].filter(Boolean).join("\n\n");

  if (cancelButton) {
    if (window.confirm(text)) {
      confirmButton.onPress?.();
    } else {
      cancelButton.onPress?.();
    }
  } else {
    window.alert(text);
    confirmButton.onPress?.();
  }
}
