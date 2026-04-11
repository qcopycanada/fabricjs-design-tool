import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FabricImage, Canvas as FabricCanvas } from 'fabric';
import jsPDF from 'jspdf';
import { AdvancedQRCodeGenerator } from './utils/advancedQRGenerator';
import './App.css';

type CanvasFormat = 'portrait' | 'landscape';
type EditorMode = 'dev' | 'prod';

interface CanvasMockup {
  url: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  lockedInDev: boolean;
  imageWidth: number;
  imageHeight: number;
}

interface CanvasDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  format: CanvasFormat;
  data: string | null;
  lockStates?: ObjectLockState[];
  mockup?: CanvasMockup;
}

interface ObjectLockState {
  lockMovementX: boolean;
  lockMovementY: boolean;
  lockScalingX: boolean;
  lockScalingY: boolean;
  lockRotation: boolean;
  hideObjectActions: boolean;
  selectable: boolean;
  evented: boolean;
}

interface EmbeddedCanvasPayload {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  format?: CanvasFormat;
  data?: string | Record<string, unknown> | null;
  lockStates?: ObjectLockState[];
  mockup?: Partial<CanvasMockup>;
}

interface EmbeddedProjectPayload {
  canvases?: EmbeddedCanvasPayload[];
  activeCanvasId?: string;
  version?: number;
}

interface EmbeddedMessage {
  type: string;
  requestId?: string;
  payload?: unknown;
}

const EMBED_COMMANDS = {
  LOAD_PROJECT: 'fabric-editor:load-project',
  LOAD_TEMPLATE_COPY: 'fabric-editor:load-template-copy',
  EXPORT_PROJECT: 'fabric-editor:export-project',
  GET_PROJECT: 'fabric-editor:get-project',
  SAVE_PDF: 'fabric-editor:save-pdf',
  REQUEST_PDF: 'fabric-editor:request-pdf',
  PROJECT_LOADED: 'fabric-editor:project-loaded',
  PROJECT_EXPORTED: 'fabric-editor:project-exported',
  PDF_SAVED: 'fabric-editor:pdf-saved',
  PDF_READY: 'fabric-editor:pdf-ready',
  PROJECT_UPDATED: 'fabric-editor:project-updated',
  ERROR: 'fabric-editor:error',
} as const;

const LOCK_SERIALIZATION_PROPS = [
  'lockMovementX',
  'lockMovementY',
  'lockScalingX',
  'lockScalingY',
  'lockRotation',
  'hideObjectActions',
  'selectable',
  'evented',
  '__layerId',
  '__layerName',
  '__isSvgUpload',
  '__svgSource',
  '__svgOriginalSource',
  '__svgColors',
  '__svgColorMap',
];

const PX_PER_INCH = 300;

const normalizeMockupPayload = (mockup: Partial<CanvasMockup> | undefined, width: number, height: number): CanvasMockup | undefined => {
  if (!mockup || typeof mockup.url !== 'string' || !mockup.url.trim()) {
    return undefined;
  }

  const imageWidth = Math.max(1, Number(mockup.imageWidth) || width);
  const imageHeight = Math.max(1, Number(mockup.imageHeight) || height);
  const fallbackScale = Math.max((width * 1.2) / imageWidth, (height * 1.2) / imageHeight);

  return {
    url: mockup.url.trim(),
    x: Number.isFinite(mockup.x as number) ? Number(mockup.x) : width / 2,
    y: Number.isFinite(mockup.y as number) ? Number(mockup.y) : height / 2,
    scale: Math.max(0.05, Number(mockup.scale) || fallbackScale),
    rotation: Number.isFinite(mockup.rotation as number) ? Number(mockup.rotation) : 0,
    opacity: Math.max(0, Math.min(1, Number(mockup.opacity) || 1)),
    visible: mockup.visible !== false,
    lockedInDev: Boolean(mockup.lockedInDev),
    imageWidth,
    imageHeight,
  };
};

const getDefaultLockState = (): ObjectLockState => ({
  lockMovementX: false,
  lockMovementY: false,
  lockScalingX: false,
  lockScalingY: false,
  lockRotation: false,
  hideObjectActions: false,
  selectable: true,
  evented: true,
});

// Components
import Header from './components/Header';
import LeftSidebar from './components/LeftSidebar';
import CanvasWrapper from './components/CanvasWrapper';
import RightSidebar from './components/RightSidebar';
import BottomToolbar from './components/BottomToolbar';
import QRCodeDialog from './components/QRCodeDialog';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';

// Hooks
import { useCanvasManager } from './hooks/useCanvasManager';
import { useShapeCreator } from './hooks/useShapeCreator';
import { useCanvasKeyboardShortcuts } from './hooks/useCanvasKeyboardShortcuts';

// Utils
import { CanvasExporter, CanvasAligner, CanvasGroupManager } from './utils/canvasUtils';
import { CANVAS_DEFAULTS } from './utils/constants';
import { downloadDataURL, downloadText } from './utils/helpers';

// Types
import type { CanvasDimensions } from './types/canvas';

// Styles
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingExternalProjectRef = useRef<EmbeddedProjectPayload | null>(null);
  const bridgeAttachedRef = useRef(false);
  
  // Canvas management hook
  const {
    canvasState,
    canvasObjects,
    currentCanvasLayer,
    canGroup,
    canUngroup,
    canUndo,
    canRedo,
    undo,
    redo,
    addObjectToCanvas,
    selectObject,
    toggleObjectVisibility,
    deleteObject,
    reorderObjects,
    renameObject,
    toggleCanvasLayer,
    updateCanvasObjects,
    updateCanvasAndSaveHistory,
    setCanvasState,
    alignmentGuides,
  } = useCanvasManager(canvasRef);

  // Shape creation hook
  const {
    addText,
    addRectangle,
    addCircle,
    addLine,
    addEllipse,
    addRoundedRectangle,
    addTriangle,
    addPentagon,
    addHexagon,
    addStar,
    addDiamond,
    addHeart,
    addArrow,
    addCloud,
    addLightning,
    addSpeechBubble,
    addCross,
    addParallelogram,
    addTrapezoid,
    addOctagonShape,
    addQRCode,
    addImage,
  } = useShapeCreator(canvasState.canvas, addObjectToCanvas);

  // UI state
  const [canvasDimensions, setCanvasDimensions] = useState<CanvasDimensions>({ 
    width: CANVAS_DEFAULTS.WIDTH, 
    height: CANVAS_DEFAULTS.HEIGHT 
  });
  const [canvasFormat, setCanvasFormat] = useState<CanvasFormat>('landscape');
  const [canvasDocuments, setCanvasDocuments] = useState<CanvasDocument[]>([
    {
      id: 'canvas-1',
      name: 'Front',
      width: CANVAS_DEFAULTS.WIDTH,
      height: CANVAS_DEFAULTS.HEIGHT,
      format: 'landscape',
      data: null,
    }
  ]);
  const [activeCanvasId, setActiveCanvasId] = useState<string>('canvas-1');
  const canvasDocumentsRef = useRef<CanvasDocument[]>([
    {
      id: 'canvas-1',
      name: 'Front',
      width: CANVAS_DEFAULTS.WIDTH,
      height: CANVAS_DEFAULTS.HEIGHT,
      format: 'landscape',
      data: null,
    }
  ]);
  const [editorMode, setEditorMode] = useState<EditorMode>('prod');
  const [showModeToggle, setShowModeToggle] = useState(true);
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [canvasSwitchingEnabled, setCanvasSwitchingEnabled] = useState<boolean>(false);
  const [safeAreaVisible, setSafeAreaVisible] = useState<boolean>(true);
  const [trimAreaVisible, setTrimAreaVisible] = useState<boolean>(true);
  const [fitToScreenRequest, setFitToScreenRequest] = useState(0);
  const [isQRCodeDialogOpen, setIsQRCodeDialogOpen] = useState<boolean>(false);
  const [isKeyboardShortcutsModalOpen, setIsKeyboardShortcutsModalOpen] = useState<boolean>(false);
  const [mobilePanel, setMobilePanel] = useState<'none' | 'layers' | 'properties' | 'canvases'>('none');
  const [isMobilePanelInteracting, setIsMobilePanelInteracting] = useState<boolean>(false);
  const [isMobilePanelFloating, setIsMobilePanelFloating] = useState<boolean>(false);
  const [isDraggingMobilePanel, setIsDraggingMobilePanel] = useState<boolean>(false);
  const [mobilePanelPosition, setMobilePanelPosition] = useState({ x: 8, y: 120 });
  const [canvasThumbnails, setCanvasThumbnails] = useState<Record<string, string>>({});
  const [editingFloatingCanvasId, setEditingFloatingCanvasId] = useState<string | null>(null);
  const [editingFloatingCanvasName, setEditingFloatingCanvasName] = useState('');
  const floatingPanelRef = useRef<HTMLDivElement | null>(null);
  const mobilePanelDragOffsetRef = useRef({ x: 0, y: 0 });
  const mobilePanelRafRef = useRef<number | null>(null);
  const pendingPanelPositionRef = useRef<{ x: number; y: number } | null>(null);

  const selectedLayerObjectId = useMemo(() => {
    if (!canvasState.selectedObject) return null;
    const selectedLayer = canvasObjects.find(
      (item) => item.object === canvasState.selectedObject,
    );
    return selectedLayer?.id ?? null;
  }, [canvasObjects, canvasState.selectedObject]);

  const activeCanvasMockup = useMemo(() => {
    return canvasDocuments.find((doc) => doc.id === activeCanvasId)?.mockup;
  }, [activeCanvasId, canvasDocuments]);

  const hasVisibleMockup = Boolean(activeCanvasMockup?.url && activeCanvasMockup.visible);

  useEffect(() => {
    if (!canvasState.canvas) return;

    const canvas = canvasState.canvas as any;
    const backgroundColor = canvas.backgroundColor;
    const isTransparentBackground = typeof backgroundColor === 'string' && (
      backgroundColor === 'transparent'
      || backgroundColor === 'rgba(0,0,0,0)'
      || backgroundColor === 'rgba(255,255,255,0)'
    );

    if (hasVisibleMockup && !isTransparentBackground) {
      canvas.backgroundColor = 'rgba(0,0,0,0)';
      canvas.renderAll();
      return;
    }

    if (!hasVisibleMockup && isTransparentBackground) {
      canvas.backgroundColor = CANVAS_DEFAULTS.BACKGROUND_COLOR;
      canvas.renderAll();
    }
  }, [canvasState.canvas, hasVisibleMockup]);

  useEffect(() => {
    const envHideToggle = import.meta.env.VITE_HIDE_MODE_TOGGLE === 'true';

    const currentHost = window.location.hostname.toLowerCase();
    const isQcopyHost = currentHost === 'qcopy.ca' || currentHost.endsWith('.qcopy.ca');

    let isEmbeddedInQcopyHost = false;
    if (document.referrer) {
      try {
        const refHost = new URL(document.referrer).hostname.toLowerCase();
        isEmbeddedInQcopyHost = refHost === 'qcopy.ca' || refHost.endsWith('.qcopy.ca');
      } catch {
        isEmbeddedInQcopyHost = false;
      }
    }

    setShowModeToggle(!(envHideToggle || isQcopyHost || isEmbeddedInQcopyHost));
  }, []);

  // Keyboard shortcuts
  const keyboardShortcuts = useCanvasKeyboardShortcuts(canvasState.canvas, {
    enabled: true,
    enableClipboard: true,
    onObjectUpdate: updateCanvasAndSaveHistory,
    onUndo: undo,
    onRedo: redo
  });

  // Register the '?' shortcut to open shortcuts modal
  useEffect(() => {
    if (keyboardShortcuts) {
      keyboardShortcuts.registerShortcut({
        key: '?',
        action: () => setIsKeyboardShortcutsModalOpen(true),
        description: 'Show keyboard shortcuts',
        category: 'Help'
      });
    }
  }, [keyboardShortcuts]);

  // Canvas utilities - initialized when canvas is available
  const getCanvasExporter = () => canvasState.canvas ? new CanvasExporter(canvasState.canvas as any) : null;
  const getCanvasAligner = () => canvasState.canvas ? new CanvasAligner(canvasState.canvas as any) : null;
  const getGroupManager = () => canvasState.canvas ? new CanvasGroupManager(canvasState.canvas as any) : null;

  const serializeCurrentCanvas = useCallback(() => {
    if (!canvasState.canvas) return null;
    return JSON.stringify((canvasState.canvas as any).toJSON(LOCK_SERIALIZATION_PROPS));
  }, [canvasState.canvas]);

  const collectCurrentLockStates = useCallback((): ObjectLockState[] => {
    if (!canvasState.canvas) return [];

    return canvasState.canvas.getObjects().map((obj: any) => ({
      lockMovementX: Boolean(obj.lockMovementX),
      lockMovementY: Boolean(obj.lockMovementY),
      lockScalingX: Boolean(obj.lockScalingX),
      lockScalingY: Boolean(obj.lockScalingY),
      lockRotation: Boolean(obj.lockRotation),
      hideObjectActions: Boolean(obj.hideObjectActions),
      selectable: obj.selectable !== false,
      evented: obj.evented !== false,
    }));
  }, [canvasState.canvas]);

  const applyLockStatesToCurrentCanvas = useCallback((lockStates?: ObjectLockState[]) => {
    if (!canvasState.canvas || !lockStates?.length) return;

    const objects = canvasState.canvas.getObjects();
    objects.forEach((obj: any, index: number) => {
      const state = lockStates[index] || getDefaultLockState();
      obj.set({
        lockMovementX: state.lockMovementX,
        lockMovementY: state.lockMovementY,
        lockScalingX: state.lockScalingX,
        lockScalingY: state.lockScalingY,
        lockRotation: state.lockRotation,
        hideObjectActions: state.hideObjectActions,
        selectable: state.selectable,
        evented: state.evented,
      });
      if (typeof obj.setCoords === 'function') {
        obj.setCoords();
      }
    });
  }, [canvasState.canvas]);

  const setCanvasDocumentsSynced = useCallback((
    nextOrUpdater: CanvasDocument[] | ((prev: CanvasDocument[]) => CanvasDocument[])
  ) => {
    const nextDocuments = typeof nextOrUpdater === 'function'
      ? (nextOrUpdater as (prev: CanvasDocument[]) => CanvasDocument[])(canvasDocumentsRef.current)
      : nextOrUpdater;

    canvasDocumentsRef.current = nextDocuments;
    setCanvasDocuments(nextDocuments);
    return nextDocuments;
  }, []);

  useEffect(() => {
    canvasDocumentsRef.current = canvasDocuments;
  }, [canvasDocuments]);

  const persistActiveCanvas = useCallback((nextDimensions?: CanvasDimensions, nextFormat?: CanvasFormat) => {
    const serializedData = serializeCurrentCanvas();
    if (!serializedData) return;

    setCanvasDocumentsSynced(prev => {
      const next = prev.map(doc => {
        if (doc.id !== activeCanvasId) return doc;

        return {
          ...doc,
          width: nextDimensions?.width ?? canvasDimensions.width,
          height: nextDimensions?.height ?? canvasDimensions.height,
          format: nextFormat ?? canvasFormat,
          data: serializedData,
          lockStates: collectCurrentLockStates(),
        };
      });

      return next;
    });
  }, [activeCanvasId, canvasDimensions.height, canvasDimensions.width, canvasFormat, collectCurrentLockStates, serializeCurrentCanvas, setCanvasDocumentsSynced]);

  const normalizeCanvasPayload = useCallback((payload: EmbeddedCanvasPayload, index: number): CanvasDocument => {
    const width = payload.width && payload.width > 0 ? payload.width : CANVAS_DEFAULTS.WIDTH;
    const height = payload.height && payload.height > 0 ? payload.height : CANVAS_DEFAULTS.HEIGHT;
    const format: CanvasFormat = payload.format || (width >= height ? 'landscape' : 'portrait');

    let data: string | null = null;
    if (typeof payload.data === 'string') {
      data = payload.data;
    } else if (payload.data && typeof payload.data === 'object') {
      data = JSON.stringify(payload.data);
    } else {
      // Support direct Fabric canvas JSON uploads where objects are at root level.
      const rawCanvas = payload as unknown as Record<string, unknown>;
      if (Array.isArray(rawCanvas.objects)) {
        data = JSON.stringify(rawCanvas);
      }
    }

    return {
      id: `canvas-${index + 1}`,
      name: (payload.name || '').trim() || (index === 0 ? 'Front' : `Canvas ${index + 1}`),
      width,
      height,
      format,
      data,
      lockStates: Array.isArray(payload.lockStates) ? payload.lockStates : undefined,
      mockup: normalizeMockupPayload(payload.mockup, width, height),
    };
  }, []);

  const normalizeProjectPayload = useCallback((input: unknown): EmbeddedProjectPayload => {
    if (typeof input === 'string') {
      try {
        return JSON.parse(input) as EmbeddedProjectPayload;
      } catch {
        return { canvases: [] };
      }
    }

    if (Array.isArray(input)) {
      const arrayInput = input as unknown[];

      // If an array of raw Fabric canvas JSON objects is uploaded, map them as canvases.
      if (arrayInput.every(item => item && typeof item === 'object' && Array.isArray((item as Record<string, unknown>).objects))) {
        return {
          canvases: arrayInput.map(item => ({ data: item as Record<string, unknown> })),
        };
      }

      return { canvases: input as EmbeddedCanvasPayload[] };
    }

    if (input && typeof input === 'object') {
      const asRawCanvas = input as Record<string, unknown>;
      if (Array.isArray(asRawCanvas.objects)) {
        return {
          canvases: [{ data: asRawCanvas }],
        };
      }

      const asProject = input as EmbeddedProjectPayload;
      if (Array.isArray(asProject.canvases)) {
        return asProject;
      }

      return { canvases: [input as EmbeddedCanvasPayload] };
    }

    return { canvases: [] };
  }, []);

  const buildProjectSnapshot = useCallback(() => {
    const serializedCurrent = serializeCurrentCanvas();
    const mergedDocuments = canvasDocuments.map(doc => {
      if (doc.id !== activeCanvasId) return doc;

      return {
        ...doc,
        width: canvasDimensions.width,
        height: canvasDimensions.height,
        format: canvasFormat,
        data: serializedCurrent ?? doc.data,
      };
    });

    return {
      version: 1,
      activeCanvasId,
      canvases: mergedDocuments,
      exportedAt: new Date().toISOString(),
    };
  }, [activeCanvasId, canvasDimensions.height, canvasDimensions.width, canvasDocuments, canvasFormat, serializeCurrentCanvas]);

  const loadCanvasDocument = useCallback(async (target: CanvasDocument) => {
    if (!canvasState.canvas) return;

    const canvas = canvasState.canvas;
    const nextDimensions = { width: target.width, height: target.height };

    setCanvasDimensions(nextDimensions);
    setCanvasFormat(target.format);

    canvas.setDimensions(nextDimensions);
    if (canvasRef.current) {
      canvasRef.current.width = target.width;
      canvasRef.current.height = target.height;
    }

    canvas.discardActiveObject();
    if (target.data) {
      await canvas.loadFromJSON(target.data);
      applyLockStatesToCurrentCanvas(target.lockStates);
    } else {
      canvas.clear();
      canvas.backgroundColor = CANVAS_DEFAULTS.BACKGROUND_COLOR;
    }

    canvas.renderAll();
    setCanvasState(prev => ({ ...prev, selectedObject: null }));
    updateCanvasObjects();
  }, [applyLockStatesToCurrentCanvas, canvasState.canvas, setCanvasState, updateCanvasObjects]);

  const updateActiveCanvasMockup = useCallback((nextMockup?: CanvasMockup) => {
    setCanvasDocumentsSynced((prev) => prev.map((doc) => (
      doc.id === activeCanvasId
        ? { ...doc, mockup: nextMockup }
        : doc
    )));
  }, [activeCanvasId, setCanvasDocumentsSynced]);

  const applyExternalProject = useCallback(async (input: unknown) => {
    const normalized = normalizeProjectPayload(input);
    const sourceCanvases = normalized.canvases || [];

    if (!sourceCanvases.length) {
      throw new Error('No canvases found in project payload.');
    }

    const loadedDocuments = sourceCanvases.map((canvasPayload, index) =>
      normalizeCanvasPayload(canvasPayload, index)
    );

    const desiredActiveId = loadedDocuments.find(doc => doc.id === normalized.activeCanvasId)?.id
      || loadedDocuments[0].id;

    setCanvasDocumentsSynced(loadedDocuments);
    setActiveCanvasId(desiredActiveId);

    const activeDocument = loadedDocuments.find(doc => doc.id === desiredActiveId) || loadedDocuments[0];
    await loadCanvasDocument(activeDocument);
  }, [loadCanvasDocument, normalizeCanvasPayload, normalizeProjectPayload, setCanvasDocumentsSynced]);

  // Canvas dimension management
  const updateCanvasDimensions = (width: number, height: number) => {
    if (editorMode === 'prod') return;
    if (!canvasState.canvas) return;

    const nextDimensions = { width, height };
    setCanvasDimensions(nextDimensions);
    canvasState.canvas.setDimensions({ width, height });
    canvasState.canvas.renderAll();
    
    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }

    persistActiveCanvas(nextDimensions, width >= height ? 'landscape' : 'portrait');
  };

  const updateCanvasDimensionsFromCanvas = (dimensions: CanvasDimensions) => {
    updateCanvasDimensions(dimensions.width, dimensions.height);
  };

  const handleToggleCanvasSwitching = (enabled: boolean) => {
    setCanvasSwitchingEnabled(enabled);
  };

  const handleCanvasCountChange = useCallback((count: number, newCanvasName?: string) => {
    const boundedCount = Math.max(1, Math.min(20, count));
    const requestedName = (newCanvasName || '').trim();

    setCanvasDocumentsSynced(prev => {
      if (boundedCount === prev.length) return prev;

      if (boundedCount < prev.length) {
        const next = prev.slice(0, boundedCount);
        if (!next.some(doc => doc.id === activeCanvasId)) {
          setActiveCanvasId(next[0].id);
        }
        return next;
      }

      const additions: CanvasDocument[] = [];
      let customNameIndex = 1;
      for (let index = prev.length + 1; index <= boundedCount; index += 1) {
        const generatedName = requestedName
          ? (customNameIndex === 1 ? requestedName : `${requestedName} ${customNameIndex}`)
          : `Canvas ${index}`;

        additions.push({
          id: `canvas-${index}`,
          name: generatedName,
          width: canvasDimensions.width,
          height: canvasDimensions.height,
          format: canvasFormat,
          data: null,
          lockStates: [],
        });

        customNameIndex += 1;
      }
      return [...prev, ...additions];
    });
  }, [activeCanvasId, canvasDimensions.height, canvasDimensions.width, canvasFormat, setCanvasDocumentsSynced]);

  const handleCanvasNameChange = useCallback((canvasId: string, name: string) => {
    if (editorMode !== 'dev') return;

    const trimmedName = name.trim();
    if (!trimmedName) return;

    setCanvasDocumentsSynced(prev => prev.map(doc => (
      doc.id === canvasId
        ? { ...doc, name: trimmedName }
        : doc
    )));
  }, [editorMode, setCanvasDocumentsSynced]);

  const startFloatingCanvasRename = useCallback((canvasId: string, currentName: string) => {
    if (editorMode !== 'dev') return;
    setEditingFloatingCanvasId(canvasId);
    setEditingFloatingCanvasName(currentName);
  }, [editorMode]);

  const commitFloatingCanvasRename = useCallback(() => {
    if (!editingFloatingCanvasId) return;
    const trimmedName = editingFloatingCanvasName.trim();
    if (trimmedName) {
      handleCanvasNameChange(editingFloatingCanvasId, trimmedName);
    }
    setEditingFloatingCanvasId(null);
    setEditingFloatingCanvasName('');
  }, [editingFloatingCanvasId, editingFloatingCanvasName, handleCanvasNameChange]);

  const cancelFloatingCanvasRename = useCallback(() => {
    setEditingFloatingCanvasId(null);
    setEditingFloatingCanvasName('');
  }, []);

  const handleCanvasFormatChange = useCallback((format: CanvasFormat) => {
    if (editorMode === 'prod') return;
    if (format === canvasFormat) return;

    let nextWidth = canvasDimensions.width;
    let nextHeight = canvasDimensions.height;

    if (format === 'portrait' && nextWidth > nextHeight) {
      nextWidth = canvasDimensions.height;
      nextHeight = canvasDimensions.width;
    }

    if (format === 'landscape' && nextHeight > nextWidth) {
      nextWidth = canvasDimensions.height;
      nextHeight = canvasDimensions.width;
    }

    setCanvasFormat(format);
    updateCanvasDimensions(nextWidth, nextHeight);
    persistActiveCanvas({ width: nextWidth, height: nextHeight }, format);
  }, [canvasDimensions.height, canvasDimensions.width, canvasFormat, editorMode, persistActiveCanvas]);

  const handleSwitchCanvas = useCallback(async (canvasId: string) => {
    if (canvasId === activeCanvasId) return;

    const serializedData = serializeCurrentCanvas();
    let nextDocuments = canvasDocumentsRef.current;

    if (serializedData) {
      nextDocuments = canvasDocumentsRef.current.map(doc => {
        if (doc.id !== activeCanvasId) return doc;

        return {
          ...doc,
          width: canvasDimensions.width,
          height: canvasDimensions.height,
          format: canvasFormat,
          data: serializedData,
          lockStates: collectCurrentLockStates(),
        };
      });

      setCanvasDocumentsSynced(nextDocuments);
    }

    const target = nextDocuments.find(doc => doc.id === canvasId);
    if (!target) return;

    await loadCanvasDocument(target);
    setActiveCanvasId(canvasId);
  }, [activeCanvasId, canvasDimensions.height, canvasDimensions.width, canvasFormat, collectCurrentLockStates, loadCanvasDocument, serializeCurrentCanvas, setCanvasDocumentsSynced]);

  useEffect(() => {
    if (!canvasState.canvas) return;

    const activeDoc = canvasDocuments.find(doc => doc.id === activeCanvasId);
    if (!activeDoc) return;

    if (activeDoc.data === null) {
      persistActiveCanvas();
    }
  }, [activeCanvasId, canvasDocuments, canvasState.canvas, persistActiveCanvas]);

  useEffect(() => {
    if (!canvasDocuments.some(doc => doc.id === activeCanvasId) && canvasDocuments[0]) {
      void handleSwitchCanvas(canvasDocuments[0].id);
    }
  }, [activeCanvasId, canvasDocuments, handleSwitchCanvas]);

  useEffect(() => {
    if (!canvasState.canvas || !pendingExternalProjectRef.current) return;

    const pending = pendingExternalProjectRef.current;
    pendingExternalProjectRef.current = null;
    void applyExternalProject(pending);
  }, [applyExternalProject, canvasState.canvas]);

  useEffect(() => {
    const postHostMessage = (type: string, payload: unknown, requestId?: string) => {
      window.parent?.postMessage({ type, payload, requestId }, '*');
    };

    const exportProject = () => buildProjectSnapshot();

    const loadProject = async (payload: unknown) => {
      if (!canvasState.canvas) {
        pendingExternalProjectRef.current = normalizeProjectPayload(payload);
        return;
      }

      await applyExternalProject(payload);
    };

    const onMessage = (event: MessageEvent) => {
      const message = event.data as EmbeddedMessage;
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return;
      }

      if (message.type === EMBED_COMMANDS.LOAD_PROJECT || message.type === EMBED_COMMANDS.LOAD_TEMPLATE_COPY) {
        loadProject(message.payload)
          .then(() => {
            postHostMessage(EMBED_COMMANDS.PROJECT_LOADED, { success: true }, message.requestId);
          })
          .catch((error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load project.';
            postHostMessage(EMBED_COMMANDS.ERROR, { message: errorMessage }, message.requestId);
          });
      }

      if (message.type === EMBED_COMMANDS.EXPORT_PROJECT || message.type === EMBED_COMMANDS.GET_PROJECT) {
        const project = exportProject();
        postHostMessage(EMBED_COMMANDS.PROJECT_EXPORTED, project, message.requestId);
      }
    };

    window.addEventListener('message', onMessage);

    if (!bridgeAttachedRef.current) {
      (window as any).fabricDesignToolBridge = {
        loadProject,
        loadTemplateCopy: loadProject,
        exportProject,
      };
      bridgeAttachedRef.current = true;

      const initialPayload = (window as any).__FABRIC_EDITOR_INITIAL_PROJECT__;
      if (initialPayload) {
        void loadProject(initialPayload);
      }
    }

    return () => {
      window.removeEventListener('message', onMessage);
      if ((window as any).fabricDesignToolBridge) {
        delete (window as any).fabricDesignToolBridge;
      }
      bridgeAttachedRef.current = false;
    };
  }, [applyExternalProject, buildProjectSnapshot, canvasState.canvas, normalizeProjectPayload]);

  useEffect(() => {
    if (!canvasState.canvas) return;

    const snapshot = buildProjectSnapshot();
    window.parent?.postMessage({
      type: EMBED_COMMANDS.PROJECT_UPDATED,
      payload: snapshot,
    }, '*');
  }, [buildProjectSnapshot, canvasDocuments, canvasObjects, canvasState.canvas]);

  // QR Code dialog handlers
  const handleOpenQRCodeDialog = () => {
    setIsQRCodeDialogOpen(true);
  };

  const handleCloseQRCodeDialog = () => {
    setIsQRCodeDialogOpen(false);
  };

  const handleGenerateQRCode = (content: string, type: string, options: any) => {
    addQRCode(type, content, options);
    setIsQRCodeDialogOpen(false);
  };

  // QR Code color update function
  const updateQRCodeColors = async (qrObject: FabricImage, foregroundColor: string, backgroundColor: string) => {
    if (!canvasState.canvas) return;
    
    try {
      const content = (qrObject as any).qrCodeContent;
      const options = (qrObject as any).qrCodeOptions || {};
      
      if (!content) return;
      
      // Update the QR options with new colors
      const updatedOptions = {
        ...options,
        dotsOptions: {
          ...options.dotsOptions,
          color: foregroundColor
        },
        backgroundOptions: {
          ...options.backgroundOptions,
          color: backgroundColor
        },
        cornersSquareOptions: {
          ...options.cornersSquareOptions,
          color: foregroundColor
        },
        cornersDotOptions: {
          ...options.cornersDotOptions,
          color: foregroundColor
        },
        color: { dark: foregroundColor, light: backgroundColor } // Legacy compatibility
      };
      
      const svgString = await AdvancedQRCodeGenerator.generateAdvancedQRCode(content, updatedOptions);
      const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;
      
      const img = new Image();
      img.onload = () => {
        const left = qrObject.left;
        const top = qrObject.top;
        const scaleX = qrObject.scaleX;
        const scaleY = qrObject.scaleY;
        const angle = qrObject.angle;
        
        (qrObject as any).setSrc(svgDataUrl, {
          crossOrigin: 'anonymous'
        }).then(() => {
          qrObject.set({ left, top, scaleX, scaleY, angle });
          
          (qrObject as any).qrCodeSvg = svgString;
          (qrObject as any).qrCodeOptions = updatedOptions;
          
          canvasState.canvas!.renderAll();
        }).catch(() => {
          // Error loading image
        });
      };
      
      img.src = svgDataUrl;
    } catch {
      // Error generating QR code
    }
  };

  const getExportDocuments = useCallback(() => {
    const serializedCurrent = serializeCurrentCanvas();

    return canvasDocuments.map(doc => {
      if (doc.id !== activeCanvasId) return doc;

      return {
        ...doc,
        width: canvasDimensions.width,
        height: canvasDimensions.height,
        format: canvasFormat,
        data: serializedCurrent ?? doc.data,
        lockStates: collectCurrentLockStates(),
      };
    });
  }, [activeCanvasId, canvasDimensions.height, canvasDimensions.width, canvasDocuments, canvasFormat, collectCurrentLockStates, serializeCurrentCanvas]);

  const sanitizeFilePart = (value: string) => {
    const safe = value.trim().replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return safe || 'canvas';
  };

  const renderDocumentToCanvas = useCallback(async (doc: CanvasDocument) => {
    const tempElement = document.createElement('canvas');
    tempElement.width = doc.width;
    tempElement.height = doc.height;

    const tempCanvas = new FabricCanvas(tempElement, {
      width: doc.width,
      height: doc.height,
      enableRetinaScaling: false,
      backgroundColor: CANVAS_DEFAULTS.BACKGROUND_COLOR,
    });

    if (doc.data) {
      await tempCanvas.loadFromJSON(doc.data);
    } else {
      tempCanvas.clear();
      tempCanvas.backgroundColor = CANVAS_DEFAULTS.BACKGROUND_COLOR;
    }

    tempCanvas.renderAll();
    return tempCanvas;
  }, []);

  useEffect(() => {
    let disposed = false;

    const buildThumbnails = async () => {
      const docs = getExportDocuments();
      const nextThumbnails: Record<string, string> = {};

      for (const doc of docs) {
        const tempCanvas = await renderDocumentToCanvas(doc);
        try {
          nextThumbnails[doc.id] = tempCanvas.toDataURL({
            format: 'png',
            quality: 0.8,
            multiplier: 0.25,
          });
        } finally {
          tempCanvas.dispose();
        }
      }

      if (!disposed) {
        setCanvasThumbnails(nextThumbnails);
      }
    };

    void buildThumbnails();

    return () => {
      disposed = true;
    };
  }, [getExportDocuments, renderDocumentToCanvas, canvasObjects]);

  const buildMultiCanvasPDF = useCallback(async (documents: CanvasDocument[]) => {
    if (!documents.length) return;

    const first = documents[0];
    const pdf = new jsPDF({
      orientation: first.width >= first.height ? 'landscape' : 'portrait',
      unit: 'in',
      format: [first.width / PX_PER_INCH, first.height / PX_PER_INCH],
    });

    for (let index = 0; index < documents.length; index += 1) {
      const doc = documents[index];
      const tempCanvas = await renderDocumentToCanvas(doc);

      try {
        if (index > 0) {
          const orientation = doc.width >= doc.height ? 'landscape' : 'portrait';
          (pdf as any).addPage([doc.width / PX_PER_INCH, doc.height / PX_PER_INCH], orientation);
        }

        const imageData = tempCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 2,
        });

        // Render edge-to-edge with no added margins.
        pdf.addImage(imageData, 'PNG', 0, 0, doc.width / PX_PER_INCH, doc.height / PX_PER_INCH);
      } finally {
        tempCanvas.dispose();
      }
    }

    return pdf;
  }, [renderDocumentToCanvas]);

  const exportAsMultiCanvasPDF = useCallback(async (documents: CanvasDocument[]) => {
    const pdf = await buildMultiCanvasPDF(documents);
    if (!pdf) return;
    pdf.save(`canvas-project-${Date.now()}.pdf`);
  }, [buildMultiCanvasPDF]);

  const buildPdfReturnPayload = useCallback(async () => {
    const documents = getExportDocuments();
    const pdf = await buildMultiCanvasPDF(documents);

    if (!pdf) {
      throw new Error('No canvases available to export as PDF.');
    }

    const pdfArrayBuffer = pdf.output('arraybuffer') as ArrayBuffer;
    const byteArray = new Uint8Array(pdfArrayBuffer);
    let binary = '';

    for (let index = 0; index < byteArray.length; index += 1) {
      binary += String.fromCharCode(byteArray[index]);
    }

    return {
      mimeType: 'application/pdf' as const,
      fileName: `canvas-project-${Date.now()}.pdf`,
      pdfBase64: btoa(binary),
      pdfArrayBuffer,
      projectSnapshot: buildProjectSnapshot(),
    };
  }, [buildMultiCanvasPDF, buildProjectSnapshot, getExportDocuments]);

  // Export function
  const handleExport = async (format: string) => {
    const exportDocuments = getExportDocuments();

    if (format === 'json') {
      const projectSnapshot = {
        version: 1,
        activeCanvasId,
        canvases: exportDocuments,
        exportedAt: new Date().toISOString(),
      };
      const fileName = `canvas-project-${Date.now()}.json`;
      downloadText(JSON.stringify(projectSnapshot, null, 2), fileName, 'application/json');
      return;
    }

    if (format === 'pdf') {
      await exportAsMultiCanvasPDF(exportDocuments);
      return;
    }

    if (format === 'png' || format === 'jpeg' || format === 'svg') {
      for (const doc of exportDocuments) {
        const tempCanvas = await renderDocumentToCanvas(doc);
        const baseName = `${sanitizeFilePart(doc.name)}-${Date.now()}`;

        try {
          if (format === 'svg') {
            const svgString = tempCanvas.toSVG();
            downloadText(svgString, `${baseName}.svg`, 'image/svg+xml');
            continue;
          }

          const mimeFormat = format === 'jpeg' ? 'jpeg' : 'png';
          const extension = format === 'jpeg' ? 'jpg' : 'png';
          const dataURL = tempCanvas.toDataURL({
            format: mimeFormat,
            quality: format === 'jpeg' ? 0.95 : 1,
            multiplier: 2,
          });
          downloadDataURL(dataURL, `${baseName}.${extension}`);
        } finally {
          tempCanvas.dispose();
        }
      }
      return;
    }

    const exporter = getCanvasExporter();
    if (exporter) {
      exporter.export(format as any);
    }
  };

  const handleSaveForParent = useCallback(async () => {
    try {
      const payload = await buildPdfReturnPayload();
      window.parent?.postMessage({
        type: EMBED_COMMANDS.PDF_SAVED,
        payload,
      }, '*');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF payload.';
      window.parent?.postMessage({
        type: EMBED_COMMANDS.ERROR,
        payload: { message: errorMessage },
      }, '*');
    }
  }, [buildPdfReturnPayload]);

  useEffect(() => {
    const postHostMessage = (type: string, payload: unknown, requestId?: string) => {
      window.parent?.postMessage({ type, payload, requestId }, '*');
    };

    const onPdfRequestMessage = (event: MessageEvent) => {
      const message = event.data as EmbeddedMessage;
      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        return;
      }

      if (message.type !== EMBED_COMMANDS.SAVE_PDF && message.type !== EMBED_COMMANDS.REQUEST_PDF) {
        return;
      }

      buildPdfReturnPayload()
        .then((payload) => {
          const responseType = message.type === EMBED_COMMANDS.REQUEST_PDF
            ? EMBED_COMMANDS.PDF_READY
            : EMBED_COMMANDS.PDF_SAVED;
          postHostMessage(responseType, payload, message.requestId);
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF payload.';
          postHostMessage(EMBED_COMMANDS.ERROR, { message: errorMessage }, message.requestId);
        });
    };

    window.addEventListener('message', onPdfRequestMessage);
    return () => {
      window.removeEventListener('message', onPdfRequestMessage);
    };
  }, [buildPdfReturnPayload]);

  useEffect(() => {
    if (!(window as any).fabricDesignToolBridge) return;

    (window as any).fabricDesignToolBridge.savePdf = buildPdfReturnPayload;
    (window as any).fabricDesignToolBridge.requestPdf = buildPdfReturnPayload;
  }, [buildPdfReturnPayload]);

  // Alignment function
  const handleAlignObjects = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const aligner = getCanvasAligner();
    if (aligner) {
      aligner.align(alignment);
    }
  };

  // Group/Ungroup functions
  const handleGroupObjects = () => {
    const groupManager = getGroupManager();
    if (groupManager) {
      groupManager.groupObjects();
    }
  };

  const handleUngroupObjects = () => {
    const groupManager = getGroupManager();
    if (groupManager) {
      groupManager.ungroupObjects();
    }
  };

  const handleImportJSON = useCallback(async (payload: unknown) => {
    await applyExternalProject(payload);
  }, [applyExternalProject]);

  useEffect(() => {
    const closePanelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobilePanel('none');
      }
    };

    document.addEventListener('keydown', closePanelOnEscape);
    return () => {
      document.removeEventListener('keydown', closePanelOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!canvasState.selectedObject) return;
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 1280) return;
    setMobilePanel('properties');
  }, [canvasState.selectedObject]);

  useEffect(() => {
    if (!isDraggingMobilePanel || !isMobilePanelFloating) return;

    const flushPendingPosition = () => {
      mobilePanelRafRef.current = null;
      if (!pendingPanelPositionRef.current) return;
      setMobilePanelPosition(pendingPanelPositionRef.current);
      pendingPanelPositionRef.current = null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const panel = floatingPanelRef.current;
      const panelWidth = panel?.offsetWidth ?? 320;
      const panelHeight = panel?.offsetHeight ?? 360;

      const minX = 8;
      const maxX = Math.max(minX, window.innerWidth - panelWidth - 8);
      const minY = 56;
      const maxY = Math.max(minY, window.innerHeight - panelHeight - 8);

      const nextX = Math.min(maxX, Math.max(minX, event.clientX - mobilePanelDragOffsetRef.current.x));
      const nextY = Math.min(maxY, Math.max(minY, event.clientY - mobilePanelDragOffsetRef.current.y));

      pendingPanelPositionRef.current = { x: nextX, y: nextY };
      if (mobilePanelRafRef.current === null) {
        mobilePanelRafRef.current = window.requestAnimationFrame(flushPendingPosition);
      }
    };

    const handlePointerUp = () => {
      if (mobilePanelRafRef.current !== null) {
        window.cancelAnimationFrame(mobilePanelRafRef.current);
        mobilePanelRafRef.current = null;
      }

      const panel = floatingPanelRef.current;
      const panelWidth = panel?.offsetWidth ?? 320;
      const panelHeight = panel?.offsetHeight ?? 360;
      const minX = 8;
      const maxX = Math.max(minX, window.innerWidth - panelWidth - 8);
      const minY = 56;
      const maxY = Math.max(minY, window.innerHeight - panelHeight - 8);

      const currentPosition = pendingPanelPositionRef.current ?? mobilePanelPosition;
      pendingPanelPositionRef.current = null;

      const distLeft = Math.abs(currentPosition.x - minX);
      const distRight = Math.abs(maxX - currentPosition.x);
      const distTop = Math.abs(currentPosition.y - minY);
      const distBottom = Math.abs(maxY - currentPosition.y);

      const nearest = Math.min(distLeft, distRight, distTop, distBottom);

      const snappedPosition = { ...currentPosition };
      if (nearest === distLeft) snappedPosition.x = minX;
      else if (nearest === distRight) snappedPosition.x = maxX;
      else if (nearest === distTop) snappedPosition.y = minY;
      else snappedPosition.y = maxY;

      setMobilePanelPosition(snappedPosition);
      setIsDraggingMobilePanel(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);

    return () => {
      if (mobilePanelRafRef.current !== null) {
        window.cancelAnimationFrame(mobilePanelRafRef.current);
        mobilePanelRafRef.current = null;
      }
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDraggingMobilePanel, isMobilePanelFloating, mobilePanelPosition]);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Header 
        selectedTool={selectedTool}
        onToolSelect={setSelectedTool}
        onAddText={addText}
        onAddRectangle={addRectangle}
        onAddLine={addLine}
        onAddImage={addImage}
        onAddCircle={addCircle}
        onAddTriangle={addTriangle}
        onAddPentagon={addPentagon}
        onAddHexagon={addHexagon}
        onAddStar={addStar}
        onAddEllipse={addEllipse}
        onAddArrow={addArrow}
        onAddRoundedRectangle={addRoundedRectangle}
        onAddDiamond={addDiamond}
        onAddHeart={addHeart}
        onAddCloud={addCloud}
        onAddLightning={addLightning}
        onAddSpeechBubble={addSpeechBubble}
        onAddCross={addCross}
        onAddParallelogram={addParallelogram}
        onAddTrapezoid={addTrapezoid}
        onAddOctagonShape={addOctagonShape}
        onAddQRCode={handleOpenQRCodeDialog}
        onSave={handleSaveForParent}
        onExport={handleExport}
        onImportJSON={handleImportJSON}
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
        showModeToggle={showModeToggle}
        showActionButtons={showModeToggle}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onAlignObjects={handleAlignObjects}
        onGroupObjects={handleGroupObjects}
        onUngroupObjects={handleUngroupObjects}
        canGroup={canGroup}
        canUngroup={canUngroup}
      />

      <div className="xl:hidden border-b border-gray-200 bg-white px-2 py-2">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setMobilePanel(prev => prev === 'layers' ? 'none' : 'layers')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mobilePanel === 'layers' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-700'}`}
          >
            Layers
          </button>
          <button
            onClick={() => setMobilePanel(prev => prev === 'properties' ? 'none' : 'properties')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mobilePanel === 'properties' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-700'}`}
          >
            Properties
          </button>
          <button
            onClick={() => setMobilePanel(prev => prev === 'canvases' ? 'none' : 'canvases')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mobilePanel === 'canvases' ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-700'}`}
          >
            Canvases
          </button>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden xl:block">
          <LeftSidebar 
            objects={canvasObjects}
            selectedObjectId={selectedLayerObjectId}
            onSelectObject={selectObject}
            onToggleVisibility={toggleObjectVisibility}
            onDeleteObject={deleteObject}
            onReorderObjects={reorderObjects}
            onRenameObject={renameObject}
            className="w-64"
          />
        </div>
        
        <div className="flex-1 flex flex-col relative">
          <CanvasWrapper 
            canvasRef={canvasRef}
            canvas={canvasState.canvas}
            zoom={canvasState.zoom}
            editorMode={editorMode}
            mockup={activeCanvasMockup}
            showSafeArea={safeAreaVisible}
            showTrimArea={trimAreaVisible}
            fitToScreenRequest={fitToScreenRequest}
            canvasDimensions={canvasDimensions}
            onZoomChange={(zoom: number) => setCanvasState(prev => ({ ...prev, zoom }))}
            onCanvasDimensionsChange={updateCanvasDimensionsFromCanvas}
            onMockupChange={updateActiveCanvasMockup}
          />
          
          <BottomToolbar 
            zoom={canvasState.zoom}
            onZoomChange={(zoom: number) => setCanvasState(prev => ({ ...prev, zoom }))}
            onFitToScreen={() => setFitToScreenRequest(prev => prev + 1)}
            safeAreaVisible={safeAreaVisible}
            onToggleSafeArea={setSafeAreaVisible}
            trimAreaVisible={trimAreaVisible}
            onToggleTrimArea={setTrimAreaVisible}
            onToggleCanvasLayer={toggleCanvasLayer}
            currentLayer={currentCanvasLayer}
            canvasSwitchingEnabled={canvasSwitchingEnabled}
            onToggleCanvasSwitching={handleToggleCanvasSwitching}
            editorMode={editorMode}
            showCanvasTabs={false}
            canvases={canvasDocuments.map(doc => ({ id: doc.id, name: doc.name }))}
            activeCanvasId={activeCanvasId}
            onSwitchCanvas={(canvasId: string) => {
              void handleSwitchCanvas(canvasId);
            }}
            onRenameCanvas={handleCanvasNameChange}
            onShowKeyboardShortcuts={() => setIsKeyboardShortcutsModalOpen(true)}
          />

          {canvasDocuments.length > 0 && (
            <div className="absolute top-4 right-4 z-20 hidden xl:block w-44 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-2">
              <div className="px-1 pb-2 text-xs font-medium text-gray-500">Canvases</div>
              <div className="max-h-[58vh] overflow-y-auto space-y-2">
                {canvasDocuments.map((doc) => {
                  const isActive = activeCanvasId === doc.id;
                  const isEditing = editorMode === 'dev' && editingFloatingCanvasId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      className={`w-full rounded-lg border p-1.5 transition-colors ${
                        isActive
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <button
                        onClick={() => {
                          void handleSwitchCanvas(doc.id);
                        }}
                        className="w-full text-left"
                      >
                        <div className="w-full aspect-[3/2] overflow-hidden rounded border border-gray-200 bg-gray-100 mb-1.5">
                          {canvasThumbnails[doc.id] ? (
                            <img
                              src={canvasThumbnails[doc.id]}
                              alt={`${doc.name} preview`}
                              className="w-full h-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">Preview</div>
                          )}
                        </div>
                      </button>

                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingFloatingCanvasName}
                          onChange={(e) => setEditingFloatingCanvasName(e.target.value)}
                          onBlur={commitFloatingCanvasRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              commitFloatingCanvasRename();
                            }
                            if (e.key === 'Escape') {
                              cancelFloatingCanvasRename();
                            }
                          }}
                          className="w-full px-1.5 py-1 text-xs border border-cyan-400 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      ) : (
                        <div
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            startFloatingCanvasRename(doc.id, doc.name);
                          }}
                          className={`text-xs font-medium truncate ${isActive ? 'text-cyan-700' : 'text-gray-700'}`}
                          title={editorMode === 'dev' ? `${doc.name} (double-click to rename)` : doc.name}
                        >
                          {doc.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        <div className="hidden xl:block">
          <RightSidebar 
            selectedObject={canvasState.selectedObject}
            canvas={canvasState.canvas}
            canvasDimensions={canvasDimensions}
            updateCanvasObjects={updateCanvasObjects}
            updateCanvasDimensions={updateCanvasDimensions}
            canvasCount={canvasDocuments.length}
            onCanvasCountChange={handleCanvasCountChange}
            canvasFormat={canvasFormat}
            onCanvasFormatChange={handleCanvasFormatChange}
            editorMode={editorMode}
            updateQRCodeColors={updateQRCodeColors}
            onLockStateChange={() => persistActiveCanvas()}
            mockup={activeCanvasMockup}
            onMockupChange={updateActiveCanvasMockup}
            onObjectUpdate={updateCanvasObjects}
            alignmentGuides={alignmentGuides}
            className="w-80"
          />
        </div>
      </div>

      {mobilePanel !== 'none' && (
        <div className="xl:hidden fixed inset-0 z-40 pointer-events-none">
          <div
            ref={floatingPanelRef}
            className={`pointer-events-auto border border-gray-200 backdrop-blur-sm shadow-2xl overflow-hidden transition-opacity duration-150 ${isMobilePanelFloating ? `absolute rounded-xl max-h-[62vh] ${isDraggingMobilePanel ? '' : 'transition-[left,top] duration-200 ease-out'}` : 'absolute inset-x-0 bottom-0 mx-2 mb-2 rounded-t-2xl max-h-[52vh]'} ${isMobilePanelInteracting ? 'bg-white/80 opacity-85' : 'bg-white/95 opacity-100'}`}
            style={isMobilePanelFloating ? {
              left: `${mobilePanelPosition.x}px`,
              top: `${mobilePanelPosition.y}px`,
              width: 'min(380px, calc(100vw - 16px))',
            } : undefined}
            onPointerDownCapture={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest('input, select, textarea, button, [role="slider"]')) {
                setIsMobilePanelInteracting(true);
              }
            }}
            onPointerUpCapture={() => setIsMobilePanelInteracting(false)}
            onPointerCancel={() => setIsMobilePanelInteracting(false)}
          >
            <div
              className={`flex items-center justify-between px-4 py-3 border-b border-gray-200 ${isMobilePanelFloating ? 'cursor-move' : ''}`}
              style={isMobilePanelFloating ? { touchAction: 'none', userSelect: 'none' } : undefined}
              onPointerDown={(event) => {
                if (!isMobilePanelFloating) return;
                const target = event.target as HTMLElement;
                if (target.closest('button, input, select, textarea')) return;

                event.preventDefault();
                mobilePanelDragOffsetRef.current = {
                  x: event.clientX - mobilePanelPosition.x,
                  y: event.clientY - mobilePanelPosition.y,
                };
                setIsDraggingMobilePanel(true);
              }}
            >
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                {mobilePanel === 'layers' && 'Layers'}
                {mobilePanel === 'properties' && 'Properties'}
                {mobilePanel === 'canvases' && 'Canvases'}
                {isMobilePanelFloating && <span className="text-xs text-gray-400">Drag</span>}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setIsMobilePanelFloating(prev => !prev);
                    setIsDraggingMobilePanel(false);
                  }}
                  className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                  title={isMobilePanelFloating ? 'Dock panel to bottom' : 'Float panel and drag anywhere'}
                >
                  {isMobilePanelFloating ? 'Dock' : 'Float'}
                </button>
                <button
                  onClick={() => setMobilePanel('none')}
                  className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
                >
                  Close
                </button>
              </div>
            </div>

            {mobilePanel === 'layers' && (
              <div className="h-[calc(52vh-57px)]">
                <LeftSidebar 
                  objects={canvasObjects}
                  selectedObjectId={selectedLayerObjectId}
                  onSelectObject={(objectId) => {
                    selectObject(objectId);
                  }}
                  onToggleVisibility={toggleObjectVisibility}
                  onDeleteObject={deleteObject}
                  onReorderObjects={reorderObjects}
                  onRenameObject={renameObject}
                  className="w-full"
                />
              </div>
            )}

            {mobilePanel === 'properties' && (
              <div className="h-[calc(52vh-57px)]">
                <RightSidebar 
                  selectedObject={canvasState.selectedObject}
                  canvas={canvasState.canvas}
                  canvasDimensions={canvasDimensions}
                  updateCanvasObjects={updateCanvasObjects}
                  updateCanvasDimensions={updateCanvasDimensions}
                  canvasCount={canvasDocuments.length}
                  onCanvasCountChange={handleCanvasCountChange}
                  canvasFormat={canvasFormat}
                  onCanvasFormatChange={handleCanvasFormatChange}
                  editorMode={editorMode}
                  updateQRCodeColors={updateQRCodeColors}
                  onLockStateChange={() => persistActiveCanvas()}
                  mockup={activeCanvasMockup}
                  onMockupChange={updateActiveCanvasMockup}
                  onObjectUpdate={updateCanvasObjects}
                  alignmentGuides={alignmentGuides}
                  className="w-full"
                />
              </div>
            )}

            {mobilePanel === 'canvases' && (
              <div className="h-[calc(52vh-57px)] overflow-y-auto p-4 space-y-3">
                {canvasDocuments.map((doc) => {
                  const isActive = activeCanvasId === doc.id;
                  const isEditing = editorMode === 'dev' && editingFloatingCanvasId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      className={`w-full rounded-lg border p-2 transition-colors ${
                        isActive
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <button
                        onClick={() => {
                          void handleSwitchCanvas(doc.id);
                          setMobilePanel('none');
                        }}
                        className="w-full text-left"
                      >
                        <div className="w-full aspect-[3/2] overflow-hidden rounded border border-gray-200 bg-gray-100 mb-2">
                          {canvasThumbnails[doc.id] ? (
                            <img
                              src={canvasThumbnails[doc.id]}
                              alt={`${doc.name} preview`}
                              className="w-full h-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Preview</div>
                          )}
                        </div>
                      </button>

                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingFloatingCanvasName}
                          onChange={(e) => setEditingFloatingCanvasName(e.target.value)}
                          onBlur={commitFloatingCanvasRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              commitFloatingCanvasRename();
                            }
                            if (e.key === 'Escape') {
                              cancelFloatingCanvasRename();
                            }
                          }}
                          className="w-full px-1.5 py-1 text-sm border border-cyan-400 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      ) : (
                        <div
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            startFloatingCanvasRename(doc.id, doc.name);
                          }}
                          className={`text-sm font-medium truncate ${isActive ? 'text-cyan-700' : 'text-gray-700'}`}
                          title={editorMode === 'dev' ? `${doc.name} (double-click to rename)` : doc.name}
                        >
                          {doc.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Code Dialog */}
      <QRCodeDialog
        isOpen={isQRCodeDialogOpen}
        onClose={handleCloseQRCodeDialog}
        onGenerate={handleGenerateQRCode}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isKeyboardShortcutsModalOpen}
        onClose={() => setIsKeyboardShortcutsModalOpen(false)}
        shortcuts={keyboardShortcuts?.getShortcuts() || []}
      />
    </div>
  );
}

export default App;
