/** idle: no file loaded yet / loaded: a setlist is shown (artwork may still be fetching) */
export type AppPhase = 'idle' | 'loaded';

export interface SetlistTemplate {
  id: string;
  name: string;
  canvasBackground: string;
  headerBorderColor: string;
  eventColor: string;
  dateColor: string;
  djColor: string;
  totalColor: string;
  rowOddBackground: string;
  rowEvenBackground: string;
  numColor: string;
  titleColor: string;
  subColor: string;
  bpmColor: string;
  noArtBackground: string;
  brandColor: string;
  overlayColor: string;
}
