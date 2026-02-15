import React, { CSSProperties } from 'react'

type MediaType = 'video' | 'image'

export interface TokenMediaProps {
  media?: {
    type: MediaType
    src: string
    poster?: string
  }
  fallbackSrc?: string
  alt?: string
  className?: string
  style?: CSSProperties
  objectFit?: CSSProperties['objectFit']
  showPosterOnly?: boolean
}

export const TokenMedia = ({
  media,
  fallbackSrc,
  alt = '',
  className,
  style,
  objectFit = 'cover',
  showPosterOnly = false,
}: TokenMediaProps) => {
  const source = media ?? (fallbackSrc ? { type: 'image' as MediaType, src: fallbackSrc } : null)
  const fitStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    objectPosition: 'center',
    borderRadius: 'inherit',
    ...style,
  }

  if (!source) return null

  if (source.type === 'video') {
    if (showPosterOnly) {
      return (
        <img
          src={source.poster ?? fallbackSrc ?? source.src}
          alt={alt}
          className={className}
          style={fitStyle}
        />
      )
    }

    return (
      <video
        className={className}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        poster={source.poster}
        style={fitStyle}
      >
        <source src={source.src} type="video/mp4" />
      </video>
    )
  }

  return <img src={source.src} alt={alt} className={className} style={fitStyle} />
}

