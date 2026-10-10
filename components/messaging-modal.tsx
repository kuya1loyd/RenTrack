"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { X, Send, User, Image as ImageIcon, Mic, Square, Phone, Video, Home } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { getInitials, getTimeAgo } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getMessages, sendMessage, markAllMessagesRead, uploadMessageAttachment, getProperties, getUnits, Message, Property, Unit } from "@/lib/data";
import { toast } from "sonner";

interface MessagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  otherUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
    allowMessages?: boolean;
  };
  properties?: { id: string; name: string; location: string; type: string; units: number; rentAmount?: number; unitNames?: string[] }[];
}

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  owner: "bg-blue-100 text-blue-700 border-blue-200",
  agent: "bg-emerald-100 text-emerald-700 border-emerald-200",
  tenant: "bg-amber-100 text-amber-700 border-amber-200",
};

const EMPTY_PROPERTIES: MessagingModalProps["properties"] = [];

export default function MessagingModal({ isOpen, onClose, otherUser, properties = EMPTY_PROPERTIES }: MessagingModalProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [attachmentType, setAttachmentType] = useState<"image" | "audio" | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [checkingMicrophone, setCheckingMicrophone] = useState(false);
  const [showPropertyPicker, setShowPropertyPicker] = useState(false);
  const [loadedProperties, setLoadedProperties] = useState<MessagingModalProps["properties"]>(properties);
  const audioPreviewUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragControls = useDragControls();
  const availableProperties = loadedProperties || [];

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    setLoadedProperties(properties);
  }, [properties]);

  useEffect(() => {
    if (!isOpen || availableProperties.length > 0) return;
    Promise.all([getProperties(), getUnits()]).then(([propertyData, unitData]) => {
      setLoadedProperties((propertyData || []).map((property: Property) => ({
        ...property,
        unitNames: (unitData || []).filter((unit: Unit) => unit?.propertyId === property.id).map((unit: Unit) => unit.unitNumber),
      })));
    }).catch(() => setLoadedProperties([]));
  }, [isOpen, availableProperties.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && otherUser?.id) {
      void markAllMessagesRead(otherUser.id);
      setLoading(true);
      setMessages([]);
      setNewMessage("");
      setSubject("");
      setAttachmentPreview(null);
      setImageFile(null);
      setAttachmentType(null);
      setAudioBlob(null);
      setIsRecording(false);
      setRecordingTime(0);
      setRecordingError(null);
      getMessages(otherUser.id)
        .then((msgs) => {
          setMessages(msgs);
          if (msgs.length > 0) {
            void markAllMessagesRead(otherUser.id);
          }
        })
        .catch(() => toast.error("Failed to load messages"))
        .finally(() => setLoading(false));
      scrollToBottom();
    }
  }, [isOpen, otherUser?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    setAttachmentUploading(true);
    try {
      const compressed = await compressImage(file, 1200, 0.7);
      setAttachmentPreview(compressed);
      setImageFile(dataUrlToFile(compressed, "photo.jpg"));
      setAttachmentType("image");
      setAudioBlob(null);
    } catch {
      toast.error("Failed to process image");
    } finally {
      setAttachmentUploading(false);
    }
  };

  const dataUrlToFile = (dataUrl: string, filename: string) => {
    const [header, encoded] = dataUrl.split(",");
    const mimeType = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
    const bytes = atob(encoded);
    const array = Uint8Array.from(bytes, (character) => character.charCodeAt(0));
    return new File([array], filename, { type: mimeType });
  };

  const compressImage = (file: File, maxWidth: number, quality: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("Canvas context unavailable"));
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const startRecording = async () => {
    setRecordingError(null);
    setCheckingMicrophone(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone recording requires HTTPS or localhost.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
        ? "audio/webm;codecs=opus" 
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);
        setAttachmentPreview(null);
        setAttachmentType("audio");
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 59) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      const errorName = err instanceof DOMException ? err.name : "";
      const message = errorName === "NotAllowedError" || errorName === "SecurityError"
        ? "Microphone permission was denied. Allow microphone access in your browser settings, then try again."
        : err instanceof Error ? err.message : "Microphone access denied or not available";
      setRecordingError(message);
      toast.error(message);
    } finally {
      setCheckingMicrophone(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const clearAttachment = () => {
    setAttachmentPreview(null);
    setImageFile(null);
    setAttachmentType(null);
    setAudioBlob(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() && !attachmentPreview && !audioBlob) return;
    if (sending) return;

    setSending(true);
    let attachmentUrl: string | undefined;
    let attachmentTypeToSend: string | undefined;

    try {
      if (attachmentPreview && attachmentType === "image") {
        if (!imageFile) throw new Error("Image is not ready yet");
        attachmentUrl = await uploadMessageAttachment(imageFile, "image");
        attachmentTypeToSend = "image";
      } else if (audioBlob && attachmentType === "audio") {
        attachmentUrl = await uploadMessageAttachment(new File([audioBlob], "voice-message.webm", { type: audioBlob.type || "audio/webm" }), "audio");
        attachmentTypeToSend = "audio";
      }
    } catch (err) {
      console.error("Attachment processing error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to process attachment");
      setSending(false);
      return;
    }

    try {
      const sent = await sendMessage({
        receiverId: otherUser.id,
        subject: subject.trim() || undefined,
        body: newMessage.trim() || (attachmentTypeToSend === "image" ? "Photo" : "Voice message"),
        attachmentUrl,
        attachmentType: attachmentTypeToSend,
      });
      setMessages((prev) => [...prev, sent]);
      setNewMessage("");
      setSubject("");
      clearAttachment();
    } catch (err) {
      console.error("Send message error:", err);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen || !otherUser?.id) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0.05}
        className="relative z-10 w-full h-full sm:h-[600px] sm:max-w-lg sm:rounded-3xl bg-white sm:shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Messenger style */}
        <div
          className="flex cursor-move select-none touch-none items-center gap-3 p-3 bg-[#0084ff] text-white shrink-0"
          onPointerDown={(event) => {
            if (!(event.target as HTMLElement).closest("button")) dragControls.start(event);
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors cursor-pointer z-50 pointer-events-auto"
            aria-label="Close message"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          <Avatar src={otherUser.avatarUrl} fallback={getInitials(otherUser.name)} size="md" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{otherUser.name}</h3>
            <p className="text-xs text-white/80 capitalize">{otherUser.role}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                try {
                  const roomName = `RentTrack-Audio-${[user?.id || "user", otherUser.id].sort().join("-")}`;
                  const roomUrl = `https://meet.jit.si/${encodeURIComponent(roomName)}#config.startWithAudioMuted=false&config.startWithVideoMuted=true`;
                  await sendMessage({
                    receiverId: otherUser.id,
                    subject: "Audio call request",
                    body: `${user?.name || "A user"} started an audio call. Join here: ${roomUrl}`,
                  });
                  window.open(roomUrl, "_blank", "noopener,noreferrer");
                  toast.success("Audio room opened and link sent");
                } catch {
                  toast.error("Could not start the audio call");
                }
              }}
              className="h-9 w-9 hidden sm:flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              aria-label="Start audio call"
            >
              <Phone className="h-4 w-4 text-white" />
            </button>
            <button
              onClick={async () => {
                try {
                  const roomName = `RentTrack-${[user?.id || "tenant", otherUser.id].sort().join("-")}`;
                  const roomUrl = `https://meet.jit.si/${encodeURIComponent(roomName)}`;
                  await sendMessage({ receiverId: otherUser.id, subject: "Video call request", body: `${user?.name || "Tenant"} started a video call. Join here: ${roomUrl}` });
                  window.open(roomUrl, "_blank", "noopener,noreferrer");
                  toast.success("Video room opened and link sent to the agent");
                } catch {
                  toast.error("Could not send video call request");
                }
              }}
              className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
              aria-label="Request video call"
            >
              <Video className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-3 sm:p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-6 w-6 border-2 border-gray-300 border-t-[#0084ff] rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="h-16 w-16 rounded-full bg-[#0084ff]/10 flex items-center justify-center mb-3">
                <User className="h-8 w-8 text-[#0084ff]" />
              </div>
              <p className="text-base font-semibold text-gray-900">No messages yet</p>
              <p className="text-sm text-gray-500 mt-1">Send a message to start the conversation</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%] sm:max-w-[75%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {msg.subject && !isMe && (
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5 ml-1">{msg.subject}</p>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2 ${
                        isMe
                          ? "bg-[#0084ff] text-white rounded-br-sm"
                          : "bg-white text-gray-900 rounded-bl-sm shadow-sm"
                      }`}
                    >
                      {msg.attachmentUrl && msg.attachmentType === "image" && (
                        <div className="mb-1.5 rounded-xl overflow-hidden">
                          <img 
                            src={msg.attachmentUrl} 
                            alt="Attachment" 
                            className="max-w-full h-auto max-h-56 object-cover rounded-xl"
                          />
                        </div>
                      )}
                      {msg.attachmentUrl && msg.attachmentType === "audio" && (
                        <div className={`mb-1.5 ${isMe ? "bg-white/20" : "bg-gray-50"} rounded-xl px-3 py-2`}>
                          <audio controls src={msg.attachmentUrl} className="h-9 max-w-full" />
                        </div>
                      )}
                      {msg.body && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                      {getTimeAgo(msg.createdAt)}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Attachment Preview */}
        <AnimatePresence>
          {(attachmentPreview || audioBlob) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 py-2 bg-white border-t border-gray-200 shrink-0"
            >
              <div className="flex items-center gap-3">
                {attachmentPreview && attachmentType === "image" && (
                  <div className="relative">
                    <img src={attachmentPreview} alt="Preview" className="h-14 w-14 object-cover rounded-lg" />
                    <button
                      onClick={clearAttachment}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-500 text-white flex items-center justify-center text-xs hover:bg-gray-600 shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {audioBlob && attachmentType === "audio" && (
                  <div className="flex items-center gap-2 flex-1">
                    <audio controls src={audioPreviewUrl || ""} className="h-9 flex-1" />
                    <button
                      onClick={clearAttachment}
                      className="h-8 w-8 rounded-full bg-gray-500 text-white flex items-center justify-center hover:bg-gray-600 shadow-sm shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <span className="text-xs text-gray-500 truncate">
                  {attachmentUploading ? "Preparing photo..." : sending ? "Uploading attachment..." : attachmentType === "image" ? "Photo ready" : "Voice message ready"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording Indicator */}
        <AnimatePresence>
          {recordingError && !isRecording && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-between gap-3 border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span>{recordingError} Check the browser microphone icon near the address bar, allow access, then retry.</span>
              <button type="button" onClick={() => void startRecording()} disabled={checkingMicrophone} className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                {checkingMicrophone ? "Checking..." : "Retry"}
              </button>
            </motion.div>
          )}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="px-3 py-2.5 bg-red-50 border-t border-red-100 shrink-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-medium text-red-700">Recording...</span>
                  <span className="text-sm text-red-600 font-mono">{formatRecordingTime(recordingTime)}</span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="h-8 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Square className="h-3 w-3 mr-1 inline" />
                  Stop
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input - Messenger style */}
        <div className="p-2.5 sm:p-3 bg-[#f0f2f5] shrink-0">
          {messages.length === 0 && (
            <input
              type="text"
              placeholder="Subject (optional)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#0084ff]/20 focus:border-[#0084ff]"
            />
          )}
          <div className="flex items-end gap-1.5 sm:gap-2">
            <div className="flex-1 flex items-end bg-white rounded-2xl border border-gray-200 focus-within:border-[#0084ff] focus-within:ring-2 focus-within:ring-[#0084ff]/20 transition-all">
              <textarea
                ref={inputRef}
                placeholder="Aa"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                className="flex-1 min-h-[40px] sm:min-h-[44px] max-h-24 px-3 sm:px-4 py-2.5 bg-transparent text-sm resize-none focus:outline-none"
              />
               <div className="flex items-center gap-0.5 pr-1.5 pb-1.5">
                 <input
                   ref={fileInputRef}
                   type="file"
                   accept="image/*"
                   capture="environment"
                   className="hidden"
                   onChange={handlePhotoSelect}
                 />
                 <button
                   type="button"
                   onClick={() => fileInputRef.current?.click()}
                   disabled={sending || attachmentUploading || isRecording}
                   className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-[#0084ff] hover:bg-gray-50 transition-colors disabled:opacity-50"
                   title="Photo"
                 >
                   <ImageIcon className="h-5 w-5" />
                 </button>
                 {!isRecording ? (
                   <button
                     type="button"
                     onClick={startRecording}
                     disabled={sending || attachmentUploading}
                     className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-[#0084ff] hover:bg-gray-50 transition-colors disabled:opacity-50"
                     title="Voice message"
                   >
                     <Mic className="h-5 w-5" />
                   </button>
                 ) : (
                   <button
                     type="button"
                     onClick={stopRecording}
                     className="h-8 w-8 flex items-center justify-center rounded-full text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                     title="Stop recording"
                   >
                     <Square className="h-3 w-3" />
                   </button>
                 )}
                 {availableProperties.length > 0 && (
                   <div className="relative">
                     <button
                       type="button"
                       onClick={() => setShowPropertyPicker((prev) => !prev)}
                       className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-[#0084ff] hover:bg-gray-50 transition-colors"
                       title="Send property details"
                     >
                       <Home className="h-5 w-5" />
                     </button>
                     {showPropertyPicker && (
                       <div className="absolute bottom-10 left-0 w-72 bg-white rounded-xl shadow-lg border border-gray-200 max-h-64 overflow-y-auto z-20">
                         <div className="p-2 border-b border-gray-100">
                           <p className="text-xs font-medium text-gray-500">Send property details</p>
                         </div>
                         {availableProperties.map((p) => (
                           <button
                             key={p.id}
                             type="button"
                             onClick={() => {
                               setNewMessage(`Property: ${p.name || p.id}\nLocation: ${p.location || "-"}\nType: ${p.type || "-"}\nUnits: ${p.units ?? "-"}${p.rentAmount ? `\nRent Amount: ₱${Number(p.rentAmount).toLocaleString()}` : ""}`);
                               setShowPropertyPicker(false);
                               inputRef.current?.focus();
                             }}
                             className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                           >
                             <p className="font-medium text-gray-900">{p.name || "Property"}</p>
                             <p className="text-xs text-gray-500">{p.location}</p>
                             {p.unitNames && p.unitNames.length > 0 && (
                               <p className="mt-1 text-xs font-medium text-blue-600">
                                 Units: {p.unitNames.join(", ")}
                               </p>
                             )}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                 )}
               </div>
            </div>
            <button
              onClick={handleSend}
              disabled={(!newMessage.trim() && !attachmentPreview && !audioBlob) || sending || attachmentUploading}
              className="h-10 w-10 sm:h-11 sm:w-11 flex items-center justify-center rounded-full bg-[#0084ff] hover:bg-[#0073e6] disabled:bg-gray-300 disabled:cursor-not-allowed text-white transition-colors shrink-0 shadow-sm"
            >
              {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Send className="h-4 w-4 sm:h-5 sm:w-5" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
