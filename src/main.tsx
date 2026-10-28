import { Capacitor } from '@capacitor/core';
import { render } from 'preact';
import { App } from './ui/App';
import { initStore } from './store/store';
import { startReminderLoop } from './notifications';
import './styles.css';

render(<App />, document.getElementById('app')!);
initStore().then(() => startReminderLoop());

if ('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((e) => console.warn('SW não registrado', e));
  });
}
