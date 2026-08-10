import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Warm } from '@/constants/theme';

export default function AppTabs() {
  return (
    <NativeTabs backgroundColor={Warm.card} indicatorColor={Warm.primarySoft} iconColor={Warm.textSecondary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label selectedStyle={{ color: Warm.primaryStrong }}>홈</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" selectedColor={Warm.primaryStrong} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="report">
        <NativeTabs.Trigger.Label selectedStyle={{ color: Warm.primaryStrong }}>리포트</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" selectedColor={Warm.primaryStrong} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="care">
        <NativeTabs.Trigger.Label selectedStyle={{ color: Warm.primaryStrong }}>돌봄</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="heart.fill" md="favorite" selectedColor={Warm.primaryStrong} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Label selectedStyle={{ color: Warm.primaryStrong }}>대화</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.fill" md="chat" selectedColor={Warm.primaryStrong} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label selectedStyle={{ color: Warm.primaryStrong }}>설정</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" selectedColor={Warm.primaryStrong} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
