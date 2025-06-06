import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import PropTypes from 'prop-types';
import { getThinkingLabel } from '../local/languages';

const ThinkingAccordion = ({ thinkingContent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [thinkingLabelText, setThinkingLabelText] = useState(getThinkingLabel());

  // Mettre à jour le label quand la langue change
  useEffect(() => {
    const updateLabel = () => {
      setThinkingLabelText(getThinkingLabel());
    };

    // Écouter les changements de localStorage
    window.addEventListener('storage', updateLabel);
    
    // Vérifier périodiquement pour les changements (au cas où)
    const interval = setInterval(updateLabel, 1000);

    return () => {
      window.removeEventListener('storage', updateLabel);
      clearInterval(interval);
    };
  }, []);

  if (!thinkingContent) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-gray-500 w-full text-left bg-transparent border-none p-0 focus:outline-none focus:border-none"
        style={{ backgroundColor: 'transparent', outline: 'none', border: 'none' }}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        <Brain className="w-4 h-4 text-purple-500" />
        <span className="italic font-medium text-gray-500">{thinkingLabelText}</span>
      </button>
      
      {isOpen && (
        <div className="mt-2 p-3 bg-slate-800/40 rounded-md border-l-4 border-purple-500/70 backdrop-blur-sm">
          <div className="text-sm text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
            {thinkingContent}
          </div>
        </div>
      )}
    </div>
  );
};

ThinkingAccordion.propTypes = {
  thinkingContent: PropTypes.string
};

export default ThinkingAccordion;