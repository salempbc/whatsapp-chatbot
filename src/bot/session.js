const store = new Map();  // chatId → { state, expiresAt }
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export const getState = (chatId) => {
  const entry = store.get(chatId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(chatId);
    return null;
  }
  return entry.state;
};

export const setState = (chatId, state) =>
  store.set(chatId, { state, expiresAt: Date.now() + TTL_MS });

export const clearState = (chatId) => store.delete(chatId);
