"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  Home,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import PublicAgentTrustPanels from "@/components/public-agent-trust-panels";
import { Modal } from "@/components/ui/modal";
import styles from "./agent-profile.module.css";

type Agent = {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  experience?: string;
  createdAt?: string | null;
  avatarUrl?: string | null;
  location?: string;
};

type AgentProperty = {
  id: string;
  agentId?: string;
  name: string;
  location: string;
  type?: string;
  status?: string;
  availabilityStatus?: string;
  imageUrl?: string | null;
  imageUrls?: string[];
};

type ContactForm = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

function safeImageSource(value?: string | null) {
  const source = value?.trim();
  if (!source || source.startsWith("//")) return null;
  if (/^https?:\/\//i.test(source) || source.startsWith("/") || /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(source)) {
    return source;
  }
  return null;
}

function formatMemberSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "Asia/Manila" }).format(date)
    : null;
}

function AgentPortrait({ agent, large = false }: { agent: Agent; large?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const source = !imageFailed ? safeImageSource(agent.avatarUrl) : null;
  const initials = agent.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div className={`${styles.portrait} ${large ? styles.portraitLarge : ""}`}>
      {source ? (
        <Image
          src={source}
          alt={`${agent.name}, Rent Manager`}
          fill
          unoptimized
          sizes={large ? "(max-width: 760px) 42vw, 260px" : "160px"}
          priority={large}
          className={styles.portraitImage}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className={styles.portraitFallback} role="img" aria-label={`${agent.name}, no profile photo available`}>
          <UserRound aria-hidden="true" />
          <span>{initials || "RT"}</span>
        </div>
      )}
      {large && <span aria-hidden="true" className={styles.portraitBrand}>Rent<span>Track</span></span>}
    </div>
  );
}

export default function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [agentError, setAgentError] = useState(false);
  const [properties, setProperties] = useState<AgentProperty[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState(false);
  const [search, setSearch] = useState("");
  const [availability, setAvailability] = useState<"all" | "available">("all");
  const [form, setForm] = useState<ContactForm>({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/users/agents")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error("Agent profiles are unavailable");
        const found = (Array.isArray(data.users) ? data.users : []).find((entry: Agent) => entry.id === id) || null;
        if (mounted) setAgent(found);
      })
      .catch(() => { if (mounted) setAgentError(true); })
      .finally(() => { if (mounted) setAgentLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    fetch("/api/data/properties")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || data.degraded || !Array.isArray(data.properties)) {
          throw new Error("Listings are unavailable");
        }
        if (mounted) setProperties(data.properties);
      })
      .catch(() => { if (mounted) setPropertiesError(true); })
      .finally(() => { if (mounted) setPropertiesLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      name: current.name || user.name || "",
      email: current.email || user.email || "",
      phone: current.phone || user.phone || "",
    }));
  }, [user]);

  useEffect(() => {
    if (!agent || window.location.hash !== "#message") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("message")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [agent]);

  const listings = useMemo(() => {
    if (!agent) return [];
    return properties.filter((property) => property.agentId === agent.id && property.status === "active");
  }, [agent, properties]);

  const shownListings = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return listings.filter((property) => {
      const matchesSearch = !query || `${property.name} ${property.location} ${property.type || ""}`.toLocaleLowerCase().includes(query);
      const matchesAvailability = availability === "all" || property.availabilityStatus?.toLocaleLowerCase() === "available";
      return matchesSearch && matchesAvailability;
    });
  }, [availability, listings, search]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agent || sending) return;

    setSending(true);
    setFeedback("");
    setSuccessModalOpen(false);

    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: form.message,
          senderName: form.name,
          senderEmail: form.email,
          senderPhone: form.phone,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Your inquiry could not be emailed");

      const successCopy = data.message || `Your inquiry was emailed to ${agent.name}. They can reply directly to your email address.`;
      setForm((current) => ({ ...current, message: "" }));
      setSuccessMessage(successCopy);
      setSuccessModalOpen(true);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (agentLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingState} role="status" aria-live="polite">
          <LoaderCircle aria-hidden="true" className={styles.spinner} />
          <span>Loading Rent Manager profile…</span>
        </div>
      </main>
    );
  }

  if (agentError || !agent) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <Link href="/agents" className={styles.backLink}><ArrowLeft size={16} /> All Rent Managers</Link>
          <section className={styles.statePanel} role={agentError ? "alert" : "status"}>
            <UserRound aria-hidden="true" />
            <h1>{agentError ? "Profile unavailable" : "This Rent Manager is not listed"}</h1>
            <p>{agentError ? "We couldn’t load this profile right now. Please try again shortly." : "The profile may have been removed or is no longer public."}</p>
            <Link href="/agents" className={styles.stateLink}>Back to the directory <ArrowRight size={16} /></Link>
          </section>
        </div>
      </main>
    );
  }

  const memberSince = formatMemberSince(agent.createdAt);
  const experience = agent.experience?.trim();
  const profileLocation = agent.location?.trim();
  const normalizedType = (type?: string) => {
    if (type?.toLocaleLowerCase() === "house") return "House";
    if (type?.toLocaleLowerCase() === "condominium") return "Condominium";
    return type?.trim() || "Property";
  };

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link href="/agents" className={styles.wordmark} aria-label="RentTrack Rent Managers directory">
            <Image
              src="/images/landing/logo.png"
              alt="RentTrack logo"
              width={42}
              height={42}
              className={styles.brandLogo}
              priority
            />
            <span><strong>RentTrack</strong><small>RENT MANAGERS</small></span>
          </Link>
          <Link href="/agents" className={styles.directoryLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>All Rent Managers</span>
          </Link>
        </div>
      </header>

      <div className={styles.shell}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
          <Link href="/">RentTrack</Link><span aria-hidden="true">/</span>
          <Link href="/agents">Rent Managers</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{agent.name}</span>
        </nav>

        <div className={styles.profileLayout}>
          <aside className={styles.identityPanel} aria-label={`${agent.name} profile summary`}>
            <AgentPortrait agent={agent} large />
            <div className={styles.identityCopy}>
              <h1>{agent.name}</h1>
              <p className={styles.roleLabel}>Owner-Managed Agent</p>
              {profileLocation ? (
                <p className={styles.locationLine}><MapPin size={15} aria-hidden="true" />{profileLocation}</p>
              ) : (
                <p className={styles.mutedLine}>Location not listed</p>
              )}
            </div>
            <dl className={styles.summaryStats}>
              <div>
                <dt>Active properties</dt>
                <dd>{propertiesLoading ? <span className={styles.statPlaceholder} aria-label="Loading property count" /> : propertiesError ? "—" : listings.length}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd className={styles.statExperience}>{experience || "Not listed"}</dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>{memberSince || "Not listed"}</dd>
              </div>
            </dl>
            <div className={styles.identityActions}>
              <p className={styles.actionLabel}>CONTACT &amp; CONNECT</p>
              <a href="#message" className={styles.primaryAction}><Mail size={17} aria-hidden="true" /> Email inquiry</a>
              {agent.phone && isAuthenticated && <a href={`tel:${agent.phone}`} className={styles.secondaryAction}><Phone size={16} aria-hidden="true" /> Call</a>}
              {agent.email && isAuthenticated && <a href={`mailto:${agent.email}`} className={styles.secondaryAction}><Mail size={16} aria-hidden="true" /> Email</a>}
            </div>
            <p className={styles.privacyNote}>Profile details are provided by this Rent Manager.</p>
          </aside>

          <div className={styles.profileContent}>
            <section className={styles.introSection} aria-labelledby="profile-heading">
              <div>
                <p className={styles.sectionEyebrow}><span /> PUBLIC PROFILE</p>
                <h2 id="profile-heading">A closer look at your<br className={styles.desktopBreak} /> next point of contact.</h2>
                <p className={styles.introCopy}>
                  Explore properties managed by {agent.name} and connect directly when you’re ready.
                </p>
              </div>
            </section>

            {experience && (
              <section className={styles.aboutSection} aria-labelledby="about-title">
                <div className={styles.sectionHeading}>
                  <h2 id="about-title">Experience</h2>
                </div>
                <div className={styles.aboutBody}>
                  <span className={styles.aboutIcon}><Clock3 size={20} aria-hidden="true" /></span>
                  <div>
                    <p className={styles.aboutLead}>{experience}</p>
                    <p className={styles.aboutSub}>Experience information supplied on this member profile.</p>
                  </div>
                </div>
              </section>
            )}

            <section className={styles.listingsSection} aria-labelledby="listings-title">
              <div className={styles.sectionHeading}>
                <div className={styles.listingsHeadingCopy}>
                  <h2 id="listings-title">Properties in their care</h2>
                  <p>Current active properties associated with this Rent Manager.</p>
                </div>
                <span className={styles.listingCount}>{propertiesLoading ? "…" : propertiesError ? "—" : String(listings.length).padStart(2, "0")} <small>LISTED</small></span>
              </div>

              {!propertiesLoading && !propertiesError && listings.length > 0 && (
                <div className={styles.listingTools}>
                  <label className={styles.searchField}>
                    <Search size={17} aria-hidden="true" />
                    <span className={styles.visuallyHidden}>Search properties</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search name, location, or type"
                    />
                  </label>
                  <label className={styles.filterField}>
                    <SlidersHorizontal size={16} aria-hidden="true" />
                    <span className={styles.visuallyHidden}>Filter by availability</span>
                    <select value={availability} onChange={(event) => setAvailability(event.target.value as "all" | "available")}>
                      <option value="all">All properties</option>
                      <option value="available">Available only</option>
                    </select>
                  </label>
                </div>
              )}

              {propertiesLoading ? (
                <div className={styles.listingState} role="status">
                  <LoaderCircle aria-hidden="true" className={styles.spinner} />
                  <span>Loading associated properties…</span>
                </div>
              ) : propertiesError ? (
                <div className={styles.listingState} role="status">
                  <Building2 aria-hidden="true" />
                  <span>Property listings are temporarily unavailable.</span>
                </div>
              ) : listings.length === 0 ? (
                <div className={styles.listingState}>
                  <Building2 aria-hidden="true" />
                  <div><strong>No active properties listed</strong><span>There are no active properties associated with this profile at the moment.</span></div>
                </div>
              ) : shownListings.length === 0 ? (
                <div className={styles.listingState} role="status">
                  <Search aria-hidden="true" />
                  <span>No properties match these filters. Try a different search.</span>
                </div>
              ) : (
                <div className={styles.listingGrid}>
                  {shownListings.map((property, index) => {
                    const propertyImage = safeImageSource(property.imageUrls?.[0] || property.imageUrl);
                    const availabilityLabel = property.availabilityStatus?.trim();
                    return (
                      <article className={styles.listingCard} key={property.id}>
                        <div className={styles.listingImage}>
                          {propertyImage ? (
                            <Image
                              src={propertyImage}
                              alt={`${property.name} property`}
                              fill
                              unoptimized
                              sizes="(max-width: 760px) 90vw, (max-width: 1100px) 42vw, 360px"
                              className={styles.propertyImage}
                            />
                          ) : (
                            <div className={styles.propertyImageFallback} role="img" aria-label="No property photo available">
                              <Home aria-hidden="true" />
                            </div>
                          )}
                          <span className={styles.listingOrdinal}>{String(index + 1).padStart(2, "0")}</span>
                          {availabilityLabel && <span className={styles.availabilityBadge}>{availabilityLabel}</span>}
                        </div>
                        <div className={styles.listingDetails}>
                          <div className={styles.listingTitleRow}>
                            <div>
                              <span className={styles.propertyType}>{normalizedType(property.type)}</span>
                              <h3>{property.name}</h3>
                            </div>
                            <Building2 size={18} aria-hidden="true" />
                          </div>
                          <p className={styles.propertyLocation}><MapPin size={14} aria-hidden="true" />{property.location}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <PublicAgentTrustPanels agentId={agent.id} />

            <section className={styles.contactSection} id="message" aria-labelledby="message-title">
              <div className={styles.contactIntro}>
                <p className={styles.sectionEyebrow}><span /> CONTACT &amp; CONNECT</p>
                <h2 id="message-title">Email {agent.name} about an inquiry.</h2>
                <p>Share what you’re looking for and your inquiry will be emailed directly to this Rent Manager.</p>
                <p className="mt-2 text-sm font-medium text-slate-700">Want to leave a review later? Sign in as a tenant before sending your inquiry. Anonymous inquiries don’t qualify for reviews.</p>
              </div>
              {feedback && <p role="status" className={styles.feedback}>{feedback}</p>}
              <form onSubmit={sendMessage} className={styles.contactForm} aria-busy={sending} aria-live="polite">
                <label>
                  <span>Your name</span>
                  <input required maxLength={120} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </label>
                <label>
                  <span>Email address</span>
                  <input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </label>
                <label>
                  <span>Phone <em>Optional</em></span>
                  <input type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </label>
                <label className={styles.messageField}>
                  <span>What can we help you with?</span>
                  <textarea required maxLength={5000} rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
                </label>
                <button type="submit" className={styles.sendButton} disabled={sending} aria-disabled={sending}>
                  {sending ? <><LoaderCircle className={styles.spinner} size={16} /> Sending inquiry…</> : <>Email inquiry <ArrowRight size={16} aria-hidden="true" /></>}
                </button>
              </form>
            </section>

            <Modal
              isOpen={successModalOpen}
              onClose={() => setSuccessModalOpen(false)}
              title="Inquiry sent"
              className={styles.successModal}
            >
              <div className={styles.successContent}>
                <div className={styles.successBadge} aria-hidden="true">
                  <CheckCircle2 size={36} />
                </div>
                <p className={styles.successMessage}>{successMessage}</p>
                <button type="button" className={styles.successAction} onClick={() => setSuccessModalOpen(false)}>
                  Continue
                </button>
              </div>
            </Modal>
          </div>
        </div>
        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} RentTrack</span>
          <span>Rental Management Network</span>
        </footer>
      </div>
    </main>
  );
}
