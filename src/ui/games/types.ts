import type { PlayerInfo } from '../../engine/core/types';
import type { Session } from '../../session/types';

/** Every game's table component gets the same props. */
export interface TableProps {
  session: Session;
  /** the seat this screen belongs to (rotates in pass-and-play) */
  mySeat: number;
  players: PlayerInfo[];
  /** single-player hints: highlight the medium bot's suggestion */
  hints: boolean;
  /** several humans share this device and it is not this seat's turn: show backs */
  handHidden: boolean;
  onLeave: () => void;
  onRematch: () => void;
}
