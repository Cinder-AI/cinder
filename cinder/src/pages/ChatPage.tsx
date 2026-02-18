import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom'
import { useStore } from '../store/StoreProvider.jsx'
import { sendMessageToAI } from '../services/ai-service';
import '../css/pages/chat.css';

import WAIFU_VIDEO from '../assets/tokens/WAIFU4.mp4'

const MESSAGE_COST_MIN = 10;
const MESSAGE_COST_MAX = 20;

const getMessageCost = () =>
  Math.floor(Math.random() * (MESSAGE_COST_MAX - MESSAGE_COST_MIN + 1)) + MESSAGE_COST_MIN;

export function ChatPage() {
  const [balance, setBalance] = useState(11200)
  const { id } = useParams()
  const { state } = useStore()
  const token = state.tokens.find(t => String(t.id) === id) || state.tokens[0]

  const [messages, setMessages] = useState([
    // {
    //   id: Date.now(),
    //   content: `Hey! I'm the ${token?.ticker || 'Token'} 💕`,
    //   isUser: false,
    //   isError: false,
    //   time: new Date().toLocaleTimeString()
    // }
  ]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const lastUserMessage = [...messages].reverse().find(m => m.isUser);
  const [visibleUserBubble, setVisibleUserBubble] = useState(null);
  const bubbleTimerRef = useRef(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Автоскролл к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Показываем последнее сообщение юзера на видео на пару секунд
  useEffect(() => {
    if (!lastUserMessage) return;
    setVisibleUserBubble(lastUserMessage);
    if (bubbleTimerRef.current) {
      clearTimeout(bubbleTimerRef.current);
    }
    bubbleTimerRef.current = setTimeout(() => {
      setVisibleUserBubble(null);
    }, 1500);
    return () => {
      if (bubbleTimerRef.current) {
        clearTimeout(bubbleTimerRef.current);
      }
    };
  }, [lastUserMessage?.id]);

  // Фокус на input при загрузке
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const messageCost = getMessageCost();
    if (balance < messageCost) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now(),
          content: `You don't have enough balance to send this message. The cost is ${messageCost} ${token?.ticker || 'Unknown Token'}.`,
          isUser: false,
          isError: true,
          time: new Date().toLocaleTimeString()
        }
      ]);
      setInputText('');
      return;
    }

    // Блокируем интерфейс
    setIsLoading(true);
    setBalance(prev => prev - messageCost);

    // Добавляем сообщение пользователя
    const userMessage = {
      id: Date.now(),
      content: text,
      isUser: true,
      isError: false,
      time: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, userMessage]);

    // Добавляем в историю
    const newHistory = [
      ...conversationHistory,
      { role: "user", content: text }
    ];
    setConversationHistory(newHistory);

    // Очищаем input
    setInputText('');

    // Показываем typing indicator
    setIsTyping(true);

    try {
      // Отправляем запрос к AI
      const response = await sendMessageToAI(text, token, newHistory);
      
      // Убираем typing indicator
      setIsTyping(false);
      
      // Добавляем ответ AI
      const botMessage = {
        id: Date.now() + 1,
        content: response.content,
        isUser: false,
        isError: response.error || false,
        time: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, botMessage]);
      
      // Добавляем ответ в историю (только если не ошибка)
      if (!response.error) {
        setConversationHistory(prev => [
          ...prev,
          { role: "assistant", content: response.content }
        ]);
      }

      // Логируем модель если есть
      if (response.model) {
        console.log(`Response from: ${response.model}`);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      
      // Убираем typing indicator
      setIsTyping(false);
      
      // Показываем ошибку
      const errorMessage = {
        id: Date.now() + 1,
        content: "Oops! Something went wrong. Please try again.",
        isUser: false,
        isError: true,
        time: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      // Разблокируем интерфейс
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSendMessage();
    }
  };

  

  return (
    <div className="chat-page">
      {/* Hero с видео и оверлейным UI */}
      <div className="chat-hero">
        <video
          className="chat-hero-video"
          src={WAIFU_VIDEO}
          autoPlay
          loop
          muted
          playsInline
          poster={token?.image}
        />
        <div className="chat-hero-overlay">
          <div className="chat-header">
            <div className="chat-token-info">
              <div className="chat-token-info-left">
                <img 
                  src={token?.image || 'assets/logo.png'} 
                  alt={token?.ticker || 'Token'} 
                  className="chat-token-image"
                />
                <div className="chat-token-details">
                  <h3>{token?.ticker || 'Unknown Token'}</h3>
                </div>
              </div>
              <div className="chat-token-info-right">
                <div className="chat-token-balance">
                  <span className="chat-token-balance-label">Balance: </span>
                  <span className="chat-token-balance-value">{balance}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="chat-hero-gradient" />
          {visibleUserBubble && (
            <div className="chat-bubble-user">
              <div className="chat-bubble-text">{visibleUserBubble.content}</div>
            </div>
          )}
          <div className="chat-input-overlay">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything..."
              className="message-input overlay"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputText.trim()}
              className="send-button overlay"
            >
              <span style={{ display: isLoading ? 'none' : 'inline' }}>Send</span>
              <span style={{ display: isLoading ? 'inline' : 'none' }}>...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};