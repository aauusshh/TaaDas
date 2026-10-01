import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { anchorRect, type Rect } from './anchors';
import { dur } from './queue';
import { effectiveReduceMotion } from '../../storage/settings';

export interface FlightSpec {
  front: ReactNode;
  /** when given with flip, the card turns over in flight */
  back?: ReactNode;
  flip?: boolean;
  from: Rect | string;
  to: Rect | string;
  /** ms before scaling; default 260 */
  duration?: number;
  delay?: number;
  /** arc height in px (peak lift); default 18 */
  arc?: number;
  /** start and end rotation in degrees */
  rotate?: [number, number];
}

interface Flight extends FlightSpec {
  id: number;
  fromRect: Rect;
  toRect: Rect;
  done: () => void;
}

type FlyFn = (spec: FlightSpec) => Promise<void>;
const Ctx = createContext<FlyFn>(() => Promise.resolve());
export const useFly = () => useContext(Ctx);

function resolve(r: Rect | string): Rect | null {
  return typeof r === 'string' ? anchorRect(r) : r;
}

function FlightCard({ f }: { f: Flight }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const started = useRef(false);

  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      if (!el || started.current) return;
      started.current = true;
      const reduce = effectiveReduceMotion();
      const d = reduce ? dur(0) : dur(f.duration ?? 260);
      const dx = f.toRect.x + f.toRect.w / 2 - (f.fromRect.x + f.fromRect.w / 2);
      const dy = f.toRect.y + f.toRect.h / 2 - (f.fromRect.y + f.fromRect.h / 2);
      const s = f.toRect.w / f.fromRect.w;
      const [r0, r1] = f.rotate ?? [0, 0];
      const arc = f.arc ?? 18;
      const timing: KeyframeAnimationOptions = {
        duration: d,
        delay: f.delay ?? 0,
        easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
        fill: 'both',
      };
      const frames: Keyframe[] = reduce
        ? [
            { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(${s})` },
            { opacity: 1, transform: `translate(${dx}px, ${dy}px) scale(${s})` },
          ]
        : [
            { transform: `translate(0px, 0px) scale(1) rotate(${r0}deg)` },
            {
              transform: `translate(${dx * 0.5}px, ${dy * 0.5 - arc}px) scale(${1 + (s - 1) * 0.5 + 0.04}) rotate(${(r0 + r1) / 2}deg)`,
              offset: 0.5,
            },
            { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${r1}deg)` },
          ];
      const anim = el.animate(frames, timing);
      if (f.flip && f.back && inner.current && !reduce) {
        inner.current.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], {
          ...timing,
          easing: 'ease-in-out',
        });
      }
      anim.finished.then(f.done, f.done);
    },
    [f],
  );

  const flipping = f.flip && f.back;
  return (
    <div
      ref={setRef}
      style={{
        position: 'fixed',
        left: f.fromRect.x,
        top: f.fromRect.y,
        width: f.fromRect.w,
        pointerEvents: 'none',
        willChange: 'transform',
        perspective: flipping ? 800 : undefined,
      }}
    >
      {flipping ? (
        <div
          ref={inner}
          style={{
            position: 'relative',
            transformStyle: 'preserve-3d',
            transform: 'rotateY(180deg)',
          }}
        >
          <div style={{ backfaceVisibility: 'hidden' }}>{f.front}</div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {f.back}
          </div>
        </div>
      ) : (
        f.front
      )}
    </div>
  );
}

let nextId = 1;

export function FlightLayer({ children }: { children: ReactNode }) {
  const [flights, setFlights] = useState<Flight[]>([]);

  const fly = useCallback<FlyFn>((spec) => {
    const fromRect = resolve(spec.from);
    const toRect = resolve(spec.to);
    if (!fromRect || !toRect) return Promise.resolve(); // missing anchor: skip the animation, never block the game
    return new Promise<void>((res) => {
      const id = nextId++;
      const done = () => {
        setFlights((fs) => fs.filter((x) => x.id !== id));
        res();
      };
      setFlights((fs) => [...fs, { ...spec, id, fromRect, toRect, done }]);
    });
  }, []);

  const value = useMemo(() => fly, [fly]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}
      >
        {flights.map((f) => (
          <FlightCard key={f.id} f={f} />
        ))}
      </div>
    </Ctx.Provider>
  );
}
