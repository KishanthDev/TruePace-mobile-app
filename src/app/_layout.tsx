import '../../global.css';
// Side-effect import: registers the background location task with TaskManager
// MUST appear before any component that uses useRunTracker mounts.
import '../tasks/locationTask';
import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';


export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'fade',
        }}
      />
    </SafeAreaProvider>
  );
}
