import { Suspense, lazy, useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { SvgDefs } from '../ui/cards/art/SvgDefs';
import { FlightLayer } from '../ui/anim/FlightLayer';
import { ToastHost } from '../ui/components/Overlays';
import { initSettings } from '../storage/settings';
import { sound } from '../ui/sound/SoundManager';
import { Home } from './Home';
const DevKit = lazy(() => import('./DevKit').then((m) => ({ default: m.DevKit })));
const InfoPage = lazy(() => import('./InfoPages').then((m) => ({ default: m.InfoPage })));
const DevOg = lazy(() => import('./DevOg').then((m) => ({ default: m.DevOg })));
const GameScreen = lazy(() => import('./GameScreen').then((m) => ({ default: m.GameScreen })));
const ProfileScreen = lazy(() =>
  import('./ProfileScreen').then((m) => ({ default: m.ProfileScreen })),
);
const JoinScreen = lazy(() => import('./JoinScreen').then((m) => ({ default: m.JoinScreen })));
const RoomScreen = lazy(() => import('./RoomScreen').then((m) => ({ default: m.RoomScreen })));

export function App() {
  useEffect(() => {
    initSettings();
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);
  return (
    <HashRouter>
      <SvgDefs />
      <FlightLayer>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play/:gameId" element={<GameScreen />} />
            <Route path="/about" element={<InfoPage page="about" />} />
            <Route path="/terms" element={<InfoPage page="terms" />} />
            <Route path="/privacy" element={<InfoPage page="privacy" />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/join/:code" element={<JoinScreen />} />
            <Route path="/room/:code" element={<RoomScreen />} />
            {import.meta.env.DEV && <Route path="/dev/kit" element={<DevKit />} />}
            {import.meta.env.DEV && <Route path="/dev/og" element={<DevOg />} />}
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </FlightLayer>
      <ToastHost />
    </HashRouter>
  );
}
