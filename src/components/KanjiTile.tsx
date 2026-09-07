import React from 'react';
import { KanjiItem } from '../types';
import { RoughCard } from './RoughCard';

interface KanjiTileProps {
  item: KanjiItem;
  onSelect: (item: KanjiItem) => void;
  level: string;
}

export const KanjiTile: React.FC<KanjiTileProps> = ({ item, onSelect, level }) => {
  const getTheme = () => {
    switch (level) {
      case 'N5':
        return {
          fill: '#86efac', // Soft pastel mint green matching screenshot
          text: '#047857', // Dark teal-green
          stroke: '#6b7280' // Soft pencil gray
        };
      case 'N4':
        return {
          fill: '#bae6fd',
          text: '#0369a1',
          stroke: '#6b7280'
        };
      case 'N3':
        return {
          fill: '#fde68a',
          text: '#b45309',
          stroke: '#6b7280'
        };
      case 'N2':
        return {
          fill: '#fed7aa',
          text: '#c2410c',
          stroke: '#6b7280'
        };
      case 'N1':
        return {
          fill: '#fecdd3',
          text: '#be123c',
          stroke: '#6b7280'
        };
      default:
        return {
          fill: '#86efac',
          text: '#047857',
          stroke: '#6b7280'
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative cursor-pointer select-none"
    >
      <RoughCard
        fill={theme.fill}
        stroke={theme.stroke}
        strokeWidth={1.0}
        roughness={0.7}
        bowing={0.4}
        borderRadius={10}
        className="aspect-square flex items-center justify-center transition-transform group-hover:scale-105"
      >
        <span 
          className="font-kanji font-bold text-center leading-none select-none"
          style={{ 
            color: theme.text,
            fontSize: '22px'
          }}
        >
          {item.kanji}
        </span>
      </RoughCard>

      {/* Tooltip on hover */}
      <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-[#292524] px-2 py-0.5 text-[11px] whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-md z-20 font-sketch font-bold">
        {item.hanViet} ({item.meaning})
      </div>
    </div>
  );
};
