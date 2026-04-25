import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import '../pages/ai/AIChatPage.css';

/**
 * Floating entry button that takes any authenticated user into the AI
 * assistant. Rendered once by AppShell so every role (doctor/admin,
 * elder, family) sees the same affordance.
 */
const AIEntryFab: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Don't show the FAB on the chat page itself.
  if (location.pathname === '/ai' || location.pathname.startsWith('/ai/')) {
    return null;
  }
  return (
    <button
      type="button"
      className="ai-fab"
      onClick={() => navigate('/ai')}
      title="AI 助手"
      aria-label="打开 AI 助手"
    >
      <Sparkles size={24} strokeWidth={1.8} />
    </button>
  );
};

export default AIEntryFab;
