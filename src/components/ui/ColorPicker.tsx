import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cellUtils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

const COLORS = [
  { name: 'Bleu', hex: '#3b82f6' },
  { name: 'Vert', hex: '#10b981' },
  { name: 'Rouge', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Jaune', hex: '#eab308' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Rose', hex: '#ec4899' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Gris', hex: '#6b7280' },
  { name: 'Noir', hex: '#1f2937' },
];

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="p-2">
      <div className="text-sm font-medium mb-3">Choisir une couleur</div>
      <div className="grid grid-cols-4 gap-2">
        {COLORS.map((color) => (
          <button
            key={color.hex}
            type="button"
            onClick={() => onChange(color.hex)}
            className={cn(
              "relative w-10 h-10 rounded-md border-2 transition-all hover:scale-110",
              value === color.hex ? "border-gray-900 shadow-md" : "border-gray-200"
            )}
            style={{ backgroundColor: color.hex }}
            title={color.name}
          >
            {value === color.hex && (
              <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow-md" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
