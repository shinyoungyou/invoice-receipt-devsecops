import { expect, test, vi } from 'vitest';
import { isStripeCheckoutUrl } from '../src/external.js';

test.each([
  ['https://checkout.stripe.com/c/pay/cs_test_a1B2c3', true],
  ['https://checkout.stripe.com/', true],
  ['http://checkout.stripe.com/c/pay/cs_test_a1B2c3', false],
  ['https://checkout.stripe.com.evil.example/c/pay', false],
  ['https://evil.example/?next=https://checkout.stripe.com', false],
  ['https://user@evil.example', false],
  ['javascript:alert(1)', false],
  ['/invoices/inv_1', false],
  ['', false],
  [undefined, false]
])('%j is a Stripe checkout URL: %s', (url, expected) => {
  expect(isStripeCheckoutUrl(url)).toBe(expected);
});

test('goToStripeCheckout sends the browser to the given URL', async () => {
  const { goToStripeCheckout } = await import('../src/external.js');
  const assign = vi.fn();
  vi.stubGlobal('location', { assign });

  goToStripeCheckout('https://checkout.stripe.com/c/pay/cs_test_a1B2c3');

  expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_a1B2c3');
  vi.unstubAllGlobals();
});

test('saveFile downloads the blob under the given name and releases it afterwards', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  const { saveFile } = await import('../src/external.js');
  const createObjectURL = vi.fn(() => 'blob:receipt');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
  const clicked = [];
  const onClick = event => {
    event.preventDefault();
    clicked.push({ href: event.target.getAttribute('href'), download: event.target.download });
  };
  document.addEventListener('click', onClick);
  const blob = new Blob(['%PDF'], { type: 'application/pdf' });

  saveFile(blob, 'receipt-INV-0001.pdf');

  expect(createObjectURL).toHaveBeenCalledWith(blob);
  expect(clicked).toEqual([{ href: 'blob:receipt', download: 'receipt-INV-0001.pdf' }]);
  expect(document.querySelector('a[download]')).toBeNull();
  expect(revokeObjectURL).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:receipt');

  document.removeEventListener('click', onClick);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
