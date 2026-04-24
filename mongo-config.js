(() => {
  const protocol = String(window.location && window.location.protocol ? window.location.protocol : "");
  const isHttpProtocol = protocol === "http:" || protocol === "https:";
  const defaultApiBaseUrl = isHttpProtocol
    ? `${window.location.origin}/api`
    : "http://localhost:3000/api";

  window.APP_CONFIG = {
    apiBaseUrl: defaultApiBaseUrl,
  };
})();
