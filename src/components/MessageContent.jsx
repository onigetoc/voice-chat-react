import PropTypes from 'prop-types';
import ThinkingAccordion from './ThinkingAccordion';
import { parseMessageContent } from '../utils/messageParser';

const MessageContent = ({ content, messageIndex }) => {
  const { normalContent, thinkingContent, hasThinking } = parseMessageContent(content);

  return (
    <div className="message-content">
      {/* Section de réflexion en accordéon AU-DESSUS (non lue par le TTS) */}
      {hasThinking && (
        <ThinkingAccordion
          thinkingContent={thinkingContent}
          index={messageIndex}
        />
      )}
      
      {/* Contenu normal (visible par défaut et lu par le TTS) */}
      {normalContent && (
        <div className="normal-content whitespace-pre-wrap">
          {normalContent}
        </div>
      )}
    </div>
  );
};

MessageContent.propTypes = {
  content: PropTypes.string,
  messageIndex: PropTypes.number
};

export default MessageContent;