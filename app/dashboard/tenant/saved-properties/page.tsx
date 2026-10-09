"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Clock, Heart, MapPin, Star, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { getProperties, Property } from "@/lib/data";
import { getTenantPropertyIds, removeRecentPropertyView, toggleFavoriteProperty } from "@/lib/tenant-property-storage";

type SavedView = "favorites" | "recently-viewed";

export default function TenantSavedPropertiesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [view, setView] = useState<SavedView>("favorites");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const updateViewFromHash = () => setView(window.location.hash === "#recently-viewed" ? "recently-viewed" : "favorites");
    updateViewFromHash();
    window.addEventListener("hashchange", updateViewFromHash);
    return () => window.removeEventListener("hashchange", updateViewFromHash);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    Promise.all([getProperties(user), Promise.resolve(getTenantPropertyIds(user.id, "favorites")), Promise.resolve(getTenantPropertyIds(user.id, "recently-viewed"))])
      .then(([loadedProperties, nextFavorites, nextRecent]) => {
        if (!active) return;
        setProperties(loadedProperties);
        setFavoriteIds(nextFavorites);
        setRecentIds(nextRecent);
      })
      .catch(() => {
        if (!active) return;
        setProperties([]);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  const propertyIds = view === "favorites" ? favoriteIds : recentIds;
  const savedProperties = propertyIds.flatMap((id) => {
    const property = properties.find((item) => item.id === id);
    return property ? [property] : [];
  });

  const selectView = (nextView: SavedView) => {
    setView(nextView);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${nextView}`);
  };

  const removeProperty = (propertyId: string) => {
    if (!user) return;
    if (view === "favorites") {
      toggleFavoriteProperty(user.id, propertyId);
      setFavoriteIds((current) => current.filter((id) => id !== propertyId));
    } else {
      removeRecentPropertyView(user.id, propertyId);
      setRecentIds((current) => current.filter((id) => id !== propertyId));
    }
  };

  const isFavorites = view === "favorites";
  const HeadingIcon = isFavorites ? Heart : Clock;

  return (
    <div className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-600">Your rentals</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-slate-900"><HeadingIcon className="h-6 w-6 text-blue-600" />{isFavorites ? "My Favorites" : "Recently Viewed"}</h1>
        </div>
        <Link href="/dashboard/tenant/properties-page" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Building2 className="h-4 w-4" />Browse properties</Link>
      </div>

      <div className="mb-6 flex border-b border-slate-200">
        <button type="button" onClick={() => selectView("favorites")} className={`border-b-2 px-4 py-3 text-sm font-medium ${isFavorites ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Heart className="mr-2 inline h-4 w-4" />My Favorites</button>
        <button type="button" onClick={() => selectView("recently-viewed")} className={`border-b-2 px-4 py-3 text-sm font-medium ${!isFavorites ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}><Clock className="mr-2 inline h-4 w-4" />Recently Viewed</button>
      </div>

      {loading ? (
        <div className="flex min-h-56 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" /></div>
      ) : savedProperties.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center border-y border-slate-200 px-4 text-center">
          <HeadingIcon className="mb-3 h-9 w-9 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-800">{isFavorites ? "No favorites saved" : "No recently viewed properties"}</h2>
          <p className="mt-1 text-sm text-slate-500">{isFavorites ? "Save a rental from the properties page to keep it here." : "Properties you open will appear here."}</p>
          <Link href="/dashboard/tenant/properties-page" className="mt-4 text-sm font-semibold text-blue-700 hover:text-blue-800">Browse properties</Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {savedProperties.map((property) => (
            <article key={property.id} className="flex items-center gap-4 py-4">
              <div className="hidden h-20 w-28 shrink-0 overflow-hidden rounded-md bg-slate-100 sm:block">
                {property.imageUrl ? <Image src={property.imageUrl} alt="" width={112} height={80} className="h-full w-full object-cover" /> : <Building2 className="m-auto h-8 w-8 text-slate-300" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-slate-900">{property.name}</h2>
                <p className="mt-1 flex items-center gap-1 truncate text-sm text-slate-500"><MapPin className="h-3.5 w-3.5 shrink-0" />{property.location}</p>
                <p className="mt-2 text-sm font-medium text-slate-800">{formatCurrency(property.monthlyRevenue || 0)}<span className="font-normal text-slate-500">/mo</span></p>
              </div>
              <button type="button" onClick={() => removeProperty(property.id)} aria-label={isFavorites ? `Remove ${property.name} from favorites` : `Remove ${property.name} from recently viewed`} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600">
                {isFavorites ? <Star className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}