import React from 'react';
import { DarkTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../constants/theme';
import { AddInterestTargetScreen } from '../screens/AddInterestTargetScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { PoliticianDetailScreen } from '../screens/PoliticianDetailScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplashScreen } from '../screens/SplashScreen';
import type { MainTabParamList, RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    background: colors.bgBase,
    card: colors.bgBase,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
    notification: colors.accent,
  },
};

interface TabIconProps {
  label: string;
  focused: boolean;
}

const TabIcon: React.FC<TabIconProps> = ({ label, focused }) => (
  <View style={styles.tabIcon}>
    <Text
      style={[
        styles.tabLabel,
        { color: focused ? colors.textPrimary : colors.textTertiary },
      ]}
    >
      {label}
    </Text>
    {focused ? <View style={styles.tabUnderline} /> : null}
  </View>
);

const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="홈" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="검색" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="설정" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerStyle: { backgroundColor: colors.bgBase },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerTitleStyle: {
            color: colors.textPrimary,
            fontSize: typography.size.base,
            fontWeight: typography.weight.semibold,
          },
          contentStyle: { backgroundColor: colors.bgBase },
        }}
      >
        <RootStack.Screen
          name="Splash"
          component={SplashScreen}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <RootStack.Screen
          name="PoliticianDetail"
          component={PoliticianDetailScreen}
          options={{ title: '', headerBackTitle: '' }}
        />
        <RootStack.Screen
          name="AddInterest"
          component={AddInterestTargetScreen}
          options={{ headerShown: false, presentation: 'modal' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bgBase,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    height: 64,
    paddingTop: 8,
    paddingBottom: 8,
    elevation: 0,
  },
  tabItem: {
    paddingVertical: 4,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: typography.size.sm,
    letterSpacing: typography.letterSpacing.wide,
    fontWeight: typography.weight.medium,
  },
  tabUnderline: {
    height: 1,
    width: 16,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
});
