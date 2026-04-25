import { T } from '@/lib/edullentTokens';

interface ComparisonCardProps {
  type: 'topper' | 'user';
  rank: number;
  name: string;
  score: number;
}

export function ComparisonCard({ type, rank, name, score }: ComparisonCardProps) {
  const isUser = type === 'user';
  return (
    <div
      style={{
        textAlign: 'center',
        padding: 14,
        borderRadius: 14,
        background: isUser
          ? 'linear-gradient(135deg, rgba(0,85,255,0.10) 0%, rgba(17,102,255,0.05) 100%)'
          : 'linear-gradient(135deg, rgba(255,170,0,0.08) 0%, rgba(255,136,0,0.04) 100%)',
        border: isUser ? `1.5px solid ${T.B1}` : '0.5px solid rgba(255,170,0,0.18)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 10,
          background: isUser
            ? 'linear-gradient(135deg, #0055FF 0%, #1166FF 100%)'
            : 'linear-gradient(135deg, #FFD700 0%, #FFAA00 100%)',
          color: '#FFFFFF',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: '-0.4px',
          marginBottom: 6,
        }}
      >
        {rank}
      </div>
      <p
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: T.T1,
          margin: '0 0 4px',
          letterSpacing: '-0.2px',
        }}
      >
        {name}
      </p>
      <p
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: isUser ? T.B1 : T.T1,
          margin: 0,
          letterSpacing: '-0.6px',
        }}
      >
        {score}
      </p>
    </div>
  );
}
