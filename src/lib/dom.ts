/**
 * Helpers para guards en listeners globales (window keydown/paste).
 * Centralizado para que cualquier hotkey o handler global pueda ignorar
 * inputs de form, textareas y editores ricos (contentEditable).
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
    return true;
  }
  if (target.isContentEditable) return true;
  if (target.closest('[contenteditable="true"], [contenteditable=""]')) return true;
  return false;
}
