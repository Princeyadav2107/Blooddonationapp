import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Heart,
  HeartHandshake,
  LockKeyhole,
  MapPin,
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
  phone: "",
  city: "",
};

function App() {
  const [mode, setMode] = useState("register");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("openvein-account") ?? "null");
    } catch {
      return null;
    }
  });

  const isRegister = mode === "register";

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = isRegister
        ? {
            ...form,
            blood_group: form.blood_group || null,
            phone: form.phone || null,
            city: form.city || null,
          }
        : { email: form.email, password: form.password };
      const response = await fetch(`${API_URL}/api/auth/${isRegister ? "register" : "login"}`, {
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
            {isRegister ? "Already part of the community?" : "New to OpenVein?"}
          </span>
          <button
            className="font-semibold text-coral transition hover:text-rose-700"
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setError("");
            }}
          >
            {isRegister ? "Sign in" : "Create an account"}
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
                    {isRegister ? "MAKE A DIFFERENCE" : "WELCOME BACK"}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
                    {isRegister ? "Join the community" : "Good to see you again"}
                  </h2>
                  <p className="mt-2 text-sm text-stone-500">
                    {isRegister
                      ? "Create your free account in just a moment."
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
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="City" htmlFor="city">
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
                        <Field label="Phone (optional)" htmlFor="phone">
                          <input
                            id="phone"
                            name="phone"
                            value={form.phone}
                            onChange={updateField}
                            placeholder="Your number"
                            autoComplete="tel"
                            type="tel"
                            maxLength={30}
                            className="input"
                          />
                        </Field>
                      </div>
                    </>
                  )}

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
                  <Field label="Password" htmlFor="password">
                    <input
                      id="password"
                      name="password"
                      value={form.password}
                      onChange={updateField}
                      placeholder={isRegister ? "At least 8 characters" : "Your password"}
                      autoComplete={isRegister ? "new-password" : "current-password"}
                      type="password"
                      minLength={isRegister ? 8 : 1}
                      maxLength={128}
                      required
                      className="input"
                    />
                  </Field>

                  {error && (
                    <p
                      role="alert"
                      className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                      {error}
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
                        : "Sign in"}
                    {!loading && (
                      <ArrowRight
                        size={17}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    )}
                  </button>
                </form>

                <div className="mt-5 flex items-center justify-center gap-2 text-xs text-stone-400">
                  <LockKeyhole size={13} />
                  Your information is private and secure.
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
  const user = account.user;
  const roleLabels = {
    donor: "Donor",
    recipient: "Recipient",
    both: "Donor & recipient",
  };
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
        <button
          onClick={onSignOut}
          className="mt-7 text-sm font-semibold text-stone-500 underline decoration-stone-300 underline-offset-4 transition hover:text-ink"
        >
          Sign out
        </button>
      </div>
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
