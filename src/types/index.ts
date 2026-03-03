export type AppPhase = 'idle' | 'parsed' | 'fetching' | 'ready';

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
  timeColor: string;
  genreBgColor: string;
  genreTextColor: string;
  noArtBackground: string;
  brandColor: string;
  overlayColor: string;
}
