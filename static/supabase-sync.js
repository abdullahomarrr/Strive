"use strict";
(() => {
  const ANONYMOUS_CACHE = "strive_anonymous_workspace_v1";
  const ANONYMOUS_CACHE_DAY = "strive_anonymous_workspace_day_v1";
  const ACTIVE_USER = "strive_active_sync_user_v1";
  const onboardingReceiptKey = (userId) =>
    `strive_onboarding_complete_${userId}`;
  const userCacheKey = (userId) => `strive_user_workspace_${userId}`;
  const pendingDeletesKey = (userId) => `strive_pending_deletes_${userId}`;
  let client = null;
  let session = null;
  let callbacks = null;
  let syncTimer = null;
  let pullTimer = null;
  let channel = null;
  let syncing = false;
  let syncAgain = false;
  let authMode = "signin";
  const desktopRequiresAccount = () => !!window.StriveRuntime?.desktop;
  const localDay = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const elements = () => ({
    button: document.getElementById("accountButton"),
    label: document.getElementById("accountLabel"),
    dialog: document.getElementById("authDialog"),
    form: document.getElementById("authForm"),
    title: document.getElementById("authTitle"),
    subtitle: document.getElementById("authSubtitle"),
    signedOut: document.getElementById("authSignedOut"),
    signedIn: document.getElementById("authSignedIn"),
    nameGroup: document.getElementById("authNameGroup"),
    name: document.getElementById("authName"),
    email: document.getElementById("authEmail"),
    password: document.getElementById("authPassword"),
    message: document.getElementById("authMessage"),
    submit: document.getElementById("authSubmit"),
    forgot: document.getElementById("forgotPassword"),
    accountEmail: document.getElementById("accountEmail"),
    accountSyncState: document.getElementById("accountSyncState"),
  });
  const readCache = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  const writeCache = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };
  const setStatus = (status, detail = "") => {
    callbacks?.setStatus(status);
    const { accountSyncState } = elements();
    if (accountSyncState)
      accountSyncState.textContent =
        detail ||
        {
          synced: "Your notebooks are synced.",
          syncing: "Syncing your notebooks…",
          offline: "Changes are saved locally and will sync when online.",
          error: "Your local work is safe. Cloud sync needs attention.",
        }[status] ||
        "Saved on this device.";
  };
  const isUntouchedStarterWorkspace = (state) => {
    const starterNames = new Set([
      "Calculus I",
      "Discrete mathematics",
      "Room to think",
    ]);
    return (
      state?.books?.length === 3 &&
      state.books.every(
        (book) =>
          starterNames.has(book.title) &&
          !(book.history || []).length &&
          book.pages?.every((page) => !(page.items || []).length),
      )
    );
  };
  async function pushState(
    state = callbacks.getState(),
    booksToPush = state.books || [],
  ) {
    if (!client || !session?.user || !navigator.onLine) {
      setStatus(session ? "offline" : "local");
      return;
    }
    const userId = session.user.id;
    const notebooks = booksToPush.map((book) => ({
      id: book.id,
      user_id: userId,
      title: book.title,
      color: book.color,
      data: book,
      client_updated_at: Number(book.updated || Date.now()),
    }));
    if (notebooks.length) {
      const { error } = await client
        .from("notebooks")
        .upsert(notebooks, { onConflict: "id" });
      if (error) throw error;
    }
    const { error: preferenceError } = await client
      .from("workspace_preferences")
      .upsert(
        {
          user_id: userId,
          tabs: state.tabs || [],
          client_updated_at: Date.now(),
        },
        { onConflict: "user_id" },
      );
    if (preferenceError) throw preferenceError;
    writeCache(userCacheKey(userId), state);
  }
  async function syncNow(localOverride = null) {
    if (!session?.user || !client) return;
    if (syncing) {
      syncAgain = true;
      return;
    }
    if (!navigator.onLine) return setStatus("offline");
    syncing = true;
    setStatus("syncing");
    try {
      await flushPendingDeletes();
      const [{ data: rows, error }, { data: preference, error: prefError }] =
        await Promise.all([
          client
            .from("notebooks")
            .select("id,title,color,data,client_updated_at"),
          client
            .from("workspace_preferences")
            .select("tabs,client_updated_at")
            .maybeSingle(),
        ]);
      if (error) throw error;
      if (prefError) throw prefError;
      let local = localOverride || callbacks.getState();
      if (rows?.length && isUntouchedStarterWorkspace(local))
        local = { books: [], tabs: [] };
      const remoteById = new Map((rows || []).map((row) => [row.id, row]));
      const merged = new Map(
        (local.books || []).map((book) => [book.id, book]),
      );
      (rows || []).forEach((row) => {
        const existing = merged.get(row.id);
        const remoteBook = { ...row.data, id: row.id };
        if (
          !existing ||
          Number(row.client_updated_at || 0) > Number(existing.updated || 0)
        )
          merged.set(row.id, remoteBook);
      });
      const next = {
        books: [...merged.values()],
        tabs: preference?.tabs || local.tabs || [],
      };
      const booksToPush = next.books.filter((book) => {
        const remote = remoteById.get(book.id);
        return (
          !remote ||
          Number(book.updated || 0) > Number(remote.client_updated_at || 0)
        );
      });
      callbacks.applyState(next);
      await pushState(next, booksToPush);
      setStatus("synced");
    } catch (error) {
      console.error("Strive sync failed", error);
      setStatus("error", error.message);
    } finally {
      syncing = false;
      if (syncAgain) {
        syncAgain = false;
        queueSync(100);
      }
    }
  }
  function queueSync(delay = 900) {
    if (!session?.user) return;
    writeCache(userCacheKey(session.user.id), callbacks.getState());
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncNow(), delay);
  }
  async function deleteNotebook(notebookId) {
    if (!session?.user || !client) return;
    const userId = session.user.id;
    writeCache(userCacheKey(userId), callbacks.getState());
    if (!navigator.onLine) {
      const pending = readCache(pendingDeletesKey(userId)) || [];
      writeCache(pendingDeletesKey(userId), [
        ...new Set([...pending, notebookId]),
      ]);
      return setStatus("offline");
    }
    const { error } = await client
      .from("notebooks")
      .delete()
      .eq("id", notebookId);
    if (error) {
      setStatus("error", error.message);
      throw error;
    }
  }
  async function flushPendingDeletes() {
    if (!session?.user || !navigator.onLine) return;
    const key = pendingDeletesKey(session.user.id);
    const pending = readCache(key) || [];
    if (!pending.length) return;
    const { error } = await client.from("notebooks").delete().in("id", pending);
    if (error) throw error;
    localStorage.removeItem(key);
  }
  function subscribe(userId) {
    if (channel) client.removeChannel(channel);
    channel = client
      .channel(`strive-notebooks-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notebooks",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          clearTimeout(pullTimer);
          pullTimer = setTimeout(() => syncNow(), 500);
        },
      )
      .subscribe();
  }
  function renderAccount() {
    const ui = elements();
    ui.button.hidden = false;
    ui.label.textContent = session?.user ? "Account" : "Sign in";
    ui.signedOut.hidden = !!session?.user;
    ui.signedIn.hidden = !session?.user;
    if (session?.user)
      ui.accountEmail.textContent = session.user.email || "Signed in";
  }
  function showDesktopAuthGate(message = "") {
    if (!desktopRequiresAccount()) return;
    document.documentElement.classList.add("desktop-auth-pending");
    const ui = elements();
    setAuthMode("signin");
    if (message) ui.message.textContent = message;
    if (!ui.dialog.open) ui.dialog.showModal();
  }
  function releaseDesktopAuthGate() {
    if (!desktopRequiresAccount()) return;
    document.documentElement.classList.remove("desktop-auth-pending");
    const dialog = elements().dialog;
    if (dialog?.open) dialog.close();
  }
  function setAuthMode(mode) {
    authMode = mode;
    const ui = elements();
    document
      .querySelectorAll("[data-auth-mode]")
      .forEach((button) =>
        button.classList.toggle("active", button.dataset.authMode === mode),
      );
    ui.title.textContent =
      mode === "signup"
        ? "Create your account"
        : mode === "recovery"
          ? "Choose a new password"
          : "Welcome back";
    ui.subtitle.textContent =
      mode === "signup"
        ? "Create a space for your notes, progress, and next questions."
        : mode === "recovery"
          ? "Choose a secure password for your account."
          : "Pick up where your thinking left off.";
    ui.submit.textContent =
      mode === "signup"
        ? "Create account"
        : mode === "recovery"
          ? "Update password"
          : "Sign in";
    ui.nameGroup.hidden = mode !== "signup";
    ui.name.required = mode === "signup";
    ui.forgot.hidden = mode !== "signin";
    ui.password.autocomplete =
      mode === "signin" ? "current-password" : "new-password";
    ui.message.textContent = "";
  }
  async function handleSession(nextSession, event = "") {
    const previousUser = localStorage.getItem(ACTIVE_USER);
    if (!nextSession?.user) {
      if (previousUser && callbacks)
        writeCache(userCacheKey(previousUser), callbacks.getState());
      localStorage.removeItem(ACTIVE_USER);
      session = null;
      if (channel && client) client.removeChannel(channel);
      channel = null;
      const anonymous =
        localStorage.getItem(ANONYMOUS_CACHE_DAY) === localDay()
          ? readCache(ANONYMOUS_CACHE)
          : null;
      callbacks.applyState(anonymous || { books: [], tabs: [] });
      renderAccount();
      setStatus("local");
      showDesktopAuthGate();
      return;
    }
    session = nextSession;
    const userId = session.user.id;
    let localState = callbacks.getState();
    if (!previousUser) {
      writeCache(ANONYMOUS_CACHE, localState);
      localStorage.setItem(ANONYMOUS_CACHE_DAY, localDay());
      localState = readCache(userCacheKey(userId)) || { books: [], tabs: [] };
    } else if (previousUser !== userId) {
      writeCache(userCacheKey(previousUser), localState);
      localState = readCache(userCacheKey(userId)) || { books: [], tabs: [] };
    }
    localStorage.setItem(ACTIVE_USER, userId);
    renderAccount();
    releaseDesktopAuthGate();
    subscribe(userId);
    if (event !== "TOKEN_REFRESHED") await syncNow(localState);
    const metadata = session.user.user_metadata || {};
    const automaticOnboardingEvent =
      event === "INITIAL_SESSION" || event === "SIGNED_IN";
    const onboardingAlreadyHandled =
      localStorage.getItem(onboardingReceiptKey(userId)) === "true";
    if (metadata.strive_onboarding_complete === true)
      localStorage.setItem(onboardingReceiptKey(userId), "true");
    if (
      automaticOnboardingEvent &&
      metadata.strive_new_account === true &&
      metadata.strive_onboarding_complete !== true &&
      !onboardingAlreadyHandled &&
      window.StriveOnboarding &&
      !window.StriveOnboarding.isActive()
    ) {
      const authDialog = document.getElementById("authDialog");
      if (authDialog?.open) authDialog.close();
      window.StriveOnboarding.start({
        initial: {
          name: metadata.full_name || metadata.name || "",
        },
        complete: async (preferences) => {
          const { data, error } = await client.auth.updateUser({
            data: {
              strive_new_account: true,
              strive_onboarding_complete: true,
              strive_onboarding_preferences: preferences,
            },
          });
          if (error) throw error;
          localStorage.setItem(onboardingReceiptKey(userId), "true");
          if (data.user) session = { ...session, user: data.user };
        },
      });
    }
  }
  function bindAuthUI() {
    const ui = elements();
    ui.button.onclick = () => {
      renderAccount();
      ui.dialog.showModal();
    };
    document.getElementById("closeAuth").onclick = () => {
      if (!desktopRequiresAccount() || session?.user) ui.dialog.close();
    };
    ui.dialog.addEventListener("cancel", (event) => {
      if (desktopRequiresAccount() && !session?.user) event.preventDefault();
    });
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.onclick = () => setAuthMode(button.dataset.authMode);
    });
    ui.form.onsubmit = async (event) => {
      event.preventDefault();
      ui.submit.disabled = true;
      ui.message.textContent = "Working…";
      try {
        let result;
        if (authMode === "signup")
          result = await client.auth.signUp({
            email: ui.email.value.trim(),
            password: ui.password.value,
            options: {
              emailRedirectTo: location.origin,
              data: {
                full_name: ui.name.value.trim(),
                strive_new_account: true,
                strive_onboarding_complete: false,
              },
            },
          });
        else if (authMode === "recovery")
          result = await client.auth.updateUser({
            password: ui.password.value,
          });
        else
          result = await client.auth.signInWithPassword({
            email: ui.email.value.trim(),
            password: ui.password.value,
          });
        if (result.error) throw result.error;
        if (authMode === "signup" && !result.data.session)
          ui.message.textContent = "Check your email to confirm your account.";
        else if (authMode === "recovery") {
          ui.message.textContent = "Password updated.";
          setAuthMode("signin");
        } else ui.dialog.close();
      } catch (error) {
        ui.message.textContent = error.message;
      } finally {
        ui.submit.disabled = false;
      }
    };
    ui.forgot.onclick = async () => {
      const email = ui.email.value.trim();
      if (!email) return (ui.message.textContent = "Enter your email first.");
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin,
      });
      ui.message.textContent = error
        ? error.message
        : "Password reset instructions were sent to your email.";
    };
    document.getElementById("syncNow").onclick = () => syncNow();
    document.getElementById("editLearningProfile").onclick = () => {
      const existing =
        session?.user?.user_metadata?.strive_onboarding_preferences || {};
      ui.dialog.close();
      window.StriveOnboarding?.start({
        initial: existing,
        complete: async (preferences) => {
          const { data, error } = await client.auth.updateUser({
            data: {
              strive_new_account: true,
              strive_onboarding_complete: true,
              strive_onboarding_preferences: preferences,
            },
          });
          if (error) throw error;
          localStorage.setItem(onboardingReceiptKey(session.user.id), "true");
          if (data.user) session = { ...session, user: data.user };
        },
      });
    };
    document.getElementById("signOut").onclick = async () => {
      await client.auth.signOut();
      if (desktopRequiresAccount()) showDesktopAuthGate();
      else ui.dialog.close();
    };
  }
  async function configure(nextCallbacks) {
    callbacks = nextCallbacks;
    renderAccount();
    const accountUi = elements();
    accountUi.button.onclick = () => {
      setAuthMode("signin");
      accountUi.dialog.showModal();
      if (!client)
        accountUi.message.textContent =
          "Account services are loading. Please try again in a moment.";
    };
    if (!localStorage.getItem(ACTIVE_USER)) {
      if (localStorage.getItem(ANONYMOUS_CACHE_DAY) !== localDay())
        localStorage.removeItem(ANONYMOUS_CACHE);
      writeCache(ANONYMOUS_CACHE, callbacks.getState());
      localStorage.setItem(ANONYMOUS_CACHE_DAY, localDay());
    }
    try {
      const config = await fetch(window.striveApiUrl("/config")).then(
        (response) => response.json(),
      );
      if (!config.supabase_enabled || !window.supabase) {
        accountUi.message.textContent =
          "Account services are temporarily unavailable. Please try again shortly.";
        if (desktopRequiresAccount()) {
          elements().dialog.showModal();
        }
        return setStatus("local");
      }
      client = window.supabase.createClient(
        config.supabase_url,
        config.supabase_publishable_key,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        },
      );
      bindAuthUI();
      const { data } = client.auth.onAuthStateChange((event, nextSession) => {
        if (event === "PASSWORD_RECOVERY") {
          setAuthMode("recovery");
          elements().dialog.showModal();
        }
        setTimeout(() => handleSession(nextSession, event), 0);
      });
      void data;
      const { data: sessionData } = await client.auth.getSession();
      await handleSession(sessionData.session, "INITIAL_SESSION");
    } catch (error) {
      console.error("Supabase initialization failed", error);
      accountUi.message.textContent =
        "Strive could not reach account services. Check your connection and try again.";
      if (desktopRequiresAccount()) {
        const ui = elements();
        if (!ui.dialog.open) ui.dialog.showModal();
      }
      setStatus("error", error.message);
    }
  }
  window.addEventListener("online", () => session && syncNow());
  window.addEventListener("offline", () => session && setStatus("offline"));
  window.StriveCloud = {
    configure,
    queueSync,
    syncNow,
    deleteNotebook,
    isSignedIn: () => !!session?.user,
    getLearnerProfile: () =>
      session?.user?.user_metadata?.strive_onboarding_preferences || null,
  };
})();
