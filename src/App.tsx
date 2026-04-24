/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Languages, 
  Copy, 
  Download, 
  Volume2, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Video,
  FileText,
  RefreshCw,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TARGET_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'te', name: 'Telugu' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ originalText: string; translatedText: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const ai = useRef<GoogleGenAI | null>(null);

  useEffect(() => {
    if (process.env.GEMINI_API_KEY) {
      ai.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
  }, []);

  const onDrop = (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      if (selectedFile.size > 20 * 1024 * 1024) {
        setError("File is too large (max 20MB for direct processing).");
        return;
      }
      setFile(selectedFile);
      setVideoPreview(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
    }
  };

  // @ts-ignore - environmental type mismatch for optional dropzone properties
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] as string[] },
    multiple: false
  });

  const handleTranslate = async () => {
    if (!file || !ai.current) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Small delay to show animation
      await new Promise(r => setTimeout(r, 1000));

      const base64Data = await fileToBase64(file);
      const targetLangName = TARGET_LANGUAGES.find(l => l.code === targetLanguage)?.name || 'English';

      const response = await ai.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data.split(',')[1],
              },
            },
            {
              text: `Listen to this video carefully. Detect the spoken language.
              1. Transcribe the audio exactly in its original language.
              2. Translate the transcription into ${targetLangName}.
              
              Format your response as a valid JSON object with two keys:
              "originalText": "the original transcription",
              "translatedText": "the translated version"`,
            }
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              originalText: { type: Type.STRING },
              translatedText: { type: Type.STRING }
            },
            required: ["originalText", "translatedText"]
          }
        }
      });

      const data = JSON.parse(response.text);
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong during translation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleCopy = () => {
    if (result?.translatedText) {
      navigator.clipboard.writeText(result.translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const content = `Original Text:\n${result.originalText}\n\nTranslated Text (${targetLanguage}):\n${result.translatedText}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation_${targetLanguage}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSpeak = () => {
    if (!result?.translatedText) return;
    const utterance = new SpeechSynthesisUtterance(result.translatedText);
    const lang = targetLanguage === 'en' ? 'en-US' : targetLanguage;
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  };

  const reset = () => {
    setFile(null);
    setVideoPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="border-b border-black/10 py-6 px-4 md:px-12 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-black text-white p-2 rounded-xl">
            <Languages size={24} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">SmartDub</h1>
        </div>
        <div className="hidden md:flex gap-4">
          <button onClick={reset} className="text-sm font-medium opacity-60 hover:opacity-100 transition-opacity">
            New Project
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 py-12 md:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Upload and Controls */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <section>
              <h2 className="text-3xl font-bold tracking-tight mb-4 leading-tight">
                Translate your video <br />
                <span className="text-black/40">in seconds.</span>
              </h2>
              <p className="text-black/60 leading-relaxed mb-8">
                Upload any video file. We'll automatically detect the language, transcribe the audio, and translate it to your target language.
              </p>

              {!file ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-3xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 text-center group",
                    isDragActive ? "border-black bg-black/5" : "border-black/10 hover:border-black/20"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={28} className="text-black/40" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">Drop your video here</p>
                    <p className="text-sm text-black/40">MP4, MOV, or WEBM (Max 20MB)</p>
                  </div>
                  <button className="mt-2 px-6 py-2 bg-black text-white rounded-full text-sm font-medium hover:bg-black/80 transition-colors">
                    Browse Files
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-black/10 rounded-3xl overflow-hidden shadow-xl"
                >
                  <div className="relative aspect-video bg-black">
                    {videoPreview && (
                      <video 
                        src={videoPreview} 
                        className="w-full h-full object-contain" 
                        controls
                      />
                    )}
                    <button 
                      onClick={reset}
                      className="absolute top-4 right-4 bg-white/20 backdrop-blur-md hover:bg-white/40 p-2 rounded-full text-white transition-colors"
                    >
                      <RefreshCw size={20} />
                    </button>
                  </div>
                  <div className="p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Video size={18} className="text-black/40" />
                        <span className="text-sm font-medium truncate max-w-[150px]">{file.name}</span>
                      </div>
                      <span className="text-xs text-black/40">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-semibold uppercase tracking-wider text-black/40">Target Language</label>
                      <select 
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="w-full bg-black/5 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-black outline-none appearance-none cursor-pointer"
                      >
                        {TARGET_LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </select>

                      <button 
                        onClick={handleTranslate}
                        disabled={isProcessing}
                        className="w-full bg-black text-white rounded-2xl py-4 font-semibold flex items-center justify-center gap-2 hover:bg-black/90 transition-all disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="animate-spin" size={20} />
                            <span>Processing Audio...</span>
                          </>
                        ) : (
                          <>
                            <Languages size={20} />
                            <span>Start Translation</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </section>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 flex items-start gap-3"
              >
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex flex-col gap-6"
                >
                  <div className="bg-white border border-black/10 rounded-[32px] p-8 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <CheckCircle2 className="text-green-500" size={20} />
                        Translation Results
                      </h3>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleCopy}
                          className="p-2 hover:bg-black/5 rounded-full transition-colors relative"
                          title="Copy Translation"
                        >
                          <Copy size={20} />
                          {copied && (
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded">Copied!</span>
                          )}
                        </button>
                        <button 
                          onClick={handleSpeak}
                          className="p-2 hover:bg-black/5 rounded-full transition-colors"
                          title="Speak Translation"
                        >
                          <Volume2 size={20} />
                        </button>
                        <button 
                          onClick={handleDownload}
                          className="p-2 hover:bg-black/5 rounded-full transition-colors"
                          title="Download Text"
                        >
                          <Download size={20} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/30">Original Transcription (Auto-Detected)</label>
                        <div className="bg-[#FAF9F6] p-6 rounded-2xl border border-black/[0.03] text-black/60 italic leading-relaxed">
                          {result.originalText}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/30">
                          Translated Text ({TARGET_LANGUAGES.find(l => l.code === targetLanguage)?.name})
                        </label>
                        <div className="bg-black text-white p-8 rounded-2xl leading-relaxed text-lg font-medium shadow-lg">
                          {result.translatedText}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-black/10 p-6 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                        <Languages size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-black/40 uppercase font-bold">Accuracy</p>
                        <p className="font-semibold italic">Refined by AI</p>
                      </div>
                    </div>
                    <div className="bg-white border border-black/10 p-6 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                        <Volume2 size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-black/40 uppercase font-bold">Audio</p>
                        <p className="font-semibold italic">Ready to Play</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full min-h-[400px] border border-black/5 rounded-[40px] border-dashed flex flex-col items-center justify-center text-center p-12 bg-black/[0.01]"
                >
                  <div className="w-20 h-20 bg-black/[0.03] rounded-full flex items-center justify-center mb-6">
                    <FileText className="text-black/10" size={40} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Awaiting processing</h3>
                  <p className="text-black/40 max-w-sm">
                    Upload a video and choose your language to see the magic happen. Your results will appear here.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/5 py-12 px-12 text-center">
        <p className="text-sm text-black/30 font-medium">Powered by Gemini AI • SmartDub 2024</p>
      </footer>
    </div>
  );
}
