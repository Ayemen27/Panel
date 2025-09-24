// toast.ts
type ToastOptions = {
  title?: string;
  message: string;
  duration?: number; // ms, default 4000
};

const TOAST_ID = 'global-toast-overlay';

function ensureStyles() {
  if (document.getElementById(`${TOAST_ID}-styles`)) return;
  const style = document.createElement('style');
  style.id = `${TOAST_ID}-styles`;
  style.textContent = `
#${TOAST_ID} {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%) translateY(-10px);
  z-index: 999999;
  pointer-events: none; /* allows clicks through except children that enable pointer-events */
  transition: transform 240ms ease, opacity 240ms ease;
  opacity: 0;
  will-change: transform, opacity;
  display: flex;
  gap: 8px;
  width: min(680px, calc(100% - 32px));
  max-width: 680px;
  box-sizing: border-box;
  direction: rtl; /* for Arabic */
}
#${TOAST_ID}.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}
.${TOAST_ID}-card {
  pointer-events: auto;
  background: #111827; /* near-black */
  color: white;
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.25);
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  overflow: hidden;
  touch-action: pan-y;
  font-family: 'Cairo', -apple-system, BlinkMacSystemFont, sans-serif;
}
.${TOAST_ID}-card.error {
  background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
}
.${TOAST_ID}-card.success {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}
.${TOAST_ID}-card.warning {
  background: linear-gradient(135deg, #d97706 0%, #92400e 100%);
}
.${TOAST_ID}-content {
  flex: 1;
}
.${TOAST_ID}-title {
  font-weight: 600;
  margin: 0 0 4px 0;
  font-size: 14px;
}
.${TOAST_ID}-message {
  margin: 0;
  font-size: 13px;
  opacity: 0.92;
  line-height: 1.4;
}
.${TOAST_ID}-close {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.9);
  font-size: 18px;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  margin-right: 4px;
}
.${TOAST_ID}-close:hover {
  background: rgba(255,255,255,0.1);
}
.${TOAST_ID}-close:active { transform: scale(0.98); }
.${TOAST_ID}-swipe {
  transition: transform 180ms ease, opacity 180ms ease;
  will-change: transform, opacity;
}
@media (prefers-reduced-motion: reduce) {
  #${TOAST_ID}, .${TOAST_ID}-swipe { transition: none; }
}
@media (max-width: 640px) {
  #${TOAST_ID} {
    top: 8px;
    width: calc(100% - 16px);
  }
  .${TOAST_ID}-card {
    padding: 16px 12px;
  }
  .${TOAST_ID}-title {
    font-size: 15px;
  }
  .${TOAST_ID}-message {
    font-size: 14px;
  }
}
`;
  document.head.appendChild(style);
}

function createContainer() {
  let container = document.getElementById(TOAST_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_ID;
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('role', 'status');
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(opts: ToastOptions & { variant?: 'default' | 'error' | 'success' | 'warning' }) {
  ensureStyles();
  const { title, message, duration = 4000, variant = 'default' } = opts;
  const container = createContainer();

  // create card
  const cardWrap = document.createElement('div');
  cardWrap.className = `${TOAST_ID}-swipe`;
  const card = document.createElement('div');
  card.className = `${TOAST_ID}-card`;
  if (variant !== 'default') {
    card.classList.add(variant);
  }
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', title ?? 'إشعار');

  const content = document.createElement('div');
  content.className = `${TOAST_ID}-content`;
  if (title) {
    const h = document.createElement('p');
    h.className = `${TOAST_ID}-title`;
    h.textContent = title;
    content.appendChild(h);
  }
  const p = document.createElement('p');
  p.className = `${TOAST_ID}-message`;
  p.textContent = message;
  content.appendChild(p);

  const closeBtn = document.createElement('button');
  closeBtn.className = `${TOAST_ID}-close`;
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'إغلاق الإشعار');

  card.appendChild(content);
  card.appendChild(closeBtn);
  cardWrap.appendChild(card);
  container.appendChild(cardWrap);

  // show with animation
  // allow layout to apply then add show class on container
  requestAnimationFrame(() => {
    container.classList.add('show');
  });

  // auto-dismiss timer
  let hideTimeout = window.setTimeout(() => dismiss(), duration);

  function cleanup() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      // @ts-ignore
      hideTimeout = null;
    }
    // animate out then remove
    container.classList.remove('show');
    // small delay to allow exit animation
    setTimeout(() => {
      try {
        cardWrap.remove();
        if (container && container.children.length === 0) {
          container.remove();
        }
      } catch (e) {}
    }, 220);
    // remove listeners
    closeBtn.removeEventListener('click', onClose);
    card.removeEventListener('keydown', onKeyDown);
    card.removeEventListener('touchstart', onTouchStart);
    card.removeEventListener('touchmove', onTouchMove);
    card.removeEventListener('touchend', onTouchEnd);
  }

  function dismiss() {
    cleanup();
  }

  function onClose(e: Event) {
    e.stopPropagation();
    dismiss();
  }

  closeBtn.addEventListener('click', onClose);

  // keyboard: Escape closes
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') dismiss();
  }
  card.addEventListener('keydown', onKeyDown);
  // make focusable for keyboard users
  card.setAttribute('tabindex', '0');

  // swipe to dismiss (vertical or horizontal)
  let startY = 0;
  let startX = 0;
  let currentTranslate = 0;
  const threshold = 60; // px to trigger dismiss

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    currentTranslate = 0;
    // pause auto-hide while interacting
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      // @ts-ignore
      hideTimeout = null;
    }
  }
  function onTouchMove(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    // prefer vertical swipe up to dismiss OR horizontal swipe left/right
    // apply translation for feedback
    currentTranslate = dy;
    const translate = `translateY(${currentTranslate}px)`;
    (cardWrap as HTMLElement).style.transform = translate;
    // fade out a bit
    const op = Math.max(0, 1 - Math.abs(currentTranslate) / 200);
    (cardWrap as HTMLElement).style.opacity = String(op);
    e.preventDefault();
  }
  function onTouchEnd(e: TouchEvent) {
    // if moved enough, dismiss
    if (Math.abs(currentTranslate) > threshold) {
      // animate out further
      const direction = currentTranslate < 0 ? -1 : 1;
      (cardWrap as HTMLElement).style.transition = 'transform 180ms ease, opacity 180ms ease';
      (cardWrap as HTMLElement).style.transform = `translateY(${direction * 120}px)`;
      (cardWrap as HTMLElement).style.opacity = '0';
      // small delay then cleanup
      setTimeout(dismiss, 160);
      return;
    }
    // else reset position, resume timer
    (cardWrap as HTMLElement).style.transition = 'transform 180ms ease, opacity 180ms ease';
    (cardWrap as HTMLElement).style.transform = '';
    (cardWrap as HTMLElement).style.opacity = '';
    // resume timer
    // @ts-ignore
    hideTimeout = window.setTimeout(() => dismiss(), duration);
    // remove the specific transition after it finishes
    setTimeout(() => {
      (cardWrap as HTMLElement).style.transition = '';
    }, 200);
  }

  card.addEventListener('touchstart', onTouchStart, { passive: true });
  card.addEventListener('touchmove', onTouchMove, { passive: false });
  card.addEventListener('touchend', onTouchEnd);

  // return a handle to programmatically dismiss if needed
  return {
    dismiss,
  };
}

export default showToast;