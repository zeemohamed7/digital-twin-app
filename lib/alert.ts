import { Alert, Platform } from "react-native";

/**
 * react-native-web's Alert.alert is a no-op (it never renders anything and
 * never invokes button callbacks), so any logic gated behind an Alert button
 * -- including simply showing the message -- silently never runs on web.
 */

/** Fire-and-forget info/error message. */
export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Confirm before a destructive action. */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
