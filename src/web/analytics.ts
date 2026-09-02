const GOATCOUNTER_ENDPOINT = 'https://dzh.goatcounter.com/count';

/**
 * Loaded from `main.ts`, not the HTML: a static `<script>` tag fires in dev
 * too, counting every local reload. Gating on `PROD` here keeps that decision
 * in code, next to the endpoint, instead of split across a template and a
 * build flag.
 */
export const initAnalytics = (): void => {
  if (!import.meta.env.PROD) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = '//gc.zgo.at/count.js';
  script.dataset['goatcounter'] = GOATCOUNTER_ENDPOINT;
  document.head.appendChild(script);
};
