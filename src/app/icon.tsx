import { ImageResponse } from 'next/og'

export const size        = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#1E3A5F',
          width: 32,
          height: 32,
          borderRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Factory silhouette in amber */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          {/* Chimney */}
          <rect x="4" y="4" width="3" height="8" rx="0.5" fill="#F59E0B" />
          {/* Roof line */}
          <path d="M2 12 L8 9 L14 12 L22 8 L22 20 L2 20 Z" fill="#FBBF24" />
          {/* Windows */}
          <rect x="5"  y="14" width="3" height="3" rx="0.5" fill="#1E3A5F" />
          <rect x="10" y="14" width="3" height="3" rx="0.5" fill="#1E3A5F" />
          <rect x="15" y="14" width="3" height="3" rx="0.5" fill="#1E3A5F" />
          {/* Floor */}
          <rect x="2" y="19" width="20" height="1.5" rx="0.5" fill="#F59E0B" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
