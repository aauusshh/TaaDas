import s from './Petals.module.css';

/** The one celebration: a short fall of marigold petals at game end. Transform and opacity only. */
export function Petals() {
  return (
    <div className={s.layer} aria-hidden="true">
      {Array.from({ length: 22 }, (_, i) => (
        <span
          key={i}
          className={s.petal}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 7) * 90}ms`,
            ['--drift' as string]: `${((i * 53) % 60) - 30}px`,
            ['--spin' as string]: `${200 + ((i * 41) % 260)}deg`,
            background: i % 3 === 0 ? '#f08a14' : '#f6b21a',
          }}
        />
      ))}
    </div>
  );
}
