"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
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
  rentAmount?: number;
};

type AgentUnit = {
  id: string;
  propertyId?: string;
  unitNumber: string;
  floor?: number | null;
  status?: string;
  rentAmount?: number;
  address?: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  agentId?: string;
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

function AgentProfilePageContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPropertyId = searchParams.get("propertyId") || "";
  const urlPropertyName = searchParams.get("propertyName") || "";
  const urlUnitNumber = searchParams.get("unitNumber") || "";

  const { user, isAuthenticated } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [agentLoading, setAgentLoading] = useState(true);
  const [agentError, setAgentError] = useState(false);
  const [properties, setProperties] = useState<AgentProperty[]>([]);
  const [units, setUnits] = useState<AgentUnit[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertiesError, setPropertiesError] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "properties" | "units">("all");
  const [availability, setAvailability] = useState<"all" | "available">("all");
  const [form, setForm] = useState<ContactForm>({ name: "", email: "", phone: "", message: "" });
  const [selectedPropertyId, setSelectedPropertyId] = useState(urlPropertyId);
  const [selectedPropertyName, setSelectedPropertyName] = useState(urlPropertyName);
  const [selectedUnitNumber, setSelectedUnitNumber] = useState(urlUnitNumber);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const cleanPhone = (agent?.phone || "").replace(/[^\d+]/g, "");

  const handleCallClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!agent?.phone) return;
    setCallModalOpen(true);
  };

  const handleEmailClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!agent?.email) return;
    setEmailModalOpen(true);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedItem(label);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleBack = () => {
    const previousPageIsInternal = window.document.referrer.startsWith(window.location.origin);
    if (previousPageIsInternal && window.history.length > 1) {
      router.back();
    } else {
      router.push("/agents");
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let response = await fetch("/api/agents");
        if (!response.ok) response = await fetch("/api/auth/users/agents");
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error("Agent profiles are unavailable");
        const found = (Array.isArray(data.users) ? data.users : []).find((entry: Agent) => entry.id === id) || null;
        if (mounted) setAgent(found);
      } catch {
        if (mounted) setAgentError(true);
      } finally {
        if (mounted) setAgentLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/api/data/properties").then(res => res.json()).catch(() => ({ success: false })),
      fetch("/api/data/units").then(res => res.json()).catch(() => ({ success: false })),
    ]).then(([propData, unitData]) => {
      if (!mounted) return;
      if (propData && propData.success && Array.isArray(propData.properties)) {
        setProperties(propData.properties);
      }
      if (unitData && unitData.success && Array.isArray(unitData.units)) {
        setUnits(unitData.units);
      }
      setPropertiesLoading(false);
    }).catch(() => {
      if (mounted) {
        setPropertiesError(true);
        setPropertiesLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (urlPropertyId && urlPropertyId !== selectedPropertyId) {
      setSelectedPropertyId(urlPropertyId);
    }
    if (urlPropertyName && urlPropertyName !== selectedPropertyName) {
      setSelectedPropertyName(urlPropertyName);
    }
    if (urlUnitNumber && urlUnitNumber !== selectedUnitNumber) {
      setSelectedUnitNumber(urlUnitNumber);
    }
  }, [urlPropertyId, urlPropertyName, urlUnitNumber]);

  useEffect(() => {
    if (properties.length === 0) return;
    if (selectedPropertyId) {
      const match = properties.find((p) => p.id === selectedPropertyId);
      if (match && match.name !== selectedPropertyName) {
        setSelectedPropertyName(match.name);
      }
    } else if (selectedPropertyName) {
      const match = properties.find((p) => p.name.toLowerCase() === selectedPropertyName.toLowerCase());
      if (match) {
        setSelectedPropertyId(match.id);
      }
    }
  }, [properties, selectedPropertyId, selectedPropertyName]);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      name: current.name || user.name || "",
      email: current.email || user.email || "",
      phone: current.phone || user.phone || "",
    }));
  }, [user]);

  const scrollToMessage = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }
    const target = document.getElementById("message");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof window !== "undefined" && window.location.hash !== "#message") {
        window.history.pushState(null, "", "#message");
      }
      setTimeout(() => {
        const firstInput = target.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
        firstInput?.focus();
      }, 450);
    }
  };

  useEffect(() => {
    if (!agent || (window.location.hash !== "#message" && !urlPropertyId)) return;

    const scroll = () => {
      const target = document.getElementById("message");
      if (target) {
        target.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          block: "start",
        });
      }
    };

    const t1 = setTimeout(scroll, 150);
    const t2 = setTimeout(scroll, 500);
    const t3 = setTimeout(() => {
      scroll();
      const firstInput = document.getElementById("message")?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
      firstInput?.focus();
    }, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [agent, urlPropertyId]);

  // Determine which properties and units are in this agent's care:
  // 1. Direct assignment (p.agentId === agent.id)
  // 2. OR location match (agent location matches property location or unit address)
  const agentTokens = useMemo(() => {
    if (!agent) return [];
    const loc = `${agent.location || ""}`.toLowerCase();
    return loc.split(/[\s,.-]+/).map(t => t.trim()).filter(t => t.length >= 3);
  }, [agent]);

  const matchedProperties = useMemo(() => {
    if (!agent) return [];
    return properties.filter((property) => {
      if (property.agentId === agent.id) return true;
      if (property.status && property.status !== "active") return false;
      const propLoc = (property.location || "").toLowerCase();
      if (agentTokens.length > 0 && agentTokens.some(tok => propLoc.includes(tok))) return true;
      return false;
    });
  }, [agent, properties, agentTokens]);

  const matchedPropertyIds = useMemo(() => {
    return new Set(matchedProperties.map(p => p.id));
  }, [matchedProperties]);

  const matchedUnits = useMemo(() => {
    if (!agent) return [];
    return units.filter((unit) => {
      if (unit.agentId === agent.id) return true;
      if (unit.propertyId && matchedPropertyIds.has(unit.propertyId)) return true;
      const unitAddr = (unit.address || "").toLowerCase();
      if (agentTokens.length > 0 && agentTokens.some(tok => unitAddr.includes(tok))) return true;
      return false;
    });
  }, [agent, units, matchedPropertyIds, agentTokens]);

  const totalCaredCount = matchedProperties.length + matchedUnits.length;

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return matchedProperties.filter((property) => {
      const matchesSearch = !query || `${property.name} ${property.location} ${property.type || ""}`.toLocaleLowerCase().includes(query);
      const matchesAvailability = availability === "all" || property.availabilityStatus?.toLocaleLowerCase() === "available";
      return matchesSearch && matchesAvailability;
    });
  }, [availability, matchedProperties, search]);

  const filteredUnits = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return matchedUnits.filter((unit) => {
      const parentProp = properties.find(p => p.id === unit.propertyId);
      const parentName = parentProp?.name || "";
      const matchesSearch = !query || `${unit.unitNumber} ${unit.address || ""} ${parentName}`.toLocaleLowerCase().includes(query);
      const matchesAvailability = availability === "all" || unit.status?.toLocaleLowerCase() === "vacant" || unit.status?.toLocaleLowerCase() === "available";
      return matchesSearch && matchesAvailability;
    });
  }, [availability, matchedUnits, properties, search]);

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
          propertyId: selectedPropertyId || undefined,
          propertyName: selectedPropertyName || undefined,
          unitNumber: selectedUnitNumber || undefined,
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
          <button type="button" onClick={handleBack} className={`${styles.directoryLink} ${styles.directoryButton}`} aria-label="Go back or return to the Rent Managers directory">
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back</span>
          </button>
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
              {(agent.phone || agent.email) && (
                <div className={styles.agentContactDetails} aria-label="Agent contact information">
                  {agent.phone && (
                    <button
                      type="button"
                      onClick={handleCallClick}
                      className={styles.contactDetailBadge}
                      title={`Call or copy phone: ${agent.phone}`}
                    >
                      <Phone size={13} aria-hidden="true" className={styles.contactDetailIcon} />
                      <span className={styles.contactDetailText}>{agent.phone}</span>
                    </button>
                  )}
                  {agent.email && (
                    <button
                      type="button"
                      onClick={handleEmailClick}
                      className={styles.contactDetailBadge}
                      title={`Email or copy: ${agent.email}`}
                    >
                      <Mail size={13} aria-hidden="true" className={styles.contactDetailIcon} />
                      <span className={styles.contactDetailText}>{agent.email}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <dl className={styles.summaryStats}>
              <div>
                <dt>Properties &amp; Units</dt>
                <dd>{propertiesLoading ? <span className={styles.statPlaceholder} aria-label="Loading property count" /> : propertiesError ? "—" : totalCaredCount}</dd>
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
              <a
                href="#message"
                className={styles.primaryAction}
                onClick={scrollToMessage}
              >
                <Mail size={17} aria-hidden="true" /> Inquire
              </a>
              {agent.phone && (
                <button
                  type="button"
                  onClick={handleCallClick}
                  className={styles.secondaryAction}
                  title={`Call ${agent.name} (${agent.phone})`}
                  aria-label={`Call ${agent.name} at ${agent.phone}`}
                >
                  <Phone size={16} aria-hidden="true" /> Call
                </button>
              )}
              {agent.email && (
                <button
                  type="button"
                  onClick={handleEmailClick}
                  className={styles.secondaryAction}
                  title={`Email ${agent.name} (${agent.email})`}
                  aria-label={`Email ${agent.name} at ${agent.email}`}
                >
                  <Mail size={16} aria-hidden="true" /> Email
                </button>
              )}
            </div>
            <p className={styles.privacyNote}>Profile details are provided by this Rent Manager.</p>
          </aside>

          <div className={styles.profileContent}>
            <section className={styles.introSection} aria-labelledby="profile-heading">
              <div>
                <p className={styles.sectionEyebrow}><span /> PUBLIC PROFILE</p>
                <h2 id="profile-heading">A closer look at your<br className={styles.desktopBreak} /> next point of contact.</h2>
                <p className={styles.introCopy}>
                  Explore properties and units managed by {agent.name} and connect directly when you’re ready.
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
                  <h2 id="listings-title">Properties &amp; Units in their care</h2>
                  <p>Current active properties and units in {profileLocation ? `${profileLocation} and associated locations` : "their service area"}.</p>
                </div>
                <span className={styles.listingCount}>{propertiesLoading ? "…" : propertiesError ? "—" : String(totalCaredCount).padStart(2, "0")} <small>LISTED</small></span>
              </div>

              {!propertiesLoading && !propertiesError && totalCaredCount > 0 && (
                <>
                  <div className={styles.tabsRow} role="tablist" aria-label="Filter listings by type">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "all"}
                      onClick={() => setActiveTab("all")}
                      className={`${styles.tabButton} ${activeTab === "all" ? styles.tabButtonActive : ""}`}
                    >
                      All <span className={styles.tabBadge}>{totalCaredCount}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "properties"}
                      onClick={() => setActiveTab("properties")}
                      className={`${styles.tabButton} ${activeTab === "properties" ? styles.tabButtonActive : ""}`}
                    >
                      Properties <span className={styles.tabBadge}>{matchedProperties.length}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "units"}
                      onClick={() => setActiveTab("units")}
                      className={`${styles.tabButton} ${activeTab === "units" ? styles.tabButtonActive : ""}`}
                    >
                      Units <span className={styles.tabBadge}>{matchedUnits.length}</span>
                    </button>
                  </div>

                  <div className={styles.listingTools}>
                    <label className={styles.searchField}>
                      <Search size={17} aria-hidden="true" />
                      <span className={styles.visuallyHidden}>Search listings</span>
                      <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search name, unit number, or location"
                      />
                    </label>
                    <label className={styles.filterField}>
                      <SlidersHorizontal size={16} aria-hidden="true" />
                      <span className={styles.visuallyHidden}>Filter by availability</span>
                      <select value={availability} onChange={(event) => setAvailability(event.target.value as "all" | "available")}>
                        <option value="all">All items</option>
                        <option value="available">Available only</option>
                      </select>
                    </label>
                  </div>
                </>
              )}

              {propertiesLoading ? (
                <div className={styles.listingState} role="status">
                  <LoaderCircle aria-hidden="true" className={styles.spinner} />
                  <span>Loading associated properties and units…</span>
                </div>
              ) : propertiesError ? (
                <div className={styles.listingState} role="status">
                  <Building2 aria-hidden="true" />
                  <span>Listings are temporarily unavailable.</span>
                </div>
              ) : totalCaredCount === 0 ? (
                <div className={styles.listingState}>
                  <Building2 aria-hidden="true" />
                  <div><strong>No active properties or units listed</strong><span>There are no active properties or units associated with this profile at the moment.</span></div>
                </div>
              ) : (
                <div className={styles.listingGrid}>
                  {(activeTab === "all" || activeTab === "properties") && filteredProperties.map((property, index) => {
                    const propertyImage = safeImageSource(property.imageUrls?.[0] || property.imageUrl);
                    const availabilityLabel = property.availabilityStatus?.trim() || "Available";
                    return (
                      <article className={styles.listingCard} key={`prop-${property.id}`}>
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
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPropertyId(property.id);
                              setSelectedPropertyName(property.name);
                              setSelectedUnitNumber("");
                              scrollToMessage();
                            }}
                            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <MessageCircle size={14} /> Inquire about this property
                          </button>
                        </div>
                      </article>
                    );
                  })}

                  {(activeTab === "all" || activeTab === "units") && filteredUnits.map((unit, index) => {
                    const unitImage = safeImageSource(unit.imageUrls?.[0] || unit.imageUrl);
                    const parentProp = properties.find(p => p.id === unit.propertyId);
                    const availabilityLabel = unit.status === "occupied" ? "Occupied" : "Vacant / Available";
                    return (
                      <article className={styles.listingCard} key={`unit-${unit.id}`}>
                        <div className={styles.listingImage}>
                          {unitImage ? (
                            <Image
                              src={unitImage}
                              alt={`Unit ${unit.unitNumber}`}
                              fill
                              unoptimized
                              sizes="(max-width: 760px) 90vw, (max-width: 1100px) 42vw, 360px"
                              className={styles.propertyImage}
                            />
                          ) : (
                            <div className={styles.propertyImageFallback} role="img" aria-label="No unit photo available">
                              <Home aria-hidden="true" />
                            </div>
                          )}
                          <span className={styles.listingOrdinal}>U{String(index + 1).padStart(2, "0")}</span>
                          <span className={styles.availabilityBadge}>{availabilityLabel}</span>
                        </div>
                        <div className={styles.listingDetails}>
                          <div className={styles.listingTitleRow}>
                            <div>
                              <span className={styles.propertyType}>Unit Listing</span>
                              <h3>Unit {unit.unitNumber}{unit.floor ? ` · Floor ${unit.floor}` : ""}</h3>
                              {parentProp && <p className={styles.unitParentProperty}>in {parentProp.name}</p>}
                            </div>
                            <Home size={18} aria-hidden="true" className="text-slate-500" />
                          </div>
                          <p className={styles.propertyLocation}>
                            <MapPin size={14} aria-hidden="true" />
                            {unit.address || parentProp?.location || "Location on request"}
                          </p>
                          {Number(unit.rentAmount) > 0 && (
                            <p className={styles.unitPriceTag}>₱{Number(unit.rentAmount).toLocaleString()} / month</p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPropertyId(unit.propertyId || "");
                              setSelectedPropertyName(parentProp?.name || `Unit ${unit.unitNumber}`);
                              setSelectedUnitNumber(unit.unitNumber);
                              scrollToMessage();
                            }}
                            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <MessageCircle size={14} /> Inquire about this unit
                          </button>
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
                {selectedPropertyName && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 border border-blue-200">
                    <Building2 size={14} className="text-blue-600" />
                    <span>Inquiring about: <strong>{selectedPropertyName}</strong>{selectedUnitNumber ? ` (Unit ${selectedUnitNumber})` : ""}</span>
                  </div>
                )}
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
                <label className={styles.messageField}>
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

            {agent.phone && (
              <Modal
                isOpen={callModalOpen}
                onClose={() => setCallModalOpen(false)}
                title={`Call ${agent.name}`}
              >
                <div className="py-2 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Phone size={26} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{agent.name}</h3>
                    <p className="text-xs text-slate-500">Owner-Managed Agent{profileLocation ? ` · ${profileLocation}` : ""}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Direct Phone Number</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 select-all">{agent.phone}</p>
                  </div>
                  <div className="flex flex-col gap-2.5 pt-2">
                    <a
                      href={`tel:${cleanPhone}`}
                      className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-sm"
                    >
                      <Phone size={16} /> Call Now ({agent.phone})
                    </a>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(agent.phone || "", "phone")}
                      className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition-colors"
                    >
                      {copiedItem === "phone" ? <Check size={16} className="text-emerald-600" /> : <Copy size={15} />}
                      <span>{copiedItem === "phone" ? "Copied to clipboard!" : "Copy Number"}</span>
                    </button>
                  </div>
                </div>
              </Modal>
            )}

            {agent.email && (
              <Modal
                isOpen={emailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                title={`Email ${agent.name}`}
              >
                <div className="py-2 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <Mail size={26} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{agent.name}</h3>
                    <p className="text-xs text-slate-500">Owner-Managed Agent{profileLocation ? ` · ${profileLocation}` : ""}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email Address</p>
                    <p className="mt-1 text-base font-bold text-slate-900 break-all select-all">{agent.email}</p>
                  </div>
                  <div className="flex flex-col gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailModalOpen(false);
                        scrollToMessage();
                      }}
                      className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-sm"
                    >
                      <MessageCircle size={16} /> Send Inquiry on RentTrack
                    </button>
                    <a
                      href={`mailto:${agent.email}?subject=Inquiry%20via%20RentTrack`}
                      className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-sm transition-colors"
                    >
                      <Mail size={15} /> Open Mail App
                    </a>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(agent.email || "", "email")}
                      className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors pt-1"
                    >
                      {copiedItem === "email" ? <Check size={14} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{copiedItem === "email" ? "Copied email address!" : "Copy email address"}</span>
                    </button>
                  </div>
                </div>
              </Modal>
            )}
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

export default function AgentProfilePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading agent profile…</div>}>
      <AgentProfilePageContent />
    </Suspense>
  );
}
