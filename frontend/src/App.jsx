import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  HeartHandshake,
  LockKeyhole,
  LocateFixed,
  MapPin,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const initialForm = {
  full_name: "",
  email: "",
  password: "",
  blood_group: "",
  date_of_birth: "",
  gender: "",
  phone: "",
};

const fieldLabels = {
  full_name: "Name",
  email: "Email address",
  password: "Password",
  role: "Account type",
  blood_group: "Blood group",
  date_of_birth: "Date of birth",
  gender: "Gender",
  phone: "Phone number",
  city: "City",
};

function describeApiError(result, fallback = "Please check your details and try again.") {
  if (typeof result.detail === "string") return result.detail;
  if (Array.isArray(result.detail)) {
    const messages = result.detail.map((issue) => {
      const field = issue.loc?.at(-1);
      const label = fieldLabels[field] ?? (typeof field === "string" ? field.replaceAll("_", " ") : "Details");
      const message = String(issue.msg ?? "Invalid value.").replace(/^Value error,\s*/i, "");
      return `${label}: ${message}`;
    });
    if (messages.length) return `Please check: ${messages.join("; ")}`;
  }
  return fallback;
}

function useSessionDraft(key, defaults) {
  const [value, setValue] = useState(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Keep the form usable if session storage is unavailable.
    }
  }, [key, value]);

  return [value, setValue];
}

function App() {
  const [mode, setMode] = useState(() =>
    window.location.hash.includes("reset_token=") ? "reset" : "register",
  );
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("openvein-account") ?? "null");
    } catch {
      return null;
    }
  });

  const isRegister = mode === "register";
  const isForgotPassword = mode === "forgot";
  const isResetPassword = mode === "reset";
  const isLogin = mode === "login";
  const resetToken = new URLSearchParams(window.location.hash.slice(1)).get("reset_token");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const endpoint = isForgotPassword
        ? "password-reset/request"
        : isResetPassword
          ? "password-reset/confirm"
          : isRegister
            ? "register"
            : "login";
      const body = isForgotPassword
        ? {
            email: form.email,
            date_of_birth: form.date_of_birth,
            phone: form.phone,
          }
        : isResetPassword
          ? { token: resetToken, new_password: form.password }
          : isRegister
            ? {
                ...form,
                  role: "both",
                blood_group: form.blood_group || null,
              }
            : { email: form.email, password: form.password };
      const response = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(describeApiError(result));
      }
      if (isForgotPassword) {
        setMessage(result.message);
        return;
      }
      if (isResetPassword) {
        window.history.replaceState({}, "", window.location.pathname);
        setForm({ ...initialForm, email: form.email, password: "" });
        setMode("login");
        setMessage(result.message);
        return;
      }
      const session = { token: result.access_token, user: result.user };
      localStorage.setItem("openvein-account", JSON.stringify(session));
      setAccount(session);
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "We couldn't reach the server. Please try again in a moment."
          : requestError.message,
      );
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (account) {
      try {
        await fetch(`${API_URL}/api/auth/donor-profile`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${account.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            city: null,
            latitude: null,
            longitude: null,
            last_donation_date: account.user.last_donation_date ?? null,
          }),
        });
      } catch {
        // Sign out locally even if location cleanup cannot reach the API.
      }
    }
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("openvein-draft-"))
      .forEach((key) => sessionStorage.removeItem(key));
    localStorage.removeItem("openvein-account");
    setAccount(null);
    setForm(initialForm);
  }

  function updateAccountUser(user) {
    const nextAccount = { ...account, user };
    localStorage.setItem("openvein-account", JSON.stringify(nextAccount));
    setAccount(nextAccount);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-cream text-ink">
      <div className="pointer-events-none absolute -left-44 top-36 h-96 w-96 rounded-full bg-coral/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -right-52 top-0 h-[34rem] w-[34rem] rounded-full bg-amber-100/60 blur-3xl" />

      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-12">
        <a href="#" className="flex items-center gap-2.5" aria-label="OpenVein home">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-coral text-white shadow-lg shadow-coral/20">
            <Heart size={20} fill="currentColor" strokeWidth={2.2} />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">openvein</span>
        </a>
        {account ? (
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-stone-600 sm:inline">Hi, {account.user.full_name.split(" ")[0]}</span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2 font-semibold text-stone-700 transition hover:border-coral hover:text-coral"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-stone-600">
            <span className="hidden sm:inline">
              {isRegister || isForgotPassword || isResetPassword
                ? "Already part of the community?"
                : "New to OpenVein?"}
            </span>
            <button
              className="font-semibold text-coral transition hover:text-rose-700"
              onClick={() => {
                setMode(isRegister || isForgotPassword || isResetPassword ? "login" : "register");
                setError("");
                setMessage("");
              }}
            >
              {isRegister || isForgotPassword || isResetPassword ? "Sign in" : "Create an account"}
            </button>
          </div>
        )}
      </header>

      {account ? (
        <Welcome account={account} onUserUpdate={updateAccountUser} />
      ) : (
        <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:pb-24 lg:pt-12">
          <div className="order-2 max-w-xl lg:order-1">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white/80 px-3.5 py-2 text-xs font-semibold tracking-wide text-rose-700 shadow-sm">
              <Sparkles size={14} />
              A little kindness goes a long way
            </div>
            <h1 className="font-display text-[2.9rem] font-extrabold leading-[1.08] tracking-[-0.045em] sm:text-6xl">
              Your next
              <br />
              <span className="text-coral">good deed</span> is closer
              <br />
              than you think.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
              Every day, someone needs a helping hand. Join a caring community that brings blood
              donors and those seeking support a little closer together.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Pill icon={<HeartHandshake size={16} />} text="Real people, real impact" />
              <Pill icon={<ShieldCheck size={16} />} text="Your details stay private" />
            </div>

            <div className="mt-14 hidden items-center gap-4 border-t border-stone-200/80 pt-7 sm:flex">
              <div className="flex -space-x-2">
                {["bg-rose-200", "bg-amber-200", "bg-orange-200", "bg-red-300"].map(
                  (color, index) => (
                    <span
                      key={index}
                      className={`grid h-10 w-10 place-items-center rounded-full border-[3px] border-cream ${color} text-xs font-bold text-stone-700`}
                    >
                      {["A", "J", "M", "S"][index]}
                    </span>
                  ),
                )}
              </div>
              <p className="text-sm leading-5 text-stone-600">
                <span className="font-semibold text-ink">Good things happen together.</span>
                <br />
                There’s a place for everyone here.
              </p>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-[500px]">
              <div className="absolute -inset-4 rotate-2 rounded-[2rem] bg-gradient-to-br from-rose-100/80 via-orange-50 to-amber-100/70" />
              <div className="relative rounded-[1.65rem] border border-white/80 bg-white p-6 shadow-card sm:p-9">
                <div className="mb-7">
                  <p className="text-sm font-semibold text-coral">
                    {isRegister
                      ? "MAKE A DIFFERENCE"
                      : isForgotPassword
                        ? "ACCOUNT RECOVERY"
                        : isResetPassword
                          ? "CHOOSE A NEW PASSWORD"
                          : "WELCOME BACK"}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
                    {isRegister
                      ? "Join the community"
                      : isForgotPassword
                        ? "Reset your password"
                        : isResetPassword
                          ? "Set a new password"
                          : "Good to see you again"}
                  </h2>
                  <p className="mt-2 text-sm text-stone-500">
                    {isRegister
                      ? "Create your free account in just a moment."
                      : isForgotPassword
                        ? "Enter your account details. We’ll email a one-time reset link if they match."
                        : isResetPassword
                          ? "Choose a strong password you haven’t used before."
                          : "Sign in to pick up where you left off."}
                  </p>
                </div>

                <form onSubmit={submitForm} className="space-y-4">
                  {isRegister && (
                    <>
                      <Field label="Your name" htmlFor="full_name">
                        <input
                          id="full_name"
                          name="full_name"
                          value={form.full_name}
                          onChange={updateField}
                          placeholder="e.g. Alex Morgan"
                          autoComplete="name"
                          minLength={2}
                          maxLength={120}
                          required
                          className="input"
                        />
                      </Field>
                      <Field label="Date of birth" htmlFor="date_of_birth">
                        <input
                          id="date_of_birth"
                          name="date_of_birth"
                          value={form.date_of_birth}
                          onChange={updateField}
                          autoComplete="bday"
                          type="date"
                          max={new Date().toISOString().slice(0, 10)}
                          required
                          className="input"
                        />
                      </Field>
                      <Field label="Gender" htmlFor="gender">
                        <select
                          id="gender"
                          name="gender"
                          value={form.gender}
                          onChange={updateField}
                          required
                          className="input"
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                      </Field>
                      <Field label="Blood group" htmlFor="blood_group">
                        <select
                          id="blood_group"
                          name="blood_group"
                          value={form.blood_group}
                          onChange={updateField}
                          className="input"
                        >
                          <option value="">Select if known (optional)</option>
                          {bloodGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                        </select>
                      </Field>
                      <Field label="Phone number" htmlFor="phone">
                        <input
                          id="phone"
                          name="phone"
                          value={form.phone}
                          onChange={updateField}
                          placeholder="Your number"
                          autoComplete="tel"
                          type="tel"
                          minLength={7}
                          maxLength={30}
                          required
                          className="input"
                        />
                      </Field>
                    </>
                  )}

                  {(isLogin || isRegister || isForgotPassword) && (
                    <Field label="Email address" htmlFor="email">
                      <input
                        id="email"
                        name="email"
                        value={form.email}
                        onChange={updateField}
                        placeholder="you@example.com"
                        autoComplete="email"
                        type="email"
                        required
                        className="input"
                      />
                    </Field>
                  )}
                  {isForgotPassword && (
                    <>
                      <Field label="Date of birth" htmlFor="date_of_birth">
                        <input
                          id="date_of_birth"
                          name="date_of_birth"
                          value={form.date_of_birth}
                          onChange={updateField}
                          autoComplete="bday"
                          type="date"
                          required
                          className="input"
                        />
                      </Field>
                      <Field label="Phone number" htmlFor="phone">
                        <input
                          id="phone"
                          name="phone"
                          value={form.phone}
                          onChange={updateField}
                          placeholder="The phone number on your account"
                          autoComplete="tel"
                          type="tel"
                          minLength={7}
                          maxLength={30}
                          required
                          className="input"
                        />
                      </Field>
                    </>
                  )}
                  {(isLogin || isRegister || isResetPassword) && (
                    <Field label={isResetPassword ? "New password" : "Password"} htmlFor="password">
                      <input
                        id="password"
                        name="password"
                        value={form.password}
                        onChange={updateField}
                        placeholder={isLogin ? "Your password" : "At least 8 characters"}
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        type="password"
                        minLength={isLogin ? 1 : 8}
                        maxLength={128}
                        required
                        className="input"
                      />
                    </Field>
                  )}

                  {error && (
                    <p
                      role="alert"
                      className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                      {error}
                    </p>
                  )}
                  {message && (
                    <p
                      role="status"
                      className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                    >
                      {message}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-coral px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-coral/20 transition hover:-translate-y-0.5 hover:bg-rose-600 hover:shadow-xl hover:shadow-coral/25 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-70"
                  >
                    {loading
                      ? "One moment..."
                      : isRegister
                        ? "Create my account"
                        : isForgotPassword
                          ? "Send reset link"
                          : isResetPassword
                            ? "Update password"
                            : "Sign in"}
                    {!loading && (
                      <ArrowRight
                        size={17}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    )}
                  </button>
                </form>

                {isLogin && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      className="text-sm font-semibold text-coral transition hover:text-rose-700"
                      onClick={() => {
                        setMode("forgot");
                        setError("");
                        setMessage("");
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {(isForgotPassword || isResetPassword) && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      className="text-sm font-semibold text-stone-500 transition hover:text-ink"
                      onClick={() => {
                        setMode("login");
                        setError("");
                        setMessage("");
                      }}
                    >
                      Back to sign in
                    </button>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-center gap-2 text-xs text-stone-400">
                  <LockKeyhole size={13} />
                  {isForgotPassword
                    ? "DOB and phone are extra checks; your email link authorizes the reset."
                    : "Your information is private and secure."}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <footer className="relative border-t border-stone-200/70 bg-white/40">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 text-center text-xs leading-5 text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:text-left lg:px-12">
          <span>© {new Date().getFullYear()} OpenVein. Every connection starts with care.</span>
          <span>OpenVein is a community platform, not a medical service.</span>
        </div>
      </footer>
    </main>
  );
}

function Pill({ icon, text }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-stone-200/80 bg-white/70 px-3.5 py-2.5 text-sm font-medium text-stone-700">
      <span className="text-coral">{icon}</span>
      {text}
    </span>
  );
}

function Field({ label, htmlFor, children }) {
  return (
    <label className="block space-y-1.5" htmlFor={htmlFor}>
      <span className="block text-[13px] font-semibold text-stone-700">{label}</span>
      {children}
    </label>
  );
}

function Welcome({ account, onUserUpdate }) {
  const [navigation, setNavigation] = useState({ pages: ["home"], index: 0 });
  const view = navigation.pages[navigation.index];
  const user = account.user;
  const roleLabels = { donor: "Donor", recipient: "Recipient", both: "Donor & recipient" };

  function navigateTo(nextPage) {
    setNavigation((current) => ({
      pages: [...current.pages.slice(0, current.index + 1), nextPage],
      index: current.index + 1,
    }));
  }

  function previousPage() {
    setNavigation((current) => ({ ...current, index: Math.max(0, current.index - 1) }));
  }

  function nextPage() {
    setNavigation((current) => ({ ...current, index: Math.min(current.pages.length - 1, current.index + 1) }));
  }

  return (
    <section className="relative mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <nav aria-label="Page navigation" className="mb-6 flex items-center justify-between rounded-2xl border border-white bg-white/80 px-3 py-2 shadow-sm">
        <button type="button" onClick={previousPage} disabled={navigation.index === 0} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={17} />Previous</button>
        <span className="text-xs font-medium text-stone-400">Page {navigation.index + 1} of {navigation.pages.length}</span>
        <button type="button" onClick={nextPage} disabled={navigation.index >= navigation.pages.length - 1} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={17} /></button>
      </nav>
      {view === "home" ? (
        <>
          <div className="rounded-[2rem] border border-white bg-white p-7 shadow-card sm:p-10">
            <p className="text-xs font-bold tracking-[0.16em] text-coral">OPENVEIN COMMUNITY</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Welcome, {user.full_name.split(" ")[0]}.</h1>
            <p className="mt-3 max-w-2xl leading-7 text-stone-600">Choose what you need today. We’ll connect blood requests with nearby compatible donors and keep you updated as donors respond.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-stone-600">
              <span className="rounded-full bg-cream px-3 py-1.5">{user.role === "both" ? "Choose what you need" : roleLabels[user.role]}</span>
              {user.blood_group && <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">Blood group {user.blood_group}</span>}
              {user.city && <span className="rounded-full bg-cream px-3 py-1.5">{user.city}</span>}
            </div>
          </div>
          <SharedLocationCard account={account} onUserUpdate={onUserUpdate} />
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <button onClick={() => navigateTo("need")} className="group rounded-[1.75rem] border border-white bg-white p-7 text-left shadow-card transition hover:-translate-y-1 hover:shadow-xl sm:p-9">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-coral"><Heart size={27} /></span>
              <h2 className="mt-6 font-display text-2xl font-extrabold">I need blood</h2>
              <p className="mt-2 leading-6 text-stone-500">Create a request and notify the closest eligible compatible donor. We’ll expand the search radius if needed.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-coral">Raise a blood request <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span>
            </button>
            <button onClick={() => navigateTo("donate")} className="group rounded-[1.75rem] border border-white bg-white p-7 text-left shadow-card transition hover:-translate-y-1 hover:shadow-xl sm:p-9">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><HeartHandshake size={27} /></span>
              <h2 className="mt-6 font-display text-2xl font-extrabold">I can donate</h2>
              <p className="mt-2 leading-6 text-stone-500">Set your blood group and last donation date to receive nearby requests. Your shared location is set above.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">View donation requests <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span>
            </button>
          </div>
          <RecoveryDetailsCard account={account} onUserUpdate={onUserUpdate} />
          <p className="mx-auto mt-7 max-w-3xl text-center text-xs leading-5 text-stone-500">The 90/120 day interval is an initial matching guide. It does not establish medical eligibility; the blood bank must screen and approve every donor.</p>
        </>
      ) : (
        <>
          <button onClick={() => navigateTo("home")} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-stone-500 hover:text-ink"><ArrowRight size={15} className="rotate-180" />Back to choices</button>
          {view === "need" ? <BloodNeedDashboard account={account} onChangeLocation={() => navigateTo("home")} /> : <DonorDashboard account={account} onUserUpdate={onUserUpdate} onChangeLocation={() => navigateTo("home")} />}
        </>
      )}
    </section>
  );
}

function SharedLocationCard({ account, onUserUpdate }) {
  const user = account.user;
  const [location, setLocation] = useSessionDraft(`openvein-draft-location-${user.id}`, {
    city: user.city ?? "",
    latitude: user.latitude ?? "",
    longitude: user.longitude ?? "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveLocation() {
    setError("");
    setNotice("");
    if (location.latitude === "" || location.longitude === "") {
      setError("Find and select an address or use device location before saving.");
      return;
    }
    setSaving(true);
    try {
      const updated = await authenticatedRequest(account, "/donor-profile", {
        method: "PUT",
        body: JSON.stringify({
          city: location.city.trim() || null,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          last_donation_date: account.user.last_donation_date ?? null,
        }),
      });
      onUserUpdate(updated);
      setNotice("Shared location saved. It will be used for donor matching and blood requests.");
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please try again." : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6 rounded-[1.75rem] border border-rose-100 bg-white p-6 shadow-card sm:p-8">
      <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-start">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-coral">SHARED LOCATION</p>
          <h2 className="mt-2 font-display text-xl font-extrabold">Set your location once</h2>
          <p className="mt-2 text-sm leading-6 text-stone-500">This location is used for both finding nearby donors and matching you with requests.</p>
          <p className="mt-3 text-xs text-stone-500">Currently saved: {user.city || (user.latitude != null && user.longitude != null ? "Device location" : "No location yet")}</p>
        </div>
        <div className="space-y-4">
          <LocationPicker
            account={account}
            city={user.city}
            onCityChange={(city) => setLocation((current) => ({ ...current, city }))}
            latitude={location.latitude}
            longitude={location.longitude}
            onCoordinatesChange={({ latitude, longitude }) => setLocation((current) => ({ ...current, latitude, longitude }))}
            idPrefix="shared"
          />
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
          <button type="button" onClick={saveLocation} disabled={saving} className="rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-60">{saving ? "Saving location..." : "Save shared location"}</button>
        </div>
      </div>
    </div>
  );
}

function RecoveryDetailsCard({ account, onUserUpdate }) {
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState({ date_of_birth: "", phone: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const user = await authenticatedRequest(account, "/recovery-details", {
        method: "PUT",
        body: JSON.stringify(details),
      });
      onUserUpdate(user);
      setNotice("Password recovery details updated.");
      setEditing(false);
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please try again." : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-stone-200/80 bg-white/80 p-5">
      {editing ? <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Date of birth" htmlFor="account_recovery_dob"><input id="account_recovery_dob" type="date" value={details.date_of_birth} onChange={(event) => setDetails((current) => ({ ...current, date_of_birth: event.target.value }))} required className="input" /></Field>
        <Field label="Phone number" htmlFor="account_recovery_phone"><input id="account_recovery_phone" type="tel" minLength={7} maxLength={30} value={details.phone} onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))} required className="input" /></Field>
        {error && <p role="alert" className="sm:col-span-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? "Saving..." : "Save details"}</button><button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-600">Cancel</button></div>
      </form> : <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">Password recovery</p><p className="mt-1 text-xs text-stone-500">Reset links are sent to your account email after verification.</p>{notice && <p role="status" className="mt-2 text-xs text-emerald-700">{notice}</p>}</div><button type="button" onClick={() => { setNotice(""); setEditing(true); }} className="text-sm font-semibold text-coral hover:text-rose-700">Update recovery details</button></div>}
    </div>
  );
}

async function authenticatedRequest(account, path, options = {}) {
  const response = await fetch(`${API_URL}/api/auth${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${account.token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Your sign-in has expired. Sign out and sign in again, then close the request.");
    }
    throw new Error(typeof result.detail === "string" ? result.detail : "Please try again.");
  }
  return result;
}

function locateUser() {
  return new Promise((resolve, reject) => {
    const localHosts = ["localhost", "127.0.0.1", "[::1]"];
    if (window.isSecureContext === false && !localHosts.includes(window.location.hostname)) {
      reject(new Error("Device location requires HTTPS. Open the app over HTTPS or use localhost during development."));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("This browser cannot access device location. Search by PIN code or address instead."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (geoError) => {
        const messages = {
          1: "Location permission is blocked. Allow location access for this site in your browser settings, then try again.",
          2: "Your device could not determine its location. Try again outdoors or search by PIN code or address.",
          3: "The device could not determine your location within 5 seconds. Check Location Services or search by PIN code or address.",
        };
        reject(new Error(messages[geoError.code] ?? "Location access failed. Allow browser location access or search by PIN code or address."));
      },
      // Prefer a location cached within the last two minutes and ask the browser
      // for a fast, low-accuracy fix rather than waiting on high-accuracy GPS.
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 120000 },
    );
  });
}

function LocationPicker({ account, city, onCityChange, latitude, longitude, onCoordinatesChange, idPrefix }) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [pinCode, setPinCode] = useState("");

  async function searchAddress() {
    setError("");
    setNotice("");
    setPlaces([]);
    if (!query.trim()) {
      await useCurrentLocation();
      return;
    }
    if (query.trim().length < 3) {
      setError("Enter at least 3 characters, such as a locality or landmark, then search.");
      return;
    }
    setSearching(true);
    try {
      const matches = await authenticatedRequest(account, `/location/geocode?query=${encodeURIComponent(query.trim())}`);
      setPlaces(matches);
      if (matches.length === 0) setNotice("No matching address found. Try a nearby landmark or PIN code.");
    } catch (err) {
      setError(err instanceof TypeError ? "Could not reach the address search service. Clear the address and try Find location to use your device location." : err.message);
    } finally {
      setSearching(false);
    }
  }

  async function searchPinCode() {
    setError("");
    setNotice("");
    setPlaces([]);
    if (!/^[1-9]\d{5}$/.test(pinCode.trim())) {
      setError("Enter a valid 6-digit Indian PIN code.");
      return;
    }
    setSearching(true);
    try {
      const matches = await authenticatedRequest(account, `/location/pincode?code=${encodeURIComponent(pinCode.trim())}`);
      setPlaces(matches);
      if (matches.length === 0) setNotice("No mapped location was found for this PIN code. Try an address or nearby landmark.");
    } catch (err) {
      setError(err instanceof TypeError ? "Could not reach the PIN code location service. Try again or search by address." : err.message);
    } finally {
      setSearching(false);
    }
  }

  async function useCurrentLocation() {
    setError("");
    setNotice("");
    setLocating(true);
    try {
      const coords = await locateUser();
      onCoordinatesChange({ latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) });
      onCityChange("");
      setQuery("");
      setPinCode("");
      setNotice("Device location found. Save the shared location to use it in both sections.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLocating(false);
    }
  }

  function selectPlace(place) {
    onCoordinatesChange({ latitude: place.latitude.toFixed(6), longitude: place.longitude.toFixed(6) });
    const summary = place.city || place.label.split(",")[0];
    onCityChange(summary);
    setQuery(place.label);
    setPinCode("");
    setPlaces([]);
    setNotice(`Location selected: ${place.label}. Save the shared location to use it in both sections.`);
    setError("");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Enter an address, locality, or landmark" htmlFor={`${idPrefix}_location_query`}>
          <input id={`${idPrefix}_location_query`} value={query} onChange={(event) => { setQuery(event.target.value); onCityChange(event.target.value); onCoordinatesChange({ latitude: "", longitude: "" }); setPlaces([]); }} maxLength={100} minLength={3} placeholder={city || "e.g. Civil Lines, Roorkee"} className="input" />
        </Field>
        <button type="button" disabled={searching || locating} onClick={searchAddress} className="inline-flex h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 hover:border-coral hover:text-coral disabled:opacity-50"><LocateFixed size={15} />{locating ? "Finding location..." : searching ? "Searching..." : "Find location"}</button>
      </div>
      {places.length > 0 && <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">{places.map((place) => <button key={`${place.latitude}-${place.longitude}`} type="button" onClick={() => selectPlace(place)} className="block w-full border-b border-stone-100 px-4 py-3 text-left text-sm text-stone-700 last:border-0 hover:bg-rose-50">{place.label}</button>)}</div>}
      {latitude !== "" && longitude !== "" && <p className="text-xs text-stone-500">A location point is selected.</p>}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {notice && <p role="status" className="text-xs text-stone-500">{notice}</p>}
      <div className="rounded-xl bg-cream px-4 py-3">
        <p className="text-xs font-semibold text-stone-600">Or find your location by 6-digit Indian PIN code</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="PIN code" htmlFor={`${idPrefix}_pincode`}>
            <input id={`${idPrefix}_pincode`} value={pinCode} onChange={(event) => { setPinCode(event.target.value.replace(/\D/g, "").slice(0, 6)); onCoordinatesChange({ latitude: "", longitude: "" }); setPlaces([]); }} inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="e.g. 247667" className="input" />
          </Field>
          <button type="button" disabled={searching || locating} onClick={searchPinCode} className="inline-flex h-[44px] items-center justify-center rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 hover:border-coral hover:text-coral disabled:opacity-50">{searching ? "Searching..." : "Find PIN code"}</button>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-stone-400">PIN codes can cover several post offices. Choose the result matching your locality; the location is approximate.</p>
      </div>
      <p className="text-[11px] leading-4 text-stone-400">Address search sends the text you enter to OpenStreetMap. <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors</a></p>
    </div>
  );
}

function BloodNeedDashboard({ account, onChangeLocation }) {
  const [draft, setDraft] = useSessionDraft(`openvein-draft-need-${account.user.id}`, {
    bloodGroup: "",
    hospital: "",
    units: "1",
    message: "",
  });
  const { bloodGroup, hospital, units, message } = draft;
  const city = account.user.city ?? "";
  const latitude = account.user.latitude ?? "";
  const longitude = account.user.longitude ?? "";
  const [needs, setNeeds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fallbackBusy, setFallbackBusy] = useState(false);

  async function refreshNeeds() {
    setNeeds(await authenticatedRequest(account, "/blood-needs"));
  }

  useEffect(() => {
    refreshNeeds().catch((err) => setError(err.message));
    const interval = window.setInterval(() => refreshNeeds().catch(() => {}), 15000);
    return () => window.clearInterval(interval);
  }, [account.token]);

  async function submitNeed(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (latitude === "" || longitude === "") {
      setError("Set and save your shared location before creating a blood request.");
      return;
    }
    setBusy(true);
    try {
      const result = await authenticatedRequest(account, "/blood-needs", {
        method: "POST",
        body: JSON.stringify({
          blood_group: bloodGroup,
          city: city.trim() || null,
          latitude: Number(latitude),
          longitude: Number(longitude),
          hospital: hospital.trim() || null,
          units: Number(units),
          message: message.trim() || null,
        }),
      });
      setNotice(result.donor_name
        ? `Request ${result.reference_code} created. ${result.donor_name} is the closest match at ${result.distance_km} km; the search started at ${result.search_radius_km} km.`
        : `Request ${result.reference_code} created. No eligible compatible donor was found within 15 km yet. Your request is saved so you can track it.`);
      await refreshNeeds();
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please try again." : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function chooseFallback(need, choice) {
    setFallbackBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await authenticatedRequest(account, `/blood-needs/${need.reference_code}/fallback`, {
        method: "POST", body: JSON.stringify({ choice }),
      });
      setNotice(`${choice === "universal" ? "O− universal red-cell donor" : "Next-city compatible donor"} search started for ${result.reference_code}.`);
      await refreshNeeds();
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please try again." : err.message);
    } finally { setFallbackBusy(false); }
  }

  async function closeNeed(need) {
    setError(""); setNotice(""); setFallbackBusy(true);
    const previousNeeds = needs;
    setNeeds((current) => current.map((item) => item.reference_code === need.reference_code
      ? { ...item, status: "cancelled", invitations: item.invitations.map((invitation) => ["pending", "queued", "available", "accepted"].includes(invitation.status) ? { ...invitation, status: "closed" } : invitation) }
      : item));
    try {
      const result = await authenticatedRequest(account, `/blood-needs/${need.reference_code}/close`, { method: "POST" });
      if (result.status !== "cancelled") throw new Error("The server did not confirm that this request was closed.");
      setNotice(`Request ${need.reference_code} was closed. You can create a new request now.`);
      refreshNeeds().catch(() => {});
    } catch (err) {
      setNeeds(previousNeeds);
      setError(err instanceof TypeError ? "We couldn't reach the server. The request was not closed; check that the backend is running and try again." : err.message);
    }
    finally { setFallbackBusy(false); }
  }

  const hasActiveNeed = needs.some((need) => ["open", "unmatched", "matched"].includes(need.status));
  const activeNeeds = needs.filter((need) => ["open", "unmatched", "matched"].includes(need.status));
  const historyNeeds = needs.filter((need) => !["open", "unmatched", "matched"].includes(need.status));

  return (
    <div className="rounded-[2rem] border border-white bg-white p-6 shadow-card sm:p-9">
      <div className="max-w-2xl">
        <p className="text-xs font-bold tracking-[0.16em] text-coral">REQUEST BLOOD</p>
        <h2 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">Tell us what’s needed</h2>
        <p className="mt-2 leading-6 text-stone-500">OpenVein checks compatible donors within 5 km, then expands to 10 km and 15 km. One donor is notified at a time; if they decline or don’t respond within five minutes, the next closest donor is contacted.</p>
      </div>
      <form onSubmit={submitNeed} className="mt-7 grid gap-4 sm:grid-cols-2">
        <Field label="Blood group needed" htmlFor="need_blood_group"><select id="need_blood_group" value={bloodGroup} onChange={(e) => setDraft((current) => ({ ...current, bloodGroup: e.target.value }))} required className="input"><option value="">Choose blood group</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></Field>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3"><p className="text-sm text-stone-600">Shared location: <span className="font-semibold">{city || (latitude !== "" ? "Device location" : "Not set")}</span></p><button type="button" onClick={onChangeLocation} className="text-sm font-semibold text-coral hover:text-rose-700">Change shared location</button></div>
        <Field label="Hospital or care center (optional)" htmlFor="need_hospital"><input id="need_hospital" value={hospital} onChange={(e) => setDraft((current) => ({ ...current, hospital: e.target.value }))} maxLength={160} placeholder="Hospital name" className="input" /></Field>
        <Field label="Units needed" htmlFor="need_units"><input id="need_units" type="number" min="1" max="10" value={units} onChange={(e) => setDraft((current) => ({ ...current, units: e.target.value }))} required className="input" /></Field>
        <div className="sm:col-span-2"><Field label="Note for the donor (optional)" htmlFor="need_message"><textarea id="need_message" rows={3} maxLength={500} value={message} onChange={(e) => setDraft((current) => ({ ...current, message: e.target.value }))} placeholder="Add any details that could help the donor respond" className="input resize-y" /></Field></div>
        {hasActiveNeed && <p className="sm:col-span-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">You already have an active request. Track it below; you can create another after it is completed.</p>}
        <button disabled={busy || hasActiveNeed} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-coral px-5 py-3.5 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60"><Send size={16} />{busy ? "Finding a donor..." : hasActiveNeed ? "Active request already exists" : "Create blood request"}</button>
      </form>
      <div className="mt-9 border-t border-stone-100 pt-6">
        <h3 className="font-display text-xl font-extrabold">LIVE INBOX · Your request history</h3>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        {activeNeeds.length === 0 ? <p className="mt-3 text-sm text-stone-500">No active blood requests. Closed requests remain in your history below.</p> : <div className="mt-4 space-y-3">{activeNeeds.map((need) => <article key={need.reference_code} className="rounded-2xl bg-cream p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold tracking-wide text-coral">{need.reference_code}</p><p className="mt-1 font-bold">{need.blood_group} · {need.city || "Nearby location"}{need.hospital ? ` · ${need.hospital}` : ""}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold capitalize text-stone-600">{need.status}</span></div>
          <div className="mt-3 space-y-2">{need.invitations.map((invitation, index) => <div key={`${need.reference_code}-${index}`} className="rounded-xl bg-white p-3 text-sm text-stone-600"><p className="flex flex-wrap items-center justify-between gap-2"><span>{invitation.donor_name} · {invitation.distance_km} km ({invitation.radius_km} km range){invitation.matching_mode === "universal" ? " · O− fallback" : invitation.matching_mode === "next_city" ? " · next city" : ""}</span><span className="font-semibold capitalize">{invitation.status}{invitation.status === "available" ? ` · ${[invitation.donor_phone, invitation.donor_email].filter(Boolean).join(" · ")}` : ""}</span></p>{invitation.medical_feedback_shared && <p className="mt-2 border-t pt-2 text-xs">Donor self-report: blood-bank screening <strong>{(invitation.medical_screening_status || "not provided").replaceAll("_", " ")}</strong>; reports a medical background concern: <strong>{invitation.medical_background_concern ? "yes" : "no"}</strong>. A blood bank must make the final eligibility decision.</p>}</div>)}</div>
          {["open", "unmatched", "matched"].includes(need.status) && <button type="button" disabled={fallbackBusy} onClick={() => closeNeed(need)} className="mt-4 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 disabled:opacity-50">{fallbackBusy ? "Closing request..." : "Close this request"}</button>}
          {need.status === "unmatched" && (need.universal_option_available || need.next_city_option_available) && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">No local compatible donor was found. Choose another search:</p><div className="mt-3 flex flex-wrap gap-2">{need.universal_option_available && <button disabled={fallbackBusy} onClick={() => chooseFallback(need, "universal")} className="rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Search O− donors within 50 km</button>}{need.next_city_option_available && <button disabled={fallbackBusy} onClick={() => chooseFallback(need, "next_city")} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50">Search compatible donors in nearby cities</button>}</div><p className="mt-2 text-xs text-amber-800">O− can donate red cells to all ABO/Rh groups, but a blood bank must confirm compatibility and cross-match before transfusion.</p></div>}
        </article>)}</div>}
        {historyNeeds.length > 0 && <div className="mt-6 border-t border-stone-200 pt-5"><h4 className="font-display text-lg font-bold">Request history</h4><div className="mt-3 space-y-3">{historyNeeds.map((need) => <article key={need.reference_code} className="rounded-2xl bg-cream p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold tracking-wide text-coral">{need.reference_code}</p><p className="mt-1 font-semibold">{need.blood_group} · {need.city || "Nearby location"}{need.hospital ? ` · ${need.hospital}` : ""}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold capitalize">{need.status}</span></div><div className="mt-3 space-y-2">{need.invitations.map((invitation, index) => <p key={`${need.reference_code}-history-${index}`} className="flex flex-wrap justify-between gap-2 rounded-xl bg-white p-3 text-sm text-stone-600"><span>{invitation.donor_name}</span><span className="font-semibold capitalize">{invitation.status.replaceAll("_", " ")}</span></p>)}</div></article>)}</div></div>}
      </div>
      <p className="mt-6 text-xs leading-5 text-stone-500">Compatibility and donation interval are preliminary filters. A licensed blood bank must confirm the blood type, donor’s health, and cross-match before transfusion.</p>
    </div>
  );
}

function DonorDashboard({ account, onUserUpdate, onChangeLocation }) {
  const user = account.user;
  const [profile, setProfile] = useSessionDraft(`openvein-draft-donor-${user.id}`, {
    blood_group: user.blood_group ?? "",
    gender: user.gender ?? "",
    last_donation_date: user.last_donation_date ?? "",
  });
  const [invitations, setInvitations] = useState([]);
  const [createdRequests, setCreatedRequests] = useState([]);
  const [createdRequestsError, setCreatedRequestsError] = useState("");
  const [confirmations, setConfirmations] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [medicalForms, setMedicalForms] = useState({});

  async function refreshInbox() {
    const [inboxResult, createdResult] = await Promise.allSettled([
      authenticatedRequest(account, "/donor-invitations"),
      authenticatedRequest(account, "/blood-needs"),
    ]);
    if (inboxResult.status === "fulfilled") setInvitations(inboxResult.value);
    if (createdResult.status === "fulfilled") {
      setCreatedRequests(createdResult.value);
      setCreatedRequestsError("");
    } else {
      setCreatedRequestsError(createdResult.reason.message || "Could not load requests for this account.");
    }
    const failure = [inboxResult, createdResult].find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }

  useEffect(() => {
    refreshInbox().catch((err) => setError(err.message));
    const interval = window.setInterval(() => refreshInbox().catch(() => {}), 10000);
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") refreshInbox().catch(() => {});
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [account.token]);

  function updateProfileField(event) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const updated = await authenticatedRequest(account, "/donor-profile", {
        method: "PUT",
        body: JSON.stringify({
          blood_group: profile.blood_group || null,
          gender: profile.gender || null,
          last_donation_date: profile.last_donation_date || null,
        }),
      });
      onUserUpdate(updated);
      setNotice("Donor profile saved. You can now be matched with requests near you.");
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please try again." : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function respond(invitation, response) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = await authenticatedRequest(account, `/donor-invitations/${invitation.id}/respond`, {
        method: "POST",
        body: JSON.stringify({
          response,
          eligibility_confirmed: response === "available" && (confirmations[invitation.id] ?? false),
        }),
      });
      const recipientContact = [result.recipient_phone, result.recipient_email].filter(Boolean).join(" · ");
      setNotice(recipientContact ? `${result.message} Recipient contact: ${recipientContact}` : result.message);
      if (response === "available") {
        setInvitations((current) => current.map((item) => item.id === invitation.id
          ? { ...item, status: "available", recipient_phone: result.recipient_phone }
          : item));
      }
      await refreshInbox();
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please try again." : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function completeDonation(invitation) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const updatedUser = await authenticatedRequest(account, `/donor-invitations/${invitation.id}/complete`, { method: "POST" });
      onUserUpdate(updatedUser);
      setProfile((current) => ({ ...current, last_donation_date: updatedUser.last_donation_date ?? "" }));
      setNotice("Donation marked complete. Your last donation date was updated.");
      await refreshInbox();
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please try again." : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveMedicalFeedback(invitation) {
    const form = medicalForms[invitation.id] || {};
    setError(""); setNotice(""); setBusy(true);
    try {
      await authenticatedRequest(account, `/donor-invitations/${invitation.id}/medical-feedback`, {
        method: "PUT",
        body: JSON.stringify({ screening_status: form.screening_status || invitation.medical_screening_status || "not_scheduled", background_concern: form.background_concern ?? invitation.medical_background_concern ?? false, share_with_acceptor: form.share_with_acceptor ?? invitation.medical_feedback_shared ?? false }),
      });
      setNotice("Your donor feedback has been saved.");
      await refreshInbox();
    } catch (err) { setError(err instanceof TypeError ? "We couldn't reach the server. Please try again." : err.message); }
    finally { setBusy(false); }
  }

  const hasActiveAcceptance = invitations.some((invitation) => ["available", "accepted"].includes(invitation.status));
  const liveInvitations = invitations.filter((invitation) => ["pending", "available", "accepted"].includes(invitation.status));
  const pastInvitations = invitations.filter((invitation) => !["pending", "available", "accepted"].includes(invitation.status));

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-white bg-white p-6 shadow-card sm:p-9">
        <p className="text-xs font-bold tracking-[0.16em] text-emerald-700">DONOR PROFILE</p>
        <h2 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">Set up nearby matching</h2>
        <p className="mt-2 max-w-2xl leading-6 text-stone-500">Your approximate location helps us rank nearby requests. Add your last whole-blood donation date so we can apply the correct interval before sending invitations.</p>
        <form onSubmit={saveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Your blood group" htmlFor="donor_blood_group"><select id="donor_blood_group" name="blood_group" value={profile.blood_group} onChange={updateProfileField} required className="input"><option value="">Choose blood group</option>{bloodGroups.map((group) => <option key={group}>{group}</option>)}</select></Field>
          <Field label="Gender for interval guidance" htmlFor="donor_gender"><select id="donor_gender" name="gender" value={profile.gender} onChange={updateProfileField} className="input"><option value="">Prefer not to provide</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></Field>
          <Field label="Last whole-blood donation (leave blank if none)" htmlFor="donor_last_donation"><input id="donor_last_donation" name="last_donation_date" type="date" max={new Date().toISOString().slice(0, 10)} value={profile.last_donation_date} onChange={updateProfileField} className="input" /></Field>
          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream px-4 py-3"><p className="text-sm text-stone-600">Shared location: <span className="font-semibold">{user.city || (user.latitude != null ? "Device location" : "Not set")}</span></p><button type="button" onClick={onChangeLocation} className="text-sm font-semibold text-coral hover:text-rose-700">Change shared location</button></div>
          {error && <p role="alert" className="sm:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="sm:col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
          <button disabled={busy} className="sm:col-span-2 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white hover:bg-stone-700 disabled:opacity-60">{busy ? "Saving..." : "Save donor profile"}</button>
        </form>
      </div>

      {(user.last_donation_date || profile.last_donation_date) && <DonationCooldownCard lastDonationDate={user.last_donation_date || profile.last_donation_date} gender={profile.gender || user.gender} />}

      <div className="rounded-[2rem] border border-white bg-white p-6 shadow-card sm:p-9">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.16em] text-coral">YOUR ACTIVITY</p><h2 className="mt-2 font-display text-2xl font-extrabold">Blood requests you created</h2><p className="mt-1 text-xs text-stone-500">Signed in as {user.email}; only requests from this account appear here.</p></div><button type="button" onClick={() => refreshInbox().catch((err) => setError(err.message))} className="text-xs font-semibold text-coral hover:text-rose-700">Refresh requests</button></div>
        {createdRequestsError && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{createdRequestsError}</p>}
        {createdRequests.length === 0 ? <p className="mt-5 rounded-xl bg-cream p-4 text-sm text-stone-500">Requests you submit from “I need blood” appear here. Saving your donor profile prepares you to receive matching requests; those appear in “Donation requests near you” below.</p> : <div className="mt-5 space-y-3">{createdRequests.map((need) => <article key={need.reference_code} className="rounded-2xl border border-stone-100 bg-cream/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold tracking-wide text-coral">{need.reference_code}</p><h3 className="mt-1 font-bold">{need.blood_group} · {need.city || "Nearby location"}{need.hospital ? ` · ${need.hospital}` : ""}</h3></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold capitalize text-stone-600">{need.status}</span></div>
          <p className="mt-2 text-sm text-stone-600">{need.units} unit{need.units === 1 ? "" : "s"} requested</p>
          {need.invitations.length > 0 && <div className="mt-3 space-y-2 border-t border-stone-200 pt-3">{need.invitations.map((invitation, index) => <p key={`${need.reference_code}-${index}`} className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600"><span>{invitation.donor_name} · {invitation.distance_km} km</span><span className="font-semibold capitalize">{invitation.status}{invitation.status === "available" ? ` · ${[invitation.donor_phone, invitation.donor_email].filter(Boolean).join(" · ")}` : ""}</span></p>)}</div>}
        </article>)}</div>}
      </div>

      <div className="rounded-[2rem] border border-white bg-white p-6 shadow-card sm:p-9">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.16em] text-coral">LIVE INBOX</p><h2 className="mt-2 font-display text-2xl font-extrabold">Donation requests near you</h2></div><span className="text-xs text-stone-400">Updates every 10 seconds</span></div>
        {liveInvitations.length === 0 ? <p className="mt-5 rounded-xl bg-cream p-4 text-sm text-stone-500">No live donation requests. Past responses and completed donations are listed in your history below.</p> : <div className="mt-5 space-y-4">{liveInvitations.map((invitation) => <article key={invitation.id} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-wide text-coral">{invitation.reference_code}{invitation.matching_mode === "universal" ? " · O− universal red-cell fallback" : invitation.matching_mode === "next_city" ? " · next-city search" : ""}</p><h3 className="mt-1 text-lg font-extrabold">{invitation.blood_group} blood requested</h3><p className="mt-1 text-sm text-stone-700">Requested by <span className="font-semibold">{invitation.recipient_name}</span></p><p className="mt-1 text-sm text-stone-600">{invitation.distance_km} km away · {invitation.city || "Nearby"}{invitation.hospital ? ` · ${invitation.hospital}` : ""}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{invitation.units} unit{invitation.units === 1 ? "" : "s"}</span><span className="rounded-full bg-white px-3 py-1 text-xs font-bold capitalize">{invitation.status.replaceAll("_", " ")}</span></div></div>
          {invitation.message && <p className="mt-3 text-sm leading-6 text-stone-600">{invitation.message}</p>}
          {["available", "completed"].includes(invitation.status) && <p className="mt-3 rounded-xl bg-white p-3 text-sm text-stone-700">Acceptor contact: {invitation.recipient_phone ? <a className="font-semibold text-coral underline" href={`tel:${invitation.recipient_phone}`}>{invitation.recipient_phone}</a> : "No phone number was provided."}</p>}
          {invitation.status === "pending" && invitation.eligibility_confirmation_required && <label className="mt-4 flex items-start gap-2 rounded-xl bg-white p-3 text-xs leading-5 text-stone-600"><input type="checkbox" checked={confirmations[invitation.id] ?? false} onChange={(event) => setConfirmations((current) => ({ ...current, [invitation.id]: event.target.checked }))} className="mt-1 accent-rose-600" /><span>We don’t have a complete donation date record for you. I confirm I meet the applicable whole-blood interval (90 days for males, 120 days for females) and will follow the blood bank’s screening advice.</span></label>}
          {invitation.status === "pending" ? <><p className="mt-3 text-xs leading-5 text-stone-500">Your phone number is shared with the acceptor if you mark yourself available. The blood bank makes the final eligibility decision.</p>{hasActiveAcceptance && <p className="mt-3 text-xs font-semibold text-amber-800">You already accepted another request. Complete it before accepting another.</p>}<div className="mt-4 flex flex-wrap gap-2"><button disabled={busy || hasActiveAcceptance || (invitation.eligibility_confirmation_required && !(confirmations[invitation.id] ?? false))} onClick={() => respond(invitation, "available")} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">I’m available</button><button disabled={busy} onClick={() => respond(invitation, "not_available")} className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 disabled:opacity-50">Not available</button><button disabled={busy} onClick={() => respond(invitation, "not_eligible")} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-50">Not eligible</button></div></> : invitation.status === "available" ? <><p className="mt-3 text-xs font-semibold text-emerald-800">You accepted this request and marked yourself available. This stays in your inbox as your active donation.</p><div className="mt-4 rounded-xl bg-white p-4"><h4 className="text-sm font-bold">Medical screening and background feedback</h4><p className="mt-1 text-xs leading-5 text-stone-500">Self-report only; don’t enter diagnoses or test results. The blood bank decides donor eligibility. If you consent, the acceptor sees this summary.</p><label className="mt-3 block text-xs font-semibold">Blood-bank screening status<select value={medicalForms[invitation.id]?.screening_status ?? invitation.medical_screening_status ?? "not_scheduled"} onChange={(e) => setMedicalForms((current) => ({ ...current, [invitation.id]: { ...current[invitation.id], screening_status: e.target.value } }))} className="input mt-1"><option value="not_scheduled">Not scheduled</option><option value="scheduled">Scheduled</option><option value="awaiting_results">Awaiting blood-bank decision</option><option value="cleared_by_blood_bank">Blood bank told me I’m cleared</option><option value="not_cleared">Blood bank told me I’m not cleared</option></select></label><label className="mt-3 flex items-start gap-2 text-xs leading-5 text-stone-600"><input type="checkbox" checked={medicalForms[invitation.id]?.background_concern ?? invitation.medical_background_concern ?? false} onChange={(e) => setMedicalForms((current) => ({ ...current, [invitation.id]: { ...current[invitation.id], background_concern: e.target.checked } }))} className="mt-1 accent-rose-600" /><span>I have a medical or medication concern I plan to discuss with the blood bank before donating.</span></label><label className="mt-3 flex items-start gap-2 text-xs leading-5 text-stone-600"><input type="checkbox" checked={medicalForms[invitation.id]?.share_with_acceptor ?? invitation.medical_feedback_shared ?? false} onChange={(e) => setMedicalForms((current) => ({ ...current, [invitation.id]: { ...current[invitation.id], share_with_acceptor: e.target.checked } }))} className="mt-1 accent-rose-600" /><span>I consent to share this screening status and concern summary with the acceptor.</span></label><button type="button" disabled={busy} onClick={() => saveMedicalFeedback(invitation)} className="mt-3 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save medical feedback</button></div><button type="button" disabled={busy} onClick={() => completeDonation(invitation)} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Updating..." : "Mark donation complete"}</button></> : invitation.status === "completed" ? <><p className="mt-3 text-xs font-semibold text-stone-600">Donation marked complete. This request is kept in your activity history.</p>{invitation.medical_feedback_shared && <p className="mt-2 text-xs text-stone-600">Your shared feedback: {(invitation.medical_screening_status || "not provided").replaceAll("_", " ")}; medical concern {invitation.medical_background_concern ? "reported" : "not reported"}.</p>}</> : <p className="mt-3 text-xs text-stone-600">Your response: <span className="font-semibold capitalize">{invitation.status.replaceAll("_", " ")}</span>. This request remains in your activity history.</p>}
        </article>)}</div>}
        {pastInvitations.length > 0 && <div className="mt-6 border-t border-stone-100 pt-5"><h3 className="font-display text-xl font-extrabold">Request history</h3><div className="mt-4 space-y-3">{pastInvitations.map((invitation) => <article key={invitation.id} className="rounded-2xl bg-cream p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold tracking-wide text-coral">{invitation.reference_code}</p><p className="mt-1 font-semibold">{invitation.blood_group} · {invitation.city || "Nearby"} · {invitation.recipient_name}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold capitalize">{invitation.status.replaceAll("_", " ")}</span></div><p className="mt-2 text-xs text-stone-500">{invitation.status === "completed" ? "Donation completed." : invitation.status === "closed" ? "Request closed by the acceptor." : `Your response: ${invitation.status.replaceAll("_", " ")}.`}</p></article>)}</div></div>}
      </div>
    </div>
  );
}

function DonationCooldownCard({ lastDonationDate, gender }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const requiredDays = gender === "female" ? 120 : 90;
  const donatedAt = new Date(`${lastDonationDate}T00:00:00`);
  const nextDate = new Date(donatedAt);
  nextDate.setDate(nextDate.getDate() + requiredDays);
  const remainingMs = Math.max(0, nextDate.getTime() - now);
  const days = Math.floor(remainingMs / 86400000);
  const hours = Math.floor((remainingMs % 86400000) / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  const elapsed = Math.min(requiredDays, Math.max(0, requiredDays - Math.ceil(remainingMs / 86400000)));
  const progress = Math.round((elapsed / requiredDays) * 100);
  const formattedDate = Number.isNaN(nextDate.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(nextDate);

  if (Number.isNaN(donatedAt.getTime())) return null;

  return (
    <section className="rounded-[2rem] border border-emerald-100 bg-emerald-50/70 p-6 shadow-card sm:p-8" aria-live="polite">
      <p className="text-xs font-bold tracking-[0.16em] text-emerald-800">DONATION COUNTDOWN</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-extrabold">{remainingMs > 0 ? "Time until your next matching interval" : "Donation interval complete"}</h2>
          <p className="mt-1 text-sm text-stone-600">Based on your recorded donation date: {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(donatedAt)}. Next interval date: {formattedDate}.</p>
        </div>
        {remainingMs > 0 ? <div className="flex gap-2 text-center">{[[days, "days"], [hours, "hrs"], [minutes, "min"], [seconds, "sec"]].map(([value, label]) => <div key={label} className="min-w-14 rounded-xl bg-white px-2 py-2"><p className="text-xl font-extrabold tabular-nums text-emerald-800">{String(value).padStart(2, "0")}</p><p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{label}</p></div>)}</div> : <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-800">Ready for matching review</span>}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${progress}%` }} /></div>
      <p className="mt-2 text-xs leading-5 text-stone-500">The countdown follows the app’s matching interval (90 days for male donors, 120 days for female donors). It is not medical clearance; the blood bank makes the final eligibility decision.</p>
    </section>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-coral">{icon}</span>
      <span className="text-stone-500">{label}</span>
      <span className="ml-auto font-semibold text-ink">{value}</span>
    </div>
  );
}

export default App;
