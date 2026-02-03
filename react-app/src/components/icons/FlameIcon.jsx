import React from 'react';

const path = "/assets/flame.svg";

const styles = {
    width: '24px',
    height: '24px',
    alignSelf: 'flex-start'
}

export function FlameIcon() {
    return (
        <img src={path} alt="Flame" style={styles} />
    )
}