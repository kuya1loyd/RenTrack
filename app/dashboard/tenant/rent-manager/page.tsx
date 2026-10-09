"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, CheckCircle, Sparkles, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAgents, UserRecord } from "@/lib/data";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import MessagingModal from "@/components/messaging-modal";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 },
};

export default function TenantRentManagerPage() {
  const [agents, setAgents] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<UserRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAgents();
        setAgents(data);
      } catch {
        toast.error("Failed to load agents");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleContact = (agent: UserRecord) => {
    setSelectedAgent(agent);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 text-white py-10 overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-10 right-10 w-96 h-96 rounded-full bg-blue-400/20 blur-3xl"
        />
        <div className="relative w-full px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-medium mb-3">
              <Sparkles className="h-3 w-3" />
              Verified Agents
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Find A Rent Manager</h1>
            <p className="text-lg text-blue-100">Connect with trusted and verified rent managers.</p>
          </motion.div>
        </div>
      </div>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No agents available yet</p>
            <p className="text-gray-400 text-sm mt-1">Please check back later</p>
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {agents.map((agent) => (
              <motion.div
                key={agent.id}
                variants={item}
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                 <Card className="p-5 border-gray-200 hover:shadow-2xl transition-all duration-300 h-full group">
                   <div className="flex items-center gap-3 mb-3">
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl"
                    >
                      {getInitials(agent.name)}
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{agent.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] capitalize bg-emerald-50 text-emerald-600 border-emerald-200">
                          Agent
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {agent.email}
                    </div>
                    {agent.phone && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Verified Agent
                      </div>
                    )}
                  </div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      className="w-full"
                      onClick={() => handleContact(agent)}
                    >
                      Contact
                    </Button>
                  </motion.div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {selectedAgent && (
        <MessagingModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedAgent(null);
          }}
          otherUser={{
            id: selectedAgent.id,
            name: selectedAgent.name,
            email: selectedAgent.email,
            role: selectedAgent.role,
            avatarUrl: selectedAgent.avatarUrl,
            allowMessages: true,
          }}
        />
      )}
    </div>
  );
}
