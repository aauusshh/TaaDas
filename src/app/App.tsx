import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { SvgDefs } from '../ui/cards/art/SvgDefs';
import { FlightLayer } from '../ui/anim/FlightLayer';
import { ToastHost } from '../ui/components/Overlays';
import { initSettings } from '../storage/settings';
import { sound } from '../ui/sound/SoundManager';
import { Home } from './Home';
import { DevKit } from './DevKit';

function Placeholder({ text }: { text: string }) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <p>{text}</p>
    </main>
  );
}

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
          <Route
            path="/join/:code"
            element={<Placeholder text="Online rooms arrive in a later build." />}
          />
          {import.meta.env.DEV && <Route path="/dev/kit" element={<DevKit />} />}
          <Route path="*" element={<Home />} />
        </Routes>
      </FlightLayer>
      <ToastHost />
    </HashRouter>
  );
}
