import React from 'react';

const path = '../../assets/dollar_sign.png'

const styles = {
    width: '50%',
    height: '50%',
}

export function DollarIcon() {
  return (
    <img src={path} alt="" className="dollar-sign" style={styles} />
  );
}