/**
 * 📳 Mobile Haptic Feedback & Gesture Enhancements for Telegram Mini App
 */

export const triggerHaptic = (type = "light") => {
  const tg = window.Telegram?.WebApp;
  if (!tg || !tg.HapticFeedback) return;

  try {
    if (type === "success" || type === "error" || type === "warning") {
      tg.HapticFeedback.notificationOccurred(type);
    } else if (type === "selection") {
      tg.HapticFeedback.selectionChanged();
    } else {
      tg.HapticFeedback.impactOccurred(type); // 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
    }
  } catch (_) {}
};

/**
 * Initializes Pull-to-Refresh on the document for mobile browsers / TMA
 */
export const initPullToRefresh = (onRefresh) => {
  let startY = 0;
  let isPulling = false;

  window.addEventListener(
    "touchstart",
    (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].pageY;
        isPulling = true;
      } else {
        isPulling = false;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (!isPulling || window.scrollY > 0) return;
      const currentY = e.touches[0].pageY;
      const diffY = currentY - startY;

      if (diffY > 90) {
        isPulling = false;
        triggerHaptic("medium");
        if (typeof onRefresh === "function") {
          onRefresh();
        }
      }
    },
    { passive: true }
  );
};
