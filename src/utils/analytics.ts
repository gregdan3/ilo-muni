export function countQuery(
  maxAttempts: number = 4,
  interval: number = 250,
): boolean {
  const path = location.pathname + location.search + location.hash;
  let attempts = 0;
  let counted = false;

  function count() {
    // @ts-expect-error: it will exist
    if (window.goatcounter && window.goatcounter.count) {
      clearInterval(t);
      // @ts-expect-error: it does exist
      window.goatcounter.count({
        path: path,
        title: document.title,
        referrer: document.referrer,
      });
      counted = true;
    } else if (attempts >= maxAttempts) {
      clearInterval(t);
    }
  }

  const t = setInterval(function () {
    attempts++;
    count();
  }, interval);
  return counted;
}
