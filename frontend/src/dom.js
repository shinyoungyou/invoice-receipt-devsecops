// Small DOM builder. User-supplied text always goes through text nodes or
// textContent, never innerHTML, so invoice names and descriptions cannot
// inject markup (XSS).

/**
 * el('p', { class: 'text-sm', text: 'Hi' })
 * el('button', { type: 'button', onclick: handler }, ['Add item'])
 *
 * - `class` sets className, `text` sets textContent
 * - `on<event>` keys with function values become event listeners
 * - `false`, `null` and `undefined` attributes are skipped; `true` sets an empty attribute
 * - string children become text nodes
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') {
      node.className = value;
    } else if (key === 'text') {
      node.textContent = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2), value);
    } else {
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}
