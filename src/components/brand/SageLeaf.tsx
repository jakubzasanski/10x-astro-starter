import { useId } from "react";

interface SageLeafProps {
  size?: number;
  className?: string;
}

// React form of the Sage leaf mark (for use inside React islands). Mirrors
// SageLeaf.astro; `useId()` keeps the gradient id unique per instance.
export function SageLeaf({ size = 30, className }: SageLeafProps) {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#84B673" />
          <stop offset="1" stopColor="#4E7C4D" />
        </linearGradient>
      </defs>
      <path d="M18 3C28 9 30 23 18 33 6 23 8 9 18 3Z" fill={`url(#${gradId})`} />
      <path
        d="M18 8C16.2 16 16.2 24 18 30"
        stroke="#fff"
        strokeOpacity=".82"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M18 14c1.8 0 3.4-.8 4.6-2.2M18 20c-1.8 0-3.4-.8-4.6-2.2"
        stroke="#fff"
        strokeOpacity=".55"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
