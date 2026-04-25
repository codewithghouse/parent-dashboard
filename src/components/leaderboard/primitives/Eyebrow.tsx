import { ReactNode } from 'react';
import { T, FONT } from '@/lib/edullentTokens';

interface EyebrowProps {
  children: ReactNode;
  color?: string;
}

export function Eyebrow({ children, color = T.T4 }: EyebrowProps) {
  return (
    <p
      className="m-0 uppercase"
      style={{
        fontSize: '10px',
        fontWeight: 800,
        letterSpacing: '1.8px',
        color,
        fontFamily: FONT,
      }}
    >
      {children}
    </p>
  );
}
