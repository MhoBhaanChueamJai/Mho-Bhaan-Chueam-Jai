import { Redirect } from 'expo-router';
import { useApp } from '../store/app';

export default function Index() {
  const { settings } = useApp();
  return <Redirect href={settings.loggedIn ? '/home' : '/login'} />;
}
