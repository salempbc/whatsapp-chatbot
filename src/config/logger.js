import { sendAdminMessage } from "../bot/index.js";

const originalError = console.error;
const originalWarn = console.warn;
let isLogging = false;

export const initLogger = () => {
  console.error = (...args) => {
    originalError(...args);
    if (isLogging) return;
    isLogging = true;
    
    try {
      const msg = args.map(a => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === "object") return a.message || String(a);
        return String(a);
      }).join(" ");
      
      if (msg.includes("editMessageText failed")) { isLogging = false; return; }
      if (msg.includes("query is too old")) { isLogging = false; return; }
      if (msg.includes("ETELEGRAM")) { isLogging = false; return; }
      
      const safeMsg = msg.substring(0, 3000).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      sendAdminMessage("?? <b>SERVER ERROR</b>\n<pre>" + safeMsg + "</pre>").catch(() => {});
    } catch (e) {
      originalError("Failed to send error to admin");
    } finally {
      // Small debounce to prevent message flooding
      setTimeout(() => { isLogging = false; }, 1000);
    }
  };

  console.warn = (...args) => {
    originalWarn(...args);
  };
};
