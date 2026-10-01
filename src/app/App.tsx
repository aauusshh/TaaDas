import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { SvgDefs } from '../ui/cards/art/SvgDefs';
import { FlightLayer } from '../ui/anim/FlightLayer';
import { ToastHost } from '../ui/components/Overlays';
import { initSettings } from '../storage/settings';
import { sound } from '../ui/sound/SoundManager';
import { Home } from './Home';
import { DevKit } from './DevKit';
import { GameScreen } from './GameScreen';
import { ProfileScreen } from './ProfileScreen';
import { JoinScreen } from './JoinScreen';
import { RoomScreen } from './RoomScreen';

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/:gameId" element={<GameScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/join/:code" element={<JoinScreen />} />
          <Route path="/room/:code" element={<RoomScreen />} />
          {import.meta.env.DEV && <Route path="/dev/kit" element={<DevKit />} />}
          <Route path="*" element={<Home />} />
        </Routes>
      </FlightLayer>
      <ToastHost />
    </HashRouter>
  );
}
