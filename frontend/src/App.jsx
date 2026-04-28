import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Paperclip, 
  Bot, 
  User, 
  Moon, 
  Sun,
  X,
  Stethoscope,
  Activity,
  Menu,
  MessageSquare,
  Settings
} from 'lucide-react';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

function App() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Hello! I am your AI Medical Assistant. How can I help you today? You can ask me questions or upload a medical prescription (image or PDF) for analysis."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [theme, setTheme] = useState('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [language, setLanguage] = useState('en');
  const chatEndRef = useRef(null);

  const clearChat = () => {
    setMessages([
      {
        id: 1,
        sender: 'bot',
        text: "Hello! I am your AI Medical Assistant. How can I help you today? You can ask me questions or upload a medical prescription (image or PDF) for analysis."
      }
    ]);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Theme toggle
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() && !selectedFile) return;

    const userMessageText = input.trim();
    const currentFile = selectedFile;
    
    // Create optimistic user message
    let messageContent = userMessageText;
    if (currentFile) {
      messageContent += messageContent ? `\n\n[Attached file: ${currentFile.name}]` : `[Attached file: ${currentFile.name}]`;
    }

    const newUserMsg = { id: Date.now(), sender: 'user', text: messageContent };
    setMessages(prev => [...prev, newUserMsg]);
    
    setInput('');
    clearFile();
    setIsLoading(true);

    try {
      let botResponseText = "";

      // If there's a file, we send it to /upload first
      if (currentFile) {
        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('language', language);
        
        const uploadRes = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: formData,
        });
        
        const uploadData = await uploadRes.json();
        
        if (uploadRes.ok) {
          botResponseText = uploadData.analysis || "File analyzed successfully.";
        } else {
          throw new Error(uploadData.error || "Failed to analyze file");
        }
      } 
      // If there's text (and no file, or text along with file but handled via chat)
      // Actually, if both are present, we might want to do both. 
      // For simplicity, if there's a file, the response is the analysis. 
      // If there's just text, it's a chat request.
      else if (userMessageText) {
        const chatRes = await fetch(`${API_URL}/get`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ msg: userMessageText, language: language }),
        });
        
        const chatData = await chatRes.json();
        if (chatRes.ok) {
          botResponseText = chatData.answer || "I'm sorry, I couldn't process that.";
        } else {
          throw new Error(chatData.error || "Failed to get response");
        }
      }

      setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: botResponseText }]);
      
    } catch (error) {
      console.error("Error communicating with server:", error);
      setMessages(prev => [...prev, { 
        id: Date.now(), 
        sender: 'bot', 
        text: `Error: ${error.message || "Failed to communicate with the server. Is the Flask backend running?"}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className={`sidebar ${!isSidebarOpen ? 'closed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">Menu</div>
          <button className="menu-toggle" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-content">
          <div className="sidebar-item new-chat" onClick={clearChat}>
            <MessageSquare size={18} />
            <span>New Consultation</span>
          </div>
          <div className="sidebar-item" onClick={() => setIsSidebarOpen(window.innerWidth >= 768)}>
            <Activity size={18} />
            <span>History (Coming Soon)</span>
          </div>
          <div className="sidebar-item" onClick={() => { setIsSettingsOpen(true); setIsSidebarOpen(window.innerWidth >= 768); }}>
            <Settings size={18} />
            <span>Settings</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <header className="header">
          <div className="header-title">
            <button 
              className="menu-toggle" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle Menu"
            >
              <Menu size={24} />
            </button>
            <div className="logo-container">
            <Stethoscope size={24} />
          </div>
          <div>
            <h1>MedChat AI</h1>
            <div className="header-subtitle">
              <span className="status-dot"></span>
              Online & Ready
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="chat-area">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`message-wrapper ${msg.sender}`}
            >
              <div className={`avatar ${msg.sender === 'bot' ? 'bot-avatar' : 'user-avatar'}`}>
                {msg.sender === 'bot' ? <Activity size={20} /> : <User size={20} />}
              </div>
              <div className="message-bubble">
                {msg.sender === 'bot' ? (
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                ) : (
                  msg.text.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      <br />
                    </span>
                  ))
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="message-wrapper bot"
          >
            <div className="avatar bot-avatar">
              <Activity size={20} />
            </div>
            <div className="message-bubble">
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-area">
        <AnimatePresence>
          {selectedFile && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="file-preview"
            >
              <Paperclip size={16} className="text-muted" />
              <span>{selectedFile.name}</span>
              <button onClick={clearFile} className="remove-file">
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form className="input-form" onSubmit={handleSend}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".jpg,.jpeg,.png,.pdf"
            style={{ display: 'none' }}
          />
          <button 
            type="button" 
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Prescription (PDF/Image)"
          >
            <Paperclip size={20} />
          </button>
          
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a medical question..."
            rows={1}
            style={{ height: 'auto' }}
          />
          
          <button 
            type="submit" 
            className="send-btn"
            disabled={(!input.trim() && !selectedFile) || isLoading}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
            >
              <div className="modal-header">
                <h2>Settings</h2>
                <button className="close-btn" onClick={() => setIsSettingsOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="setting-group">
                  <label>Appearance</label>
                  <div className="setting-control">
                    <div className="theme-switch">
                      {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
                      <span>Theme</span>
                    </div>
                    <button className="toggle-switch-btn" onClick={toggleTheme}>
                      {theme === 'light' ? 'Switch to Dark' : 'Switch to Light'}
                    </button>
                  </div>
                </div>

                <div className="setting-group">
                  <label>Language</label>
                  <div className="setting-control">
                    <span>Chat Language</span>
                    <select 
                      className="language-select" 
                      value={language} 
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                      <option value="hi">हिंदी (Hindi)</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
