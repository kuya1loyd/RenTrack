"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, Clock, MapPin,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ViewMode = "today" | "day" | "month" | "year";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  endTime?: string;
  type: "viewing" | "meeting" | "payment" | "reminder" | "other";
  location?: string;
  notes?: string;
  color?: string;
  reminderDate?: string;
}

const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
const defaultStart = `${todayStr}T09:00`;
const defaultEnd = `${todayStr}T10:00`;

export default function TenantCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [eventTitle, setEventTitle] = useState("");
  const [eventTime, setEventTime] = useState(defaultStart);
  const [eventEndTime, setEventEndTime] = useState(defaultEnd);
  const [eventType, setEventType] = useState<CalendarEvent["type"]>("viewing");
  const [eventLocation, setEventLocation] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [eventColor, setEventColor] = useState("#3B82F6");
  const [reminderDate, setReminderDate] = useState("");

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];

    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [currentDate]);

  const eventsForDate = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return events.filter((e) => e.date === dateStr);
  };

  const goToPrevious = () => {
    if (viewMode === "year") setCurrentDate(new Date(currentDate.getFullYear() - 1, 0, 1));
    else if (viewMode === "month") setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    else if (viewMode === "today") setCurrentDate(new Date());
    else setCurrentDate(new Date(currentDate.getTime() - 24 * 60 * 60 * 1000));
  };

  const goToNext = () => {
    if (viewMode === "year") setCurrentDate(new Date(currentDate.getFullYear() + 1, 0, 1));
    else if (viewMode === "month") setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    else if (viewMode === "today") setCurrentDate(new Date());
    else setCurrentDate(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000));
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleDateClick = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setEventTime(`${dateStr}T09:00`);
    setEventEndTime(`${dateStr}T10:00`);
    setReminderDate("");
    setShowEventModal(true);
  };

  const handleAddEvent = () => {
    if (!selectedDate || !eventTitle.trim()) {
      toast.error("Please enter an event title");
      return;
    }
    const newEvent: CalendarEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: eventTitle,
      date: selectedDate,
      time: eventTime || undefined,
      endTime: eventEndTime || undefined,
      type: eventType,
      location: eventLocation || undefined,
      notes: eventNotes || undefined,
      color: eventColor,
      reminderDate: reminderDate || undefined,
    };
    setEvents((prev) => [...prev, newEvent]);
    toast.success("Event added to calendar");
    setShowEventModal(false);
    setEventTitle("");
    setEventTime(defaultStart);
    setEventEndTime(defaultEnd);
    setEventType("viewing");
    setEventLocation("");
    setEventNotes("");
    setEventColor("#3B82F6");
    setReminderDate("");
  };

  const getEventColor = (type: CalendarEvent["type"], color?: string) => {
    if (color) return { backgroundColor: color, color: "#fff" };
    switch (type) {
      case "viewing": return { backgroundColor: "#DBEAFE", color: "#1E40AF" };
      case "meeting": return { backgroundColor: "#F3E8FF", color: "#6B21A8" };
      case "payment": return { backgroundColor: "#D1FAE5", color: "#065F46" };
      case "reminder": return { backgroundColor: "#FEF3C7", color: "#92400E" };
      default: return { backgroundColor: "#F3F4F6", color: "#374151" };
    }
  };

  const eventTypeOptions = [
    { value: "viewing", label: "Personal Event", icon: "🎉" },
    { value: "meeting", label: "Client Review", icon: "👔" },
    { value: "payment", label: "🎂 Birthday Greeting", icon: "🎂" },
    { value: "reminder", label: "📁 Others / Manual", icon: "📁" },
  ];

  const colorOptions = [
    { value: "#3B82F6", label: "Blue" },
    { value: "#8B5CF6", label: "Purple" },
    { value: "#EC4899", label: "Pink" },
    { value: "#EF4444", label: "Red" },
    { value: "#F59E0B", label: "Amber" },
    { value: "#10B981", label: "Green" },
    { value: "#6B7280", label: "Gray" },
  ];

  const todayStrCheck = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative bg-linear-to-r from-blue-600 to-blue-700 text-white overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 right-10 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl"
        />
        <div className="relative w-full px-4 sm:px-6 lg:px-8 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Calendar className="h-5 w-5" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold">My Calendar</h1>
            </div>
            <p className="text-xl text-blue-100">Schedule viewings, track payments, and manage appointments</p>
          </motion.div>
        </div>
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={goToPrevious} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-bold text-gray-900 min-w-50 text-center">
              {viewMode === "year" ? currentDate.getFullYear() : viewMode === "month" ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}` : viewMode === "today" ? "Today" : currentDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
            </h2>
            <Button variant="outline" size="sm" onClick={goToNext} className="gap-2">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday} className="text-blue-600 hover:text-blue-700">
              Today
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1">
              {(["today", "day", "month", "year"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize",
                    viewMode === mode ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <Button onClick={() => { setSelectedDate(todayStrCheck); setEventTime(defaultStart); setEventEndTime(defaultEnd); setShowEventModal(true); }} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          </div>
        </motion.div>

        {/* Calendar Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="border-gray-200 shadow-lg">
            <CardContent className="p-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={viewMode + currentDate.getFullYear() + currentDate.getMonth()}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {viewMode === "year" ? (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-4 p-6">
                      {monthNames.map((month, idx) => {
                        const monthDate = new Date(currentDate.getFullYear(), idx, 1);
                        const monthEvents = events.filter(e => {
                          const eventDate = new Date(e.date);
                          return eventDate.getFullYear() === currentDate.getFullYear() && eventDate.getMonth() === idx;
                        });
                        return (
                          <div
                            key={idx}
                            onClick={() => { setCurrentDate(monthDate); setViewMode("month"); }}
                            className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer text-center"
                          >
                            <h4 className="font-semibold text-gray-900 mb-1">{month}</h4>
                            <p className="text-2xl font-bold text-blue-600">{monthEvents.length}</p>
                            <p className="text-xs text-gray-500">events</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : viewMode === "today" ? (
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </h3>
                      <div className="space-y-2">
                        {eventsForDate(new Date()).length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No events for today</p>
                        ) : (
                          eventsForDate(new Date()).map((event) => (
                            <div key={event.id} className="p-3 rounded-lg border border-gray-200 flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-gray-900">{event.title}</h4>
                                {event.time && <p className="text-sm text-gray-600">{new Date(event.time).toLocaleTimeString("en-PH", { hour: 'numeric', minute: '2-digit', hour12: true })}</p>}
                              </div>
                              <Badge variant="outline" className="text-xs capitalize" style={getEventColor(event.type, event.color)}>{event.type}</Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : viewMode === "day" ? (
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {currentDate.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </h3>
                      <div className="space-y-2">
                        {eventsForDate(currentDate).length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No events for this day</p>
                        ) : (
                          eventsForDate(currentDate).map((event) => (
                            <div key={event.id} className="p-3 rounded-lg border border-gray-200 flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-gray-900">{event.title}</h4>
                                {event.time && <p className="text-sm text-gray-600">{new Date(event.time).toLocaleTimeString("en-PH", { hour: 'numeric', minute: '2-digit', hour12: true })}</p>}
                              </div>
                              <Badge variant="outline" className="text-xs capitalize" style={getEventColor(event.type, event.color)}>{event.type}</Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Day Headers */}
                      <div className="grid grid-cols-7 border-b border-gray-200">
                        {dayNames.map((day) => (
                          <div key={day} className="py-3 text-center text-sm font-medium text-gray-600">{day}</div>
                        ))}
                      </div>
                      {/* Days Grid */}
                      <div className="grid grid-cols-7">
                        {calendarDays.map((date, idx) => {
                          const dateStr = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : "";
                          const dayEvents = date ? eventsForDate(date) : [];
                          const isToday = dateStr === todayStrCheck;
                          const isCurrentMonth = date ? date.getMonth() === currentDate.getMonth() : false;
                          return (
                            <div
                              key={idx}
                              onClick={() => date && handleDateClick(date)}
                              className={cn(
                                "min-h-30 border-r border-b border-gray-100 last:border-r-0 p-2 cursor-pointer transition-all hover:bg-blue-50/50 relative group",
                                !isCurrentMonth && "bg-gray-50/30"
                              )}
                            >
                              {date && (
                                <>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={cn(
                                      "text-sm font-medium w-8 h-8 flex items-center justify-center rounded-full transition-all",
                                      isToday ? "bg-blue-600 text-white shadow-md" : isCurrentMonth ? "text-gray-900" : "text-gray-400"
                                    )}>
                                      {date.getDate()}
                                    </span>
                                    {dayEvents.length > 0 && (
                                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                        {dayEvents.length}
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    {dayEvents.slice(0, 3).map((event) => (
                                      <div key={event.id} className="text-[10px] px-1.5 py-1 rounded-md border truncate font-medium" style={getEventColor(event.type, event.color)}>
                                        <div className="flex items-center gap-1 truncate">
                                          <span className="truncate">{event.title}</span>
                                        </div>
                                      </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                      <div className="text-[10px] text-gray-500 font-medium px-1">+{dayEvents.length - 3} more</div>
                                    )}
                                  </div>
                                  <button className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white border border-gray-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming Events */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8"
        >
          <h3 className="text-xl font-bold text-gray-900 mb-4">Upcoming Events</h3>
          {events.length === 0 ? (
            <Card className="border-gray-200">
              <CardContent className="p-12 text-center">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">No events scheduled</p>
                <p className="text-gray-500 text-sm mt-1">Click on any date to add an event</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 6)
                .map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card className="border-gray-200 hover:shadow-lg transition-all duration-300 h-full">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline" className="text-xs capitalize" style={getEventColor(event.type, event.color)}>
                            {event.type.replace("_", " ")}
                          </Badge>
                          <button onClick={() => setEvents((prev) => prev.filter((e) => e.id !== event.id))} className="text-gray-400 hover:text-red-500 transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">{event.title}</h4>
                        <div className="space-y-1.5 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                            {new Date(event.date).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          {event.time && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-gray-400" />
                              {new Date(event.time).toLocaleTimeString("en-PH", { hour: 'numeric', minute: '2-digit', hour12: true })}{event.endTime ? ` - ${new Date(event.endTime).toLocaleTimeString("en-PH", { hour: 'numeric', minute: '2-digit', hour12: true })}` : ""}
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-gray-400" />
                              {event.location}
                            </div>
                          )}
                        </div>
                        {event.notes && (
                          <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">{event.notes}</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Add Event Modal */}
      <AnimatePresence>
        {showEventModal && (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowEventModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900">Add Event</h3>
                <button onClick={() => setShowEventModal(false)} className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Add title</label>
                  <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Event title" className="h-11 rounded-xl border-gray-200" />
                  <div className="flex flex-wrap gap-2 mt-3">
                    {eventTypeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEventType(opt.value as CalendarEvent["type"])}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                          eventType === opt.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                        )}
                      >
                        <span>{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Date & Time</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Start</label>
                      <Input type="datetime-local" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="h-11 rounded-xl border-gray-200 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">End</label>
                      <Input type="datetime-local" value={eventEndTime} onChange={(e) => setEventEndTime(e.target.value)} className="h-11 rounded-xl border-gray-200 text-sm" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Reminder Date</label>
                  <Input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="h-11 rounded-xl border-gray-200 text-sm" />
                  <p className="text-xs text-gray-500 mt-1.5">You&apos;ll receive an email reminder at this date and time.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    placeholder="Add notes or description..."
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Event Color</label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setEventColor(color.value)}
                        className={cn(
                          "h-8 w-8 rounded-full border-2 transition-all",
                          eventColor === color.value ? "border-gray-900 scale-110" : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color.value }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setShowEventModal(false)} className="flex-1 h-11">Cancel</Button>
                  <Button onClick={handleAddEvent} className="flex-1 h-11 bg-blue-600 hover:bg-blue-700">
                    Save Event
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
