import { CandlestickData, SeriesMarker, Time } from 'lightweight-charts';

export interface DetectedSignal {
  time: Time;
  label: string;
  sentiment: 'BULLISH' | 'BEARISH';
  price: number;
}

export interface PatternResult {
  markers: SeriesMarker<Time>[];
  signals: DetectedSignal[];
}

export function detectPatterns(data: CandlestickData<Time>[]): PatternResult {
  const markers: SeriesMarker<Time>[] = [];
  const signals: DetectedSignal[] = [];
  if (data.length < 6) return { markers, signals };

  const isRed = (c: CandlestickData<Time>) => c.close < c.open;
  const isGreen = (c: CandlestickData<Time>) => c.close > c.open;
  const range = (c: CandlestickData<Time>) => Math.max(0.0001, c.high - c.low);
  const isDoji = (c: CandlestickData<Time>) => Math.abs(c.close - c.open) <= range(c) * 0.1;
  const bodySize = (c: CandlestickData<Time>) => Math.abs(c.close - c.open);
  const upperWick = (c: CandlestickData<Time>) => c.high - Math.max(c.open, c.close);
  const lowerWick = (c: CandlestickData<Time>) => Math.min(c.open, c.close) - c.low;

  for (let i = 5; i < data.length; i++) {
    const c5 = data[i - 4];
    const c4 = data[i - 3];
    const c3 = data[i - 2];
    const c2 = data[i - 1];
    const curr = data[i];

    const time = curr.time;
    let label = '';
    let sentiment: 'BULLISH' | 'BEARISH' = 'BULLISH';

    // --- BULLISH PATTERNS ---
    // 1. Bullish Engulfing
    if (isRed(c2) && isGreen(curr) && curr.open <= c2.close && curr.close >= c2.open && bodySize(curr) > bodySize(c2)) {
      label = 'BULL ENGULFING';
      sentiment = 'BULLISH';
    }
    // 2. Hammer (after pullback)
    else if (
      c2.close < c3.close &&
      bodySize(curr) > 0 &&
      lowerWick(curr) >= bodySize(curr) * 2 &&
      upperWick(curr) <= bodySize(curr) * 0.5
    ) {
      label = 'HAMMER';
      sentiment = 'BULLISH';
    }
    // 3. Inverted Hammer
    else if (
      c2.close < c3.close &&
      bodySize(curr) > 0 &&
      upperWick(curr) >= bodySize(curr) * 2 &&
      lowerWick(curr) <= bodySize(curr) * 0.5
    ) {
      label = 'INV. HAMMER';
      sentiment = 'BULLISH';
    }
    // 4. Morning Star
    else if (
      isRed(c3) &&
      bodySize(c2) < bodySize(c3) * 0.35 &&
      isGreen(curr) &&
      curr.close > (c3.open + c3.close) / 2
    ) {
      label = 'MORNING STAR';
      sentiment = 'BULLISH';
    }
    // 5. Piercing Pattern
    else if (
      isRed(c2) &&
      isGreen(curr) &&
      curr.open < c2.low &&
      curr.close > (c2.open + c2.close) / 2 &&
      curr.close < c2.open
    ) {
      label = 'PIERCING';
      sentiment = 'BULLISH';
    }
    // 6. Three White Soldiers
    else if (
      isGreen(c3) &&
      isGreen(c2) &&
      isGreen(curr) &&
      curr.close > c2.close &&
      c2.close > c3.close &&
      bodySize(curr) >= range(curr) * 0.5 &&
      bodySize(c2) >= range(c2) * 0.5
    ) {
      label = '3 SOLDIERS';
      sentiment = 'BULLISH';
    }
    // 7. Bullish Harami
    else if (
      isRed(c2) &&
      isGreen(curr) &&
      bodySize(c2) > range(c2) * 0.5 &&
      curr.open > c2.close &&
      curr.close < c2.open
    ) {
      label = 'BULL HARAMI';
      sentiment = 'BULLISH';
    }
    // 8. Tweezer Bottom
    else if (
      isRed(c2) &&
      isGreen(curr) &&
      Math.abs(c2.low - curr.low) <= range(curr) * 0.05 &&
      c3.close > c2.close
    ) {
      label = 'TWEEZER BTM';
      sentiment = 'BULLISH';
    }
    // 9. Rising Three Methods
    else if (
      isGreen(c5) &&
      isRed(c4) &&
      isRed(c3) &&
      isRed(c2) &&
      isGreen(curr) &&
      curr.close > c5.close &&
      c4.low > c5.low &&
      c2.low > c5.low
    ) {
      label = 'RISING THREE';
      sentiment = 'BULLISH';
    }
    // 10. Bullish Doji Confirmation
    else if (isDoji(c2) && isGreen(curr) && curr.close > c2.high && c3.close > c2.close) {
      label = 'DOJI REVERSAL';
      sentiment = 'BULLISH';
    }

    // --- BEARISH PATTERNS ---
    // 11. Bearish Engulfing
    else if (
      isGreen(c2) &&
      isRed(curr) &&
      curr.open >= c2.close &&
      curr.close <= c2.open &&
      bodySize(curr) > bodySize(c2)
    ) {
      label = 'BEAR ENGULFING';
      sentiment = 'BEARISH';
    }
    // 12. Shooting Star
    else if (
      c2.close > c3.close &&
      bodySize(curr) > 0 &&
      upperWick(curr) >= bodySize(curr) * 2 &&
      lowerWick(curr) <= bodySize(curr) * 0.5 &&
      isRed(curr)
    ) {
      label = 'SHOOTING STAR';
      sentiment = 'BEARISH';
    }
    // 13. Evening Star
    else if (
      isGreen(c3) &&
      bodySize(c2) < bodySize(c3) * 0.35 &&
      isRed(curr) &&
      curr.close < (c3.open + c3.close) / 2
    ) {
      label = 'EVENING STAR';
      sentiment = 'BEARISH';
    }
    // 14. Three Black Crows
    else if (
      isRed(c3) &&
      isRed(c2) &&
      isRed(curr) &&
      curr.close < c2.close &&
      c2.close < c3.close &&
      bodySize(curr) >= range(curr) * 0.5 &&
      bodySize(c2) >= range(c2) * 0.5
    ) {
      label = '3 BLACK CROWS';
      sentiment = 'BEARISH';
    }
    // 15. Tweezer Top
    else if (
      isGreen(c2) &&
      isRed(curr) &&
      Math.abs(c2.high - curr.high) <= range(curr) * 0.05 &&
      c2.close > c3.close
    ) {
      label = 'TWEEZER TOP';
      sentiment = 'BEARISH';
    }

    if (label) {
      markers.push({
        time,
        position: sentiment === 'BULLISH' ? 'belowBar' : 'aboveBar',
        color: sentiment === 'BULLISH' ? '#2ebd85' : '#f6465d',
        shape: sentiment === 'BULLISH' ? 'arrowUp' : 'arrowDown',
        text: label,
      });
      signals.push({
        time,
        label,
        sentiment,
        price: curr.close,
      });
    }
  }

  return { markers, signals };
}
