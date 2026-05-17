"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Mic, MicOff } from "lucide-react";

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: { length: number; [i: number]: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function VoiceCapture({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string, isFinal: boolean) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognition());
  }, []);

  const toggle = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor || disabled) return;

    if (listening && recRef.current) {
      recRef.current.stop();
      setListening(false);
      return;
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event) => {
      let chunk = "";
      for (let i = 0; i < event.results.length; i++) {
        chunk += event.results[i][0].transcript;
      }
      const last = event.results[event.results.length - 1];
      const isFinal = !!(last as { isFinal?: boolean }).isFinal;
      onTranscript(chunk.trim(), isFinal);
    };

    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  if (!supported) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-300">
        Voice input needs Chrome or Edge. You can type your command below instead.
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant={listening ? "primary" : "secondary"}
      onClick={toggle}
      disabled={disabled}
      className="gap-2"
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
      {listening ? "Stop speaking" : "Speak command"}
    </Button>
  );
}
