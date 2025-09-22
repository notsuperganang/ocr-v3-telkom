"use client";

import { motion } from "motion/react";

export default function MotionTest() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <motion.div
        className="w-32 h-32 bg-blue-500 rounded-xl"
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
      <motion.button
        className="mt-6 px-4 py-2 bg-green-500 text-white rounded-lg"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        Click Me
      </motion.button>
    </div>
  );
}
