import React from 'react';

interface FormattedMessageProps {
  content: string;
}

export default function FormattedMessage({ content }: FormattedMessageProps) {
  // Split into lines/paragraphs
  const lines = content.split('\n');

  // Helper to parse bold and inline code
  const parseInline = (text: string) => {
    // Split by code blocks first
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={index}
            className="bg-[#232736] text-indigo-300 px-1.5 py-0.5 rounded text-[11px] font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-2 text-xs leading-relaxed text-gray-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line spacer
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Heading 3
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-sm text-indigo-300 mt-2 mb-1">
              {parseInline(trimmed.slice(4))}
            </h4>
          );
        }

        // Bullet point
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <div className="flex-1">{parseInline(trimmed.replace(/^(\*|-|•)\s+/, ''))}</div>
            </div>
          );
        }

        // Regular paragraph line
        return (
          <p key={idx} className="leading-relaxed">
            {parseInline(line)}
          </p>
        );
      })}
    </div>
  );
}
