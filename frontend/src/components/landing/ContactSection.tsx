"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

export function validateContact(fields: { name: string; email: string; message: string }) {
  const errors: Partial<Record<keyof typeof fields, string>> = {};
  if (!fields.name.trim()) errors.name = "Tell us your name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
    errors.email = "That email doesn't look right";
  if (fields.message.trim().length < 10) errors.message = "A little more detail helps (10+ chars)";
  return errors;
}

export function ContactSection({ active }: { active: boolean }) {
  const [fields, setFields] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<ReturnType<typeof validateContact>>({});
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateContact(fields);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const body = encodeURIComponent(`${fields.message}\n\n— ${fields.name}`);
    window.location.href = `mailto:hello@dreamers.studio?subject=${encodeURIComponent(
      "Dreamers — hello from " + fields.name,
    )}&body=${body}`;
    setSent(true);
  };

  const inputCls =
    "focus-sunset w-full rounded-xl border border-line bg-plum/70 px-4 py-3 text-sm text-star placeholder:text-star-faint";

  return (
    <div className="grain relative flex h-full w-full flex-col bg-gradient-to-b from-night via-plum to-[#241127]">
      <div
        className="absolute bottom-0 left-1/2 h-72 w-[120%] -translate-x-1/2 rounded-[100%] bg-gradient-to-t from-sunset-amber/20 via-sunset-magenta/10 to-transparent blur-3xl"
        aria-hidden
      />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center overflow-y-auto px-6 py-24 max-h-full">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={active ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-xs uppercase tracking-[0.28em] text-sunset-gold"
            >
              Contact
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 18 }}
              animate={active ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="mt-3 font-display text-3xl font-semibold sm:text-5xl"
            >
              Tell us what you <span className="text-gradient">dream about</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={active ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.16 }}
              className="mt-4 max-w-md text-sm leading-relaxed text-star-dim"
            >
              Questions, feature ideas, or a film you're proud of — we read
              everything. You can also just say hi.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={active ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.24 }}
              className="mt-6 flex gap-3 text-sm"
            >
              <a href="mailto:hello@dreamers.studio" className="focus-sunset rounded-full border border-line px-4 py-2 text-star-dim hover:border-sunset-amber/60 hover:text-sunset-gold">✉ Email</a>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="focus-sunset rounded-full border border-line px-4 py-2 text-star-dim hover:border-sunset-amber/60 hover:text-sunset-gold">GitHub</a>
              <a href="https://x.com" target="_blank" rel="noreferrer" className="focus-sunset rounded-full border border-line px-4 py-2 text-star-dim hover:border-sunset-amber/60 hover:text-sunset-gold">X</a>
            </motion.div>
          </div>

          <motion.form
            initial={{ opacity: 0, y: 24 }}
            animate={active ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.65, delay: 0.2 }}
            onSubmit={submit}
            noValidate
            className="border-gradient rounded-3xl p-6 sm:p-8"
          >
            {sent ? (
              <div className="py-10 text-center">
                <p className="text-3xl">🌙</p>
                <h3 className="mt-3 font-display text-xl font-semibold text-star">
                  Your message is on its way
                </h3>
                <p className="mt-2 text-sm text-star-dim">We'll dream up a reply soon.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="c-name" className="mb-1.5 block text-xs text-star-dim">Name</label>
                  <input id="c-name" className={inputCls} value={fields.name} placeholder="Ada Lovelace"
                    onChange={(e) => setFields({ ...fields, name: e.target.value })} />
                  {errors.name && <p role="alert" className="mt-1 text-xs text-bad">{errors.name}</p>}
                </div>
                <div>
                  <label htmlFor="c-email" className="mb-1.5 block text-xs text-star-dim">Email</label>
                  <input id="c-email" type="email" className={inputCls} value={fields.email} placeholder="you@example.com"
                    onChange={(e) => setFields({ ...fields, email: e.target.value })} />
                  {errors.email && <p role="alert" className="mt-1 text-xs text-bad">{errors.email}</p>}
                </div>
                <div>
                  <label htmlFor="c-msg" className="mb-1.5 block text-xs text-star-dim">Message</label>
                  <textarea id="c-msg" rows={4} className={`${inputCls} resize-none`} value={fields.message} placeholder="I dreamed of…"
                    onChange={(e) => setFields({ ...fields, message: e.target.value })} />
                  {errors.message && <p role="alert" className="mt-1 text-xs text-bad">{errors.message}</p>}
                </div>
                <button type="submit" className="focus-sunset w-full rounded-xl bg-sunset py-3 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5">
                  Send message
                </button>
              </div>
            )}
          </motion.form>
        </div>

        {/* footer */}
        <div className="mt-14 flex flex-col items-center gap-3 border-t border-line/50 pt-6 text-center">
          <p className="font-display text-2xl font-semibold text-gradient-soft">Dreamers</p>
          <Link
            href="/studio"
            className="focus-sunset rounded-full bg-sunset px-6 py-2.5 text-sm font-semibold text-night transition-transform hover:-translate-y-0.5"
          >
            Generate your dream →
          </Link>
          <p className="text-xs text-star-faint">
            © 2026 Dreamers · 1 credit = $1 · your first two dreams are free
          </p>
        </div>
      </div>
    </div>
  );
}
