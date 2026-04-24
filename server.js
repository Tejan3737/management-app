const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config();

const {
  MONGODB_URI,
  MONGODB_DB_NAME = "user",
  PORT = "3000",
} = process.env;

let client = null;
let dbPromise = null;
let indexPromise = null;

function getClient() {
  if (!MONGODB_URI) {
    const error = new Error("Missing MONGODB_URI. Set it in environment variables.");
    error.code = "MONGODB_URI_MISSING";
    throw error;
  }

  if (!client) {
    client = new MongoClient(MONGODB_URI);
  }

  return client;
}

function toStringSafe(value) {
  return String(value || "").trim();
}

function normalizeUsername(value) {
  return toStringSafe(value).toLowerCase();
}

function normalizeTheme(value) {
  return value === "dark" ? "dark" : "light";
}

function sanitizeDocument(document) {
  if (!document || typeof document !== "object") {
    return null;
  }

  const sanitized = { ...document };
  delete sanitized._id;
  return sanitized;
}

function sanitizeDocuments(documents) {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents
    .map((document) => sanitizeDocument(document))
    .filter((document) => document !== null);
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function isDatabaseUnavailableError(error) {
  if (!error) {
    return false;
  }

  const knownCodes = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"]);
  if (knownCodes.has(error.code)) {
    return true;
  }

  const name = String(error.name || "");
  if (name === "MongoServerSelectionError" || name === "MongoNetworkError") {
    return true;
  }

  const message = String(error.message || "").toLowerCase();
  if (message.includes("querysrv") || message.includes("server selection") || message.includes("failed to connect")) {
    return true;
  }

  const cause = error.cause;
  if (cause && typeof cause === "object") {
    return isDatabaseUnavailableError(cause);
  }

  return false;
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = getClient()
      .connect()
      .then(() => client.db(MONGODB_DB_NAME))
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }

  return dbPromise;
}

async function getCollections() {
  const db = await getDb();
  return {
    users: db.collection("users"),
    products: db.collection("products"),
    bills: db.collection("bills"),
    settings: db.collection("settings"),
  };
}

async function ensureIndexes() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const { users, products, bills, settings } = await getCollections();

      await Promise.all([
        users.createIndex({ id: 1 }, { unique: true }),
        users.createIndex({ username: 1 }, { unique: true }),
        products.createIndex({ ownerId: 1 }),
        products.createIndex({ ownerId: 1, id: 1 }, { unique: true }),
        bills.createIndex({ ownerId: 1 }),
        bills.createIndex({ ownerId: 1, id: 1 }, { unique: true }),
        settings.createIndex({ ownerId: 1, key: 1 }, { unique: true }),
      ]);
    })().catch((error) => {
      indexPromise = null;
      throw error;
    });
  }

  return indexPromise;
}

function normalizeProducts(ownerId, products) {
  if (!Array.isArray(products)) {
    return [];
  }

  return products
    .filter((record) => record && typeof record === "object")
    .map((record) => ({
      ...record,
      id: toStringSafe(record.id),
      ownerId,
    }))
    .filter((record) => record.id);
}

function normalizeBills(ownerId, bills) {
  if (!Array.isArray(bills)) {
    return [];
  }

  return bills
    .filter((record) => record && typeof record === "object")
    .map((record) => {
      const normalizedItems = Array.isArray(record.items)
        ? record.items
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
              productId: toStringSafe(item.productId),
              name: toStringSafe(item.name),
              price: Number(item.price) || 0,
              quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
            }))
            .filter((item) => item.productId)
        : [];

      return {
        ...record,
        id: toStringSafe(record.id),
        ownerId,
        items: normalizedItems,
        total: Number(record.total) || 0,
      };
    })
    .filter((record) => record.id);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    try {
      await getDb();
      res.json({ status: "ok", database: MONGODB_DB_NAME });
    } catch (_error) {
      res.status(503).json({ status: "degraded", database: MONGODB_DB_NAME, error: "Database unavailable." });
    }
  })
);

app.get(
  "/api/users/by-username/:username",
  asyncHandler(async (req, res) => {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      return res.status(400).json({ error: "username is required." });
    }

    const { users } = await getCollections();
    const user = await users.findOne({ username });
    res.json({ user: sanitizeDocument(user) });
  })
);

app.get(
  "/api/users/:id",
  asyncHandler(async (req, res) => {
    const id = toStringSafe(req.params.id);
    if (!id) {
      return res.status(400).json({ error: "id is required." });
    }

    const { users } = await getCollections();
    const user = await users.findOne({ id });
    res.json({ user: sanitizeDocument(user) });
  })
);

app.post(
  "/api/users",
  asyncHandler(async (req, res) => {
    const payload = req.body && req.body.user ? req.body.user : {};

    const user = {
      id: toStringSafe(payload.id),
      username: normalizeUsername(payload.username),
      displayName: toStringSafe(payload.displayName),
      passwordHash: toStringSafe(payload.passwordHash),
      createdAt: toStringSafe(payload.createdAt) || new Date().toISOString(),
    };

    if (!user.id || !user.username || !user.displayName || !user.passwordHash) {
      return res.status(400).json({ error: "id, username, displayName, and passwordHash are required." });
    }

    const { users } = await getCollections();

    try {
      await users.insertOne(user);
      return res.status(201).json({ user });
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(409).json({ error: "User already exists." });
      }

      throw error;
    }
  })
);

app.get(
  "/api/products",
  asyncHandler(async (req, res) => {
    const ownerId = toStringSafe(req.query.ownerId);
    if (!ownerId) {
      return res.status(400).json({ error: "ownerId is required." });
    }

    const { products } = await getCollections();
    const documents = await products.find({ ownerId }).toArray();
    res.json({ products: sanitizeDocuments(documents) });
  })
);

app.put(
  "/api/products/:ownerId",
  asyncHandler(async (req, res) => {
    const ownerId = toStringSafe(req.params.ownerId);
    if (!ownerId) {
      return res.status(400).json({ error: "ownerId is required." });
    }

    const normalizedProducts = normalizeProducts(ownerId, req.body ? req.body.products : []);
    const { products } = await getCollections();

    await products.deleteMany({ ownerId });
    if (normalizedProducts.length) {
      await products.insertMany(normalizedProducts);
    }

    res.status(204).end();
  })
);

app.get(
  "/api/bills",
  asyncHandler(async (req, res) => {
    const ownerId = toStringSafe(req.query.ownerId);
    if (!ownerId) {
      return res.status(400).json({ error: "ownerId is required." });
    }

    const { bills } = await getCollections();
    const documents = await bills.find({ ownerId }).toArray();
    res.json({ bills: sanitizeDocuments(documents) });
  })
);

app.put(
  "/api/bills/:ownerId",
  asyncHandler(async (req, res) => {
    const ownerId = toStringSafe(req.params.ownerId);
    if (!ownerId) {
      return res.status(400).json({ error: "ownerId is required." });
    }

    const normalizedBills = normalizeBills(ownerId, req.body ? req.body.bills : []);
    const { bills } = await getCollections();

    await bills.deleteMany({ ownerId });
    if (normalizedBills.length) {
      await bills.insertMany(normalizedBills);
    }

    res.status(204).end();
  })
);

app.get(
  "/api/settings/theme",
  asyncHandler(async (req, res) => {
    const ownerId = toStringSafe(req.query.ownerId);
    if (!ownerId) {
      return res.status(400).json({ error: "ownerId is required." });
    }

    const { settings } = await getCollections();
    const document = await settings.findOne({ ownerId, key: "theme" });
    const theme = document ? normalizeTheme(document.value) : null;
    res.json({ theme });
  })
);

app.put(
  "/api/settings/theme",
  asyncHandler(async (req, res) => {
    const ownerId = toStringSafe(req.body ? req.body.ownerId : "");
    const theme = normalizeTheme(req.body ? req.body.theme : "light");

    if (!ownerId) {
      return res.status(400).json({ error: "ownerId is required." });
    }

    const { settings } = await getCollections();
    await settings.updateOne(
      { ownerId, key: "theme" },
      {
        $set: {
          ownerId,
          key: "theme",
          value: theme,
        },
      },
      { upsert: true }
    );

    res.status(204).end();
  })
);

app.get(
  "/api/settings/monthly-expense",
  asyncHandler(async (req, res) => {
    const ownerId = toStringSafe(req.query.ownerId);
    if (!ownerId) {
      return res.status(400).json({ error: "ownerId is required." });
    }

    const { settings } = await getCollections();
    const document = await settings.findOne({ ownerId, key: "monthlyExpense" });
    const amount = Math.max(0, Number(document && document.value) || 0);
    res.json({ amount });
  })
);

app.put(
  "/api/settings/monthly-expense",
  asyncHandler(async (req, res) => {
    const ownerId = toStringSafe(req.body ? req.body.ownerId : "");
    const amount = Number(req.body ? req.body.amount : 0);

    if (!ownerId) {
      return res.status(400).json({ error: "ownerId is required." });
    }

    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "amount must be a non-negative number." });
    }

    const { settings } = await getCollections();
    await settings.updateOne(
      { ownerId, key: "monthlyExpense" },
      {
        $set: {
          ownerId,
          key: "monthlyExpense",
          value: amount,
        },
      },
      { upsert: true }
    );

    res.status(204).end();
  })
);

app.use(express.static(path.join(__dirname)));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);

  if (res.headersSent) {
    return;
  }

  if (error && error.code === "MONGODB_URI_MISSING") {
    return res.status(503).json({
      error: "Database is not configured. Set MONGODB_URI in environment variables.",
    });
  }

  if (isDatabaseUnavailableError(error)) {
    return res.status(503).json({
      error: "Database unavailable. Check Atlas network access, credentials, and DNS, then retry.",
    });
  }

  res.status(500).json({ error: "Internal server error." });
});

function start() {
  app.listen(Number(PORT), () => {
    console.log(`Server running at http://localhost:${PORT}`);

    void ensureIndexes()
      .then(() => {
        console.log("MongoDB indexes are ready.");
      })
      .catch((error) => {
        console.warn(`MongoDB index setup deferred: ${error.message}`);
      });
  });
}

  if (require.main === module) {
    start();

    process.on("SIGINT", async () => {
      try {
        if (client) {
          await client.close();
        }
      } finally {
        process.exit(0);
      }
    });
  }

  module.exports = app;
