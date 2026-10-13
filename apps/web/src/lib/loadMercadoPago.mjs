let sdkPromise;

// Pagamentos não precisam bloquear o login e os demais módulos do CRM.
export function loadMercadoPago() {
  if (window.MercadoPago) return Promise.resolve(window.MercadoPago);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      sdkPromise = undefined;
      reject(new Error('Não foi possível carregar o serviço de pagamento.'));
    };
    const timer = setTimeout(fail, 15000);
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      if (window.MercadoPago) resolve(window.MercadoPago);
      else fail();
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
