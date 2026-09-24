import { ImageResponse } from 'next/og';
import { siteBaseUrl } from '@/infrastructure/siteMetadata';

export const dynamic = 'force-static';
export const alt = 'Reactive Skills: resumable workflows for coding agents';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
const siteLabel = siteBaseUrl.toString().replace(/^https?:\/\//, '').replace(/\/$/, '');

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#101418',
          color: '#f2f5f7',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'space-between',
          padding: '72px',
          width: '100%',
        }}
      >
        <div style={{ color: '#79d9b0', display: 'flex', fontSize: 28, fontWeight: 700 }}>
          REACTIVE SKILLS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 920 }}>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05 }}>
            Resumable workflows for coding agents.
          </div>
          <div style={{ color: '#a9b3bc', fontSize: 30, lineHeight: 1.3 }}>
            Follow the current step. Verify progress. Resume with evidence.
          </div>
        </div>
        <div style={{ color: '#71808c', display: 'flex', fontFamily: 'monospace', fontSize: 22 }}>
          {siteLabel}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
