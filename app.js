(() => {
  "use strict";

  const LOW_STOCK_THRESHOLD = 5;
  const SESSION_STORAGE_KEY = "ssbs_session_user";

  const DATABASE_CONFIG = {
    collections: {
      users: "users",
      products: "products",
      bills: "bills",
      settings: "settings",
    },
    settingKeys: {
      theme: "theme",
    },
  };
  const sectionsMeta = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Track your shop performance, inventory health, and billing in one workspace.",
    },
    inventory: {
      title: "Inventory",
      subtitle: "Add, update, and monitor stock levels with quick search and low-stock alerts.",
    },
    billing: {
      title: "Billing",
      subtitle: "Build invoices quickly, preview them, and checkout while auto-updating stock.",
    },
    finance: {
      title: "Finance",
      subtitle: "Review monthly sales, profit trends, and net profit for the current month.",
    },
    history: {
      title: "History",
      subtitle: "Browse all saved bills with calendar filters and page through older records.",
    },
  };

  const state = {
    products: [],
    bills: [],
    currentBillItems: [],
    searchTerm: "",
    activeSection: "dashboard",
    historyMonthFilter: "all",
    historyYearFilter: "all",
    historyPage: 1,
    historyPageSize: 10,
    toastTimerId: null,
    databaseStatus: "fallback",
    currentUser: null,
    authMode: "login",
    monthlyExpense: 0,
    activeBillDetailsId: null,
  };

  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const elements = {
    appShell: document.getElementById("appShell"),
    authScreen: document.getElementById("authScreen"),
    authMessage: document.getElementById("authMessage"),
    showLoginBtn: document.getElementById("showLoginBtn"),
    showRegisterBtn: document.getElementById("showRegisterBtn"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    loginUsername: document.getElementById("loginUsername"),
    loginPassword: document.getElementById("loginPassword"),
    registerName: document.getElementById("registerName"),
    registerUsername: document.getElementById("registerUsername"),
    registerPassword: document.getElementById("registerPassword"),
    registerConfirmPassword: document.getElementById("registerConfirmPassword"),

    navLinks: document.querySelectorAll(".nav-link"),
    sections: document.querySelectorAll(".content-section"),
    sectionTitle: document.getElementById("sectionTitle"),
    sectionSubtitle: document.getElementById("sectionSubtitle"),
    currentDate: document.getElementById("currentDate"),
    dbStatusBadge: document.getElementById("dbStatusBadge"),
    currentUserBadge: document.getElementById("currentUserBadge"),
    logoutBtn: document.getElementById("logoutBtn"),

    themeToggle: document.getElementById("themeToggle"),

    statTotalProducts: document.getElementById("statTotalProducts"),
    statTotalSales: document.getElementById("statTotalSales"),
    statBillsCount: document.getElementById("statBillsCount"),
    statLowStockCount: document.getElementById("statLowStockCount"),
    dashMonthlyProfit: document.getElementById("dashMonthlyProfit"),
    dashNetProfitCurrentMonth: document.getElementById("dashNetProfitCurrentMonth"),
    dashboardSalesChart: document.getElementById("dashboardSalesChart"),
    recentBillsTableBody: document.getElementById("recentBillsTableBody"),

    financeCurrentMonthSales: document.getElementById("financeCurrentMonthSales"),
    financeMonthlyProfit: document.getElementById("financeMonthlyProfit"),
    financeNetProfitCurrentMonth: document.getElementById("financeNetProfitCurrentMonth"),
    financeSalesChart: document.getElementById("financeSalesChart"),
    financeMonthlyTableBody: document.getElementById("financeMonthlyTableBody"),
    payLaterTableBody: document.getElementById("payLaterTableBody"),
    financeExpenseForm: document.getElementById("financeExpenseForm"),
    financeExpenseInput: document.getElementById("financeExpenseInput"),
    saveFinanceExpenseBtn: document.getElementById("saveFinanceExpenseBtn"),

    history: document.getElementById("history"),
    historyMonthFilter: document.getElementById("historyMonthFilter"),
    historyYearFilter: document.getElementById("historyYearFilter"),
    historyPrevPageBtn: document.getElementById("historyPrevPageBtn"),
    historyNextPageBtn: document.getElementById("historyNextPageBtn"),
    historyPageInfo: document.getElementById("historyPageInfo"),
    historyTableBody: document.getElementById("historyTableBody"),
    historyTotalBills: document.getElementById("historyTotalBills"),
    historyPayLaterBills: document.getElementById("historyPayLaterBills"),
    historyPayLaterDue: document.getElementById("historyPayLaterDue"),

    productForm: document.getElementById("productForm"),
    productCostPrice: document.getElementById("productCostPrice"),
    inventorySearch: document.getElementById("inventorySearch"),
    inventoryTableBody: document.getElementById("inventoryTableBody"),

    billItemForm: document.getElementById("billItemForm"),
    billingNameInput: document.getElementById("billingNameInput"),
    billingPaymentType: document.getElementById("billingPaymentType"),
    billingProductSelect: document.getElementById("billingProductSelect"),
    billingQuantity: document.getElementById("billingQuantity"),
    billItemsTableBody: document.getElementById("billItemsTableBody"),
    currentBillTotal: document.getElementById("currentBillTotal"),
    openInvoiceBtn: document.getElementById("openInvoiceBtn"),
    clearBillBtn: document.getElementById("clearBillBtn"),
    invoicePreview: document.getElementById("invoicePreview"),

    editModal: document.getElementById("editModal"),
    editProductForm: document.getElementById("editProductForm"),
    editProductId: document.getElementById("editProductId"),
    editProductName: document.getElementById("editProductName"),
    editProductPrice: document.getElementById("editProductPrice"),
    editProductCostPrice: document.getElementById("editProductCostPrice"),
    editProductQuantity: document.getElementById("editProductQuantity"),
    closeEditModalBtn: document.getElementById("closeEditModalBtn"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),

    invoiceModal: document.getElementById("invoiceModal"),
    invoiceModalBody: document.getElementById("invoiceModalBody"),
    closeInvoiceModalBtn: document.getElementById("closeInvoiceModalBtn"),
    cancelInvoiceBtn: document.getElementById("cancelInvoiceBtn"),
    finalizeCheckoutBtn: document.getElementById("finalizeCheckoutBtn"),

    billDetailsModal: document.getElementById("billDetailsModal"),
    billDetailsModalBody: document.getElementById("billDetailsModalBody"),
    closeBillDetailsModalBtn: document.getElementById("closeBillDetailsModalBtn"),
    markBillPaidBtn: document.getElementById("markBillPaidBtn"),
    dismissBillDetailsBtn: document.getElementById("dismissBillDetailsBtn"),

    toast: document.getElementById("appToast"),
  };
  // Backend API handling
  const database = {
    isSupported: typeof window !== "undefined" && typeof window.fetch === "function",

    setStatus(status) {
      if (state.databaseStatus === status) {
        return;
      }

      state.databaseStatus = status;
      renderDatabaseStatusBadge();
    },

    getConfig() {
      if (!database.isSupported) {
        database.setStatus("fallback");
        throw new Error("Fetch API is not supported in this browser.");
      }

      const config = window.APP_CONFIG || {};
      const baseUrl = String(config.apiBaseUrl || "http://localhost:3000/api")
        .trim()
        .replace(/\/+$/, "");

      if (!baseUrl) {
        database.setStatus("fallback");
        throw new Error("Backend API is not configured. Update mongo-config.js.");
      }

      return {
        baseUrl,
      };
    },

    async request(path, options = {}) {
      try {
        const config = database.getConfig();
        const requestOptions = {
          method: options.method || "GET",
          headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
          },
        };

        if (typeof options.body !== "undefined") {
          requestOptions.body = JSON.stringify(options.body);
        }

        const response = await fetch(`${config.baseUrl}${path}`, requestOptions);

        let responseData = {};
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          try {
            responseData = await response.json();
          } catch (_jsonError) {
            responseData = {};
          }
        }

        if (!response.ok) {
          const message = responseData.error || responseData.message || `Request failed (${response.status})`;
          throw new Error(message);
        }

        database.setStatus("connected");
        return responseData;
      } catch (error) {
        database.setStatus("fallback");
        throw error;
      }
    },

    normalizeDocument(document) {
      const normalized = { ...(document || {}) };
      if ((!normalized.id || typeof normalized.id !== "string") && normalized._id) {
        if (typeof normalized._id === "string") {
          normalized.id = normalized._id;
        } else if (typeof normalized._id.$oid === "string") {
          normalized.id = normalized._id.$oid;
        }
      }

      delete normalized._id;
      return normalized;
    },

    async findUserByUsername(username) {
      const normalizedUsername = encodeURIComponent(String(username || "").trim().toLowerCase());
      const response = await database.request(`/users/by-username/${normalizedUsername}`);
      return response.user ? database.normalizeDocument(response.user) : null;
    },

    async findUserById(userId) {
      const response = await database.request(`/users/${encodeURIComponent(String(userId || "").trim())}`);
      return response.user ? database.normalizeDocument(response.user) : null;
    },

    async createUser(userDocument) {
      await database.request("/users", {
        method: "POST",
        body: {
          user: userDocument,
        },
      });
    },

    async loadProducts(ownerId) {
      const response = await database.request(`/products?ownerId=${encodeURIComponent(ownerId)}`);
      const documents = Array.isArray(response.products) ? response.products : [];
      const normalized = documents.map((document) => database.normalizeDocument(document));
      return normalized.filter((document) => typeof document.id === "string" && document.id);
    },

    async saveProducts(ownerId, products) {
      await database.request(`/products/${encodeURIComponent(ownerId)}`, {
        method: "PUT",
        body: {
          products,
        },
      });
    },

    async loadBills(ownerId) {
      const response = await database.request(`/bills?ownerId=${encodeURIComponent(ownerId)}`);
      const documents = Array.isArray(response.bills) ? response.bills : [];
      const normalized = documents.map((document) => database.normalizeDocument(document));
      return normalized.filter((document) => typeof document.id === "string" && document.id);
    },

    async saveBills(ownerId, bills) {
      await database.request(`/bills/${encodeURIComponent(ownerId)}`, {
        method: "PUT",
        body: {
          bills,
        },
      });
    },

    async loadTheme(ownerId) {
      const response = await database.request(`/settings/theme?ownerId=${encodeURIComponent(ownerId)}`);
      return response.theme ?? null;
    },

    async saveTheme(ownerId, theme) {
      await database.request("/settings/theme", {
        method: "PUT",
        body: {
          ownerId,
          theme,
        },
      });
    },

    async loadMonthlyExpense(ownerId) {
      const response = await database.request(`/settings/monthly-expense?ownerId=${encodeURIComponent(ownerId)}`);
      return Number(response.amount) || 0;
    },

    async saveMonthlyExpense(ownerId, amount) {
      await database.request("/settings/monthly-expense", {
        method: "PUT",
        body: {
          ownerId,
          amount,
        },
      });
    },
  };

  const storage = {
    memoryByUser: {},

    cloneProducts(products) {
      return Array.isArray(products) ? products.map((product) => ({ ...product })) : [];
    },

    cloneBills(bills) {
      if (!Array.isArray(bills)) {
        return [];
      }

      return bills.map((bill) => ({
        ...bill,
        items: Array.isArray(bill.items) ? bill.items.map((item) => ({ ...item })) : [],
      }));
    },

    getBucket(userId) {
      if (!userId) {
        return {
          products: [],
          bills: [],
          theme: "light",
          monthlyExpense: 0,
        };
      }

      if (!storage.memoryByUser[userId]) {
        storage.memoryByUser[userId] = {
          products: [],
          bills: [],
          theme: "light",
          monthlyExpense: 0,
        };
      }

      return storage.memoryByUser[userId];
    },

    async loadProducts(userId) {
      const bucket = storage.getBucket(userId);
      if (!userId) {
        return storage.cloneProducts(bucket.products);
      }

      try {
        const products = await database.loadProducts(userId);
        bucket.products = storage.cloneProducts(products);
        return storage.cloneProducts(bucket.products);
      } catch (error) {
        console.warn("Using in-memory fallback for products.", error);
        database.setStatus("fallback");
        return storage.cloneProducts(bucket.products);
      }
    },

    saveProducts(products, userId) {
      const bucket = storage.getBucket(userId);
      const normalizedProducts = storage.cloneProducts(products);
      bucket.products = normalizedProducts;

      if (!userId) {
        return;
      }

      void database.saveProducts(userId, normalizedProducts).catch((error) => {
        console.warn("Backend save failed for products. Fallback active.", error);
        database.setStatus("fallback");
      });
    },

    async loadBills(userId) {
      const bucket = storage.getBucket(userId);
      if (!userId) {
        return storage.cloneBills(bucket.bills);
      }

      try {
        const bills = await database.loadBills(userId);
        bucket.bills = storage.cloneBills(bills);
        return storage.cloneBills(bucket.bills);
      } catch (error) {
        console.warn("Using in-memory fallback for bills.", error);
        database.setStatus("fallback");
        return storage.cloneBills(bucket.bills);
      }
    },

    saveBills(bills, userId) {
      const bucket = storage.getBucket(userId);
      const normalizedBills = storage.cloneBills(bills);
      bucket.bills = normalizedBills;

      if (!userId) {
        return;
      }

      void database.saveBills(userId, normalizedBills).catch((error) => {
        console.warn("Backend save failed for bills. Fallback active.", error);
        database.setStatus("fallback");
      });
    },

    async loadTheme(userId) {
      const bucket = storage.getBucket(userId);
      if (!userId) {
        return bucket.theme;
      }

      try {
        const theme = await database.loadTheme(userId);
        const resolvedTheme = theme === "dark" ? "dark" : "light";
        bucket.theme = resolvedTheme;
        return resolvedTheme;
      } catch (error) {
        console.warn("Using in-memory fallback for theme.", error);
        database.setStatus("fallback");
        return bucket.theme;
      }
    },

    saveTheme(theme, userId) {
      const bucket = storage.getBucket(userId);
      const resolvedTheme = theme === "dark" ? "dark" : "light";
      bucket.theme = resolvedTheme;

      if (!userId) {
        return;
      }

      void database.saveTheme(userId, resolvedTheme).catch((error) => {
        console.warn("Backend save failed for theme. Fallback active.", error);
        database.setStatus("fallback");
      });
    },

    async loadMonthlyExpense(userId) {
      const bucket = storage.getBucket(userId);
      if (!userId) {
        return bucket.monthlyExpense;
      }

      try {
        const amount = Math.max(0, helpers.toNumber(await database.loadMonthlyExpense(userId), 0));
        bucket.monthlyExpense = amount;
        return amount;
      } catch (error) {
        console.warn("Using in-memory fallback for monthly expense.", error);
        database.setStatus("fallback");
        return bucket.monthlyExpense;
      }
    },

    saveMonthlyExpense(amount, userId) {
      const bucket = storage.getBucket(userId);
      const resolvedAmount = Math.max(0, helpers.toNumber(amount, 0));
      bucket.monthlyExpense = resolvedAmount;

      if (!userId) {
        return;
      }

      void database.saveMonthlyExpense(userId, resolvedAmount).catch((error) => {
        console.warn("Backend save failed for monthly expense. Fallback active.", error);
        database.setStatus("fallback");
      });
    },
  };

  const authSession = {
    read() {
      try {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.id !== "string" || !parsed.id) {
          return null;
        }

        return parsed;
      } catch (_error) {
        return null;
      }
    },

    write(user) {
      if (!user || !user.id) {
        return;
      }

      const payload = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      };

      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    },

    clear() {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    },
  };

  const helpers = {
    newId(prefix) {
      return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    },

    formatCurrency(value) {
      return currencyFormatter.format(Number(value) || 0);
    },

    formatDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "--";
      }

      return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    toNumber(value, fallback = 0) {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : fallback;
    },

    escapeHtml(text) {
      const temp = document.createElement("div");
      temp.textContent = text;
      return temp.innerHTML;
    },

    normalizeUsername(value) {
      return String(value || "")
        .trim()
        .toLowerCase();
    },

    isValidUsername(value) {
      return /^[a-z0-9._-]{3,32}$/.test(value);
    },

    async hashPassword(password) {
      const plain = String(password || "");

      if (window.crypto && window.crypto.subtle && typeof window.TextEncoder === "function") {
        const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(plain));
        return Array.from(new Uint8Array(digest))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
      }

      // Fallback hash for non-secure contexts where SubtleCrypto is unavailable.
      let hash = 0;
      for (let i = 0; i < plain.length; i += 1) {
        hash = (hash << 5) - hash + plain.charCodeAt(i);
        hash |= 0;
      }

      return `fallback-${Math.abs(hash)}`;
    },
  };

  function getCurrentUserId() {
    return state.currentUser && state.currentUser.id ? state.currentUser.id : null;
  }

  function getCurrentBillDraftMeta() {
    const rawName = elements.billingNameInput ? elements.billingNameInput.value : "";
    const name = String(rawName || "").trim();
    const paymentType =
      elements.billingPaymentType && elements.billingPaymentType.value === "paylater" ? "paylater" : "paid";

    return {
      name,
      paymentType,
    };
  }

  function resetCurrentBillDraft() {
    if (elements.billingNameInput) {
      elements.billingNameInput.value = "";
    }

    if (elements.billingPaymentType) {
      elements.billingPaymentType.value = "paid";
    }
  }

  function getBillPaymentLabel(bill) {
    const normalizedBill = normalizeBillRecord(bill);
    if (normalizedBill.paymentStatus === "pending") {
      return `Pay Later (${helpers.formatCurrency(normalizedBill.dueAmount)})`;
    }

    return "Paid";
  }

  function normalizeBillRecord(bill) {
    const rawBill = bill && typeof bill === "object" ? bill : {};
    const id = String(rawBill.id || "").trim();
    const total = Math.max(0, helpers.toNumber(rawBill.total, 0));

    const items = Array.isArray(rawBill.items)
      ? rawBill.items
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            ...item,
            productId: String(item.productId || "").trim(),
            name: String(item.name || "").trim(),
            quantity: Math.max(0, Math.floor(helpers.toNumber(item.quantity, 0))),
            price: Math.max(0, helpers.toNumber(item.price, 0)),
            costPrice: Math.max(0, helpers.toNumber(item.costPrice, 0)),
          }))
      : [];

    const paymentStatus = rawBill.paymentStatus === "pending" ? "pending" : "paid";
    const requestedDueAmount = Math.max(0, helpers.toNumber(rawBill.dueAmount, paymentStatus === "pending" ? total : 0));
    const dueAmount = paymentStatus === "pending" ? Math.min(total, requestedDueAmount || total) : 0;
    const paidAmount = paymentStatus === "pending" ? Math.max(0, total - dueAmount) : total;
    const baseName = String(rawBill.name || rawBill.billName || "").trim();
    const name = baseName || (id ? `Bill ${id}` : "Untitled Bill");

    return {
      ...rawBill,
      id,
      items,
      total,
      name,
      paymentStatus,
      dueAmount,
      paidAmount,
    };
  }

  function clearWorkspaceState() {
    state.products = [];
    state.bills = [];
    state.currentBillItems = [];
    state.searchTerm = "";
    state.monthlyExpense = 0;
    state.activeBillDetailsId = null;

    resetCurrentBillDraft();

    if (elements.inventorySearch) {
      elements.inventorySearch.value = "";
    }

    if (elements.financeExpenseInput) {
      elements.financeExpenseInput.value = "0";
    }
  }

  function setAuthMessage(message, type = "info") {
    if (!elements.authMessage) {
      return;
    }

    elements.authMessage.textContent = message || "";
    elements.authMessage.classList.remove("error", "success");

    if (type === "error") {
      elements.authMessage.classList.add("error");
    }

    if (type === "success") {
      elements.authMessage.classList.add("success");
    }
  }

  function switchAuthMode(mode) {
    const targetMode = mode === "register" ? "register" : "login";
    state.authMode = targetMode;

    elements.showLoginBtn.classList.toggle("active", targetMode === "login");
    elements.showRegisterBtn.classList.toggle("active", targetMode === "register");
    elements.loginForm.classList.toggle("active", targetMode === "login");
    elements.registerForm.classList.toggle("active", targetMode === "register");
    setAuthMessage("");
  }

  function renderCurrentUserBadge() {
    if (!elements.currentUserBadge || !elements.logoutBtn) {
      return;
    }

    if (state.currentUser) {
      const label = state.currentUser.displayName || state.currentUser.username || "User";
      elements.currentUserBadge.textContent = `User: ${label}`;
      elements.logoutBtn.classList.remove("auth-hidden");
      return;
    }

    elements.currentUserBadge.textContent = "Not Signed In";
    elements.logoutBtn.classList.add("auth-hidden");
  }

  function toggleApplicationVisibility(isLoggedIn) {
    if (elements.appShell) {
      elements.appShell.classList.toggle("app-hidden", !isLoggedIn);
    }

    if (elements.authScreen) {
      elements.authScreen.classList.toggle("auth-hidden", isLoggedIn);
    }
  }

  async function loadInitialDataForUser(userId) {
    const [products, bills, theme, monthlyExpense] = await Promise.all([
      storage.loadProducts(userId),
      storage.loadBills(userId),
      storage.loadTheme(userId),
      storage.loadMonthlyExpense(userId),
    ]);

    return {
      products: Array.isArray(products) ? products : [],
      bills: Array.isArray(bills) ? bills.map((bill) => normalizeBillRecord(bill)) : [],
      theme: theme === "dark" ? "dark" : "light",
      monthlyExpense: Math.max(0, helpers.toNumber(monthlyExpense, 0)),
    };
  }

  async function loadWorkspaceForCurrentUser() {
    const userId = getCurrentUserId();
    if (!userId) {
      clearWorkspaceState();
      return;
    }

    const initialData = await loadInitialDataForUser(userId);
    state.products = initialData.products;
    state.bills = initialData.bills.map((bill) => normalizeBillRecord(bill));
    state.monthlyExpense = initialData.monthlyExpense;
    state.currentBillItems = [];
    state.searchTerm = "";
    state.activeBillDetailsId = null;
    resetCurrentBillDraft();
    if (elements.inventorySearch) {
      elements.inventorySearch.value = "";
    }

    if (elements.financeExpenseInput) {
      elements.financeExpenseInput.value = String(initialData.monthlyExpense);
    }

    setTheme(initialData.theme, { persist: false });
    setActiveSection("dashboard");
    renderAll();
  }

  async function startSessionForUser(userRecord, options = {}) {
    const safeUser = {
      id: userRecord.id,
      username: userRecord.username,
      displayName: userRecord.displayName || userRecord.username,
    };

    state.currentUser = safeUser;
    authSession.write(safeUser);
    renderCurrentUserBadge();
    toggleApplicationVisibility(true);
    await loadWorkspaceForCurrentUser();
    setAuthMessage("");

    if (options.showToast !== false) {
      showToast(`Welcome, ${safeUser.displayName}.`);
    }
  }

  function endSession() {
    authSession.clear();
    state.currentUser = null;
    clearWorkspaceState();
    closeModal(elements.editModal);
    closeModal(elements.invoiceModal);
    closeBillDetailsModal();
    renderCurrentUserBadge();
    toggleApplicationVisibility(false);
    setTheme("light", { persist: false });
    switchAuthMode("login");
    setAuthMessage("Sign in to continue.");
  }

  // Product management
  const productManager = {
    list() {
      return [...state.products].sort((a, b) => a.name.localeCompare(b.name));
    },

    getById(productId) {
      return state.products.find((product) => product.id === productId) || null;
    },

    addProduct({ name, price, costPrice, quantity }) {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error("Please sign in before adding products.");
      }

      const product = {
        id: helpers.newId("prd"),
        ownerId: userId,
        name: name.trim(),
        price: Number(price),
        costPrice: Number(costPrice),
        quantity: Math.floor(Number(quantity)),
        createdAt: new Date().toISOString(),
      };

      state.products.push(product);
      storage.saveProducts(state.products, userId);
      return product;
    },

    updateProduct(productId, updates) {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error("Please sign in before editing products.");
      }

      const product = productManager.getById(productId);
      if (!product) {
        throw new Error("Product not found.");
      }

      product.name = updates.name.trim();
      product.price = Number(updates.price);
      product.costPrice = Number(updates.costPrice);
      product.quantity = Math.floor(Number(updates.quantity));
      product.updatedAt = new Date().toISOString();

      storage.saveProducts(state.products, userId);
      reconcileCurrentBillWithInventory();
      return product;
    },

    deleteProduct(productId) {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error("Please sign in before deleting products.");
      }

      state.products = state.products.filter((product) => product.id !== productId);
      state.currentBillItems = state.currentBillItems.filter((item) => item.productId !== productId);
      storage.saveProducts(state.products, userId);
    },
  };

  // Billing logic
  const billingManager = {
    getById(billId) {
      const normalizedId = String(billId || "").trim();
      return state.bills.find((bill) => bill.id === normalizedId) || null;
    },

    listPayLaterBills() {
      return state.bills
        .filter((bill) => normalizeBillRecord(bill).paymentStatus === "pending")
        .map((bill) => normalizeBillRecord(bill))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },

    addItem(productId, quantity) {
      const product = productManager.getById(productId);
      if (!product) {
        throw new Error("Please select a valid product.");
      }

      if (product.quantity <= 0) {
        throw new Error("Selected product is out of stock.");
      }

      const qty = Math.floor(helpers.toNumber(quantity));
      if (qty < 1) {
        throw new Error("Quantity must be at least 1.");
      }

      const existing = state.currentBillItems.find((item) => item.productId === product.id);
      const alreadyInBill = existing ? existing.quantity : 0;

      if (qty + alreadyInBill > product.quantity) {
        const allowed = Math.max(product.quantity - alreadyInBill, 0);
        throw new Error(`Only ${allowed} more unit(s) available for this product.`);
      }

      if (existing) {
        existing.quantity += qty;
      } else {
        state.currentBillItems.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          costPrice: helpers.toNumber(product.costPrice, 0),
          quantity: qty,
        });
      }
    },

    removeItem(productId) {
      state.currentBillItems = state.currentBillItems.filter((item) => item.productId !== productId);
    },

    clear(options = {}) {
      const shouldResetDraft = options.resetDraft !== false;
      state.currentBillItems = [];

      if (shouldResetDraft) {
        resetCurrentBillDraft();
      }
    },

    calculateTotal(items = state.currentBillItems) {
      return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    },

    generateInvoiceMarkup(items, withTimestamp = true) {
      if (!items.length) {
        return '<p class="invoice-empty">Add products to generate invoice preview.</p>';
      }

      const draftMeta = getCurrentBillDraftMeta();
      const draftName = draftMeta.name || "Untitled Bill";
      const paymentLabel = draftMeta.paymentType === "paylater" ? "Pay Later" : "Paid";

      const rows = items
        .map((item) => {
          const itemTotal = item.quantity * item.price;
          return `<li><span>${helpers.escapeHtml(item.name)} x ${item.quantity}</span><strong>${helpers.formatCurrency(
            itemTotal
          )}</strong></li>`;
        })
        .join("");

      const draftDetailsText = withTimestamp
        ? `${paymentLabel} | ${helpers.formatDate(new Date().toISOString())}`
        : paymentLabel;

      return `
        <div class="invoice-shell">
          <div class="invoice-head">
            <div>
              <h4>${helpers.escapeHtml(draftName)} (Draft)</h4>
              <small>${helpers.escapeHtml(draftDetailsText)}</small>
            </div>
            <strong>${helpers.formatCurrency(billingManager.calculateTotal(items))}</strong>
          </div>
          <ul class="invoice-items">${rows}</ul>
          <div class="invoice-total">
            <span>Grand Total</span>
            <strong>${helpers.formatCurrency(billingManager.calculateTotal(items))}</strong>
          </div>
        </div>
      `;
    },

    generateCompletedBillMarkup(bill) {
      if (!bill || !Array.isArray(bill.items) || !bill.items.length) {
        return '<p class="invoice-empty">No bill details available.</p>';
      }

      const normalizedBill = normalizeBillRecord(bill);
      const paymentLabel = getBillPaymentLabel(normalizedBill);

      const rows = normalizedBill.items
        .map((item) => {
          const itemTotal = Number(item.quantity) * Number(item.price);
          return `<li><span>${helpers.escapeHtml(item.name)} x ${item.quantity} @ ${helpers.formatCurrency(
            item.price
          )}</span><strong>${helpers.formatCurrency(itemTotal)}</strong></li>`;
        })
        .join("");

      return `
        <div class="invoice-shell">
          <div class="invoice-head">
            <div>
              <h4>${helpers.escapeHtml(normalizedBill.name)}</h4>
              <small>${helpers.escapeHtml(normalizedBill.id)} | ${helpers.formatDate(normalizedBill.date)}</small>
              <small>${helpers.escapeHtml(paymentLabel)}</small>
            </div>
            <strong>${helpers.formatCurrency(normalizedBill.total)}</strong>
          </div>
          <ul class="invoice-items">${rows}</ul>
          <div class="invoice-total">
            <span>Paid Amount</span>
            <strong>${helpers.formatCurrency(normalizedBill.paidAmount)}</strong>
          </div>
          <div class="invoice-total">
            <span>Due Amount</span>
            <strong>${helpers.formatCurrency(normalizedBill.dueAmount)}</strong>
          </div>
          <div class="invoice-total">
            <span>Grand Total</span>
            <strong>${helpers.formatCurrency(normalizedBill.total)}</strong>
          </div>
        </div>
      `;
    },

    checkout() {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error("Please sign in before checkout.");
      }

      if (!state.currentBillItems.length) {
        throw new Error("Cannot checkout an empty bill.");
      }

      for (const item of state.currentBillItems) {
        const product = productManager.getById(item.productId);
        if (!product) {
          throw new Error(`Product ${item.name} no longer exists.`);
        }

        if (item.quantity > product.quantity) {
          throw new Error(`Insufficient stock for ${item.name}.`);
        }
      }

      state.currentBillItems.forEach((item) => {
        const product = productManager.getById(item.productId);
        product.quantity -= item.quantity;
      });

      const draftMeta = getCurrentBillDraftMeta();
      const billId = helpers.newId("bill");
      const total = billingManager.calculateTotal(state.currentBillItems);
      const isPayLater = draftMeta.paymentType === "paylater";

      const newBill = normalizeBillRecord({
        id: billId,
        ownerId: userId,
        date: new Date().toISOString(),
        items: state.currentBillItems.map((item) => ({ ...item })),
        total,
        name: draftMeta.name || `Bill ${billId}`,
        paymentStatus: isPayLater ? "pending" : "paid",
        paidAmount: isPayLater ? 0 : total,
        dueAmount: isPayLater ? total : 0,
      });

      state.bills.unshift(newBill);
      storage.saveProducts(state.products, userId);
      storage.saveBills(state.bills, userId);
      billingManager.clear({ resetDraft: true });

      return newBill;
    },

    markBillAsPaid(billId) {
      const userId = getCurrentUserId();
      if (!userId) {
        throw new Error("Please sign in before updating bill payment.");
      }

      const bill = billingManager.getById(billId);
      if (!bill) {
        throw new Error("Bill not found.");
      }

      const normalizedBill = normalizeBillRecord(bill);
      if (normalizedBill.paymentStatus === "paid") {
        return normalizedBill;
      }

      const updatedBill = {
        ...normalizedBill,
        paymentStatus: "paid",
        paidAmount: normalizedBill.total,
        dueAmount: 0,
        settledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const billIndex = state.bills.findIndex((entry) => entry.id === updatedBill.id);
      if (billIndex < 0) {
        throw new Error("Bill not found.");
      }

      state.bills[billIndex] = updatedBill;
      storage.saveBills(state.bills, userId);
      return updatedBill;
    },
  };

  // UI rendering
  function renderDatabaseStatusBadge() {
    if (!elements.dbStatusBadge) {
      return;
    }

    const isConnected = state.databaseStatus === "connected";
    elements.dbStatusBadge.textContent = `Database: ${isConnected ? "Connected" : "Fallback"}`;
    elements.dbStatusBadge.classList.toggle("connected", isConnected);
    elements.dbStatusBadge.classList.toggle("fallback", !isConnected);
    elements.dbStatusBadge.setAttribute(
      "title",
      isConnected ? "Backend API and MongoDB are active." : "Backend unavailable. Using temporary in-memory fallback."
    );
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");

    if (state.toastTimerId) {
      clearTimeout(state.toastTimerId);
    }

    state.toastTimerId = setTimeout(() => {
      elements.toast.classList.remove("show");
      state.toastTimerId = null;
    }, 2200);
  }

  function setTheme(theme, options = {}) {
    const { persist = true } = options;
    const resolvedTheme = theme === "dark" ? "dark" : "light";

    document.body.setAttribute("data-theme", resolvedTheme);
    elements.themeToggle.checked = resolvedTheme === "dark";

    if (persist) {
      const userId = getCurrentUserId();
      storage.saveTheme(resolvedTheme, userId);
    }
  }

  function setActiveSection(sectionName) {
    state.activeSection = sectionName;

    elements.sections.forEach((section) => {
      section.classList.toggle("active", section.id === sectionName);
    });

    elements.navLinks.forEach((button) => {
      button.classList.toggle("active", button.dataset.section === sectionName);
    });

    const meta = sectionsMeta[sectionName];
    elements.sectionTitle.textContent = meta.title;
    elements.sectionSubtitle.textContent = meta.subtitle;

    if (sectionName === "dashboard") {
      renderDashboard();
    }

    if (sectionName === "finance") {
      renderFinanceSection();
    }

    if (sectionName === "history") {
      renderHistorySection();
    }
  }

  function getBillDateParts(bill) {
    const billDate = new Date(bill.date);
    if (Number.isNaN(billDate.getTime())) {
      return null;
    }

    return {
      month: String(billDate.getMonth() + 1).padStart(2, "0"),
      year: String(billDate.getFullYear()),
    };
  }

  function getHistoryBills() {
    const bills = state.bills
      .map((bill) => normalizeBillRecord(bill))
      .filter((bill) => bill.id && bill.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return bills.filter((bill) => {
      const dateParts = getBillDateParts(bill);
      if (!dateParts) {
        return false;
      }

      if (state.historyMonthFilter !== "all" && dateParts.month !== state.historyMonthFilter) {
        return false;
      }

      if (state.historyYearFilter !== "all" && dateParts.year !== state.historyYearFilter) {
        return false;
      }

      return true;
    });
  }

  function getHistoryFilterOptions() {
    const monthSet = new Set();
    const yearSet = new Set();

    state.bills.forEach((bill) => {
      const dateParts = getBillDateParts(normalizeBillRecord(bill));
      if (!dateParts) {
        return;
      }

      monthSet.add(dateParts.month);
      yearSet.add(dateParts.year);
    });

    return {
      months: [...monthSet].sort(),
      years: [...yearSet].sort((a, b) => Number(b) - Number(a)),
    };
  }

  function renderHistoryFilters() {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const { months, years } = getHistoryFilterOptions();

    if (elements.historyMonthFilter) {
      const currentMonth = elements.historyMonthFilter.value || state.historyMonthFilter;
      elements.historyMonthFilter.innerHTML =
        '<option value="all">All Months</option>' +
        months
          .map((month) => {
            const monthIndex = Math.max(1, Math.min(12, Number(month))) - 1;
            return `<option value="${month}">${monthNames[monthIndex]}</option>`;
          })
          .join("");
      elements.historyMonthFilter.value = currentMonth;
    }

    if (elements.historyYearFilter) {
      const currentYear = elements.historyYearFilter.value || state.historyYearFilter;
      elements.historyYearFilter.innerHTML =
        '<option value="all">All Years</option>' +
        years.map((year) => `<option value="${year}">${year}</option>`).join("");
      elements.historyYearFilter.value = currentYear;
    }
  }

  function renderHistorySection() {
    renderHistoryFilters();

    const filteredBills = getHistoryBills();
    const totalBills = filteredBills.length;
    const payLaterBills = filteredBills.filter((bill) => bill.paymentStatus === "pending");
    const totalPages = Math.max(1, Math.ceil(totalBills / state.historyPageSize));

    if (state.historyPage > totalPages) {
      state.historyPage = totalPages;
    }

    const pageStart = (state.historyPage - 1) * state.historyPageSize;
    const pageBills = filteredBills.slice(pageStart, pageStart + state.historyPageSize);

    if (elements.historyTotalBills) {
      elements.historyTotalBills.textContent = String(totalBills);
    }

    if (elements.historyPayLaterBills) {
      elements.historyPayLaterBills.textContent = String(payLaterBills.length);
    }

    if (elements.historyPayLaterDue) {
      const pendingDue = payLaterBills.reduce((sum, bill) => sum + helpers.toNumber(bill.dueAmount, 0), 0);
      elements.historyPayLaterDue.textContent = helpers.formatCurrency(pendingDue);
    }

    if (elements.historyPageInfo) {
      elements.historyPageInfo.textContent = totalBills
        ? `Page ${state.historyPage} of ${totalPages}`
        : "No bills found";
    }

    if (elements.historyPrevPageBtn) {
      elements.historyPrevPageBtn.disabled = state.historyPage <= 1 || totalBills === 0;
    }

    if (elements.historyNextPageBtn) {
      elements.historyNextPageBtn.disabled = state.historyPage >= totalPages || totalBills === 0;
    }

    if (!pageBills.length) {
      elements.historyTableBody.innerHTML =
        '<tr><td colspan="7" class="empty-state">No bills match the selected calendar filters.</td></tr>';
      return;
    }

    elements.historyTableBody.innerHTML = pageBills
      .map(
        (bill) => `
          <tr>
            <td>${helpers.escapeHtml(bill.id)}</td>
            <td>${helpers.escapeHtml(bill.name)}</td>
            <td>${helpers.formatDate(bill.date)}</td>
            <td>${bill.items.length}</td>
            <td>${helpers.formatCurrency(bill.total)}</td>
            <td><span class="status-chip ${bill.paymentStatus === "pending" ? "low" : "ok"}">${helpers.escapeHtml(
              getBillPaymentLabel(bill)
            )}</span></td>
            <td>
              <button class="text-btn" data-history-action="view-bill" data-id="${bill.id}" type="button">
                View
              </button>
            </td>
          </tr>
      `
      )
      .join("");
  }

  function getMonthKey(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function getFinanceSnapshot() {
    const monthlyBuckets = new Map();
    const now = new Date();
    const currentMonthKey = getMonthKey(now.toISOString());
    let currentMonthSales = 0;
    let currentMonthProfit = 0;

    state.bills.forEach((bill) => {
      const monthKey = getMonthKey(bill.date);
      if (!monthKey) {
        return;
      }

      const items = Array.isArray(bill.items) ? bill.items : [];
      let billSales = 0;
      let billCost = 0;

      items.forEach((item) => {
        const quantity = Math.max(0, Math.floor(helpers.toNumber(item.quantity)));
        const salePrice = helpers.toNumber(item.price);
        const costPrice = helpers.toNumber(item.costPrice);
        billSales += salePrice * quantity;
        billCost += costPrice * quantity;
      });

      if (billSales <= 0) {
        billSales = helpers.toNumber(bill.total);
      }

      const billProfit = billSales - billCost;
      const existing = monthlyBuckets.get(monthKey) || { sales: 0, profit: 0 };
      existing.sales += billSales;
      existing.profit += billProfit;
      monthlyBuckets.set(monthKey, existing);

      if (monthKey === currentMonthKey) {
        currentMonthSales += billSales;
        currentMonthProfit += billProfit;
      }
    });

    const timeline = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      const bucket = monthlyBuckets.get(key) || { sales: 0, profit: 0 };
      timeline.push({
        key,
        label: monthDate.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        sales: bucket.sales,
        profit: bucket.profit,
      });
    }

    const monthlyExpense = helpers.toNumber(state.monthlyExpense, 0);
    const grossMonthlyProfit = currentMonthProfit;
    const monthlyProfit = grossMonthlyProfit - monthlyExpense;
    const netProfitCurrentMonth = monthlyProfit;

    return {
      currentMonthSales,
      grossMonthlyProfit,
      monthlyProfit,
      netProfitCurrentMonth,
      timeline,
    };
  }

  function renderSalesChart(canvas, timeline) {
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const containerWidth = canvas.parentElement ? canvas.parentElement.clientWidth : 640;
    const cssWidth = Math.max(320, containerWidth - 4);
    const cssHeight = 260;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(cssWidth * pixelRatio);
    canvas.height = Math.floor(cssHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);

    const chartLeft = 50;
    const chartTop = 20;
    const chartRight = cssWidth - 18;
    const chartBottom = cssHeight - 42;
    const chartWidth = chartRight - chartLeft;
    const chartHeight = chartBottom - chartTop;
    const values = timeline.map((item) => helpers.toNumber(item.sales, 0));
    const maxValue = Math.max(...values, 1);
    const styles = getComputedStyle(document.body);
    const axisColor = styles.getPropertyValue("--line").trim() || "#d9e4ec";
    const textColor = styles.getPropertyValue("--text-muted").trim() || "#577086";
    const barColor = styles.getPropertyValue("--primary").trim() || "#0f766e";

    context.strokeStyle = axisColor;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(chartLeft, chartTop);
    context.lineTo(chartLeft, chartBottom);
    context.lineTo(chartRight, chartBottom);
    context.stroke();

    context.fillStyle = textColor;
    context.font = '12px "DM Sans", sans-serif';
    context.textAlign = "right";
    context.fillText(helpers.formatCurrency(maxValue), chartLeft - 8, chartTop + 4);
    context.fillText(helpers.formatCurrency(0), chartLeft - 8, chartBottom + 4);

    if (!timeline.length) {
      context.textAlign = "center";
      context.fillText("No sales data available.", cssWidth / 2, cssHeight / 2);
      return;
    }

    const barSlot = chartWidth / timeline.length;
    const barWidth = Math.min(42, barSlot * 0.62);

    timeline.forEach((entry, index) => {
      const salesValue = helpers.toNumber(entry.sales, 0);
      const barHeight = maxValue > 0 ? (salesValue / maxValue) * chartHeight : 0;
      const x = chartLeft + index * barSlot + (barSlot - barWidth) / 2;
      const y = chartBottom - barHeight;

      context.fillStyle = barColor;
      context.fillRect(x, y, barWidth, Math.max(2, barHeight));

      context.fillStyle = textColor;
      context.textAlign = "center";
      context.fillText(entry.label, x + barWidth / 2, chartBottom + 16);
    });
  }

  function renderFinanceSection() {
    const finance = getFinanceSnapshot();

    elements.financeCurrentMonthSales.textContent = helpers.formatCurrency(finance.currentMonthSales);
    elements.financeMonthlyProfit.textContent = helpers.formatCurrency(finance.monthlyProfit);
    elements.financeNetProfitCurrentMonth.textContent = helpers.formatCurrency(finance.netProfitCurrentMonth);

    if (elements.financeExpenseInput && document.activeElement !== elements.financeExpenseInput) {
      elements.financeExpenseInput.value = String(helpers.toNumber(state.monthlyExpense, 0));
    }

    renderSalesChart(elements.financeSalesChart, finance.timeline);

    const monthlyRows = [...finance.timeline].reverse();
    elements.financeMonthlyTableBody.innerHTML = monthlyRows
      .map(
        (entry) => `
          <tr>
            <td>${helpers.escapeHtml(entry.label)}</td>
            <td>${helpers.formatCurrency(entry.sales)}</td>
            <td>${helpers.formatCurrency(entry.profit)}</td>
          </tr>
      `
      )
      .join("");

    const payLaterBills = billingManager.listPayLaterBills();
    if (!payLaterBills.length) {
      elements.payLaterTableBody.innerHTML =
        '<tr><td colspan="6" class="empty-state">No pay-later bills pending.</td></tr>';
      return;
    }

    elements.payLaterTableBody.innerHTML = payLaterBills
      .map(
        (bill) => `
          <tr>
            <td>${helpers.escapeHtml(bill.id)}</td>
            <td>${helpers.escapeHtml(bill.name)}</td>
            <td>${helpers.formatDate(bill.date)}</td>
            <td>${helpers.formatCurrency(bill.dueAmount)}</td>
            <td><span class="status-chip low">Pending</span></td>
            <td>
              <button class="success-btn" data-finance-action="mark-paid" data-id="${bill.id}" type="button">
                Mark Paid
              </button>
            </td>
          </tr>
      `
      )
      .join("");
  }

  function renderDashboard() {
    const totalProducts = state.products.length;
    const totalSales = state.bills.reduce((sum, bill) => sum + helpers.toNumber(bill.total), 0);
    const billCount = state.bills.length;
    const lowStockCount = state.products.filter((product) => product.quantity < LOW_STOCK_THRESHOLD).length;

    elements.statTotalProducts.textContent = String(totalProducts);
    elements.statTotalSales.textContent = helpers.formatCurrency(totalSales);
    elements.statBillsCount.textContent = String(billCount);
    elements.statLowStockCount.textContent = String(lowStockCount);

    const finance = getFinanceSnapshot();
    elements.dashMonthlyProfit.textContent = helpers.formatCurrency(finance.grossMonthlyProfit);
    elements.dashNetProfitCurrentMonth.textContent = helpers.formatCurrency(finance.netProfitCurrentMonth);
    renderSalesChart(elements.dashboardSalesChart, finance.timeline);

    const recentBills = state.bills.slice(0, 6);
    if (!recentBills.length) {
      elements.recentBillsTableBody.innerHTML =
        '<tr><td colspan="7" class="empty-state">No bills generated yet.</td></tr>';
      return;
    }

    elements.recentBillsTableBody.innerHTML = recentBills
      .map(
        (billEntry) => {
          const bill = normalizeBillRecord(billEntry);
          return `
          <tr>
            <td>${helpers.escapeHtml(bill.id)}</td>
            <td>${helpers.escapeHtml(bill.name)}</td>
            <td>${helpers.formatDate(bill.date)}</td>
            <td>${bill.items.length}</td>
            <td>${helpers.formatCurrency(bill.total)}</td>
            <td><span class="status-chip ${bill.paymentStatus === "pending" ? "low" : "ok"}">${helpers.escapeHtml(
              getBillPaymentLabel(bill)
            )}</span></td>
            <td>
              <button class="text-btn" data-dashboard-action="view-bill" data-id="${bill.id}" type="button">
                View
              </button>
            </td>
          </tr>
      `;
        }
      )
      .join("");
  }

  function getInventoryStatus(product) {
    if (product.quantity <= 0) {
      return { label: "Out of Stock", className: "out" };
    }

    if (product.quantity < LOW_STOCK_THRESHOLD) {
      return { label: "Low Stock", className: "low" };
    }

    return { label: "Healthy", className: "ok" };
  }

  function renderInventoryTable() {
    const filteredProducts = productManager
      .list()
      .filter((product) => product.name.toLowerCase().includes(state.searchTerm.toLowerCase()));

    if (!filteredProducts.length) {
      elements.inventoryTableBody.innerHTML =
        '<tr><td colspan="6" class="empty-state">No products match your search.</td></tr>';
      return;
    }

    elements.inventoryTableBody.innerHTML = filteredProducts
      .map((product) => {
        const status = getInventoryStatus(product);
        const isLowStock = product.quantity < LOW_STOCK_THRESHOLD;

        return `
          <tr class="${isLowStock ? "low-stock-row" : ""}">
            <td>${helpers.escapeHtml(product.name)}</td>
            <td>${helpers.formatCurrency(product.price)}</td>
            <td>${helpers.formatCurrency(helpers.toNumber(product.costPrice, 0))}</td>
            <td>${product.quantity}</td>
            <td><span class="status-chip ${status.className}">${status.label}</span></td>
            <td>
              <button class="text-btn" data-action="edit" data-id="${product.id}" type="button">Edit</button>
              <button class="danger-btn" data-action="delete" data-id="${product.id}" type="button">Delete</button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderBillingProductOptions() {
    const selectedBefore = elements.billingProductSelect.value;
    const availableProducts = productManager.list().filter((product) => product.quantity > 0);

    if (!availableProducts.length) {
      elements.billingProductSelect.innerHTML = '<option value="">No in-stock products</option>';
      elements.billingProductSelect.disabled = true;
      elements.billingQuantity.disabled = true;
      elements.billItemForm.querySelector("button[type='submit']").disabled = true;
      return;
    }

    elements.billingProductSelect.innerHTML =
      '<option value="">Choose a product</option>' +
      availableProducts
        .map(
          (product) =>
            `<option value="${product.id}">${helpers.escapeHtml(product.name)} | ${helpers.formatCurrency(
              product.price
            )} | Stock: ${product.quantity}</option>`
        )
        .join("");

    elements.billingProductSelect.disabled = false;
    elements.billingQuantity.disabled = false;
    elements.billItemForm.querySelector("button[type='submit']").disabled = false;

    if (selectedBefore && availableProducts.some((product) => product.id === selectedBefore)) {
      elements.billingProductSelect.value = selectedBefore;
    }
  }

  function renderBillItemsTable() {
    if (!state.currentBillItems.length) {
      elements.billItemsTableBody.innerHTML =
        '<tr><td colspan="5" class="empty-state">No items in the current bill.</td></tr>';
      elements.currentBillTotal.textContent = helpers.formatCurrency(0);
      elements.openInvoiceBtn.disabled = true;
      elements.clearBillBtn.disabled = true;
      return;
    }

    elements.billItemsTableBody.innerHTML = state.currentBillItems
      .map((item) => {
        const itemTotal = item.price * item.quantity;
        return `
          <tr>
            <td>${helpers.escapeHtml(item.name)}</td>
            <td>${helpers.formatCurrency(item.price)}</td>
            <td>${item.quantity}</td>
            <td>${helpers.formatCurrency(itemTotal)}</td>
            <td>
              <button class="danger-btn" data-bill-action="remove" data-id="${item.productId}" type="button">Remove</button>
            </td>
          </tr>
        `;
      })
      .join("");

    elements.currentBillTotal.textContent = helpers.formatCurrency(billingManager.calculateTotal());
    elements.openInvoiceBtn.disabled = false;
    elements.clearBillBtn.disabled = false;
  }

  function renderInvoicePanels() {
    elements.invoicePreview.innerHTML = billingManager.generateInvoiceMarkup(state.currentBillItems, true);

    if (elements.invoiceModal.classList.contains("open")) {
      elements.invoiceModalBody.innerHTML = billingManager.generateInvoiceMarkup(state.currentBillItems, true);
    }
  }

  function openModal(modalElement) {
    modalElement.classList.add("open");
    modalElement.setAttribute("aria-hidden", "false");
  }

  function closeModal(modalElement) {
    modalElement.classList.remove("open");
    modalElement.setAttribute("aria-hidden", "true");
  }

  function openEditModal(productId) {
    const product = productManager.getById(productId);
    if (!product) {
      showToast("Unable to find this product.");
      return;
    }

    elements.editProductId.value = product.id;
    elements.editProductName.value = product.name;
    elements.editProductPrice.value = String(product.price);
    elements.editProductCostPrice.value = String(helpers.toNumber(product.costPrice, 0));
    elements.editProductQuantity.value = String(product.quantity);
    openModal(elements.editModal);
  }

  function openBillDetailsModal(billId) {
    const bill = billingManager.getById(billId);
    if (!bill) {
      showToast("Unable to find this bill.");
      return;
    }

    const normalizedBill = normalizeBillRecord(bill);
    state.activeBillDetailsId = normalizedBill.id;
    elements.billDetailsModalBody.innerHTML = billingManager.generateCompletedBillMarkup(normalizedBill);
    elements.markBillPaidBtn.classList.toggle("app-hidden", normalizedBill.paymentStatus !== "pending");
    openModal(elements.billDetailsModal);
  }

  function closeBillDetailsModal() {
    state.activeBillDetailsId = null;
    if (elements.markBillPaidBtn) {
      elements.markBillPaidBtn.classList.add("app-hidden");
    }

    closeModal(elements.billDetailsModal);
  }

  function reconcileCurrentBillWithInventory() {
    state.currentBillItems = state.currentBillItems
      .map((item) => {
        const product = productManager.getById(item.productId);
        if (!product || product.quantity <= 0) {
          return null;
        }

        return {
          ...item,
          name: product.name,
          price: product.price,
          costPrice: helpers.toNumber(product.costPrice, 0),
          quantity: Math.min(item.quantity, product.quantity),
        };
      })
      .filter((item) => item && item.quantity > 0);
  }

  function renderAll() {
    reconcileCurrentBillWithInventory();
    renderDashboard();
    renderInventoryTable();
    renderBillingProductOptions();
    renderBillItemsTable();
    renderInvoicePanels();
    renderFinanceSection();
    renderHistorySection();
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    const username = helpers.normalizeUsername(elements.loginUsername.value);
    const password = String(elements.loginPassword.value || "");

    if (!helpers.isValidUsername(username)) {
      setAuthMessage("Username must be 3-32 chars: lowercase letters, numbers, ., _, or -.", "error");
      return;
    }

    if (password.length < 6) {
      setAuthMessage("Password must be at least 6 characters.", "error");
      return;
    }

    const submitButton = elements.loginForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setAuthMessage("Signing in...");

    try {
      const user = await database.findUserByUsername(username);
      if (!user) {
        throw new Error("User not found.");
      }

      const passwordHash = await helpers.hashPassword(password);
      if (String(user.passwordHash || "") !== passwordHash) {
        throw new Error("Incorrect password.");
      }

      await startSessionForUser(user, { showToast: true });
      elements.loginForm.reset();
    } catch (error) {
      setAuthMessage(error.message || "Unable to sign in.", "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();

    const displayName = String(elements.registerName.value || "").trim();
    const username = helpers.normalizeUsername(elements.registerUsername.value);
    const password = String(elements.registerPassword.value || "");
    const confirmPassword = String(elements.registerConfirmPassword.value || "");

    if (displayName.length < 2) {
      setAuthMessage("Display name must be at least 2 characters.", "error");
      return;
    }

    if (!helpers.isValidUsername(username)) {
      setAuthMessage("Username must be 3-32 chars: lowercase letters, numbers, ., _, or -.", "error");
      return;
    }

    if (password.length < 6) {
      setAuthMessage("Password must be at least 6 characters.", "error");
      return;
    }

    if (password !== confirmPassword) {
      setAuthMessage("Password and confirm password do not match.", "error");
      return;
    }

    const submitButton = elements.registerForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setAuthMessage("Creating account...");

    try {
      const existingUser = await database.findUserByUsername(username);
      if (existingUser) {
        throw new Error("Username is already taken.");
      }

      const userRecord = {
        id: helpers.newId("usr"),
        username,
        displayName,
        passwordHash: await helpers.hashPassword(password),
        createdAt: new Date().toISOString(),
      };

      await database.createUser(userRecord);
      await startSessionForUser(userRecord, { showToast: true });
      elements.registerForm.reset();
      setAuthMessage("Account created successfully.", "success");
    } catch (error) {
      setAuthMessage(error.message || "Unable to create account.", "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  function handleAddProduct(event) {
    event.preventDefault();

    const formData = new FormData(elements.productForm);
    const name = String(formData.get("name") || "").trim();
    const price = helpers.toNumber(formData.get("price"));
    const costPrice = helpers.toNumber(formData.get("costPrice"));
    const quantity = Math.floor(helpers.toNumber(formData.get("quantity")));

    if (!name) {
      showToast("Product name is required.");
      return;
    }

    if (price <= 0) {
      showToast("Price must be greater than 0.");
      return;
    }

    if (costPrice < 0) {
      showToast("Cost price cannot be negative.");
      return;
    }

    if (costPrice > price) {
      showToast("Cost price cannot be greater than selling price.");
      return;
    }

    if (quantity < 0) {
      showToast("Quantity cannot be negative.");
      return;
    }

    try {
      productManager.addProduct({ name, price, costPrice, quantity });
      elements.productForm.reset();
      renderAll();
      showToast("Product added to inventory.");
    } catch (error) {
      showToast(error.message);
    }
  }

  function handleInventoryTableClick(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const productId = button.dataset.id;
    if (!productId) {
      return;
    }

    if (button.dataset.action === "edit") {
      openEditModal(productId);
      return;
    }

    if (button.dataset.action === "delete") {
      const product = productManager.getById(productId);
      if (!product) {
        showToast("Product not found.");
        return;
      }

      if (!window.confirm(`Delete ${product.name} from inventory?`)) {
        return;
      }

      try {
        productManager.deleteProduct(productId);
        renderAll();
        showToast("Product deleted.");
      } catch (error) {
        showToast(error.message);
      }
    }
  }

  function handleEditProduct(event) {
    event.preventDefault();

    const productId = elements.editProductId.value;
    const name = elements.editProductName.value.trim();
    const price = helpers.toNumber(elements.editProductPrice.value);
    const costPrice = helpers.toNumber(elements.editProductCostPrice.value);
    const quantity = Math.floor(helpers.toNumber(elements.editProductQuantity.value));

    if (!name) {
      showToast("Product name is required.");
      return;
    }

    if (price <= 0) {
      showToast("Price must be greater than 0.");
      return;
    }

    if (costPrice < 0) {
      showToast("Cost price cannot be negative.");
      return;
    }

    if (costPrice > price) {
      showToast("Cost price cannot be greater than selling price.");
      return;
    }

    if (quantity < 0) {
      showToast("Quantity cannot be negative.");
      return;
    }

    try {
      productManager.updateProduct(productId, { name, price, costPrice, quantity });
      closeModal(elements.editModal);
      renderAll();
      showToast("Product updated successfully.");
    } catch (error) {
      showToast(error.message);
    }
  }

  function handleAddBillItem(event) {
    event.preventDefault();

    const productId = elements.billingProductSelect.value;
    const quantity = elements.billingQuantity.value;

    if (!productId) {
      showToast("Please choose a product.");
      return;
    }

    try {
      billingManager.addItem(productId, quantity);
      elements.billingQuantity.value = "";
      renderAll();
      showToast("Item added to current bill.");
    } catch (error) {
      showToast(error.message);
    }
  }

  function handleBillItemsTableClick(event) {
    const button = event.target.closest("button[data-bill-action]");
    if (!button) {
      return;
    }

    if (button.dataset.billAction === "remove") {
      billingManager.removeItem(button.dataset.id);
      renderAll();
      showToast("Item removed from bill.");
    }
  }

  function handleRecentBillsTableClick(event) {
    const button = event.target.closest("button[data-dashboard-action]");
    if (!button) {
      return;
    }

    if (button.dataset.dashboardAction === "view-bill") {
      openBillDetailsModal(button.dataset.id);
    }
  }

  function handlePayLaterTableClick(event) {
    const button = event.target.closest("button[data-finance-action]");
    if (!button) {
      return;
    }

    if (button.dataset.financeAction === "mark-paid") {
      const billId = button.dataset.id;
      if (!billId) {
        return;
      }

      try {
        const updatedBill = billingManager.markBillAsPaid(billId);
        renderAll();
        if (state.activeBillDetailsId === updatedBill.id && elements.billDetailsModal.classList.contains("open")) {
          openBillDetailsModal(updatedBill.id);
        }
        showToast(`Bill ${updatedBill.name} marked as paid.`);
      } catch (error) {
        showToast(error.message);
      }
    }
  }

  function handleHistoryTableClick(event) {
    const button = event.target.closest("button[data-history-action]");
    if (!button) {
      return;
    }

    if (button.dataset.historyAction === "view-bill") {
      openBillDetailsModal(button.dataset.id);
    }
  }

  function handleHistoryFilterChange() {
    state.historyPage = 1;
    state.historyMonthFilter = elements.historyMonthFilter ? elements.historyMonthFilter.value : "all";
    state.historyYearFilter = elements.historyYearFilter ? elements.historyYearFilter.value : "all";
    renderHistorySection();
  }

  function handleHistoryPageChange(delta) {
    const bills = getHistoryBills();
    const totalPages = Math.max(1, Math.ceil(bills.length / state.historyPageSize));
    state.historyPage = Math.min(totalPages, Math.max(1, state.historyPage + delta));
    renderHistorySection();
  }

  function handleClearBill() {
    if (!state.currentBillItems.length) {
      return;
    }

    if (!window.confirm("Clear all items from the current bill?")) {
      return;
    }

    billingManager.clear();
    renderAll();
    showToast("Current bill has been cleared.");
  }

  function handleFinanceExpenseSubmit(event) {
    event.preventDefault();

    const userId = getCurrentUserId();
    if (!userId) {
      showToast("Please sign in before updating monthly expense.");
      return;
    }

    const amount = helpers.toNumber(elements.financeExpenseInput.value, 0);
    if (amount < 0) {
      showToast("Monthly expense cannot be negative.");
      return;
    }

    state.monthlyExpense = amount;
    storage.saveMonthlyExpense(amount, userId);
    renderAll();
    showToast("Monthly expense updated.");
  }

  function handleMarkBillPaid() {
    if (!state.activeBillDetailsId) {
      return;
    }

    try {
      const updatedBill = billingManager.markBillAsPaid(state.activeBillDetailsId);
      renderAll();
      openBillDetailsModal(updatedBill.id);
      showToast(`Bill ${updatedBill.name} marked as paid.`);
    } catch (error) {
      showToast(error.message);
    }
  }

  function handleOpenInvoiceModal() {
    if (!state.currentBillItems.length) {
      showToast("Add items to bill before preview.");
      return;
    }

    elements.invoiceModalBody.innerHTML = billingManager.generateInvoiceMarkup(state.currentBillItems, true);
    openModal(elements.invoiceModal);
  }

  function handleCheckout() {
    try {
      const bill = billingManager.checkout();
      closeModal(elements.invoiceModal);
      setActiveSection("dashboard");
      renderAll();
      openBillDetailsModal(bill.id);
      showToast(`Checkout complete. ${bill.name} saved.`);
    } catch (error) {
      showToast(error.message);
    }
  }

  function handleLogout() {
    if (!state.currentUser) {
      return;
    }

    if (!window.confirm("Log out from the current account?")) {
      return;
    }

    endSession();
    showToast("Logged out successfully.");
  }

  function bindEvents() {
    elements.showLoginBtn.addEventListener("click", () => switchAuthMode("login"));
    elements.showRegisterBtn.addEventListener("click", () => switchAuthMode("register"));
    elements.loginForm.addEventListener("submit", handleLoginSubmit);
    elements.registerForm.addEventListener("submit", handleRegisterSubmit);
    elements.logoutBtn.addEventListener("click", handleLogout);

    elements.navLinks.forEach((button) => {
      button.addEventListener("click", () => setActiveSection(button.dataset.section));
    });

    elements.themeToggle.addEventListener("change", () => {
      const theme = elements.themeToggle.checked ? "dark" : "light";
      setTheme(theme, { persist: true });
    });

    elements.productForm.addEventListener("submit", handleAddProduct);
    elements.inventorySearch.addEventListener("input", () => {
      state.searchTerm = elements.inventorySearch.value.trim();
      renderInventoryTable();
    });
    elements.inventoryTableBody.addEventListener("click", handleInventoryTableClick);
    elements.recentBillsTableBody.addEventListener("click", handleRecentBillsTableClick);
    elements.payLaterTableBody.addEventListener("click", handlePayLaterTableClick);
    elements.historyTableBody.addEventListener("click", handleHistoryTableClick);
    elements.historyMonthFilter.addEventListener("change", handleHistoryFilterChange);
    elements.historyYearFilter.addEventListener("change", handleHistoryFilterChange);
    elements.historyPrevPageBtn.addEventListener("click", () => handleHistoryPageChange(-1));
    elements.historyNextPageBtn.addEventListener("click", () => handleHistoryPageChange(1));

    elements.editProductForm.addEventListener("submit", handleEditProduct);
    elements.closeEditModalBtn.addEventListener("click", () => closeModal(elements.editModal));
    elements.cancelEditBtn.addEventListener("click", () => closeModal(elements.editModal));
    elements.editModal.addEventListener("click", (event) => {
      if (event.target === elements.editModal) {
        closeModal(elements.editModal);
      }
    });

    elements.billItemForm.addEventListener("submit", handleAddBillItem);
    elements.billItemsTableBody.addEventListener("click", handleBillItemsTableClick);
    elements.clearBillBtn.addEventListener("click", handleClearBill);

    elements.financeExpenseForm.addEventListener("submit", handleFinanceExpenseSubmit);

    elements.openInvoiceBtn.addEventListener("click", handleOpenInvoiceModal);
    elements.finalizeCheckoutBtn.addEventListener("click", handleCheckout);
    elements.closeInvoiceModalBtn.addEventListener("click", () => closeModal(elements.invoiceModal));
    elements.cancelInvoiceBtn.addEventListener("click", () => closeModal(elements.invoiceModal));
    elements.invoiceModal.addEventListener("click", (event) => {
      if (event.target === elements.invoiceModal) {
        closeModal(elements.invoiceModal);
      }
    });

    elements.closeBillDetailsModalBtn.addEventListener("click", closeBillDetailsModal);
    elements.dismissBillDetailsBtn.addEventListener("click", closeBillDetailsModal);
    elements.markBillPaidBtn.addEventListener("click", handleMarkBillPaid);
    elements.billDetailsModal.addEventListener("click", (event) => {
      if (event.target === elements.billDetailsModal) {
        closeBillDetailsModal();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      closeModal(elements.editModal);
      closeModal(elements.invoiceModal);
      closeBillDetailsModal();
    });
  }

  async function tryRestoreSession() {
    const existingSession = authSession.read();
    if (!existingSession || !existingSession.id) {
      return false;
    }

    try {
      const user = await database.findUserById(existingSession.id);
      if (!user) {
        authSession.clear();
        return false;
      }

      await startSessionForUser(user, { showToast: false });
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function initialize() {
    renderDatabaseStatusBadge();

    const nowText = new Date().toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    elements.currentDate.textContent = nowText;

    bindEvents();
    renderCurrentUserBadge();

    const restored = await tryRestoreSession();
    if (!restored) {
      toggleApplicationVisibility(false);
      switchAuthMode("login");
      setTheme("light", { persist: false });
      setAuthMessage("Sign in to continue.");
    }

    renderDatabaseStatusBadge();
  }

  void initialize();
})();
