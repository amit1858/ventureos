import styles from './demo.module.css';

interface ReadinessRingProps {
  value: number;
  size?: number;
  caption?: string;
  unit?: string;
}

/** Pure SVG readiness ring. Server component — no client JS. */
export function ReadinessRing({ value, size = 132, caption = 'Readiness', unit = '/ 100' }: ReadinessRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;
  const color = clamped >= 70 ? '#56c596' : clamped >= 45 ? '#f3b350' : '#ef6a6a';

  return (
    <div className={styles.ringWrap}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2a2a30"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className={styles.ringCenter}>
          <span className={styles.ringValue} style={{ color }}>
            {Math.round(clamped)}
          </span>
          <span className={styles.ringUnit}>{unit}</span>
        </div>
      </div>
      <span className={styles.ringCaption}>{caption}</span>
    </div>
  );
}
