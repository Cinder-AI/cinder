import React from 'react';
const path = '../../assets/back_button.png'

const styles = {
    width: '80%',
    height: '60%',
}

export function BackButtonIcon({ onClick }) {
  return (
    <img src={path} alt="" className="back-button-icon" style={styles} onClick={onClick} />
  );
}