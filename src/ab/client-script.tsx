/**
 * Inyecta un script tiny en el HTML público que expone `window.csm.ab` y
 * hace pickup automático de conversions desde elementos con
 * `data-ab-conversion="testKey"` (click) o `data-ab-submit="testKey"` (form
 * submit).
 *
 * - Tamaño objetivo <1KB minified (sin minify aún).
 * - El script no tiene side-effects observables salvo el fetch al endpoint.
 * - `window.csm.ab.track(testKey, opts?)` retorna una Promise resuelta
 *   independientemente del resultado.
 */

const SCRIPT = `
(function(){
  if (typeof window === 'undefined' || window.csm && window.csm.ab) return;
  var w = window;
  w.csm = w.csm || {};
  function track(testKey, opts){
    if (!testKey || typeof testKey !== 'string') return Promise.resolve();
    var body = { testKey: testKey, kind: 'conversion' };
    if (opts && typeof opts === 'object'){
      if (opts.variantId) body.variantId = String(opts.variantId);
      if (typeof opts.value === 'number') body.value = Math.round(opts.value);
      if (opts.meta && typeof opts.meta === 'object') body.meta = opts.meta;
    }
    try {
      return fetch('/api/ab/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        keepalive: true,
        body: JSON.stringify(body)
      }).catch(function(){});
    } catch(e) { return Promise.resolve(); }
  }
  w.csm.ab = { track: track };
  document.addEventListener('click', function(ev){
    var el = ev.target;
    while (el && el !== document.body){
      if (el.dataset && el.dataset.abConversion){
        var key = el.dataset.abConversion;
        var value = el.dataset.abValue ? Number(el.dataset.abValue) : undefined;
        track(key, value !== undefined ? { value: value } : undefined);
        return;
      }
      el = el.parentElement;
    }
  }, { capture: true, passive: true });
  document.addEventListener('submit', function(ev){
    var el = ev.target;
    if (el && el.dataset && el.dataset.abSubmit){
      track(el.dataset.abSubmit);
    }
  }, { capture: true, passive: true });
})();
`;

export function AbTrackingScript() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: tiny static client script
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
