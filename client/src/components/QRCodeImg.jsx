import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// draws a QR code for the ticket code; the organizer can scan or type it at the door
export default function QRCodeImg({ value, size = 180 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: '#1c1030', light: '#ffffff' } })
      .then((url) => alive && setSrc(url))
      .catch(() => {});
    return () => { alive = false; };
  }, [value, size]);
  return src ? <img className="qr" src={src} width={size} height={size} alt={`QR code for ticket ${value}`} /> : <div className="qr" style={{ width: size, height: size }} />;
}
