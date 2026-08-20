import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Función auxiliar de reintentos con espera exponencial para la API de Gemini
async function generateContentWithRetry(
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  maxRetries = 3,
  baseDelayMs = 2000
) {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const ai = getAIClient();
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      const errorMsg = String(error?.message || error?.status || error);
      const isTransient =
        errorMsg.includes("503") ||
        errorMsg.includes("UNAVAILABLE") ||
        errorMsg.includes("429") ||
        errorMsg.includes("RESOURCE_EXHAUSTED") ||
        errorMsg.includes("overloaded") ||
        errorMsg.includes("high demand") ||
        errorMsg.includes("fetch failed") ||
        errorMsg.includes("ECONNRESET") ||
        errorMsg.includes("ETIMEDOUT") ||
        error?.status === 503 ||
        error?.status === 429;

      if (isTransient && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(1.5, attempt - 1);
        console.warn(
          `[Reintento ${attempt}/${maxRetries}] Error temporal de Gemini (${errorMsg}). Esperando ${delay}ms antes de reintentar...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

const SYSTEM_PROMPT_BASIC = `Analiza la imagen adjunta. No hagas suposiciones previas. Tu tarea es identificar libremente el objeto principal, mueble o elemento visible en la fotografía. Describe qué es exactamente lo que estás viendo con tus propias palabras (ej: 'Es una silla de madera estilo escandinavo', 'Es una repisa de metal con botellas de vidrio', 'Es una mesa de centro rústica'). Si detectas objetos que sirvan de referencia de escala (como botellas, copas, personas, etc.), menciónalos también brevemente.`;

const SYSTEM_PROMPT_ERGONOMIC = `Actúa como un experto en diseño de mobiliario y ergonomía humana.
Analiza la imagen adjunta aplicando razonamiento estricto, dimensional y autónomo.

Instrucciones de análisis:
1. Identifica libremente el mueble u objeto principal visible (ej. mesa de comedor, escritorio, sofá, repisa, etc.).
2. Identifica y cuenta elementos de contexto que aporten escala funcional (ej. número de sillas/asientos detectados, objetos sobre la superficie, etc.).
3. Aplica estándares internacionales de ergonomía humana (como ancho necesario por comensal de 600-750 mm, profundidad de silla 450-500 mm, altura de mesa estándar 730-760 mm, espacio de rodillas, etc.) para triangular y calcular el tamaño real del mueble.
4. No te limites a la perspectiva visual plana: usa la lógica funcional (ej. si hay 6 sillas distribuidas, calcula la longitud mínima y ancho necesarios para albergar a 6 comensales con comodidad).
5. Calcula las dimensiones aproximadas en milímetros (Largo × Ancho × Alto).

Formato de salida estricto en JSON:
- objetoDetectado: Nombre preciso del mueble u objeto principal detectado (ej: "Mesa de comedor rectangular de madera").
- elementosContexto: Descripción concisa de los elementos y referencias encontrados (ej: "6 sillas de comedor, 1 centro de mesa").
- dimensiones: Dimensiones calculadas en milímetros con el formato exacto "Largo mm × Ancho mm × Alto mm" (ej: "2000 mm × 950 mm × 750 mm").
- criterioCalculo: Breve frase técnica que sintetice el criterio ergonómico o dimensional aplicado (ej: "Calculado en base al espacio ergonómico para 6 comensales (650 mm por puesto + cabeceras)").
No incluyas textos de relleno ni explicaciones sobre anatomía humana.`;

const SYSTEM_PROMPT_DESPIECE = `Actúa como un maestro carpintero profesional y ebanista experto.
A partir de la imagen adjunta y las dimensiones generales estimadas, elabora un despiece técnico profesional, desglosado y listo para corte en taller.

Instrucciones de análisis:
1. Identificación de Material: Infiere o estima el tipo de madera visible en la imagen según la tonalidad, textura, veta y acabado aparente (ej: 'Madera de roble macizo', 'Madera de pino tratado', 'Madera de haya', 'Madera de nogal', etc.).
2. Desglose Descriptivo por Piezas: Detalla componente por componente con sus medidas exactas en milímetros:
   - Tablero superior / Cubierta: Dimensiones exactas (Largo × Ancho × Espesor en mm).
   - Patas: Cantidad exacta, forma geométrica (ej. cuadradas, rectangulares, torneadas) y dimensiones exactas (Sección transversal × Largo/Altura en mm, ajustando según la altura total de la mesa menos el espesor del tablero).
   - Travesaños o faldones: Cantidad exacta y dimensiones (Largo × Ancho/Alto de faldón × Espesor en mm). Si la mesa es rectangular, diferencia detalladamente los 2 faldones longitudinales (largos) y los 2 faldones transversales (cortos), calculando su longitud real descontando el ancho de las patas. Si es cuadrada, indica que los 4 son iguales.
   - Refuerzos o piezas adicionales si la estructura del mueble lo requiere.
3. Observaciones de carpintería: Breve nota técnica sobre tipo de ensamble recomendado (ej: ensamble con caja y espiga / tarugos de haya / escuadras de rincón).
4. Lenguaje técnico, preciso y ordenado, sin saludos ni introducciones conversacionales.`;

const SYSTEM_PROMPT_DESIGN_2D = `Actúa como un arquitecto proyectista y dibujante técnico senior de mobiliario y carpintería.
A partir de la imagen adjunta y las dimensiones conocidas del mueble, genera un plano técnico 2D profesional con vistas ortogonales (Vista Frontal/Alzado, Vista Superior/Planta, y Vista Lateral/Perfil) y un diagrama vectorial SVG técnico de alta calidad estilo plano de taller (blueprint/CAD).

Instrucciones para el diagrama SVG:
1. Genera un SVG válido y completo con viewBox="0 0 800 520" y xmlns="http://www.w3.org/2000/svg".
2. Estilo de plano técnico profesional: fondo oscuro tipo blueprint (#0b192c o #0f172a), con una cuadrícula técnica sutil (grid), cotas y líneas de dimensión con flechas, marcas de centros, y líneas de corte claras en color cian (#38bdf8), esmeralda (#34d399) o blanco (#f8fafc).
3. Incluye las 3 vistas principales o las vistas más representativas del mueble (Alzado Frontal con cotas de ancho y alto; Planta Superior con cotas de largo y ancho; y Perfil Lateral con cotas de fondo y altura).
4. Rotula las medidas principales en milímetros directamente en el SVG con tipografía técnica limpia.
5. Agrega una cartela técnica o cajetín en la esquina inferior con: Nombre del mueble, Escala estimada, Fecha y 'Carpinter_IA CAD Studio'.
6. Devuelve el código SVG completo dentro del campo 'svgDiagram'.

Formato de salida estricto en JSON:
- titulo: Título del plano técnico (ej: "Plano Técnico 2D Constructivo - Mesa de Comedor")
- escala: Escala de representación (ej: "Escala 1:20 - Medidas en mm")
- tipoMueble: Nombre del mueble detectado
- dimensionesGenerales: Dimensiones generales en formato "Largo mm × Ancho mm × Alto mm"
- vistas: Lista de vistas representadas con nombre, descripcion y cotas principales
- notasTecnicas: Lista de notas técnicas de taller (tolerancias, biseles, cantos, etc.)
- svgDiagram: Código SVG completo y válido que dibuja el plano técnico`;

const SYSTEM_PROMPT_DESIGN_3D = `Actúa como un diseñador industrial 3D y modelador CAD senior especializado en ebanistería y mobiliario de madera.
A partir de la imagen adjunta y las dimensiones conocidas, genera una visualización 3D isométrica técnica profesional (Perspectiva Isométrica Axonométrica a 30°) que represente el volumen espacial, el ensamble y la volumetría tridimensional del mueble.

Instrucciones para el diagrama 3D (SVG Isométrico):
1. Genera un SVG válido y completo con viewBox="0 0 800 560" y xmlns="http://www.w3.org/2000/svg".
2. Fondo elegante oscuro (#090d16 o #0f172a) con sutiles ejes de coordenadas 3D (X, Y, Z) y rejilla isométrica de referencia.
3. Dibuja el mueble en proyección isométrica a 30° con sombreado volumétrico realista:
   - Caras superiores con tono más claro (simulando luz cenital).
   - Caras frontales izquierdas con tono medio.
   - Caras laterales derechas con sombreado más oscuro para dar profundidad 3D real.
   - Utiliza tonos madera cálidos con acabados técnicos (dorados, miel, roble o estilo CAD blueprint 3D).
4. Representa la estructura tridimensional: tablero superior con espesor visible, patas con volumen tridimensional en las 4 esquinas, faldones/travesaños interiores con profundidad.
5. Añade cotas tridimensionales de volumen (Eje X: Longitud, Eje Y: Profundidad, Eje Z: Altura) y líneas guía de perspectiva.
6. Incluye llamada de detalles estructurales (puntos de unión/ensamble) con círculos indicadores numerados.
7. Devuelve el código SVG completo dentro del campo 'svgDiagram3D'.

Formato de salida estricto en JSON:
- titulo: Título de la visualización (ej: "Modelo 3D Isométrico - Perspectiva Axonométrica")
- perspectiva: Tipo de perspectiva (ej: "Proyección Isométrica Axonométrica 30°")
- tipoMadera: Tipo de madera inferido con acabado aparente
- acabadoRecomendado: Acabado técnico sugerido para taller
- detallesEstructurales: Lista de observaciones técnicas de volumen y estabilidad 3D
- especificaciones3D: Lista de elementos con su especificación tridimensional
- svgDiagram3D: Código SVG completo y válido que dibuja la vista 3D isométrica`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Endpoint para análisis visual básico automático
  app.post("/api/analyze", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "No se proporcionó ninguna imagen para analizar." });
      }

      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
      
      const response = await generateContentWithRetry({
        model: "gemini-3.7-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: base64Data
              }
            },
            {
              text: SYSTEM_PROMPT_BASIC
            }
          ]
        },
        config: {
          systemInstruction: SYSTEM_PROMPT_BASIC
        }
      });

      const description = response.text || "No se obtuvo una descripción de la imagen.";
      return res.json({ description });
    } catch (error: any) {
      console.error("Error al analizar imagen con Gemini:", error);
      return res.status(500).json({
        error: error?.message || "Error al conectar con la API de Gemini para analizar la imagen."
      });
    }
  });

  // Endpoint para análisis ergonómico y cálculo de dimensiones ("Manos a la obra")
  app.post("/api/ergonomic-analysis", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "No se proporcionó ninguna imagen para el cálculo ergonómico." });
      }

      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");

      const response = await generateContentWithRetry({
        model: "gemini-3.7-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: base64Data
              }
            },
            {
              text: SYSTEM_PROMPT_ERGONOMIC
            }
          ]
        },
        config: {
          systemInstruction: SYSTEM_PROMPT_ERGONOMIC,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object" as any,
            properties: {
              objetoDetectado: {
                type: "string",
                description: "Nombre del objeto o mueble principal detectado"
              },
              elementosContexto: {
                type: "string",
                description: "Elementos de contexto y escala encontrados (ej. número de asientos)"
              },
              dimensiones: {
                type: "string",
                description: "Dimensiones calculadas en formato: Largo mm × Ancho mm × Alto mm"
              },
              criterioCalculo: {
                type: "string",
                description: "Breve frase técnica del criterio de cálculo aplicado"
              }
            },
            required: ["objetoDetectado", "elementosContexto", "dimensiones", "criterioCalculo"]
          }
        }
      });

      const rawJson = response.text || "{}";
      const parsedData = JSON.parse(rawJson);

      return res.json(parsedData);
    } catch (error: any) {
      console.error("Error en análisis ergonómico:", error);
      return res.status(500).json({
        error: error?.message || "Error al realizar el cálculo ergonómico con Gemini."
      });
    }
  });

  // Endpoint para despiece detallado de carpintería ("Despiece")
  app.post("/api/despiece", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg", dimensiones, objetoDetectado } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "No se proporcionó ninguna imagen para el despiece." });
      }

      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");

      const contextPrompt = `${SYSTEM_PROMPT_DESPIECE}
${dimensiones ? `Dimensiones generales calculadas previamente: ${dimensiones}.` : ""}
${objetoDetectado ? `Tipo de mueble detectado: ${objetoDetectado}.` : ""}`;

      const response = await generateContentWithRetry({
        model: "gemini-3.7-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: base64Data
              }
            },
            {
              text: contextPrompt
            }
          ]
        },
        config: {
          systemInstruction: SYSTEM_PROMPT_DESPIECE,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object" as any,
            properties: {
              tipoMadera: {
                type: "string",
                description: "Tipo de madera inferido o estimado con base en la veta, tono y textura visible"
              },
              resumenMueble: {
                type: "string",
                description: "Descripción resumida del mueble para el plano de corte"
              },
              piezas: {
                type: "array",
                description: "Lista de piezas desglosadas para el corte",
                items: {
                  type: "object",
                  properties: {
                    nombre: {
                      type: "string",
                      description: "Nombre de la pieza (ej. Tablero superior, Patas, Faldones largos, Faldones cortos)"
                    },
                    cantidad: {
                      type: "integer",
                      description: "Cantidad exacta de piezas de este tipo"
                    },
                    forma: {
                      type: "string",
                      description: "Forma o perfil de la pieza (ej. Rectangular plana, Cuadrada maciza)"
                    },
                    dimensiones: {
                      type: "string",
                      description: "Dimensiones exactas en mm (ej. 1800 mm × 900 mm × 35 mm)"
                    },
                    detallesTecnicos: {
                      type: "string",
                      description: "Detalle técnico específico para el carpintero"
                    }
                  },
                  required: ["nombre", "cantidad", "dimensiones"]
                }
              },
              observacionesCarpinteria: {
                type: "string",
                description: "Recomendación técnica sobre ensambles, uniones o fijaciones"
              }
            },
            required: ["tipoMadera", "resumenMueble", "piezas", "observacionesCarpinteria"]
          }
        }
      });

      const rawJson = response.text || "{}";
      const parsedData = JSON.parse(rawJson);

      return res.json(parsedData);
    } catch (error: any) {
      console.error("Error en despiece de carpintería:", error);
      return res.status(500).json({
        error: error?.message || "Error al generar el despiece con Gemini."
      });
    }
  });

  // Endpoint para Plano Técnico 2D ("Diseño 2D")
  app.post("/api/design-2d", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg", dimensiones, objetoDetectado } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "No se proporcionó ninguna imagen para el plano 2D." });
      }

      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");

      const contextPrompt = `${SYSTEM_PROMPT_DESIGN_2D}
${dimensiones ? `Dimensiones estimadas previamente: ${dimensiones}.` : ""}
${objetoDetectado ? `Tipo de mueble detectado: ${objetoDetectado}.` : ""}`;

      const response = await generateContentWithRetry({
        model: "gemini-3.7-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: base64Data
              }
            },
            {
              text: contextPrompt
            }
          ]
        },
        config: {
          systemInstruction: SYSTEM_PROMPT_DESIGN_2D,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object" as any,
            properties: {
              titulo: { type: "string" },
              escala: { type: "string" },
              tipoMueble: { type: "string" },
              dimensionesGenerales: { type: "string" },
              vistas: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nombre: { type: "string" },
                    descripcion: { type: "string" },
                    cotas: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          nombre: { type: "string" },
                          valor: { type: "string" }
                        },
                        required: ["nombre", "valor"]
                      }
                    }
                  },
                  required: ["nombre", "descripcion"]
                }
              },
              notasTecnicas: {
                type: "array",
                items: { type: "string" }
              },
              svgDiagram: {
                type: "string",
                description: "Código SVG completo del plano técnico 2D"
              }
            },
            required: ["titulo", "escala", "tipoMueble", "dimensionesGenerales", "vistas", "notasTecnicas", "svgDiagram"]
          }
        }
      });

      const rawJson = response.text || "{}";
      const parsedData = JSON.parse(rawJson);

      if (parsedData.svgDiagram) {
        parsedData.svgDiagram = parsedData.svgDiagram
          .replace(/^```(xml|svg)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
      }

      return res.json(parsedData);
    } catch (error: any) {
      console.error("Error en diseño 2D:", error);
      return res.status(500).json({
        error: error?.message || "Error al generar el plano 2D con Gemini."
      });
    }
  });

  // Endpoint para Modelo / Perspectiva Isométrica 3D ("Diseño 3D")
  app.post("/api/design-3d", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg", dimensiones, objetoDetectado } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "No se proporcionó ninguna imagen para el modelo 3D." });
      }

      const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");

      const contextPrompt = `${SYSTEM_PROMPT_DESIGN_3D}
${dimensiones ? `Dimensiones calculadas del mueble: ${dimensiones}.` : ""}
${objetoDetectado ? `Tipo de mueble detectado: ${objetoDetectado}.` : ""}`;

      const response = await generateContentWithRetry({
        model: "gemini-3.7-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "image/jpeg",
                data: base64Data
              }
            },
            {
              text: contextPrompt
            }
          ]
        },
        config: {
          systemInstruction: SYSTEM_PROMPT_DESIGN_3D,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object" as any,
            properties: {
              titulo: { type: "string" },
              perspectiva: { type: "string" },
              tipoMadera: { type: "string" },
              acabadoRecomendado: { type: "string" },
              detallesEstructurales: {
                type: "array",
                items: { type: "string" }
              },
              especificaciones3D: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    elemento: { type: "string" },
                    especificacion: { type: "string" }
                  },
                  required: ["elemento", "especificacion"]
                }
              },
              svgDiagram3D: {
                type: "string",
                description: "Código SVG completo de la vista isométrica tridimensional 3D"
              }
            },
            required: ["titulo", "perspectiva", "tipoMadera", "acabadoRecomendado", "detallesEstructurales", "svgDiagram3D"]
          }
        }
      });

      const rawJson = response.text || "{}";
      const parsedData = JSON.parse(rawJson);

      if (parsedData.svgDiagram3D) {
        parsedData.svgDiagram3D = parsedData.svgDiagram3D
          .replace(/^```(xml|svg)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
      }

      return res.json(parsedData);
    } catch (error: any) {
      console.error("Error en diseño 3D:", error);
      return res.status(500).json({
        error: error?.message || "Error al generar el modelo 3D con Gemini."
      });
    }
  });

  // Integración de Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
  });
}

startServer();
