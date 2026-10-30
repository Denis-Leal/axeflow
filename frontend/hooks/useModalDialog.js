import { useEffect, useRef } from 'react';

const stack = [];
const blocked = new Set();
let originalOverflow;
const focusable = 'a[href], button, input, select, textarea, [tabindex]';

function blockBackground() {
  blocked.forEach(el => { el.inert = false; });
  blocked.clear();
  const root = stack[stack.length - 1];
  if (!root) return;
  for (let node = root; node.parentElement; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling !== node && !sibling.inert) {
        sibling.inert = true;
        blocked.add(sibling);
      }
    }
    if (node.parentElement === document.body) break;
  }
}

// Shared interaction only: each modal retains its own form, layout and actions.
export function useModalDialog({ open = true, onClose, busy = false, label }) {
  const ref = useRef(null);
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };

  useEffect(() => {
    const root = ref.current;
    if (!open || !root) return;
    const previousFocus = document.activeElement;
    if (!stack.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    stack.push(root);
    blockBackground();
    const controls = () => [...root.querySelectorAll(focusable)].filter(el =>
      !el.disabled && el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length);
    (controls()[0] || root).focus();
    const topmost = () => stack[stack.length - 1] === root;
    const onKey = e => {
      if (!topmost()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!latest.current.busy) latest.current.onClose?.();
      }
      if (e.key === 'Tab') {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (!items.length) { e.preventDefault(); root.focus(); }
        else if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
          e.preventDefault(); first.focus();
        }
      }
    };
    const onFocus = e => {
      if (topmost() && !root.contains(e.target)) (controls()[0] || root).focus();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus);
      const index = stack.indexOf(root);
      if (index >= 0) stack.splice(index, 1);
      blockBackground();
      if (!stack.length) document.body.style.overflow = originalOverflow;
      if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus();
    };
  }, [open]);

  return { ref, role: 'dialog', 'aria-modal': true, 'aria-label': label, 'aria-busy': busy || undefined, tabIndex: -1, 'data-modal-dialog': true };
}
