import { sendAdminMessage } from "../bot/index.js";

const originalError = console.error;
const originalWarn = console.warn;

export const initLogger = () => {
  console.error = (...args) => {
    originalError(...args);
    
    try {
      const msg = args.map(a => typeof a === "object" ? (a && (a.stack || JSON.stringify(a) || String(a))) : String(a)).join(" ");
      if (msg.includes("editMessageText failed")) return;
      if (msg.includes("query is too old")) return;
      
      const safeMsg = msg.substring(0, 3000).replace(/</g, "&lt;").replace(/>/g, "&gt;");
      sendAdminMessage("?? <b>SERVER ERROR</b>\n<pre>" + safeMsg + "</pre>");
    } catch (e) {
      originalError("Failed to send error to admin");
    }
  };

  console.warn = (...args) => {
    originalWarn(...args);
    
    try {
      const msg = args.map(a => typeof a === "object" ? (a && (a.stack || JSON.stringify(a) || String(a))) : String(a)).join(" ");
      const safeMsg = msg.substring(0, 3000).replace(/</g, "&lt;").replace(/>/g, "&gt;");
      sendAdminMessage("?? <b>WARNING</b>\n<pre>" + safeMsg + "</pre>");
    } catch (e) {
      originalError("Failed to send warning to admin");
    }
  };
};
