import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Heart,
  HeartHandshake,
  LockKeyhole,
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
  role: "donor",
  blood_group: "",
  date_of_birth: "",
  phone: "",
  city: "",
};

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
                blood_group: form.blood_group || null,
                city: form.city || null,
              }
            : { email: form.email, password: form.password };
      const response = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Please check your details and try again.",
        );
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

  function signOut() {
    localStorage.removeItem("openvein-account");
    setAccount(null);
    setForm(initialForm);
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
      </header>

      {account ? (
        <Welcome account={account} onSignOut={signOut} />
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
                          required
                          className="input"
                        />
                      </Field>
                      <Field label="I’m here as a..." htmlFor="role">
                        <div className="relative">
                          <select
                            id="role"
                            name="role"
                            value={form.role}
                            onChange={updateField}
                            className="input appearance-none pr-10"
                          >
                            <option value="donor">Donor — I’d like to give blood</option>
                            <option value="recipient">Recipient — I’m looking for support</option>
                            <option value="both">Both — I’m open to either</option>
                          </select>
                          <ChevronDown
                            size={17}
                            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                          />
                        </div>
                      </Field>
                      {(form.role === "donor" || form.role === "both") && (
                        <Field label="Blood group" htmlFor="blood_group">
                          <div className="relative">
                            <select
                              id="blood_group"
                              name="blood_group"
                              value={form.blood_group}
                              onChange={updateField}
                              className="input appearance-none pr-10"
                            >
                              <option value="">Choose your blood group (optional)</option>
                              {bloodGroups.map((group) => (
                                <option key={group} value={group}>
                                  {group}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              size={17}
                              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                            />
                          </div>
                        </Field>
                      )}
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
                      <Field label="City (optional)" htmlFor="city">
                          <input
                            id="city"
                            name="city"
                            value={form.city}
                            onChange={updateField}
                            placeholder="Your city"
                            autoComplete="address-level2"
                            maxLength={100}
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

function Welcome({ account, onSignOut }) {
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [recoveryDetails, setRecoveryDetails] = useState({
    date_of_birth: "",
    phone: "",
  });
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [savingRecoveryDetails, setSavingRecoveryDetails] = useState(false);
  const user = account.user;
  const roleLabels = {
    donor: "Donor",
    recipient: "Recipient",
    both: "Donor & recipient",
  };

  async function saveRecoveryDetails(event) {
    event.preventDefault();
    setRecoveryError("");
    setRecoveryMessage("");
    setSavingRecoveryDetails(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/recovery-details`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${account.token}`,
        },
        body: JSON.stringify(recoveryDetails),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Please check your details and try again.",
        );
      }
      setRecoveryMessage("Your recovery details have been updated.");
      setShowRecoveryForm(false);
    } catch (requestError) {
      setRecoveryError(
        requestError instanceof TypeError
          ? "We couldn't reach the server. Please try again."
          : requestError.message,
      );
    } finally {
      setSavingRecoveryDetails(false);
    }
  }

  return (
    <section className="relative mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <div className="rounded-[2rem] border border-white bg-white p-8 text-center shadow-card sm:p-12">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-rose-50 text-coral">
          <CheckCircle2 size={32} />
        </span>
        <p className="mt-6 text-sm font-bold tracking-wide text-coral">YOU’RE IN</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Welcome, {user.full_name.split(" ")[0]}.
        </h1>
        <p className="mx-auto mt-3 max-w-md leading-7 text-stone-600">
          Your account is ready. Thank you for being part of a community that shows up for one
          another.
        </p>
        <div className="mx-auto mt-8 grid max-w-md gap-3 rounded-2xl bg-cream p-5 text-left">
          <InfoRow icon={<UsersRound size={17} />} label="Community role" value={roleLabels[user.role]} />
          {user.blood_group && (
            <InfoRow icon={<Heart size={17} />} label="Blood group" value={user.blood_group} />
          )}
          {user.city && <InfoRow icon={<MapPin size={17} />} label="City" value={user.city} />}
          <InfoRow icon={<Check size={17} />} label="Account" value="Created successfully" />
        </div>
        <p className="mt-5 text-xs leading-5 text-stone-500">
          Your contact details are not shown publicly. Please use a qualified healthcare provider
          for medical guidance.
        </p>
        <div className="mx-auto mt-6 max-w-md">
          {recoveryMessage && (
            <p role="status" className="mb-3 text-sm text-emerald-700">
              {recoveryMessage}
            </p>
          )}
          {showRecoveryForm ? (
            <form onSubmit={saveRecoveryDetails} className="space-y-4 rounded-2xl bg-cream p-5 text-left">
              <p className="text-sm leading-5 text-stone-600">
                These details help verify a reset request. A one-time link will still be sent to
                your email.
              </p>
              <Field label="Date of birth" htmlFor="recovery_date_of_birth">
                <input
                  id="recovery_date_of_birth"
                  name="date_of_birth"
                  type="date"
                  value={recoveryDetails.date_of_birth}
                  onChange={(event) =>
                    setRecoveryDetails((current) => ({
                      ...current,
                      date_of_birth: event.target.value,
                    }))
                  }
                  required
                  className="input"
                />
              </Field>
              <Field label="Phone number" htmlFor="recovery_phone">
                <input
                  id="recovery_phone"
                  name="phone"
                  type="tel"
                  value={recoveryDetails.phone}
                  onChange={(event) =>
                    setRecoveryDetails((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  minLength={7}
                  maxLength={30}
                  required
                  className="input"
                />
              </Field>
              {recoveryError && (
                <p role="alert" className="text-sm text-red-700">
                  {recoveryError}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={savingRecoveryDetails}
                  className="rounded-xl bg-coral px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
                >
                  {savingRecoveryDetails ? "Saving..." : "Save details"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryForm(false);
                    setRecoveryError("");
                  }}
                  className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRecoveryMessage("");
                setShowRecoveryForm(true);
              }}
              className="text-sm font-semibold text-coral transition hover:text-rose-700"
            >
              Add or update password recovery details
            </button>
          )}
        </div>
        <button
          onClick={onSignOut}
          className="mt-7 text-sm font-semibold text-stone-500 underline decoration-stone-300 underline-offset-4 transition hover:text-ink"
        >
          Sign out
        </button>
      </div>
      {(user.role === "recipient" || user.role === "both") && (
        <BloodRequestDashboard account={account} />
      )}
      {(user.role === "donor" || user.role === "both") && (
        <DonorRequestInbox account={account} />
      )}
    </section>
  );
}

function BloodRequestDashboard({ account }) {
  const [bloodGroup, setBloodGroup] = useState("");
  const [city, setCity] = useState(account.user.city ?? "");
  const [hospital, setHospital] = useState("");
  const [units, setUnits] = useState("1");
  const [message, setMessage] = useState("");
  const [donors, setDonors] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function api(path, options = {}) {
    const response = await fetch(`${API_URL}/api/auth${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${account.token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Please try again.");
    return result;
  }

  async function searchDonors(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setDonors([]);
    setHasSearched(true);
    setBusy(true);
    try {
      const params = new URLSearchParams({ blood_group: bloodGroup });
      if (city.trim()) params.set("city", city.trim());
      setDonors(await api(`/donors?${params}`));
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please try again." : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendRequest(donor) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await api(`/blood-requests/${donor.id}`, {
        method: "POST",
        body: JSON.stringify({ blood_group: bloodGroup, city: city.trim(), hospital: hospital.trim() || null, units: Number(units), message: message.trim() || null }),
      });
      setNotice(`Your request was sent to ${donor.full_name}.`);
      setRequests(await api("/blood-requests"));
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please try again." : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-[2rem] border border-white bg-white p-6 shadow-card sm:p-9">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-coral"><Heart size={22} /></span>
        <p className="mt-4 text-xs font-bold tracking-[0.16em] text-coral">FIND A DONOR</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight">Request blood from a compatible donor</h2>
        <p className="mt-2 text-sm leading-6 text-stone-500">Choose the patient’s blood group and city. We’ll show donors whose blood type may be compatible.</p>
      </div>

      <form onSubmit={searchDonors} className="mx-auto mt-7 grid max-w-3xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Blood group needed" htmlFor="request_blood_group">
          <select id="request_blood_group" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} required className="input">
            <option value="">Choose blood group</option>
            {bloodGroups.map((group) => <option key={group} value={group}>{group}</option>)}
          </select>
        </Field>
        <Field label="City" htmlFor="request_city">
          <input id="request_city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City to search" minLength={2} maxLength={100} required className="input" />
        </Field>
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-coral px-5 py-3 text-sm font-bold text-white transition hover:bg-rose-600 disabled:opacity-60"><Search size={16} /> Find donors</button>
      </form>

      {donors.length > 0 && (
        <div className="mx-auto mt-8 max-w-3xl">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="Hospital or care center (optional)" htmlFor="request_hospital"><input id="request_hospital" value={hospital} onChange={(e) => setHospital(e.target.value)} maxLength={160} placeholder="Where blood is needed" className="input" /></Field>
            <Field label="Units needed" htmlFor="request_units"><input id="request_units" type="number" min="1" max="10" value={units} onChange={(e) => setUnits(e.target.value)} required className="input" /></Field>
          </div>
          <Field label="Message to donor (optional)" htmlFor="request_message"><textarea id="request_message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={2} placeholder="Share any helpful details" className="input resize-y" /></Field>
          <h3 className="mb-3 mt-6 text-sm font-bold text-ink">Compatible donors in {city}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {donors.map((donor) => <div key={donor.id} className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-cream/70 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-100 font-display font-extrabold text-coral">{donor.blood_group}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{donor.full_name}</p><p className="mt-1 flex items-center gap-1 text-xs text-stone-500"><MapPin size={12} />{donor.city || "City not listed"}</p></div>
              <button type="button" disabled={busy} onClick={() => sendRequest(donor)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-coral px-3 py-2 text-xs font-bold text-white hover:bg-rose-600 disabled:opacity-60"><Send size={13} /> Ask donor</button>
            </div>)}
          </div>
        </div>
      )}
      {hasSearched && donors.length === 0 && !busy && !error && <p className="mt-6 text-center text-sm text-stone-500">No compatible donors found in {city}. Check that the city is spelled Roorkee, then restart the backend so demo donors are seeded.</p>}
      {error && <p role="alert" className="mt-5 text-center text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 text-center text-sm font-semibold text-emerald-700">{notice}</p>}
      {requests.length > 0 && <div className="mx-auto mt-7 max-w-3xl border-t border-stone-100 pt-5"><h3 className="text-sm font-bold">Your requests</h3><div className="mt-3 space-y-2">{requests.map((request) => <p key={request.id} className="flex justify-between gap-4 rounded-xl bg-cream px-4 py-3 text-sm"><span>{request.blood_group} request · {request.city}</span><span className="font-semibold capitalize text-amber-700">{request.status}</span></p>)}</div></div>}
      <p className="mt-6 text-center text-xs leading-5 text-stone-500">Compatibility shown here is a basic guide. A medical professional and blood bank must confirm donor suitability and cross-match before transfusion.</p>
    </div>
  );
}

function DonorRequestInbox({ account }) {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/auth/blood-requests/inbox`, {
      headers: { Authorization: `Bearer ${account.token}` },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Could not load requests.");
        setRequests(result);
      })
      .catch((err) => setError(err instanceof TypeError ? "We couldn't reach the server." : err.message));
  }, [account.token]);

  return (
    <div className="mt-8 rounded-[2rem] border border-white bg-white p-6 shadow-card sm:p-9">
      <h2 className="font-display text-2xl font-extrabold">Requests sent to you</h2>
      <p className="mt-2 text-sm text-stone-500">People who need a compatible blood type can send you a private request here.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {!error && requests.length === 0 && <p className="mt-5 rounded-xl bg-cream p-4 text-sm text-stone-500">No blood requests yet.</p>}
      <div className="mt-5 space-y-3">{requests.map((request) => (
        <article key={request.id} className="rounded-2xl border border-stone-100 bg-cream/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{request.recipient_name} needs {request.blood_group}</h3><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold capitalize text-amber-800">{request.status}</span></div>
          <p className="mt-2 text-sm text-stone-600">{request.units} unit{request.units === 1 ? "" : "s"} · {request.city}{request.hospital ? ` · ${request.hospital}` : ""}</p>
          {request.message && <p className="mt-2 text-sm leading-6 text-stone-600">{request.message}</p>}
          <p className="mt-2 text-xs text-stone-400">Please coordinate through appropriate medical staff; this app does not confirm donor suitability.</p>
        </article>
      ))}</div>
    </div>
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
