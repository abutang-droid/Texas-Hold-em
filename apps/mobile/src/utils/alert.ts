import { Alert, Platform } from 'react-native';

/** Cross-platform alert — Alert.alert is a no-op on Expo Web. */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message ?? '');
}
