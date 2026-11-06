import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { money } from './common';

// One series (lowest price over time) plus a dashed line for the buyer's limit.
// Single series, so no legend box: the card title names it and the limit line is labeled directly.

const W = 640;
const H = 220;
const PAD = { top: 16, right: 64, bottom: 28, left: 48 };

export default function PriceChart({ prices, limit }) {
  const [hover, setHover] = useState(null);

  const geo = useMemo(() => {
    const pts = prices.map((p, i) => ({ ...p, i, t: new Date(p.at).getTime() }));
    const values = [...pts.map((p) => p.price), limit];
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || hi * 0.1 || 1;
    const yMin = Math.max(0, lo - span * 0.25);
    const yMax = hi + span * 0.15;
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    // Evenly spaced by check, so a burst of checks on one day doesn't squash the line.
    const x = (i) => PAD.left + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
    const y = (v) => PAD.top + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const ticks = Array.from({ length: 4 }, (_, k) => yMin + ((yMax - yMin) * k) / 3);
    return { pts, x, y, ticks, iw };
  }, [prices, limit]);

  if (!prices.length) return null;
  const { pts, x, y, ticks } = geo;
  const path = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
  const last = pts.at(-1);
  const h = hover != null ? pts[hover] : null;

  function onMove(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    pts.forEach((p, k) => {
      if (Math.abs(x(p.i) - px) < Math.abs(x(pts[best].i) - px)) best = k;
    });
    setHover(best);
  }

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Lowest price over ${pts.length} checks: from ${money(pts[0].price)} to ${money(last.price)}. Your limit is ${money(limit)}.`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="axis" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{money(Math.round(t))}</text>
          </g>
        ))}
        <line className="limit" x1={PAD.left} x2={W - PAD.right} y1={y(limit)} y2={y(limit)} />
        <text className="limit-label" x={W - PAD.right + 6} y={y(limit) + 4}>Your limit</text>

        <path className="line" d={path} />
        {pts.map((p, k) => (
          <circle
            key={k}
            className={`dot${p.simulated ? ' simulated' : ''}`}
            cx={x(p.i)}
            cy={y(p.price)}
            r={k === pts.length - 1 || k === hover ? 5 : 3.5}
          />
        ))}
        <text className="axis" x={PAD.left} y={H - 8}>{dayjs(pts[0].at).format('MMM D')}</text>
        {pts.length > 1 && <text className="axis" x={W - PAD.right} y={H - 8} textAnchor="end">{dayjs(last.at).format('MMM D')}</text>}

        {h && <line className="crosshair" x1={x(h.i)} x2={x(h.i)} y1={PAD.top} y2={H - PAD.bottom} />}
      </svg>
      {h && (
        <div className="tooltip" style={{ left: `${(x(h.i) / W) * 100}%`, top: `${(y(h.price) / H) * 100}%` }}>
          <strong>{money(h.price)}</strong>
          <span>{h.domain || 'store'}</span>
          <span>{dayjs(h.at).format('MMM D, h:mm A')}</span>
          {h.simulated && <span>Simulated drop</span>}
        </div>
      )}
      <table className="sr-only">
        <caption>Price checks</caption>
        <thead><tr><th>When</th><th>Lowest price</th><th>Store</th></tr></thead>
        <tbody>
          {pts.map((p, k) => (
            <tr key={k}><td>{dayjs(p.at).format('MMM D, h:mm A')}</td><td>{money(p.price)}</td><td>{p.domain}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
