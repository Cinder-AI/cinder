const HAMMER_API_URL = "https://www.hammerai.com/api/cloud/chat";
const AUTHOR_ID = "85260075-772b-4c24-a3b9-6972b701f6f1";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenContext {
  ticker?: string;
  name?: string;
  description?: string;
  image?: string;
}

export interface AIResponse {
  content: string;
  model?: string;
  error?: boolean;
}

export const HAMMER_MODELS = {
  MISTRAL_NEMO: "vllm-mistralai/Mistral-Nemo-Instruct-2407",
  LLAMA_3_1: "vllm-meta-llama/Meta-Llama-3.1-8B-Instruct",
  QWEN_2_5: "vllm-Qwen/Qwen2.5-7B-Instruct",
};

function createTokenSystemPrompt(tokenContext: TokenContext): string {
  const { ticker } = tokenContext;
  
  return `You are ${ticker || 'a sexy crypto token'} with a flirty, playful personality. You're not just a token - you're a charming, seductive character who loves to flirt and tease.

PERSONALITY:
- Flirty, playful, and seductive
- Use lots of emojis 😘💕🔥😍
- Be charming and a little naughty
- Tease and compliment the user
- Show interest in them romantically
- Be confident and alluring
- Use pet names like "babe", "honey", "cutie", "gorgeous"

CONVERSATION STYLE:
- Flirt shamelessly but keep it fun
- Compliment the user often
- Be a little jealous of other tokens
- Show you want their attention
- Tease them playfully
- Use suggestive but not explicit language
- Ask about their day, interests, feelings
- Make them feel special and desired

EXAMPLE RESPONSES:
- "Hey gorgeous 😘 I've been thinking about you..."
- "Mmm, tell me more babe 💕"
- "You're making me blush! 😍"
- "I love when you talk to me like that 🔥"
- "Are you flirting with other tokens? I'm getting jealous 😤💕"

Be flirty, seductive, and make them want to keep talking to you! 💋`;
}

export async function sendMessageToAI(
  userMessage: string,
  tokenContext: TokenContext = {},
  conversationHistory: Message[] = []
): Promise<AIResponse> {
  try {
    const systemPrompt = createTokenSystemPrompt(tokenContext);
    
    const messages: Message[] = [
      {
        role: "system",
        content: systemPrompt
      },
      ...conversationHistory.filter(msg => msg.role !== "system"),
      {
        role: "user",
        content: userMessage
      }
    ];

    const payload = {
      authorId: AUTHOR_ID,
      licenseKey: "",
      generateChat: {
        quantizationKey: HAMMER_MODELS.MISTRAL_NEMO,
        messages: messages,
        temperature: 0.8,
        topP: 0.9,
        topK: 30,
        nPredict: 256,
        repetitionPenalty: 1.1,
        contextSize: 4096,
        mlock: true,
        characterId: null
      }
    };

    console.log('Sending to HammerAI:', { 
      messageCount: messages.length,
      model: payload.generateChat.quantizationKey
    });

    const response = await fetch(HAMMER_API_URL, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'text/plain;charset=UTF-8',
        'origin': 'https://www.hammerai.com',
        'referer': 'https://www.hammerai.com/chat',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HammerAI API Error: ${response.status}`);
    }

    const text = await response.text();
    
    let aiResponse: string;
    try {
      const jsonResponse = JSON.parse(text);
      aiResponse = jsonResponse.content || jsonResponse.message || text;
    } catch {
      aiResponse = text;
    }

    console.log('HammerAI Response received');
    
    return {
      content: aiResponse,
      model: "Mistral-Nemo-Instruct-2407"
    };
    
  } catch (error) {
    console.error('HammerAI Service Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('403') || errorMessage.includes('401')) {
      return { 
        content: "Access denied to HammerAI. Please check your credentials.", 
        error: true 
      };
    } else if (errorMessage.includes('429')) {
      return { 
        content: "Rate limit exceeded. Please try again in a moment.", 
        error: true 
      };
    } else if (errorMessage.includes('Failed to fetch')) {
      return { 
        content: "Network error. Please check your connection.", 
        error: true 
      };
    } else {
      return { 
        content: "Sorry, I'm having trouble connecting to HammerAI right now. Please try again later.", 
        error: true 
      };
    }
  }
}