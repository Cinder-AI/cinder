import React from 'react';

const styles = {
    background: `var(--color-gradient-primary)`,
    height: `100dvh`,
    width: `100dvw`,
}

export function BackgroundPage() {
    return (
        <div className="background-page" style={styles}></div>
    )
}