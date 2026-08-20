export interface CapturedImage {
  id: string;
  dataUrl: string;
  source: 'camara' | 'galeria';
  name: string;
  size?: number;
  width?: number;
  height?: number;
  capturedAt: Date;
}

export type FacingMode = 'environment' | 'user';

export interface CameraError {
  type: 'permission_denied' | 'not_found' | 'not_readable' | 'unknown';
  message: string;
}

export interface ErgonomicResult {
  objetoDetectado: string;
  elementosContexto: string;
  dimensiones: string;
  criterioCalculo: string;
}

export interface PiezaDespiece {
  nombre: string;
  cantidad: number;
  forma?: string;
  dimensiones: string;
  detallesTecnicos?: string;
}

export interface DespieceResult {
  tipoMadera: string;
  resumenMueble: string;
  piezas: PiezaDespiece[];
  observacionesCarpinteria?: string;
}

export interface Vista2D {
  nombre: string;
  descripcion: string;
  cotas?: { nombre: string; valor: string }[];
}

export interface Design2DResult {
  titulo: string;
  escala: string;
  tipoMueble: string;
  dimensionesGenerales: string;
  svgDiagram: string;
  vistas: Vista2D[];
  notasTecnicas: string[];
}

export interface Especificacion3D {
  elemento: string;
  especificacion: string;
}

export interface Design3DResult {
  titulo: string;
  perspectiva: string;
  tipoMadera: string;
  acabadoRecomendado: string;
  svgDiagram3D: string;
  detallesEstructurales: string[];
  especificaciones3D?: Especificacion3D[];
}

