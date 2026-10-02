import { translate } from '../../i18n/t';

/** "लङ्गुर बुर्जा (Langur Burja)" as plain text, Nepali first. For places that only take a string. */
export function gameLabel(id: string) {
  const ne = translate('ne', `game.${id}`);
  const en = translate('en', `game.${id}`);
  return ne === en ? en : `${ne} (${en})`;
}

/** A game's name: the Nepali name first, then the English name smaller. Same in every language. */
export function GameName({ id, block }: { id: string; block?: boolean }) {
  const ne = translate('ne', `game.${id}`);
  const en = translate('en', `game.${id}`);
  return (
    <span lang="ne" style={block ? { display: 'block' } : undefined}>
      {ne}
      {ne !== en && (
        <small
          lang="en"
          style={{
            display: block ? 'block' : 'inline',
            marginLeft: block ? 0 : '0.4em',
            fontSize: '0.62em',
            fontWeight: 500,
            opacity: 0.8,
            letterSpacing: 0,
          }}
        >
          {en}
        </small>
      )}
    </span>
  );
}
