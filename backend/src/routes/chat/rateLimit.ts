// Simple in-memory rate limiter
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

export function createRateLimiter(config: RateLimitConfig) {
  const { maxRequests, windowMs, message = "Too many requests. Please slow down." } = config;
  
  return async (request: any, reply: any) => {
    const userId = request.session?.user_id;
    if (!userId) return; // Auth middleware will handle this
    
    const key = `${request.routeOptions.url}:${userId}`;
    const now = Date.now();
    
    const entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt < now) {
      // New window
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return;
    }
    
    if (entry.count >= maxRequests) {
      return reply.status(429).send({ 
        message,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      });
    }
    
    entry.count++;
  };
}

// Predefined rate limiters for different endpoint types
export const rateLimiters = {
  messaging: createRateLimiter({
    maxRequests: 30,
    windowMs: 60 * 1000,
    message: "Too many messages. Please slow down."
  }),
  
  blocking: createRateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000,
    message: "Too many block operations. Please slow down."
  }),
  
  conversationCreation: createRateLimiter({
    maxRequests: 5,
    windowMs: 60 * 1000,
    message: "Too many conversation creation attempts. Please slow down."
  }),
  
  reading: createRateLimiter({
    maxRequests: 60,
    windowMs: 60 * 1000,
    message: "Too many requests. Please slow down."
  }),
  
  streaming: createRateLimiter({
    maxRequests: 3,
    windowMs: 60 * 1000,
    message: "Too many connection attempts. Please wait before reconnecting."
  }),
  
  inviteUpdate: createRateLimiter({
    maxRequests: 20,
    windowMs: 60 * 1000,
    message: "Too many invite updates. Please slow down."
  })
};