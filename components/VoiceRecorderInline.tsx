"use client";

/**
 * The inline recorder used to be a separate copy of the recorder with the same
 * bugs (mic released on every re-render, hard-coded audio/webm). It now shares
 * the single maintained implementation.
 */
export { VoiceRecorderEnhanced as VoiceRecorderInline } from "./VoiceRecorderEnhanced";
