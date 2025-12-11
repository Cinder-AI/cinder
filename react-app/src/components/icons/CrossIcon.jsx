import React from 'react';

const path = '../../assets/cross.png'

const styles = {
    width: '80%',
    height: '60%',
}

export function CrossIcon() {
  return (
    <img src={path} alt="" className="cross-icon" style={styles} />
  );
}