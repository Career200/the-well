const GOATCOUNTER_ENDPOINT = 'https://dzh.goatcounter.com/count';

/** Injected from JS rather than the HTML so `PROD` can gate it. */
export const initAnalytics = (): void => {
  if (!import.meta.env.PROD) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = '//gc.zgo.at/count.js';
  script.dataset['goatcounter'] = GOATCOUNTER_ENDPOINT;
  document.head.appendChild(script);
};
