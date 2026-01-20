"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";

const API = process.env.NEXT_PUBLIC_API_URL || "https://alumni-backend-d9k9.onrender.com";

export default function Leaderboard() {
  const [currentYear, setCurrentYear] = useState([]);
  const [lastYear, setLastYear] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const token = localStorage.getItem("token");

  // Fetch current & last year leaderboard
  const fetchLeaderboards = async () => {
    setLoading(true);
    try {
      const [resCurrent, resLast] = await Promise.all([
        fetch(`${API}/api/admin/leaderboard`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/admin/leaderboard/last-year`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (!resCurrent.ok) throw new Error("Failed to fetch current year leaderboard");
      if (!resLast.ok) throw new Error("Failed to fetch last year leaderboard");

      const currentData = await resCurrent.json();
      const lastData = await resLast.json();

      setCurrentYear(currentData);
      setLastYear(lastData);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const filterUsers = (users) =>
    users.filter((u) =>
      `${u.name} ${u.enrollmentNumber || ""}`.toLowerCase().includes(search.toLowerCase())
    );

  const currentFiltered = filterUsers(currentYear);
  const lastFiltered = filterUsers(lastYear);

  // ----------------- CARD -----------------
  const Card = ({ title, users }) => (
    <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">{title}</h2>
      {users.length === 0 ? (
        <p className="text-gray-500 text-center">No eligible users.</p>
      ) : (
        <ul className="space-y-4">
          {users.map((user, index) => (
            <li
              key={user._id}
              className="flex items-center justify-between bg-gray-100 rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center space-x-4">
                <span className="text-lg font-bold text-gray-700 w-6">{index + 1}.</span>
                <Image
                  src={user.profilePicture || "/default-profile.png"}
                  alt={user.name}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover border border-gray-300"
                />
                <div>
                  <p className="font-semibold text-lg text-gray-800">{user.name}</p>
                  <p className="text-sm text-gray-500">{user.enrollmentNumber || "N/A"}</p>
                </div>
              </div>
              <span className="font-bold text-blue-600 text-lg">
                {user.points?.total ?? user.lastYearPoints?.total ?? 0} pts
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <motion.div
      key="leaderboard"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6"
    >
      <div className="flex justify-between items-center mb-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-blue-700">🏆 Alumni Leaderboard</h1>
        <input
          type="text"
          placeholder="Search by name or enrollment…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border rounded-md w-1/3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading leaderboard...</p>
      ) : (
        <>
          <Card title="🎓 Current Year" users={currentFiltered} />
          <Card title="🥇 Last Year" users={lastFiltered} />
        </>
      )}
    </motion.div>
  );
}
