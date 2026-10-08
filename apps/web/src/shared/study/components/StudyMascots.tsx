import React from 'react';

/**
 * Dartboard Crow Mascot for Quiz mode (Images 2 & 3)
 */
export const DartboardCrowMascot: React.FC<{ className?: string }> = ({ className = 'w-24 h-24' }) => {
  return (
    <svg 
      viewBox="0 0 160 140" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={`opacity-30 hover:opacity-45 transition-opacity pointer-events-none select-none ${className}`}
    >
      {/* Dartboard */}
      <g stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="115" cy="70" r="38" strokeDasharray="3 2" />
        <circle cx="115" cy="70" r="28" />
        <circle cx="115" cy="70" r="16" />
        <circle cx="115" cy="70" r="6" fill="#94a3b8" />
        {/* Radial lines on dartboard */}
        <line x1="115" y1="32" x2="115" y2="108" />
        <line x1="77" y1="70" x2="153" y2="70" />
        <line x1="88" y1="43" x2="142" y2="97" />
        <line x1="88" y1="97" x2="142" y2="43" />
        {/* Numbers around dartboard */}
        <text x="113" y="28" fill="#94a3b8" fontSize="7" fontWeight="bold">20</text>
        <text x="113" y="117" fill="#94a3b8" fontSize="7" fontWeight="bold">3</text>
        <text x="70" y="73" fill="#94a3b8" fontSize="7" fontWeight="bold">11</text>
        <text x="156" y="73" fill="#94a3b8" fontSize="7" fontWeight="bold">6</text>
      </g>

      {/* Darts hitting board */}
      <g stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round">
        <line x1="115" y1="70" x2="135" y2="60" />
        <path d="M135 60 L140 57 M135 60 L138 64" />
        <line x1="108" y1="78" x2="125" y2="88" />
      </g>

      {/* Crow Mascot */}
      <g stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="#1e293b">
        {/* Body */}
        <path d="M45 105 C30 90 28 65 42 45 C55 27 75 35 78 50 C80 65 75 95 45 105 Z" fill="#334155" />
        
        {/* Head */}
        <circle cx="62" cy="40" r="16" fill="#334155" />
        
        {/* Beak */}
        <path d="M74 38 L94 43 L74 48 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2" />
        
        {/* Eye */}
        <circle cx="66" cy="37" r="4.5" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
        <circle cx="68" cy="37" r="2" fill="#0f172a" />
        
        {/* Wing with feather texture */}
        <path d="M38 65 C48 60 62 65 60 85 C55 98 42 95 35 85 C32 78 32 70 38 65 Z" fill="#1e293b" />
        <path d="M42 72 C48 72 52 78 50 85" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
        
        {/* Crow Hand holding a dart */}
        <path d="M65 72 L82 66" stroke="#94a3b8" strokeWidth="2.5" />
        {/* Dart in hand */}
        <line x1="80" y1="68" x2="98" y2="62" stroke="#f87171" strokeWidth="2.5" />
        <path d="M98 62 L94 59 M98 62 L95 65" stroke="#f87171" strokeWidth="2" />
        
        {/* Legs / Feet */}
        <path d="M42 105 L38 122 M38 122 L32 125 M38 122 L42 125" stroke="#fbbf24" strokeWidth="2" fill="none" />
        <path d="M52 103 L55 120 M55 120 L50 123 M55 120 L60 123" stroke="#fbbf24" strokeWidth="2" fill="none" />

        {/* Tail feathers */}
        <path d="M28 85 L12 92 L20 80 L8 82 L22 72" stroke="#94a3b8" strokeWidth="2" fill="#334155" />
      </g>
    </svg>
  );
};

/**
 * Typing Crow Mascot for Cram mode (Images 4 & 5)
 */
export const TypingCrowMascot: React.FC<{ className?: string }> = ({ className = 'w-20 h-20' }) => {
  return (
    <svg 
      viewBox="0 0 140 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={`opacity-35 hover:opacity-50 transition-opacity pointer-events-none select-none ${className}`}
    >
      {/* Keyboard */}
      <g stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Keyboard base (perspective) */}
        <path d="M52 82 L118 70 L132 94 L62 108 Z" fill="#334155" />
        {/* Keyboard keys lines */}
        <line x1="60" y1="84" x2="120" y2="73" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" />
        <line x1="64" y1="92" x2="124" y2="81" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" />
        <line x1="68" y1="100" x2="128" y2="89" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* Key dots */}
        <circle cx="85" cy="85" r="1.5" fill="#f8fafc" />
        <circle cx="95" cy="83" r="1.5" fill="#f8fafc" />
        <circle cx="105" cy="81" r="1.5" fill="#f8fafc" />
      </g>

      {/* Crow Typing */}
      <g stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="#1e293b">
        {/* Body */}
        <path d="M30 85 C20 70 24 45 40 32 C56 20 72 28 75 42 C78 58 70 85 45 92 Z" fill="#334155" />
        
        {/* Head */}
        <circle cx="58" cy="34" r="16" fill="#334155" />
        
        {/* Reading Glasses */}
        <circle cx="64" cy="32" r="5" fill="#ffffff/20" stroke="#f59e0b" strokeWidth="2" />
        <line x1="59" y1="32" x2="55" y2="33" stroke="#f59e0b" strokeWidth="2" />
        <line x1="69" y1="32" x2="72" y2="33" stroke="#f59e0b" strokeWidth="2" />
        
        {/* Eye behind glasses */}
        <circle cx="64" cy="32" r="1.8" fill="#0f172a" />
        
        {/* Beak */}
        <path d="M72 32 L88 36 L72 42 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="1.8" />
        
        {/* Wing positioned typing downwards */}
        <path d="M35 55 C46 52 56 56 60 70 C62 78 56 86 45 84 C38 82 32 70 35 55 Z" fill="#1e293b" />
        
        {/* Hands / Feathers hitting the keyboard */}
        <path d="M60 72 L72 80 M72 80 L76 83" stroke="#94a3b8" strokeWidth="2.5" />
        <path d="M58 66 L78 74" stroke="#94a3b8" strokeWidth="2" />

        {/* Tail */}
        <path d="M22 80 L8 88 L14 76 L4 76 L16 68" stroke="#94a3b8" strokeWidth="1.8" fill="#334155" />
      </g>
    </svg>
  );
};
