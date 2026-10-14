/**
 * Proxies deep-link paths to Cloud Run. Must set Host to run.app — not timexchange.co.za.
 */
const CLOUD_RUN_ORIGIN = 'https://tbserver-1059280513734.africa-south1.run.app';
const CLOUD_RUN_HOST = 'tbserver-1059280513734.africa-south1.run.app';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/.well-known/') || path.startsWith('/request/') || path.startsWith('/invite/') || path === '/app' || path === '/app/') {
      const target = new URL(path + url.search, CLOUD_RUN_ORIGIN);

      return fetch(target.toString(), {
        method: request.method,
        headers: {
          Accept: request.headers.get('Accept') || '*/*',
          Host: CLOUD_RUN_HOST,
        },
        redirect: 'follow',
      });
    }

    return fetch(request);
  },
};
