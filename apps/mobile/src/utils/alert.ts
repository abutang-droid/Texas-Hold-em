import { Alert, Platform } from 'react-native';

/** Cross-platform alert — Alert.alert is a no-op on Expo Web. */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message ?? '');
}

/** Confirm dialog. On web uses window.confirm so the Yes path actually runs. */
export function showConfirm(
  title: string,
  message: string,
  onYes: () => void,
  labels?: { confirm?: string; cancel?: string },
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: labels?.cancel ?? 'Cancel', style: 'cancel' },
    { text: labels?.confirm ?? 'OK', onPress: onYes },
  ]);
}
