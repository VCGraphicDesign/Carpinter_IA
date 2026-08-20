import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, AlertCircle, Sparkles } from 'lucide-react';
import { CameraError, CapturedImage, FacingMode } from '../types';

interface CameraViewProps {
  onCapture: (image: CapturedImage) => void;
  onClose: () => void;
}

export function CameraView({ onCapture, onClose }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<CameraError | null>(null);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  // Check available video devices
  useEffect(() => {
    async function checkDevices() {
      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          setHasMultipleCameras(videoInputs.length > 1);
        } catch {
          // Ignore enumeration errors
        }
      }
    }
    checkDevices();
  }, []);

  // Initialize and stop camera stream
  useEffect(() => {
    let isMounted = true;

    async function startCamera() {
      setIsLoading(true);
      setError(null);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) {
          setError({
            type: 'not_found',
            message: 'Tu navegador no soporta el acceso directo a la cámara web o móvil.'
          });
          setIsLoading(false);
        }
        return;
      }

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ensure playback starts smoothly on iOS/Android
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('Auto-play fallback error:', playErr);
          }
        }
        setIsLoading(false);
      } catch (err: any) {
        if (!isMounted) return;
        setIsLoading(false);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError({
            type: 'permission_denied',
            message: 'Permiso denegado. Por favor, permite el acceso a la cámara en los ajustes de tu navegador.'
          });
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError({
            type: 'not_found',
            message: 'No se detectó ninguna cámara disponible en este dispositivo.'
          });
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError({
            type: 'not_readable',
            message: 'La cámara ya está siendo usada por otra aplicación o pestaña.'
          });
        } else {
          setError({
            type: 'unknown',
            message: err.message || 'Ocurrió un error inesperado al conectar con la cámara.'
          });
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleCapture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Haptic feedback if available on mobile
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch {
        // Safe fallback
      }
    }

    // Flash visual animation
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // If user facing (front camera), mirror the capture if needed
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

      const captured: CapturedImage = {
        id: 'foto_' + Date.now(),
        dataUrl,
        source: 'camara',
        name: `Foto_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.jpg`,
        width: canvas.width,
        height: canvas.height,
        capturedAt: new Date()
      };

      // Stop camera stream immediately
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      onCapture(captured);
    }
  };

  return (
    <div id="camera-modal" className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none">
      {/* Top Bar */}
      <div className="relative z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center space-x-2 text-white">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-semibold tracking-wider uppercase text-neutral-300">
            Cámara en Vivo
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {hasMultipleCameras && (
            <button
              id="btn-switch-camera"
              onClick={toggleFacingMode}
              disabled={isLoading || !!error}
              title="Cambiar cámara frontal / trasera"
              className="p-2.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white border border-neutral-700/50 backdrop-blur-md transition-all active:scale-95 disabled:opacity-40"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}

          <button
            id="btn-close-camera"
            onClick={onClose}
            title="Cerrar cámara"
            className="p-2.5 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white border border-neutral-700/50 backdrop-blur-md transition-all active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewfinder Center */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        {/* Shutter flash effect */}
        {isFlashing && (
          <div className="absolute inset-0 bg-white z-40 transition-opacity duration-200 pointer-events-none" />
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-cover transition-transform duration-300 ${
            facingMode === 'user' ? 'scale-x-[-1]' : ''
          } ${isLoading || error ? 'opacity-0' : 'opacity-100'}`}
        />

        {/* Framing Guides Overlay */}
        {!isLoading && !error && (
          <div className="absolute inset-8 sm:inset-16 pointer-events-none border border-white/20 rounded-2xl flex flex-col justify-between p-4">
            <div className="flex justify-between">
              <div className="w-6 h-6 border-t-2 border-l-2 border-white/80 rounded-tl" />
              <div className="w-6 h-6 border-t-2 border-r-2 border-white/80 rounded-tr" />
            </div>
            <div className="text-center">
              <span className="text-[11px] font-medium tracking-wider uppercase text-white/60 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                Enfoca tu objetivo
              </span>
            </div>
            <div className="flex justify-between">
              <div className="w-6 h-6 border-b-2 border-l-2 border-white/80 rounded-bl" />
              <div className="w-6 h-6 border-b-2 border-r-2 border-white/80 rounded-br" />
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white space-y-3 bg-neutral-950">
            <div className="w-10 h-10 border-3 border-neutral-700 border-t-emerald-400 rounded-full animate-spin" />
            <p className="text-sm font-medium text-neutral-300">Iniciando cámara...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-6 max-w-sm m-auto p-6 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-center flex flex-col items-center justify-center space-y-4 backdrop-blur-xl shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">No se pudo acceder a la cámara</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">{error.message}</p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 w-full">
              <button
                id="btn-retry-camera"
                onClick={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-all"
              >
                Reintentar
              </button>
              <button
                id="btn-cancel-camera-error"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-700/50 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-all"
              >
                Volver
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="relative z-20 p-6 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center justify-around pb-8 sm:pb-6">
        <button
          id="btn-cancel-bottom"
          onClick={onClose}
          className="text-xs font-medium text-neutral-400 hover:text-white px-3 py-2 rounded-lg transition-colors"
        >
          Cancelar
        </button>

        {/* Shutter Button */}
        <div className="relative flex items-center justify-center">
          <button
            id="btn-shutter-capture"
            onClick={handleCapture}
            disabled={isLoading || !!error}
            aria-label="Capturar fotografía"
            className="group relative w-20 h-20 rounded-full border-4 border-white/80 p-1 flex items-center justify-center transition-all transform active:scale-90 disabled:opacity-40 disabled:pointer-events-none hover:border-white"
          >
            <div className="w-full h-full rounded-full bg-white group-hover:bg-neutral-100 transition-colors shadow-lg" />
          </button>
        </div>

        {hasMultipleCameras ? (
          <button
            id="btn-toggle-camera-bottom"
            onClick={toggleFacingMode}
            disabled={isLoading || !!error}
            className="text-xs font-medium text-neutral-400 hover:text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Girar</span>
          </button>
        ) : (
          <div className="w-12" />
        )}
      </div>

      {/* Hidden Canvas for High Resolution Capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
