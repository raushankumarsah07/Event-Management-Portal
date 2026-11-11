import { useState } from 'react';
import { CAT, coverGradient } from '../utils';

// a colourful cover made from the category (or the organizer's own image if it loads)
export default function EventCover({ event, className = '', children }) {
  const [broken, setBroken] = useState(false);
  const showImg = event.coverImage && !broken;
  return (
    <div className={`cover ${className}`} style={{ background: coverGradient(event.category) }}>
      {showImg ? (
        <img src={event.coverImage} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span className="cover-emoji" aria-hidden="true">{CAT[event.category]?.emoji || '🎟️'}</span>
      )}
      {children}
    </div>
  );
}
