import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { interceptLinks, matchRoute, navigate } from '../src/router.js';

describe('matchRoute', () => {
  test.each([
    ['/', { name: 'list' }],
    ['/invoices', { name: 'list' }],
    ['/invoices/new', { name: 'new' }],
    ['/invoices/inv_1', { name: 'detail', id: 'inv_1' }],
    ['/invoices/inv_1/', { name: 'detail', id: 'inv_1' }],
    ['/invoices/a%20b', { name: 'detail', id: 'a b' }],
    ['/invoices/%E0%A4%A', { name: 'notFound' }],
    ['/invoices/inv_1/receipt', { name: 'notFound' }],
    ['/admin', { name: 'notFound' }]
  ])('%s → %j', (path, route) => {
    expect(matchRoute(path)).toEqual(route);
  });
});

describe('navigate', () => {
  let onPopState;

  beforeEach(() => {
    history.replaceState(null, '', '/');
    onPopState = vi.fn();
    window.addEventListener('popstate', onPopState);
  });

  afterEach(() => {
    window.removeEventListener('popstate', onPopState);
  });

  test('pushes a history entry and notifies listeners', () => {
    const before = history.length;

    navigate('/invoices/new');

    expect(location.pathname).toBe('/invoices/new');
    expect(history.length).toBe(before + 1);
    expect(onPopState).toHaveBeenCalledOnce();
  });

  test('can replace the current entry instead', () => {
    const before = history.length;

    navigate('/invoices/inv_1', { replace: true });

    expect(location.pathname).toBe('/invoices/inv_1');
    expect(history.length).toBe(before);
    expect(onPopState).toHaveBeenCalledOnce();
  });
});

describe('interceptLinks', () => {
  let root;

  beforeEach(() => {
    history.replaceState(null, '', '/');
    root = document.createElement('div');
    root.innerHTML = '<a data-link href="/invoices/new"><span>New</span></a><a href="https://stripe.com">Out</a>';
    document.body.append(root);
    interceptLinks(root);
  });

  afterEach(() => root.remove());

  const click = (selector, options = {}) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...options });
    root.querySelector(selector).dispatchEvent(event);
    return event;
  };

  test('in-app links navigate without a page load, including clicks on child elements', () => {
    const event = click('span');

    expect(event.defaultPrevented).toBe(true);
    expect(location.pathname).toBe('/invoices/new');
  });

  test.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'])('%s clicks keep the browser default', key => {
    const event = click('a[data-link]', { [key]: true });

    expect(event.defaultPrevented).toBe(false);
    expect(location.pathname).toBe('/');
  });

  test('middle clicks and external links are left alone', () => {
    expect(click('a[data-link]', { button: 1 }).defaultPrevented).toBe(false);
    expect(click('a[href^="https"]').defaultPrevented).toBe(false);
  });
});
