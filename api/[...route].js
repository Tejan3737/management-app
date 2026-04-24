const app = require("../server");

module.exports = (req, res) => {
  const originalUrl = String(req.url || "");

  // In some Vercel serverless invocations for /api/[...route], the "/api"
  // prefix may be stripped before Express receives the request.
  if (!originalUrl.startsWith("/api/") && originalUrl !== "/api") {
    req.url = `/api${originalUrl.startsWith("/") ? originalUrl : `/${originalUrl}`}`;
  }

  return app(req, res);
};
