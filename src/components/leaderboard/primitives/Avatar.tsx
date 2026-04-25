import { FONT } from '@/lib/edullentTokens';

interface AvatarProps {
  initials: string;
  bg: string;
  color: string;
  size?: number;
}

export function Avatar({ initials, bg, color, size = 34 }: AvatarProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: size > 36 ? 13 : 12,
        flexShrink: 0,
        letterSpacing: '-0.2px',
        fontFamily: FONT,
      }}
    >
      {initials}
    </div>
  );
}
