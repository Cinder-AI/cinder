import React from 'react'

const path = '/assets/fire.svg'

export function CinderIcon({ styles }: { styles?: React.CSSProperties }) {
    return <img src={path} alt="Cinder" style={styles} />
}