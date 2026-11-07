import { ImageResponse } from 'next/og';
import { siteBaseUrl } from '@/infrastructure/siteMetadata';
import { OG_PALETTE } from '@/lib/og/palette';

export const dynamic = 'force-static';
export const alt = 'Reactive Skills: the event-driven agent runtime';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';
const siteLabel = siteBaseUrl.toString().replace(/^https?:\/\//, '').replace(/\/$/, '');

const { hero: HERO, ink: INK, muted: MUTED, lime: LIME } = OG_PALETTE;

/**
 * 1200x630 share image in the hero band palette: site mark, wordmark, hero line and site host.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (rendered once at build time)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=1
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=2
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: HERO,
          color: INK,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'space-between',
          padding: '72px',
          width: '100%',
        }}
      >
        <div style={{ alignItems: 'center', color: MUTED, display: 'flex', fontFamily: 'monospace', fontSize: 22, justifyContent: 'space-between' }}>
          <div style={{ alignItems: 'center', display: 'flex', gap: 18 }}>
            <div
              style={{
                alignItems: 'center',
                border: `2px solid ${LIME}`,
                borderRadius: 12,
                display: 'flex',
                height: 44,
                justifyContent: 'center',
                width: 44,
              }}
            >
              <div style={{ background: LIME, borderRadius: 999, height: 12, width: 12 }} />
            </div>
            <div style={{ display: 'flex' }}>EVENT-DRIVEN AGENT RUNTIME</div>
          </div>
          <div style={{ display: 'flex' }}>{siteLabel}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', fontSize: 132, fontWeight: 600, letterSpacing: '-0.05em', lineHeight: 1 }}>
            Reactive Skills<span style={{ color: LIME }}>.</span>
          </div>
          <div style={{ color: MUTED, display: 'flex', fontSize: 40, gap: 12, lineHeight: 1.25 }}>
            Your agent has skills.<span style={{ color: INK }}>Give them a nervous system.</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
