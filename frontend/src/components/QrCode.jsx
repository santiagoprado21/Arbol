import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function qrDataUrl(value, width = 512) {
  return QRCode.toDataURL(value, { width, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
}

export default function QrCode({ value, className = '', alt = 'Código QR' }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let alive = true;
    qrDataUrl(value).then((url) => alive && setSrc(url));
    return () => {
      alive = false;
    };
  }, [value]);

  if (!src) return <div className={`animate-pulse rounded-2xl bg-ink-700 ${className}`} />;
  return <img src={src} alt={alt} className={`rounded-2xl bg-white ${className}`} />;
}
