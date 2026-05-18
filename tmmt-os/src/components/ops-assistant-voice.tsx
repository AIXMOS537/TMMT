"use client";

import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript?: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
}

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
};

export function OpsAssistantVoice({ onTranscript, disabled }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    setSupported(!!Ctor);
    if (!Ctor) return;

    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (text) onTranscript(text);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;

    return () => {
      rec.abort();
      recognitionRef.current = null;
    };
  }, [onTranscript]);

  const toggle = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || disabled) return;
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    setListening(true);
    rec.start();
  }, [disabled, listening]);

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Voice input works in Chrome/Safari on mobile — type below if unavailable.
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-all sm:w-auto sm:min-w-[10rem]",
        listening
          ? "border-red-300 bg-red-50 text-red-800 animate-pulse"
          : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
      )}
    >
      {listening ? (
        <>
          <MicOff className="h-5 w-5" />
          Listening… tap to stop
        </>
      ) : (
        <>
          <Mic className="h-5 w-5" />
          Tap to talk
        </>
      )}
    </button>
  );
}
