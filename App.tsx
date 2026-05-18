import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { colors } from './src/constants/theme';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ApiProvider } from './src/services/dataProvider/ApiProvider';
import { InterestStoreProvider } from './src/services/interestStore/InterestStore';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ApiProvider>
          <InterestStoreProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </InterestStoreProvider>
        </ApiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
});
