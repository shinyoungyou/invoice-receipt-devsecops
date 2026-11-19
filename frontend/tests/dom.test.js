import { expect, test, vi } from 'vitest';
import { el } from '../src/dom.js';

test('user text is inserted as text, never as HTML', () => {
  const name = '<img src=x onerror="alert(1)">';

  const node = el('p', { text: name }, [name]);

  expect(node.querySelector('img')).toBeNull();
  expect(node.textContent).toBe(name + name);
});

test('sets classes, attributes, boolean attributes and listeners', () => {
  const onclick = vi.fn();

  const button = el('button', {
    class: 'btn',
    type: 'button',
    'aria-label': 'Remove item 1',
    disabled: true,
    hidden: false,
    title: null,
    onclick
  });

  expect(button.className).toBe('btn');
  expect(button.getAttribute('type')).toBe('button');
  expect(button.getAttribute('aria-label')).toBe('Remove item 1');
  expect(button.hasAttribute('disabled')).toBe(true);
  expect(button.hasAttribute('hidden')).toBe(false);
  expect(button.hasAttribute('title')).toBe(false);
  expect(button.hasAttribute('onclick')).toBe(false);

  button.disabled = false;
  button.click();
  expect(onclick).toHaveBeenCalledOnce();
});

test('appends element children and skips empty ones', () => {
  const node = el('ul', {}, [el('li', { text: 'a' }), null, undefined, false, 'b']);

  expect(node.children).toHaveLength(1);
  expect(node.textContent).toBe('ab');
});
