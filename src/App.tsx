import { useState, useRef, ChangeEvent } from 'react';
import { Camera, Image as ImageIcon, Loader2, AlertCircle, Sparkles, Ruler, Wrench, RefreshCw, Hammer, Compass, Box, Download, Layers, Check } from 'lucide-react';
import { CapturedImage, ErgonomicResult, DespieceResult, Design2DResult, Design3DResult } from './types';
import { CameraView } from './components/CameraView';

// Función auxiliar de reintentos automáticos en cliente
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3, baseDelayMs = 2000): Promise<Response> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Si es error 503, 502, 504 o 429 (alta demanda / servicio no disponible)
      if (!response.ok && [503, 502, 504, 429].includes(response.status) && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(1.5, attempt - 1);
        console.warn(`[Cliente Reintento ${attempt}/${maxRetries}] Servidor ocupado (${response.status}). Esperando ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(1.5, attempt - 1);
        console.warn(`[Cliente Reintento ${attempt}/${maxRetries}] Error de red temporal. Esperando ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }

  throw lastError;
}

export default function App() {
  const [currentImage, setCurrentImage] = useState<CapturedImage | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);

  // Análisis visual básico automático
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Funcionalidad "Manos a la obra" (Ergonomía y Dimensiones)
  const [isCalculatingErgonomics, setIsCalculatingErgonomics] = useState<boolean>(false);
  const [ergonomicResult, setErgonomicResult] = useState<ErgonomicResult | null>(null);
  const [ergonomicError, setErgonomicError] = useState<string | null>(null);

  // Funcionalidad "Despiece" (Maestro Carpintero)
  const [isCalculatingDespiece, setIsCalculatingDespiece] = useState<boolean>(false);
  const [despieceResult, setDespieceResult] = useState<DespieceResult | null>(null);
  const [despieceError, setDespieceError] = useState<string | null>(null);

  // Funcionalidad "Diseño 2D" (Plano Técnico 2D)
  const [isCalculatingDesign2D, setIsCalculatingDesign2D] = useState<boolean>(false);
  const [design2DResult, setDesign2DResult] = useState<Design2DResult | null>(null);
  const [design2DError, setDesign2DError] = useState<string | null>(null);

  // Funcionalidad "Diseño 3D" (Modelo Isométrico 3D)
  const [isCalculatingDesign3D, setIsCalculatingDesign3D] = useState<boolean>(false);
  const [design3DResult, setDesign3DResult] = useState<Design3DResult | null>(null);
  const [design3DError, setDesign3DError] = useState<string | null>(null);

  const [downloadedStatus, setDownloadedStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Análisis visual básico inicial con reintentos automáticos
  async function analizarImagen(imagen: CapturedImage) {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    try {
      const match = imagen.dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';

      const response = await fetchWithRetry('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: imagen.dataUrl,
          mimeType: mimeType,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${response.status})`);
      }

      const data = await response.json();
      setAnalysisResult(data.description);
    } catch (err: any) {
      console.error('Error durante analizarImagen:', err);
      setAnalysisError(err.message || 'Error al conectar con la API de Gemini.');
    } finally {
      setIsAnalyzing(false);
    }
  }

  // 2. Funcionalidad: "Manos a la obra" (Ergonomía y Escala) con reintentos automáticos
  async function calcularErgonomia() {
    if (!currentImage) return;

    setIsCalculatingErgonomics(true);
    setErgonomicError(null);

    try {
      const match = currentImage.dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';

      const response = await fetchWithRetry('/api/ergonomic-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: currentImage.dataUrl,
          mimeType: mimeType,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${response.status})`);
      }

      const data: ErgonomicResult = await response.json();
      setErgonomicResult(data);
    } catch (err: any) {
      console.error('Error durante calcularErgonomia:', err);
      setErgonomicError(err.message || 'Error al calcular las dimensiones ergonómicas.');
    } finally {
      setIsCalculatingErgonomics(false);
    }
  }

  // 3. Funcionalidad: "Despiece" (Maestro Carpintero) con reintentos automáticos
  async function calcularDespiece() {
    if (!currentImage) return;

    setIsCalculatingDespiece(true);
    setDespieceError(null);

    try {
      const match = currentImage.dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';

      const response = await fetchWithRetry('/api/despiece', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: currentImage.dataUrl,
          mimeType: mimeType,
          dimensiones: ergonomicResult?.dimensiones,
          objetoDetectado: ergonomicResult?.objetoDetectado,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${response.status})`);
      }

      const data: DespieceResult = await response.json();
      setDespieceResult(data);
    } catch (err: any) {
      console.error('Error durante calcularDespiece:', err);
      setDespieceError(err.message || 'Error al generar el despiece de carpintería.');
    } finally {
      setIsCalculatingDespiece(false);
    }
  }

  // 4. Funcionalidad: "Diseño 2D" (Plano Técnico) con reintentos automáticos
  async function calcularDiseno2D() {
    if (!currentImage) return;

    setIsCalculatingDesign2D(true);
    setDesign2DError(null);

    try {
      const match = currentImage.dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';

      const response = await fetchWithRetry('/api/design-2d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: currentImage.dataUrl,
          mimeType: mimeType,
          dimensiones: ergonomicResult?.dimensiones,
          objetoDetectado: ergonomicResult?.objetoDetectado,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${response.status})`);
      }

      const data: Design2DResult = await response.json();
      setDesign2DResult(data);
    } catch (err: any) {
      console.error('Error durante calcularDiseno2D:', err);
      setDesign2DError(err.message || 'Error al generar el plano técnico 2D.');
    } finally {
      setIsCalculatingDesign2D(false);
    }
  }

  // 5. Funcionalidad: "Diseño 3D" (Modelo Isométrico) con reintentos automáticos
  async function calcularDiseno3D() {
    if (!currentImage) return;

    setIsCalculatingDesign3D(true);
    setDesign3DError(null);

    try {
      const match = currentImage.dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      const mimeType = match ? match[1] : 'image/jpeg';

      const response = await fetchWithRetry('/api/design-3d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: currentImage.dataUrl,
          mimeType: mimeType,
          dimensiones: ergonomicResult?.dimensiones,
          objetoDetectado: ergonomicResult?.objetoDetectado,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${response.status})`);
      }

      const data: Design3DResult = await response.json();
      setDesign3DResult(data);
    } catch (err: any) {
      console.error('Error durante calcularDiseno3D:', err);
      setDesign3DError(err.message || 'Error al generar el modelo 3D.');
    } finally {
      setIsCalculatingDesign3D(false);
    }
  }

  // Descargar plano / modelo en SVG
  const handleDownloadSvg = (svgContent: string, fileName: string) => {
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadedStatus(fileName);
      setTimeout(() => setDownloadedStatus(null), 3000);
    } catch (e) {
      console.error("Error al descargar archivo SVG:", e);
    }
  };

  // Manejo de captura de cámara
  const handleCapture = (image: CapturedImage) => {
    setCurrentImage(image);
    setIsCameraOpen(false);
    setErgonomicResult(null);
    setErgonomicError(null);
    setDespieceResult(null);
    setDespieceError(null);
    setDesign2DResult(null);
    setDesign2DError(null);
    setDesign3DResult(null);
    setDesign3DError(null);
    analizarImagen(image);
  };

  // Manejo de subida desde galería
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona un archivo de imagen válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const newImage: CapturedImage = {
          id: 'galeria_' + Date.now(),
          dataUrl,
          source: 'galeria',
          name: file.name,
          size: file.size,
          width: img.width,
          height: img.height,
          capturedAt: new Date(),
        };
        setCurrentImage(newImage);
        setErgonomicResult(null);
        setErgonomicError(null);
        setDespieceResult(null);
        setDespieceError(null);
        setDesign2DResult(null);
        setDesign2DError(null);
        setDesign3DResult(null);
        setDesign3DError(null);
        analizarImagen(newImage);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleReset = () => {
    setCurrentImage(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setErgonomicResult(null);
    setErgonomicError(null);
    setDespieceResult(null);
    setDespieceError(null);
    setDesign2DResult(null);
    setDesign2DError(null);
    setDesign3DResult(null);
    setDesign3DError(null);
    setIsAnalyzing(false);
    setIsCalculatingErgonomics(false);
    setIsCalculatingDespiece(false);
    setIsCalculatingDesign2D(false);
    setIsCalculatingDesign3D(false);
  };

  const isAnyLoading = isCalculatingErgonomics || isCalculatingDespiece || isCalculatingDesign2D || isCalculatingDesign3D;

  return (
    <div id="app-root" className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4 sm:p-6 select-none overflow-y-auto">
      {/* Selector de archivos oculto para la galería */}
      <input
        ref={fileInputRef}
        id="gallery-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Estado 1: Si NO hay imagen, mostrar ÚNICAMENTE los dos botones centrales */}
      {!currentImage ? (
        <div className="w-full max-w-xs flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
          {/* Botón 1: Cámara */}
          <button
            id="btn-camera"
            onClick={() => setIsCameraOpen(true)}
            className="w-full min-h-[58px] py-4 px-6 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-base tracking-tight transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <Camera className="w-5 h-5 text-neutral-950" />
            <span>Cámara</span>
          </button>

          {/* Botón 2: Subir desde galería */}
          <button
            id="btn-gallery"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[58px] py-4 px-6 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-100 font-semibold text-base tracking-tight transition-all border border-neutral-800 active:scale-[0.98] flex items-center justify-center gap-3"
          >
            <ImageIcon className="w-5 h-5 text-neutral-300" />
            <span>Subir desde galería</span>
          </button>
        </div>
      ) : (
        /* Estado 2: Si YA hay imagen, mostrar la imagen limpia y las herramientas avanzadas */
        <div className="w-full max-w-md flex flex-col items-center space-y-4 py-4 animate-in fade-in duration-300">
          {/* Imagen cargada */}
          <div className="w-full max-h-[44vh] flex items-center justify-center rounded-2xl overflow-hidden bg-neutral-900/60 border border-neutral-800 p-2 shadow-2xl">
            <img
              id="preview-image"
              src={currentImage.dataUrl}
              alt="Imagen cargada"
              className="max-h-[40vh] w-auto max-w-full object-contain rounded-xl"
            />
          </div>

          {/* Botones Principales de Acción */}
          <div className="w-full grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Botón 1: "Manos a la obra" (Ergonomía / Dimensiones) */}
            <button
              id="btn-manos-a-la-obra"
              onClick={calcularErgonomia}
              disabled={isAnyLoading}
              className="w-full min-h-[48px] py-2.5 px-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-bold text-xs sm:text-sm tracking-tight transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCalculatingErgonomics ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                  <span>Calculando...</span>
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 text-neutral-950" />
                  <span>Manos a la obra</span>
                </>
              )}
            </button>

            {/* Botón 2: "Despiece" (Maestro Carpintero) */}
            <button
              id="btn-despiece"
              onClick={calcularDespiece}
              disabled={isAnyLoading}
              className="w-full min-h-[48px] py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs sm:text-sm tracking-tight transition-all shadow-lg hover:shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCalculatingDespiece ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
                  <span>Desglosando...</span>
                </>
              ) : (
                <>
                  <Hammer className="w-4 h-4 text-neutral-950" />
                  <span>Despiece</span>
                </>
              )}
            </button>

            {/* Botón 3: "Diseño 2D" (Plano Técnico 2D) */}
            <button
              id="btn-diseno-2d"
              onClick={calcularDiseno2D}
              disabled={isAnyLoading}
              className="w-full min-h-[48px] py-2.5 px-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm tracking-tight transition-all shadow-lg hover:shadow-sky-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCalculatingDesign2D ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Plano 2D...</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4 text-white" />
                  <span>Diseño 2D</span>
                </>
              )}
            </button>

            {/* Botón 4: "Diseño 3D" (Modelo Isométrico 3D) */}
            <button
              id="btn-diseno-3d"
              onClick={calcularDiseno3D}
              disabled={isAnyLoading}
              className="w-full min-h-[48px] py-2.5 px-3 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm tracking-tight transition-all shadow-lg hover:shadow-violet-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCalculatingDesign3D ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Modelo 3D...</span>
                </>
              ) : (
                <>
                  <Box className="w-4 h-4 text-white" />
                  <span>Diseño 3D</span>
                </>
              )}
            </button>
          </div>

          {/* Panel 1: Datos Técnicos Calculados ("Manos a la obra") */}
          {ergonomicResult && !isCalculatingErgonomics && (
            <div
              id="panel-datos-tecnicos"
              className="w-full rounded-2xl bg-neutral-900/95 border border-neutral-800 p-4 shadow-xl flex flex-col gap-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  <Ruler className="w-4 h-4 text-emerald-400" />
                  <span>Datos Técnicos Calculados</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono">Ergonomía IA</span>
              </div>

              {/* Objeto detectado */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
                  Objeto detectado
                </span>
                <p id="tecnico-objeto" className="text-sm font-medium text-white">
                  {ergonomicResult.objetoDetectado}
                </p>
              </div>

              {/* Elementos de contexto encontrados */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
                  Elementos de contexto encontrados
                </span>
                <p id="tecnico-contexto" className="text-sm text-neutral-300">
                  {ergonomicResult.elementosContexto}
                </p>
              </div>

              {/* Dimensiones calculadas del mueble */}
              <div className="flex flex-col gap-1 p-3 rounded-xl bg-neutral-950 border border-neutral-800/80">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wide">
                  Dimensiones calculadas del mueble (Largo × Ancho × Alto)
                </span>
                <p id="tecnico-dimensiones" className="text-base font-bold font-mono text-emerald-300">
                  {ergonomicResult.dimensiones}
                </p>
              </div>

              {/* Criterio de cálculo */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
                  Criterio de cálculo
                </span>
                <p id="tecnico-criterio" className="text-xs text-neutral-400 italic">
                  {ergonomicResult.criterioCalculo}
                </p>
              </div>
            </div>
          )}

          {/* Panel 2: Despiece Técnico de Carpintería ("Despiece") */}
          {despieceResult && !isCalculatingDespiece && (
            <div
              id="panel-despiece"
              className="w-full rounded-2xl bg-neutral-900/95 border border-neutral-800 p-4 shadow-xl flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <Hammer className="w-4 h-4 text-amber-400" />
                  <span>Despiece Profesional de Carpintería</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono">Maestro Carpintero</span>
              </div>

              {/* Identificación de Material */}
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                  Material Estimado
                </span>
                <p id="despiece-madera" className="text-sm font-semibold text-amber-200">
                  {despieceResult.tipoMadera}
                </p>
                {despieceResult.resumenMueble && (
                  <p className="text-xs text-neutral-400">
                    {despieceResult.resumenMueble}
                  </p>
                )}
              </div>

              {/* Desglose Descriptivo por Piezas */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                    Desglose de Piezas para Corte
                  </span>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Total: {despieceResult.piezas.reduce((acc, p) => acc + (p.cantidad || 1), 0)} pzs
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {despieceResult.piezas.map((pieza, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-semibold text-white">
                            {pieza.nombre}
                          </span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold font-mono">
                          {pieza.cantidad} {pieza.cantidad === 1 ? 'pieza' : 'piezas'}
                        </span>
                      </div>

                      {/* Dimensiones y forma */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <div className="px-2 py-1 rounded-lg bg-neutral-900 text-emerald-300 font-mono font-semibold border border-neutral-800">
                          {pieza.dimensiones}
                        </div>
                        {pieza.forma && (
                          <span className="text-neutral-400 text-[11px] italic">
                            ({pieza.forma})
                          </span>
                        )}
                      </div>

                      {/* Detalles técnicos específicos */}
                      {pieza.detallesTecnicos && (
                        <p className="text-[11px] text-neutral-400 leading-relaxed pt-0.5 border-t border-neutral-900">
                          {pieza.detallesTecnicos}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Observaciones de Carpintería / Ensamble */}
              {despieceResult.observacionesCarpinteria && (
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Observaciones Técnicas y Ensamble
                  </span>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {despieceResult.observacionesCarpinteria}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Panel 3: Plano Técnico Constructivo 2D ("Diseño 2D") */}
          {design2DResult && !isCalculatingDesign2D && (
            <div
              id="panel-diseno-2d"
              className="w-full rounded-2xl bg-neutral-900/95 border border-sky-900/40 p-4 shadow-xl flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                  <Compass className="w-4 h-4 text-sky-400" />
                  <span>Plano Técnico 2D (CAD Blueprint)</span>
                </div>
                <span className="text-[10px] text-sky-400/80 font-mono bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-800/50">
                  {design2DResult.escala || "Escala 1:20"}
                </span>
              </div>

              {/* Título y dimensiones generales */}
              <div className="p-3 rounded-xl bg-sky-950/20 border border-sky-800/30 flex flex-col gap-1">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider">
                  {design2DResult.tipoMueble || "Mueble Proyectado"}
                </span>
                <p className="text-sm font-semibold text-sky-100">
                  {design2DResult.titulo}
                </p>
                <p className="text-xs font-mono text-emerald-300">
                  Cotas generales: {design2DResult.dimensionesGenerales}
                </p>
              </div>

              {/* Visualización Gráfica del Plano 2D SVG */}
              {design2DResult.svgDiagram && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                      Plano de Taller Vectorial
                    </span>
                    <button
                      onClick={() => handleDownloadSvg(design2DResult.svgDiagram, `Plano_2D_${Date.now()}.svg`)}
                      className="text-[11px] font-semibold text-sky-300 hover:text-white px-2.5 py-1 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-800/60 transition-all flex items-center gap-1.5"
                    >
                      {downloadedStatus?.startsWith('Plano_2D') ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>¡Descargado!</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Descargar SVG</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div
                    className="w-full rounded-xl overflow-hidden border border-sky-900/60 bg-[#09182b] p-2 shadow-inner flex items-center justify-center [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[380px]"
                    dangerouslySetInnerHTML={{ __html: design2DResult.svgDiagram }}
                  />
                </div>
              )}

              {/* Desglose de Vistas Ortogonales */}
              {design2DResult.vistas && design2DResult.vistas.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                    Vistas Ortogonales Proyectadas
                  </span>
                  <div className="flex flex-col gap-2">
                    {design2DResult.vistas.map((vista, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-300">
                            {vista.nombre}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300 leading-relaxed">
                          {vista.descripcion}
                        </p>
                        {vista.cotas && vista.cotas.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {vista.cotas.map((cota, cIdx) => (
                              <span
                                key={cIdx}
                                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-sky-200"
                              >
                                {cota.nombre}: <strong className="text-emerald-300">{cota.valor}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas Técnicas de Taller */}
              {design2DResult.notasTecnicas && design2DResult.notasTecnicas.length > 0 && (
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Notas Técnicas y Normas de Taller
                  </span>
                  <ul className="text-xs text-neutral-300 space-y-1 list-disc list-inside">
                    {design2DResult.notasTecnicas.map((nota, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {nota}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Panel 4: Modelo Tridimensional Isométrico 3D ("Diseño 3D") */}
          {design3DResult && !isCalculatingDesign3D && (
            <div
              id="panel-diseno-3d"
              className="w-full rounded-2xl bg-neutral-900/95 border border-violet-900/40 p-4 shadow-xl flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-wider">
                  <Box className="w-4 h-4 text-violet-400" />
                  <span>Modelo 3D Isométrico CAD</span>
                </div>
                <span className="text-[10px] text-violet-300 font-mono bg-violet-950/60 px-2 py-0.5 rounded-full border border-violet-800/50">
                  {design3DResult.perspectiva || "Isometría 30°"}
                </span>
              </div>

              {/* Material y acabado sugerido */}
              <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-800/30 flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                  {design3DResult.tipoMadera || "Material de Fabricación"}
                </span>
                <p className="text-sm font-semibold text-violet-100">
                  {design3DResult.titulo}
                </p>
                {design3DResult.acabadoRecomendado && (
                  <p className="text-xs text-neutral-300">
                    <span className="text-violet-300 font-medium">Acabado: </span>
                    {design3DResult.acabadoRecomendado}
                  </p>
                )}
              </div>

              {/* Visualización Gráfica del Modelo 3D SVG */}
              {design3DResult.svgDiagram3D && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                      Perspectiva Volumétrica Tridimensional
                    </span>
                    <button
                      onClick={() => handleDownloadSvg(design3DResult.svgDiagram3D, `Modelo_3D_${Date.now()}.svg`)}
                      className="text-[11px] font-semibold text-violet-300 hover:text-white px-2.5 py-1 rounded-lg bg-violet-950/80 hover:bg-violet-900 border border-violet-800/60 transition-all flex items-center gap-1.5"
                    >
                      {downloadedStatus?.startsWith('Modelo_3D') ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>¡Descargado!</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Descargar 3D SVG</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div
                    className="w-full rounded-xl overflow-hidden border border-violet-900/60 bg-[#090d16] p-2 shadow-inner flex items-center justify-center [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-h-[400px]"
                    dangerouslySetInnerHTML={{ __html: design3DResult.svgDiagram3D }}
                  />
                </div>
              )}

              {/* Especificaciones Estructurales 3D */}
              {design3DResult.especificaciones3D && design3DResult.especificaciones3D.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                    Especificaciones Tridimensionales
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {design3DResult.especificaciones3D.map((spec, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex flex-col gap-1"
                      >
                        <span className="text-xs font-semibold text-violet-300">
                          {spec.elemento}
                        </span>
                        <p className="text-[11px] text-neutral-400">
                          {spec.especificacion}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones de Ensamblado y Estabilidad 3D */}
              {design3DResult.detallesEstructurales && design3DResult.detallesEstructurales.length > 0 && (
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    Criterios de Estructura y Rigidez 3D
                  </span>
                  <ul className="text-xs text-neutral-300 space-y-1 list-disc list-inside">
                    {design3DResult.detallesEstructurales.map((detalle, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {detalle}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Errores */}
          {(ergonomicError || despieceError || design2DError || design3DError) && (
            <div
              id="action-error"
              className="w-full p-4 rounded-2xl bg-red-950/40 border border-red-900/50 text-red-300 flex flex-col items-center gap-2 text-center text-xs leading-relaxed"
            >
              <div className="flex items-center gap-2 text-red-400 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Error en el procesamiento</span>
              </div>
              <p>{ergonomicError || despieceError || design2DError || design3DError}</p>
            </div>
          )}

          {/* Sección de Análisis Visual Inicial (Solo si aún no se ha ejecutado ninguna acción avanzada) */}
          {!ergonomicResult && !despieceResult && !design2DResult && !design3DResult && (
            <div id="analysis-container" className="w-full">
              {isAnalyzing && (
                <div
                  id="analyzing-status"
                  className="w-full p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center gap-2.5 text-neutral-300 text-xs font-medium animate-pulse"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  <p>Reconociendo imagen...</p>
                </div>
              )}

              {analysisResult && !isAnalyzing && (
                <div
                  id="analysis-result"
                  className="w-full p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 text-neutral-300 text-xs leading-relaxed shadow-md flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-neutral-300" />
                    <span>Descripción visual inicial</span>
                  </div>
                  <p className="text-neutral-300">{analysisResult}</p>
                </div>
              )}
            </div>
          )}

          {/* Botón para cambiar o subir otra imagen */}
          <button
            id="btn-new-image"
            onClick={handleReset}
            className="text-xs font-medium text-neutral-400 hover:text-white px-4 py-2 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tomar o subir otra imagen</span>
          </button>
        </div>
      )}

      {/* Visor de Cámara en Pantalla Completa */}
      {isCameraOpen && (
        <CameraView
          onCapture={handleCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
}
