/**
 * Reusable Framer Motion variants for consistent animations across the app
 * All animations respect prefers-reduced-motion
 */

import type { Variants } from 'motion/react';

/**
 * Page element entrance animations
 * Usage: <motion.div variants={fadeInUp} initial="hidden" animate="visible">
 */
export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: 'easeOut',
    },
  },
};

/**
 * Stagger container for list items (like KPI cards)
 * Usage: <motion.div variants={staggerContainer} initial="hidden" animate="visible">
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

/**
 * Individual stagger item (child of staggerContainer)
 */
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: 'easeOut',
    },
  },
};

/**
 * Table row stagger animation
 * Faster and more subtle than card entrance
 */
export const tableRowStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const tableRowItem: Variants = {
  hidden: {
    opacity: 0,
    x: -4,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  },
};

/**
 * Simple fade in for content sections
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

/**
 * Slide down from top (for headers)
 */
export const slideDown: Variants = {
  hidden: {
    opacity: 0,
    y: -8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  },
};

/**
 * Hover animation variants for interactive elements
 * Use with whileHover prop
 */
export const hoverLift = {
  y: -2,
  transition: {
    duration: 0.2,
    ease: 'easeOut',
  },
};

export const hoverScale = {
  scale: 1.02,
  transition: {
    duration: 0.15,
    ease: 'easeOut',
  },
};

export const tapScale = {
  scale: 0.98,
  transition: {
    duration: 0.1,
    ease: 'easeOut',
  },
};
