import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { makeDeck, SUITS, type Card } from '../engine/core';
import { createRng } from '../engine/core/rng';
import { CardBack, CardFace } from '../ui/cards/CardFace';
import { RangiBack, RangiCard, type RangiColor, type RangiValue } from '../ui/cards/RangiCard';
import { Hand } from '../ui/table/Hand';
import { BackStack, DiscardPile, DrawPile } from '../ui/table/Piles';
import { ChipStack } from '../ui/table/ChipStack';
import { Seat } from '../ui/table/Seat';
import { Avatar, AVATAR_IDS } from '../ui/components/Avatar';
import { Button } from '../ui/components/Button';
import { Segmented, Stepper, Toggle } from '../ui/components/Controls';
import { BottomSheet, ConfirmDialog, useToast } from '../ui/components/Overlays';
import { useFly } from '../ui/anim/FlightLayer';
import { AnimQueue, dur, wait } from '../ui/anim/queue';
import { sound, SOUND_IDS } from '../ui/sound/SoundManager';
import { useSettings, type ThemeId } from '../storage/settings';
import { SettingsSheet } from './SettingsSheet';
import s from './DevKit.module.css';

const queue = new AnimQueue();
const RANGI_COLORS: RangiColor[] = ['marigold', 'sindoor', 'neel', 'pipal'];
const RANGI_VALUES: RangiValue[] = [0, 3, 7, 9, 'skip', 'reverse', 'draw2', 'wild', 'wild4'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={s.section}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function DevKit() {
  const fly = useFly();
  const st = useSettings();
  const toast = useToast();
  const deck = useMemo(() => createRng(7).shuffle(makeDeck({ jokersPerDeck: 1 })), []);
  const [hand, setHand] = useState<Card[]>(deck.slice(0, 9));
  const [sel, setSel] = useState<number | null>(null);
  const [discard, setDiscard] = useState<Card[]>(deck.slice(20, 23));
  const [sheet, setSheet] = useState(false);
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [n, setN] = useState(4);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [tog, setTog] = useState(true);
  const [deckCount, setDeckCount] = useState(31);
  const [dealt, setDealt] = useState(0);

  const dealDemo = () =>
    queue.enqueue(async () => {
      sound.play('shuffle');
      await wait(dur(500));
      for (let i = 0; i < 4; i++) {
        const seat = i;
        void fly({
          front: <CardBack />,
          from: 'deck',
          to: `seat:${seat}`,
          duration: 260,
          rotate: [0, (i - 1.5) * 6],
        });
        sound.play('deal');
        setDeckCount((c) => c - 1);
        await wait(dur(70));
      }
      await wait(dur(300));
      setDealt((d) => d + 4);
    });

  const playDemo = () =>
    queue.enqueue(async () => {
      const c = hand[Math.floor(hand.length / 2)];
      if (!c) return;
      sound.play('slide');
      await fly({
        front: <CardFace card={c} />,
        from: `card:${c.id}`,
        to: 'discard',
        duration: 220,
        rotate: [0, 4],
      });
      sound.play('place');
      setHand((h) => h.filter((x) => x.id !== c.id));
      setDiscard((d) => [...d, c]);
    });

  const flipDemo = () =>
    queue.enqueue(async () => {
      sound.play('flip');
      await fly({
        front: <CardFace card={deck[40]} />,
        back: <CardBack />,
        flip: true,
        from: 'deck',
        to: 'discard',
        duration: 420,
      });
      setDiscard((d) => [...d, deck[40]]);
    });

  return (
    <div className={s.page}>
      <header className={s.head}>
        <Link to="/" className={s.back}>
          Home
        </Link>
        <h1 className="display">Dev kit</h1>
        <Segmented<ThemeId>
          label="Theme"
          value={st.theme}
          onChange={(v) => st.set('theme', v)}
          options={[
            { value: 'classic', label: 'Classic' },
            { value: 'dhaka', label: 'Dhaka' },
            { value: 'sal', label: 'Sal' },
            { value: 'tihar', label: 'Tihar' },
          ]}
        />
      </header>

      <Section title="Card faces">
        <div className={s.cards}>
          {SUITS.flatMap((suit) => deckSuit(suit)).map((c) => (
            <div key={c.id} className={s.cardCell} data-testid="face">
              <CardFace card={c} />
            </div>
          ))}
          <div className={s.cardCell}>
            <CardFace card={{ id: 999, suit: 'J', rank: 0, copy: 0 }} />
          </div>
        </div>
        <div className={s.row}>
          <span>Four-color deck</span>
          <Toggle
            label="Four-color deck"
            checked={st.fourColor}
            onChange={(v) => st.set('fourColor', v)}
          />
        </div>
      </Section>

      <Section title="Card backs">
        <div className={s.row}>
          {(['dhaka', 'indigo', 'forest'] as const).map((b) => (
            <div key={b} style={{ width: 70 }}>
              <CardBack variant={b} />
            </div>
          ))}
          <div style={{ width: 70 }}>
            <RangiBack />
          </div>
        </div>
      </Section>

      <Section title="Rangi cards">
        <div className={s.cards}>
          {RANGI_COLORS.flatMap((c) =>
            RANGI_VALUES.filter((v) => v !== 'wild' && v !== 'wild4')
              .slice(0, 7)
              .map((v) => (
                <div key={c + v} className={s.cardCell}>
                  <RangiCard color={c} value={v} />
                </div>
              )),
          )}
          <div className={s.cardCell}>
            <RangiCard value="wild" />
          </div>
          <div className={s.cardCell}>
            <RangiCard value="wild4" />
          </div>
          <div className={s.cardCell}>
            <RangiCard color="neel" value="wild4" />
          </div>
        </div>
      </Section>

      <Section title="Table: hand, piles, seats, animation">
        <div className={s.felt}>
          <div className={s.seats}>
            {[0, 1, 2, 3].map((i) => (
              <Seat
                key={i}
                seat={i}
                name={['Aarati', 'Bibek', 'Dawa', 'Gita'][i]}
                avatar={AVATAR_IDS[i * 3]}
                isBot={i > 0}
                value={[5000, 4200, 6100, 3900][i]}
                info={i === 1 ? '2/4' : undefined}
                isTurn={i === 1}
                timerMs={i === 1 ? 20000 : undefined}
                timerTotalMs={30000}
                dealer={i === 2}
                conn={i === 3 ? 'slow' : 'good'}
                you={i === 0}
              >
                {i > 0 && <BackStack count={13 - dealt / 4} cardWidth={26} />}
              </Seat>
            ))}
          </div>
          <div className={s.center}>
            <DrawPile count={deckCount} cardWidth={56} />
            <DiscardPile cards={discard} cardWidth={56} />
            <ChipStack amount={1650} anchorKey="pot" />
          </div>
          <Hand
            seat={0}
            cards={hand}
            cardWidth={62}
            selectedId={sel}
            onSelect={setSel}
            onPlay={(id) => {
              const c = hand.find((x) => x.id === id)!;
              setSel(null);
              queue.enqueue(async () => {
                sound.play('slide');
                await fly({
                  front: <CardFace card={c} />,
                  from: `card:${id}`,
                  to: 'discard',
                  duration: 220,
                  rotate: [0, 3],
                });
                sound.play('place');
                setHand((h) => h.filter((x) => x.id !== id));
                setDiscard((d) => [...d, c]);
              });
            }}
            playableIds={new Set(hand.filter((c) => c.suit !== 'C').map((c) => c.id))}
          />
        </div>
        <div className={s.row}>
          <Button onClick={dealDemo}>Deal 4</Button>
          <Button onClick={playDemo}>Play middle card</Button>
          <Button onClick={flipDemo}>Flip to pile</Button>
          <Button
            tone="quiet"
            onClick={() => {
              setHand(deck.slice(0, 9));
              setDiscard(deck.slice(20, 23));
              setDeckCount(31);
              setDealt(0);
            }}
          >
            Reset
          </Button>
        </div>
      </Section>

      <Section title="Chips">
        <div className={s.row} style={{ alignItems: 'flex-end', paddingBottom: 22 }}>
          {[10, 60, 150, 640, 2600, 12500].map((a) => (
            <ChipStack key={a} amount={a} />
          ))}
        </div>
      </Section>

      <Section title="Avatars">
        <div className={s.row}>
          {AVATAR_IDS.map((a) => (
            <Avatar key={a} id={a} size={48} />
          ))}
        </div>
      </Section>

      <Section title="Controls">
        <div className={s.row}>
          <Button tone="primary">Play</Button>
          <Button>Rules</Button>
          <Button tone="quiet">Leave table</Button>
          <Button tone="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className={s.row}>
          <Stepper label="Players" value={n} min={2} max={6} onChange={setN} />
          <Segmented
            label="Demo"
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'a', label: 'Bots' },
              { value: 'b', label: 'Same device' },
              { value: 'c', label: 'Online' },
            ]}
          />
          <Toggle label="Demo toggle" checked={tog} onChange={setTog} />
        </div>
        <div className={s.row}>
          <Button onClick={() => setSheet(true)}>Bottom sheet</Button>
          <Button onClick={() => setConfirm(true)}>Dialog</Button>
          <Button
            onClick={() =>
              toast.show('Room K7M2Q is full. Ask the host for a seat, or join to watch.')
            }
          >
            Toast
          </Button>
          <Button onClick={() => setSettings(true)}>Settings</Button>
        </div>
      </Section>

      <Section title="Sounds">
        <div className={s.row}>
          {SOUND_IDS.map((id) => (
            <Button
              key={id}
              size="small"
              onClick={() => {
                sound.unlock();
                setTimeout(() => sound.play(id), 60);
              }}
            >
              {id}
            </Button>
          ))}
        </div>
      </Section>

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Call Break">
        <p style={{ marginTop: 0 }}>Four players, spades are trump, bid what you can take.</p>
      </BottomSheet>
      <ConfirmDialog
        open={confirm}
        title="Leave table?"
        body="Your seat will be taken by a bot."
        confirmLabel="Leave table"
        onConfirm={() => setConfirm(false)}
        onCancel={() => setConfirm(false)}
      />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}

let sid = 0;
function deckSuit(suit: (typeof SUITS)[number]): Card[] {
  return Array.from({ length: 13 }, (_, i) => ({
    id: 5000 + sid++,
    suit,
    rank: (i + 1) as Card['rank'],
    copy: 0,
  }));
}
