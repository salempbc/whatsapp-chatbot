import { createApp } from 'vue';
import App from './App.vue';
import './style.css';
import { sendClientError } from './telemetry.js';

const app = createApp(App);

// Resilient Vue global error handler to prevent blank screen failures
app.config.errorHandler = (err, instance, info) => {
  const errMsg = err?.message || String(err);
  if (errMsg.includes('WebAppMethodUnsupported')) {
    console.warn("ℹ️ Ignored unsupported Telegram client feature:", errMsg);
    return;
  }
  console.error("💥 [VUE ERROR]:", err, info);
  sendClientError(err, `Vue errorHandler (${info})`);
  try {
    if (instance?.showToast) {
      instance.showToast("⚠️ " + (err?.message || "UI Error occurred"));
    }
  } catch (_) {}
};

window.addEventListener("unhandledrejection", (event) => {
  const reasonMsg = event?.reason?.message || String(event?.reason);
  if (reasonMsg.includes('WebAppMethodUnsupported')) {
    console.warn("ℹ️ Ignored unsupported Telegram client feature:", reasonMsg);
    event.preventDefault();
    return;
  }
  console.error("💥 [UNHANDLED REJECTION in WebApp]:", event.reason);
  sendClientError(event.reason, "unhandledrejection");
});

window.addEventListener("error", (event) => {
  const errMsg = event?.error?.message || event?.message || String(event?.error);
  if (errMsg.includes('WebAppMethodUnsupported')) {
    console.warn("ℹ️ Ignored unsupported Telegram client feature:", errMsg);
    return;
  }
  console.error("💥 [GLOBAL ERROR in WebApp]:", event.error);
  sendClientError(event.error || event.message, "global error");
  // Guarantee preloader does not trap user on runtime errors
  const p = document.getElementById('preloader');
  if (p) p.style.display = 'none';
});

try {
  app.mount('#app');
} catch (mountErr) {
  console.error("💥 [VUE MOUNT ERROR]:", mountErr);
  sendClientError(mountErr, "app.mount");
  const p = document.getElementById('preloader');
  if (p) p.style.display = 'none';
}

// Smoothly dismiss preloader once app has mounted
const preloader = document.getElementById('preloader');
if (preloader) {
  preloader.style.opacity = '0';
  setTimeout(() => {
    if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
  }, 250);
}



const reloadBtn = document.getElementById('fallback-reload-btn-action');
if (reloadBtn) reloadBtn.addEventListener('click', () => window.location.reload());
setTimeout(() => {
  const wrap = document.getElementById('fallback-reload-btn');
  if (wrap) wrap.style.display = 'block';
}, 4500);
