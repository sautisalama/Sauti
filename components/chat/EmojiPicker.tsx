'use client';

import { useState } from 'react';

// Common emoji categories with popular emojis
const EMOJI_DATA = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥'],
  'Gestures': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '😻', '💑', '💏'],
  'Objects': ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '⭐', '🌟', '✨', '💫', '🔥', '💯', '📱', '💻', '📷', '🎬', '🎵', '🎶', '🔔', '📢', '💡', '📝', '📚', '💼', '📌'],
  'Nature': ['🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '💐', '🪻', '🌱', '🌲', '🌳', '🌴', '🌵', '🍀', '☀️', '🌙', '⭐', '🌈', '☁️', '💧', '🦋', '🐦', '🐶', '🐱', '🐰']
};

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onEmojiSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_DATA>('Smileys');
  const categories = Object.keys(EMOJI_DATA) as (keyof typeof EMOJI_DATA)[];

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-serene-neutral-200 w-[320px] sm:w-[360px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Header with categories */}
      <div className="flex border-b border-serene-neutral-100 px-2 py-2 gap-1 overflow-x-auto scrollbar-hide bg-serene-neutral-50/50">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-serene-blue-100 text-serene-blue-700'
                : 'text-serene-neutral-500 hover:bg-serene-neutral-100 hover:text-serene-neutral-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="p-3 h-[200px] overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_DATA[activeCategory].map((emoji, idx) => (
            <button
              key={idx}
              onClick={() => {
                onEmojiSelect(emoji);
                onClose();
              }}
              className="w-9 h-9 flex items-center justify-center text-xl hover:bg-serene-blue-50 rounded-lg transition-colors active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-serene-neutral-100 bg-serene-neutral-50/50 flex justify-between items-center">
        <span className="text-xs text-serene-neutral-400">Select an emoji</span>
        <button
          onClick={onClose}
          className="text-xs text-serene-neutral-500 hover:text-serene-neutral-700 font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
}
